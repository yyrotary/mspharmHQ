import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 2026년 급여 자동 계산 (Net/Gross 대응)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 급여 계산 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '급여 계산 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      employee_id,
      pay_period_start,
      pay_period_end,
      payment_date,
      bonus = 0,
      special_allowance = 0,
      status = 'draft',
      notes = '',
    } = body;

    // 디버깅 로그
    console.log('급여 계산 요청:', {
      employee_id,
      pay_period: `${pay_period_start} ~ ${pay_period_end}`,
      bonus,
      special_allowance,
      status,
    });

    if (!employee_id || !pay_period_start || !pay_period_end) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 1. 직원 정보 조회 (salary_type, dependent_count)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, name, salary_type, dependent_count')
      .eq('id', employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: '직원 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 급여 정보 조회
    let salary = null;
    
    // 먼저 해당 기간에 유효한 급여 정보를 찾기
    const { data: salaryData, error: salaryError } = await supabase
      .from('salaries')
      .select('*')
      .eq('employee_id', employee_id)
      .lte('effective_from', pay_period_end)
      .or(`effective_to.is.null,effective_to.gte.${pay_period_start}`)
      .order('effective_from', { ascending: false })
      .limit(1);

    if (salaryData && salaryData.length > 0) {
      salary = salaryData[0];
    } else {
      // 유효한 급여 정보가 없으면 가장 최근 급여 정보 사용
      console.log(`급여 기간 내 정보 없음, 가장 최근 정보 조회: employee_id=${employee_id}`);
      const { data: latestSalary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employee_id)
        .order('effective_from', { ascending: false })
        .limit(1);
      
      if (latestSalary && latestSalary.length > 0) {
        salary = latestSalary[0];
        console.log(`가장 최근 급여 정보 사용: effective_from=${salary.effective_from}`);
      }
    }

    // 급여 정보가 전혀 없으면 employees 테이블의 기본 정보 사용
    if (!salary) {
      console.log(`salaries 테이블에 정보 없음, employees 테이블 확인: employee_id=${employee_id}`);
      const { data: empSalaryInfo } = await supabase
        .from('employees')
        .select('base_salary, hourly_rate, salary_type')
        .eq('id', employee_id)
        .single();
      
      if (empSalaryInfo && (empSalaryInfo.base_salary || empSalaryInfo.hourly_rate)) {
        // employees 테이블의 정보로 임시 salary 객체 생성
        salary = {
          employee_id: employee_id,
          base_salary: empSalaryInfo.base_salary || (empSalaryInfo.hourly_rate * 209),
          hourly_rate: empSalaryInfo.hourly_rate || (empSalaryInfo.base_salary / 209),
          meal_allowance: 200000, // 기본값
          car_allowance: 0,
          childcare_allowance: 0,
          overtime_rate: 1.5,
          night_shift_rate: 1.5,
          holiday_rate: 2.0,
          fixed_overtime_pay: 0,
          effective_from: pay_period_start,
          effective_to: null,
        };
        console.log('employees 테이블 정보로 임시 급여 객체 생성:', salary);
      }
    }

    if (!salary) {
      return NextResponse.json(
        { error: '직원의 급여 정보를 찾을 수 없습니다. employees 또는 salaries 테이블에 급여 정보를 입력해주세요.' },
        { status: 404 }
      );
    }

    // 3. 근태 기록 조회
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('work_date', pay_period_start)
      .lte('work_date', pay_period_end)
      .eq('status', 'present');

    if (attendanceError) {
      console.error('Attendance fetch error:', attendanceError);
      return NextResponse.json(
        { error: '근태 기록 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 4. 근무 통계 계산
    const totalWorkDays = attendance?.length || 0;
    const totalWorkHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0) || 0;
    const totalOvertimeHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0) || 0;
    const totalNightHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.night_hours) || 0), 0) || 0;
    const holidayWorkHours = attendance?.filter(a => a.is_holiday).reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0) || 0;

    // 5. 비과세 항목 계산
    // 식대는 기본급에 포함되어 있으므로 별도 지급하지 않음
    // 하지만 과세소득 계산 시에는 공제됨
    const mealAllowance = parseFloat(salary.meal_allowance) || 0;
    const carAllowance = parseFloat(salary.car_allowance) || 0;
    const childcareAllowance = parseFloat(salary.childcare_allowance) || 0;
    const totalNonTaxable = mealAllowance + carAllowance + childcareAllowance;

    // 6. 기본급 및 수당 계산
    const baseSalary = parseFloat(salary.base_salary) || 0;
    const hourlyRate = salary.hourly_rate 
      ? parseFloat(salary.hourly_rate)
      : (baseSalary > 0 ? baseSalary / 209 : 0); // 월 209시간 기준
    
    // 파트타임 여부 판정: base_salary가 0이고 hourly_rate가 있으면 파트타임
    const isPartTime = baseSalary === 0 && hourlyRate > 0;

    // 파트타임의 경우: 근무시간 x 시급
    // 정규직의 경우: 기본급 (고정)
    let actualBasePay = 0;
    if (isPartTime) {
      // 파트타임: 실제 근무시간 × 시급
      actualBasePay = totalWorkHours * hourlyRate;
    } else {
      // 정규직: 기본급 (고정)
      actualBasePay = baseSalary;
    }

    // 수당 계산 (파트타임도 연장/야간/휴일 수당 적용)
    const overtimePay = totalOvertimeHours * hourlyRate * (parseFloat(salary.overtime_rate) || 1.5);
    const nightShiftPay = totalNightHours * hourlyRate * (parseFloat(salary.night_shift_rate) || 1.5);
    const holidayPay = holidayWorkHours * hourlyRate * (parseFloat(salary.holiday_rate) || 2.0);
    
    // 주휴 수당 계산 (파트타임 직원만 해당)
    // 주 15시간 이상 근무 시 주휴 수당 지급
    let weeklyHolidayPay = 0;
    if (isPartTime) {
      const weeksInPeriod = attendance?.length > 0 ? Math.ceil(attendance.length / 7) : 0;
      const avgWeeklyHours = weeksInPeriod > 0 ? totalWorkHours / weeksInPeriod : 0;
      
      if (avgWeeklyHours >= 15) {
        // 주휴 수당 = (1주 총 근무시간 / 근무일수) * 1일 * 주수
        const avgDailyHours = totalWorkDays > 0 ? totalWorkHours / totalWorkDays : 0;
        weeklyHolidayPay = avgDailyHours * hourlyRate * weeksInPeriod;
      }
    }
    
    // 고정 OT: special_allowance(입력값)가 있으면 사용, 없으면 DB 저장값 사용
    const finalFixedOvertimePay = parseFloat(special_allowance) || parseFloat(salary.fixed_overtime_pay) || 0;
    
    console.log('급여 계산:', {
      isPartTime,
      baseSalary,
      actualBasePay,
      hourlyRate,
      totalWorkHours,
      totalWorkDays,
      special_allowance_input: special_allowance,
      db_fixed_overtime_pay: salary.fixed_overtime_pay,
      final_fixed_overtime_pay: finalFixedOvertimePay,
      weeklyHolidayPay
    });

    let grossPay = 0;
    let netTarget = 0;
    let grossCalculated = 0;

    // 7. Gross/Net 계약 타입에 따라 계산 분기
    // 식대는 기본급에 이미 포함되어 있으므로, 차량/자녀수당만 별도 지급
    const separateNonTaxable = carAllowance + childcareAllowance;

    if (employee.salary_type === 'net') {
      // Net 계약: 세후 실수령액 고정 → 세전 역산
      // 파트타임은 Net 계약을 사용하지 않음 (근무시간에 따라 변동)
      netTarget = actualBasePay; // Net 계약의 경우 실제 급여가 실수령액
      
      // Net-to-Gross 역산 함수 호출
      const { data: grossResult, error: grossError } = await supabase
        .rpc('calculate_gross_from_net_2026', {
          p_net_target: netTarget,
          p_non_taxable: totalNonTaxable,
          p_dependent_count: employee.dependent_count || 1,
        });

      if (grossError) {
        console.error('Gross calculation error:', grossError);
        return NextResponse.json(
          { error: 'Net-to-Gross 역산에 실패했습니다' },
          { status: 500 }
        );
      }

      grossCalculated = grossResult;
      // 식대는 기본급에 포함, 차량/자녀수당만 별도 지급
      grossPay = grossCalculated + separateNonTaxable + overtimePay + nightShiftPay + holidayPay + weeklyHolidayPay + bonus + finalFixedOvertimePay;
      
    } else {
      // Gross 계약: 세전 금액 직접 계산
      // 파트타임: 근무시간 × 시급 + 주휴수당 + 기타수당
      // 정규직: 기본급 + 기타수당
      grossPay = actualBasePay + separateNonTaxable + overtimePay + nightShiftPay + holidayPay + weeklyHolidayPay + bonus + finalFixedOvertimePay;
    }

    // Gross Pay 계산 로그
    console.log('Gross Pay 계산:', {
      isPartTime,
      baseSalary_fixed: baseSalary,
      actualBasePay_calculated: actualBasePay,
      mealAllowance_included: mealAllowance,
      separateNonTaxable_carChild: separateNonTaxable,
      totalNonTaxable_forTaxCalc: totalNonTaxable,
      overtimePay,
      nightShiftPay,
      holidayPay,
      weeklyHolidayPay,
      bonus,
      finalFixedOvertimePay,
      grossPay,
    });

    // 8. 과세 소득 계산
    const taxableIncome = grossPay - totalNonTaxable;

    // 9. 4대보험 계산 (Supabase 함수 호출)
    const { data: nationalPension } = await supabase
      .rpc('calculate_national_pension_2026', { p_taxable_income: taxableIncome });
    
    const { data: healthInsurance } = await supabase
      .rpc('calculate_health_insurance_2026', { p_taxable_income: taxableIncome });
    
    const { data: longTermCare } = await supabase
      .rpc('calculate_long_term_care_2026', { p_health_insurance: healthInsurance });
    
    const { data: employmentInsurance } = await supabase
      .rpc('calculate_employment_insurance_2026', { p_taxable_income: taxableIncome });

    // 10. 소득세 계산
    const { data: incomeTax } = await supabase
      .rpc('calculate_income_tax_2026', {
        p_taxable_income: taxableIncome,
        p_dependent_count: employee.dependent_count || 1,
      });

    const residentTax = Math.round((incomeTax || 0) * 0.1);

    // 11. 총 공제액 및 실수령액
    const totalDeductions = (nationalPension || 0) + (healthInsurance || 0) + (longTermCare || 0) + 
                           (employmentInsurance || 0) + (incomeTax || 0) + residentTax;
    const netPay = grossPay - totalDeductions;

    // 12. 최저임금 체크
    const { data: minimumWageCheck } = await supabase
      .rpc('check_minimum_wage_2026', {
        p_total_pay: actualBasePay,
        p_work_hours: totalWorkHours || 209,
      });

    // 13. 급여 레코드 생성 또는 업데이트 (UPSERT)
    const { data: payroll, error: payrollError } = await supabase
      .from('payroll')
      .upsert({
        employee_id,
        pay_period_start,
        pay_period_end,
        payment_date: payment_date || new Date(pay_period_end).toISOString().split('T')[0],
        
        // 급여 구성
        base_salary: actualBasePay, // 파트타임: 근무시간×시급, 정규직: 고정 기본급
        overtime_pay: overtimePay,
        night_shift_pay: nightShiftPay,
        holiday_pay: holidayPay,
        bonus: bonus,
        allowances: finalFixedOvertimePay, // 고정 OT (입력값 우선, 없으면 DB 저장값)
        weekly_holiday_pay: weeklyHolidayPay, // 주휴수당 (파트타임만)
        
        // 비과세
        meal_allowance: mealAllowance,
        car_allowance: carAllowance,
        childcare_allowance: childcareAllowance,
        total_non_taxable: totalNonTaxable,
        
        // 세전/과세소득
        gross_pay: grossPay,
        taxable_income: taxableIncome,
        
        // Net 계약 정보
        salary_type: employee.salary_type,
        net_target: employee.salary_type === 'net' ? netTarget : null,
        gross_calculated: employee.salary_type === 'net' ? grossCalculated : null,
        
        // 공제 항목
        income_tax: incomeTax || 0,
        resident_tax: residentTax,
        national_pension: nationalPension || 0,
        health_insurance: healthInsurance || 0,
        long_term_care: longTermCare || 0,
        employment_insurance: employmentInsurance || 0,
        other_deductions: 0,
        
        // 총 공제액 및 실수령액
        total_deductions: totalDeductions,
        net_pay: netPay,
        
        // 근무 시간
        total_work_days: totalWorkDays,
        total_work_hours: totalWorkHours,
        total_overtime_hours: totalOvertimeHours,
        
        // 최저임금 체크
        minimum_wage_check: minimumWageCheck || false,
        minimum_wage_month: 2156880,
        
        status: status,
        notes: weeklyHolidayPay > 0 
          ? `${notes ? notes + '\n' : ''}주휴 수당: ${Math.round(weeklyHolidayPay).toLocaleString()}원`
          : notes,
        calculated_by: user.id,
      }, {
        onConflict: 'employee_id,pay_period_start,pay_period_end',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (payrollError) {
      console.error('Payroll insert error:', payrollError);
      return NextResponse.json(
        { error: '급여 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '급여가 계산되었습니다',
      data: {
        ...payroll,
        employee_name: employee.name,
        weekly_holiday_pay: weeklyHolidayPay, // 주휴 수당 별도 전달
        warning: !minimumWageCheck ? '⚠️ 최저임금 미달' : null,
      }
    });

  } catch (error) {
    console.error('Payroll calculation error:', error);
    return NextResponse.json(
      { error: '급여 계산 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
