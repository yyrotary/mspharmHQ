import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 월간 근태 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // format: 2025-01
    const employeeId = searchParams.get('employee_id');

    // 관리자는 다른 직원 조회 가능
    const targetEmployeeId = employeeId && ['manager', 'owner'].includes(user.role) 
      ? employeeId 
      : user.id;

    if (!month) {
      return NextResponse.json(
        { error: 'month 파라미터가 필요합니다 (예: 2025-01)' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 해당 월의 시작일과 종료일
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
      .toISOString().split('T')[0];

    // 근태 기록 조회
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', targetEmployeeId)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false });

    if (error) {
      console.error('Attendance fetch error:', error);
      return NextResponse.json(
        { error: '근태 기록 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 통계 계산
    const stats = {
      totalDays: attendance.length,
      presentDays: attendance.filter(a => a.status === 'present').length,
      absentDays: attendance.filter(a => a.status === 'absent').length,
      lateDays: attendance.filter(a => a.status === 'late').length,
      vacationDays: attendance.filter(a => a.status === 'vacation').length,
      totalWorkHours: attendance.reduce((sum, a) => sum + (a.work_hours || 0), 0),
      totalOvertimeHours: attendance.reduce((sum, a) => sum + (a.overtime_hours || 0), 0),
      totalNightHours: attendance.reduce((sum, a) => sum + (a.night_hours || 0), 0),
      holidayWorkDays: attendance.filter(a => a.is_holiday).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        month,
        employee_id: targetEmployeeId,
        attendance,
        stats
      }
    });

  } catch (error) {
    console.error('Monthly attendance error:', error);
    return NextResponse.json(
      { error: '근태 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
