import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function GET(request: NextRequest) {
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

    const supabase = getEmployeePurchaseSupabase();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const startOfMonth = `${currentMonth}-01`;
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // 1. 전체 직원 수
    const { data: allEmployees, error: empError } = await supabase
      .from('employees')
      .select('id, is_active')
      .eq('is_active', true);

    if (empError) {
      console.error('Error fetching employees:', empError);
    }

    const totalEmployees = allEmployees?.length || 0;
    const activeEmployees = allEmployees?.filter(e => e.is_active).length || 0;

    // 2. 이번 달 근태 현황
    const { data: attendance, error: attError } = await supabase
      .from('attendance')
      .select('work_hours, overtime_hours, night_hours')
      .gte('work_date', startOfMonth)
      .lte('work_date', endOfMonth);

    if (attError) {
      console.error('Error fetching attendance:', attError);
    }

    const totalHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0) || 0;
    const overtimeHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0) || 0;
    const nightHours = attendance?.reduce((sum, a) => sum + (parseFloat(a.night_hours) || 0), 0) || 0;

    // 3. 예상 인건비 계산 (간단한 추정)
    // 실제로는 각 직원의 시급/월급을 기준으로 계산해야 함
    const avgHourlyRate = 15000; // 평균 시급
    const estimatedCost = totalHours * avgHourlyRate + 
                         overtimeHours * avgHourlyRate * 0.5 + 
                         nightHours * avgHourlyRate * 0.5;

    // 4. 처리 대기 중인 급여 건수
    const { data: pendingPayrolls, error: payError } = await supabase
      .from('payroll')
      .select('id')
      .eq('status', 'pending')
      .gte('pay_period_start', startOfMonth);

    if (payError) {
      console.error('Error fetching payrolls:', payError);
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalEmployees,
        activeEmployees,
        monthlyLaborCost: Math.round(estimatedCost),
        pendingPayrolls: pendingPayrolls?.length || 0,
        thisMonthAttendance: {
          totalHours: Math.round(totalHours * 10) / 10,
          overtimeHours: Math.round(overtimeHours * 10) / 10,
          nightHours: Math.round(nightHours * 10) / 10,
        },
      },
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
