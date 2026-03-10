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
    // const user = { role: 'owner', id: 'debug-user' }; // Mock user
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
    // DEBUG: Use Service Role Key directly to bypass RLS in test script
    // const { createClient } = require('@supabase/supabase-js');
    // const supabase = createClient(
    //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //   process.env.SUPABASE_SERVICE_ROLE_KEY!
    // );

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
        { error: '근태 기록 조회에 실패했습니다', details: attendanceError, env: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Key Exists' : 'Key Missing' },
        { status: 500 }
      );
    }

    // 3. 근무 통계 계산
    const totalWorkDays = attendance.filter(a => a.status === 'present').length;
    const isFullTime = employeeData?.employment_type === 'full_time';

    // 정규직(full_time)의 경우: work_hours 필드는 "추가근무" 시간임 (기본 8시간은 별도)
    // 파트타임의 경우: work_hours 필드는 실제 근무한 총 시간
    let totalWorkHours = 0;
    let totalOvertimeHours = 0;
    let holidayWorkHours = 0;

    if (isFullTime) {
      // 정규직: work_hours = 추가근무, overtime_hours도 추가로 합산
      totalOvertimeHours = attendance.reduce((sum, a) => {
        const workHrs = parseFloat(a.work_hours) || 0;
        const otHrs = parseFloat(a.overtime_hours) || 0;
        return sum + workHrs + otHrs; // Both are overtime for regular employees
      }, 0);

      // 휴일 근무도 추가근무로 계산 (work_hours + overtime_hours)
      holidayWorkHours = attendance
        .filter(a => a.is_holiday)
        .reduce((sum, a) => {
          const workHrs = parseFloat(a.work_hours) || 0;
          const otHrs = parseFloat(a.overtime_hours) || 0;
          return sum + workHrs + otHrs;
        }, 0);

      // 정규직은 기본 근무시간 계산 불필요 (월급제)
      totalWorkHours = 0;
    } else {
      // 파트타임: work_hours = 실제 근무 시간
      totalWorkHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
      totalOvertimeHours = attendance.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);

      holidayWorkHours = attendance
        .filter(a => a.is_holiday)
        .reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    }

    const weekdayWorkHours = totalWorkHours - holidayWorkHours;
    const totalNightHours = attendance.reduce((sum, a) => sum + (parseFloat(a.night_hours) || 0), 0);

    // 4. 급여 계산
    let rawBaseSalary = parseFloat(salary.base_salary);
    const hourlyRate = salary.hourly_rate
      ? parseFloat(salary.hourly_rate)
      : rawBaseSalary / 209;

    // 고정 OT 금액 확인 (없으면 0)
    const fixedOvertimePay = parseFloat(salary.fixed_overtime_pay) || 0;

    // 화면 표시용 기본급 계산
    let baseSalary = rawBaseSalary;

    if (isFullTime) {
      // 정규직: 기본급에서 고정 OT 차감하여 순수 기본급 표시
      baseSalary = Math.max(rawBaseSalary - fixedOvertimePay, 0);
    } else {
      // 파트타임: 시급 * 근무시간
      baseSalary = Math.round((hourlyRate || 0) * weekdayWorkHours);
    }

    // 수당 계산 함수 (무조건 고정 금액 * 시간)
    const calculateAllowance = (hours: number, rateValue: any, type: string) => {
      // Remove commas if string and parse
      const cleanRate = typeof rateValue === 'string' ? rateValue.replace(/,/g, '') : rateValue;
      const rate = parseFloat(cleanRate) || 0; // Default to 0 if invalid

      console.log(`[CalcDetail] Type: ${type}`);
      console.log(`[CalcDetail] RawRate: ${JSON.stringify(rateValue)}`);
      console.log(`[CalcDetail] CleanRate: ${cleanRate}`);
      console.log(`[CalcDetail] ParsedRate: ${rate}`);
      console.log(`[CalcDetail] Hours: ${hours}`);

      // 단순 곱하기 (시간 * 금액)
      const pay = hours * rate;
      console.log(`[Calc] ${type} Result: ${pay}`);

      return pay;
    };

    // Remove defaultMultiplier arguments
    const calculatedOvertimePay = calculateAllowance(totalOvertimeHours, salary.overtime_rate, 'Overtime');
    const nightShiftPay = calculateAllowance(totalNightHours, salary.night_shift_rate, 'Night');
    const holidayPay = calculateAllowance(holidayWorkHours, salary.holiday_rate, 'Holiday');

    // 고정 OT를 초과하는 실제 OT만 추가 지급
    // Fixed OT is already included in rawBaseSalary, so only pay the excess
    const actualOvertimePay = Math.max(0, calculatedOvertimePay - fixedOvertimePay);

    console.log(`[OT Logic] Calculated: ${calculatedOvertimePay}, Fixed: ${fixedOvertimePay}, Actual Extra: ${actualOvertimePay}`);

    // 총 지급액 = DB 기본급(총액) + 추가 OT(고정 OT 초과분만) + 야간 + 휴일
    const grossPay = rawBaseSalary + actualOvertimePay + nightShiftPay + holidayPay;

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
        overtime_pay: actualOvertimePay,
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
