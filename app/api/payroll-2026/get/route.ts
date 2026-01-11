import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 특정 직원의 특정 기간 급여 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const employee_id = searchParams.get('employee_id');
    const pay_period_start = searchParams.get('pay_period_start');
    const pay_period_end = searchParams.get('pay_period_end');

    if (!employee_id || !pay_period_start || !pay_period_end) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    const { data: payroll, error: payrollError } = await supabase
      .from('payroll')
      .select('*')
      .eq('employee_id', employee_id)
      .eq('pay_period_start', pay_period_start)
      .eq('pay_period_end', pay_period_end)
      .single();

    if (payrollError) {
      if (payrollError.code === 'PGRST116') {
        // 데이터 없음
        return NextResponse.json({
          success: true,
          exists: false,
          data: null,
        });
      }
      
      console.error('Payroll fetch error:', payrollError);
      return NextResponse.json(
        { error: '급여 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      exists: true,
      data: payroll,
    });

  } catch (error) {
    console.error('Payroll get error:', error);
    return NextResponse.json(
      { error: '급여 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
