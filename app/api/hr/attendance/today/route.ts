import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 오늘의 근태 상태 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getEmployeePurchaseSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 오늘의 근태 기록 조회
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('work_date', today)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Today attendance error:', error);
      return NextResponse.json(
        { error: '근태 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 근무 중 여부
    const isWorking = attendance && attendance.check_in_time && !attendance.check_out_time;
    
    // 현재 근무 시간 계산
    let currentWorkHours = 0;
    if (isWorking) {
      const now = new Date();
      const checkIn = new Date(attendance.check_in_time);
      currentWorkHours = (now.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      currentWorkHours = Math.round(currentWorkHours * 100) / 100;
    }

    return NextResponse.json({
      success: true,
      data: {
        date: today,
        attendance: attendance || null,
        isCheckedIn: !!attendance?.check_in_time,
        isCheckedOut: !!attendance?.check_out_time,
        isWorking,
        currentWorkHours,
      }
    });

  } catch (error) {
    console.error('Today attendance error:', error);
    return NextResponse.json(
      { error: '근태 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
