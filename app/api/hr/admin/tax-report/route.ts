import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자 권한 확인
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month } = body;

    if (!month) {
      return NextResponse.json(
        { error: '월 파라미터가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();
    
    // 해당 월의 시작일과 종료일 계산
    const [year, monthNum] = month.split('-');
    const startDate = `${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(monthNum), 0)
      .toISOString().split('T')[0];

    // 해당 월의 확정된 급여 기록만 조회
    const { data: payrolls, error } = await supabase
      .from('payroll')
      .select('*')
      .gte('pay_period_start', startDate)
      .lte('pay_period_end', endDate)
      .eq('status', 'approved')  // 확정된 급여만
      .order('employee_id');

    if (error) {
      console.error('Payroll fetch error:', error);
      return NextResponse.json(
        { error: '급여 기록 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    if (!payrolls || payrolls.length === 0) {
      return NextResponse.json({
        success: true,
        report: {
          month,
          employees: [],
          totals: {
            gross_pay: 0,
            non_taxable: 0,
            taxable: 0,
            national_pension: 0,
            health_insurance: 0,
            long_term_care: 0,
            employment_insurance: 0,
            income_tax: 0,
            local_tax: 0,
          },
        },
      });
    }

    // Employee 정보 조회
    const employeeIds = [...new Set(payrolls.map(p => p.employee_id))];
    const { data: employeeData } = await supabase
      .from('employees')
      .select('id, name, birth_date')
      .in('id', employeeIds);

    const employeeMap = new Map(employeeData?.map(e => [e.id, e]) || []);

    // 급여대장 데이터 변환
    const employees = payrolls.map(p => {
      const employee = employeeMap.get(p.employee_id);
      return {
        name: employee?.name || '알 수 없음',
        resident_number: '******-*******', // 보안상 마스킹
        gross_pay: p.gross_pay || 0,
        non_taxable: (p.meal_allowance || 0) + (p.allowances || 0),
        taxable: p.gross_pay - ((p.meal_allowance || 0) + (p.allowances || 0)),
        national_pension: p.national_pension || 0,
        health_insurance: p.health_insurance || 0,
        long_term_care: p.long_term_care || 0,
        employment_insurance: p.employment_insurance || 0,
        income_tax: p.income_tax || 0,
        local_tax: p.resident_tax || 0,
      };
    });

    // 합계 계산
    const totals = {
      gross_pay: employees.reduce((sum, e) => sum + e.gross_pay, 0),
      non_taxable: employees.reduce((sum, e) => sum + e.non_taxable, 0),
      taxable: employees.reduce((sum, e) => sum + e.taxable, 0),
      national_pension: employees.reduce((sum, e) => sum + e.national_pension, 0),
      health_insurance: employees.reduce((sum, e) => sum + e.health_insurance, 0),
      long_term_care: employees.reduce((sum, e) => sum + e.long_term_care, 0),
      employment_insurance: employees.reduce((sum, e) => sum + e.employment_insurance, 0),
      income_tax: employees.reduce((sum, e) => sum + e.income_tax, 0),
      local_tax: employees.reduce((sum, e) => sum + e.local_tax, 0),
    };

    return NextResponse.json({
      success: true,
      report: {
        month,
        employees,
        totals,
      },
    });

  } catch (error) {
    console.error('Tax report error:', error);
    return NextResponse.json(
      { error: '급여대장 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
