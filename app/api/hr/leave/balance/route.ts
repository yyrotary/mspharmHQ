import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 휴가 잔여 일수 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    const supabase = getEmployeePurchaseSupabase();

    // 관리자는 다른 직원 조회 가능
    const targetEmployeeId = ['manager', 'owner'].includes(user.role) && employeeId 
      ? employeeId 
      : user.id;

    // 휴가 잔여 조회
    const { data: balances, error } = await supabase
      .from('leave_balance')
      .select(`
        *,
        leave_type:leave_types(id, name, code, is_paid, max_days_per_year)
      `)
      .eq('employee_id', targetEmployeeId)
      .eq('year', parseInt(year));

    if (error) {
      console.error('Leave balance fetch error:', error);
      return NextResponse.json(
        { error: '휴가 잔여 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 휴가 타입별로 정리
    const balanceMap = balances.reduce((acc, balance) => {
      acc[balance.leave_type.code] = {
        leave_type: balance.leave_type.name,
        total_days: parseFloat(balance.total_days),
        used_days: parseFloat(balance.used_days),
        remaining_days: parseFloat(balance.remaining_days),
        carried_over_days: parseFloat(balance.carried_over_days),
      };
      return acc;
    }, {} as any);

    return NextResponse.json({
      success: true,
      data: {
        employee_id: targetEmployeeId,
        year: parseInt(year),
        balances: balanceMap,
        raw: balances,
      }
    });

  } catch (error) {
    console.error('Leave balance fetch error:', error);
    return NextResponse.json(
      { error: '휴가 잔여 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
