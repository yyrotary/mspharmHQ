import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 급여 계산
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
    const { employee_id, pay_period_start, pay_period_end, payment_date } = body;

    if (!employee_id || !pay_period_start || !pay_period_end) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 1. 직원 급여 정보 조회
    const { data: salary, error: salaryError } = await supabase
      .from('salaries')
      .select('*')
      .eq('employee_id', employee_id)
      .lte('effective_from', pay_period_end)
      .or(`effective_to.is.null,effective_to.gte.${pay_period_start}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    // 1-1. 직원 고용 형태 조회
    const { data: employeeData, error: empError } = await supabase
      .from('employees')
      .select('employment_type')
      .eq('id', employee_id)
      .single();

    if (salaryError || !salary) {
      return NextResponse.json(
        { error: '직원의 급여 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 해당 기간 근태 기록 조회
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('work_date', pay_period_start)
      .lte('work_date', pay_period_end);

    if (attendanceError) {
      console.error('Attendance fetch error:', attendanceError);
      return NextResponse.json(
        { error: '근태 기록 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 3. 근무 통계 계산
    const totalWorkDays = attendance.filter(a => a.status === 'present').length;
    const totalWorkHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    const totalOvertimeHours = attendance.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);
    const totalNightHours = attendance.reduce((sum, a) => sum + (parseFloat(a.night_hours) || 0), 0);
    const holidayWorkHours = attendance
      .filter(a => a.is_holiday)
      .reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);

    // 4. 급여 계산
    let baseSalary = parseFloat(salary.base_salary);
    const hourlyRate = salary.hourly_rate
      ? parseFloat(salary.hourly_rate)
      : baseSalary / 209; // 월 209시간 기준

    // 고용 형태가 파트타임이거나 기본급이 0인 경우: 시급 * 근무시간을 기본급으로 사용
    const isPartTime = employeeData?.employment_type === 'part_time';

    if (isPartTime || baseSalary === 0) {
      // 기본급이 0이면 (또는 파트타임이면) 시급 계산
      baseSalary = Math.round((hourlyRate || 0) * totalWorkHours);
    }

    // 수당 계산 함수
    const calculateAllowance = (hours: number, rateValue: any, defaultMultiplier: number) => {
      const rate = parseFloat(rateValue) || defaultMultiplier;
      // 10보다 크면 고정 금액으로 간주 (예: 13500)
      if (rate > 10) {
        return hours * rate;
      }
      // 10 이하이면 배율로 간주 (예: 1.5)
      return hours * hourlyRate * rate;
    };

    const overtimePay = calculateAllowance(totalOvertimeHours, salary.overtime_rate, 1.5);
    const nightShiftPay = calculateAllowance(totalNightHours, salary.night_shift_rate, 1.5);
    const holidayPay = calculateAllowance(holidayWorkHours, salary.holiday_rate, 2.0);

    // 총 지급액 (세전)
    const grossPay = baseSalary + overtimePay + nightShiftPay + holidayPay;

    // 5. 4대보험 및 세금 계산
    const nationalPension = Math.round(grossPay * 0.045); // 국민연금 4.5%
    const healthInsurance = Math.round(grossPay * 0.03545); // 건강보험 3.545%
    const longTermCare = Math.round(healthInsurance * 0.1281); // 장기요양 12.81%
    const employmentInsurance = Math.round(grossPay * 0.009); // 고용보험 0.9%

    // 소득세 간이세액표 (간략화)
    const incomeTax = calculateIncomeTax(grossPay);
    const residentTax = Math.round(incomeTax * 0.1); // 주민세 10%

    // 총 공제액
    const totalDeductions = nationalPension + healthInsurance + longTermCare +
      employmentInsurance + incomeTax + residentTax;

    // 실수령액
    const netPay = grossPay - totalDeductions;

    // 6. 급여 레코드 생성
    const { data: payroll, error: payrollError } = await supabase
      .from('payroll')
      .insert({
        employee_id,
        pay_period_start,
        pay_period_end,
        payment_date: payment_date || new Date(pay_period_end).toISOString().split('T')[0],
        base_salary: baseSalary,
        overtime_pay: overtimePay,
        night_shift_pay: nightShiftPay,
        holiday_pay: holidayPay,
        bonus: 0,
        allowances: 0,
        gross_pay: grossPay,
        income_tax: incomeTax,
        resident_tax: residentTax,
        national_pension: nationalPension,
        health_insurance: healthInsurance,
        long_term_care: longTermCare,
        employment_insurance: employmentInsurance,
        other_deductions: 0,
        total_deductions: totalDeductions,
        net_pay: netPay,
        total_work_days: totalWorkDays,
        total_work_hours: totalWorkHours,
        total_overtime_hours: totalOvertimeHours,
        status: 'draft',
        calculated_by: user.id,
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
      data: payroll
    });

  } catch (error) {
    console.error('Payroll calculation error:', error);
    return NextResponse.json(
      { error: '급여 계산 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 소득세 간이세액표 (간략화 버전)
function calculateIncomeTax(grossPay: number): number {
  if (grossPay < 1060000) return 0;
  if (grossPay < 1500000) return Math.round((grossPay - 1060000) * 0.06);
  if (grossPay < 2000000) return Math.round(26400 + (grossPay - 1500000) * 0.15);
  if (grossPay < 4500000) return Math.round(101400 + (grossPay - 2000000) * 0.24);
  if (grossPay < 8800000) return Math.round(701400 + (grossPay - 4500000) * 0.35);
  return Math.round(2206400 + (grossPay - 8800000) * 0.38);
}
