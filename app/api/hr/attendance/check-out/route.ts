import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 퇴근 체크
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { notes } = body;
    
    const supabase = getEmployeePurchaseSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 오늘 출근 기록 확인
    const { data: attendance, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('work_date', today)
      .single();

    if (fetchError || !attendance) {
      return NextResponse.json(
        { error: '출근 기록이 없습니다. 먼저 출근 체크를 해주세요.' },
        { status: 400 }
      );
    }

    if (attendance.check_out_time) {
      return NextResponse.json(
        { error: '이미 퇴근 체크가 되어 있습니다' },
        { status: 400 }
      );
    }

    const checkOutTime = new Date().toISOString();
    const checkInTime = new Date(attendance.check_in_time);
    const checkOutTimeDate = new Date(checkOutTime);

    // 근무시간 계산 (시간 단위)
    const workHours = (checkOutTimeDate.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
    const roundedWorkHours = Math.round(workHours * 100) / 100;

    // 초과근무 계산 (8시간 초과)
    const overtimeHours = workHours > 8 ? Math.round((workHours - 8) * 100) / 100 : 0;

    // 야간근무 계산 (22:00-06:00)
    const nightHours = calculateNightHours(checkInTime, checkOutTimeDate);

    // 휴일 체크 (주말)
    const isHoliday = checkOutTimeDate.getDay() === 0 || checkOutTimeDate.getDay() === 6;

    // 퇴근 기록 업데이트
    const { data, error } = await supabase
      .from('attendance')
      .update({
        check_out_time: checkOutTime,
        work_hours: roundedWorkHours,
        overtime_hours: overtimeHours,
        night_hours: nightHours,
        is_holiday: isHoliday,
        notes: notes ? `${attendance.notes || ''}${attendance.notes ? ', ' : ''}${notes}` : attendance.notes,
      })
      .eq('id', attendance.id)
      .select()
      .single();

    if (error) {
      console.error('Check-out error:', error);
      return NextResponse.json(
        { error: '퇴근 체크에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '퇴근 체크가 완료되었습니다',
      data: {
        id: data.id,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time,
        work_hours: data.work_hours,
        overtime_hours: data.overtime_hours,
        night_hours: data.night_hours,
        status: data.status,
      }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: '퇴근 체크 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 야간근무 시간 계산 (22:00-06:00)
function calculateNightHours(checkIn: Date, checkOut: Date): number {
  let nightHours = 0;
  const current = new Date(checkIn);
  
  while (current < checkOut) {
    const hour = current.getHours();
    if (hour >= 22 || hour < 6) {
      nightHours += 1;
    }
    current.setHours(current.getHours() + 1);
  }
  
  return nightHours;
}
