import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 근무 기록 생성 또는 수정
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date, check_in_time, check_out_time, notes } = body;

    if (!date || !check_in_time || !check_out_time) {
      return NextResponse.json(
        { error: '날짜, 출근시간, 퇴근시간은 필수입니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 시간 계산
    const checkIn = new Date(check_in_time);
    const checkOut = new Date(check_out_time);

    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: '퇴근 시간은 출근 시간보다 늦어야 합니다' },
        { status: 400 }
      );
    }

    // 근무시간 계산 (시간 단위)
    const workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const roundedWorkHours = Math.round(workHours * 100) / 100;

    // 초과근무 계산 (8시간 초과)
    const overtimeHours = workHours > 8 ? Math.round((workHours - 8) * 100) / 100 : 0;

    // 야간근무 계산 (22:00-06:00)
    const nightHours = calculateNightHours(checkIn, checkOut);

    // 휴일 체크 (주말)
    const workDate = new Date(date);
    const isHoliday = workDate.getDay() === 0 || workDate.getDay() === 6;

    // 기존 기록 확인
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('work_date', date)
      .single();

    let result;
    let isUpdate = false;

    if (existing) {
      // 기존 기록 업데이트
      isUpdate = true;
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_in_time: check_in_time,
          check_out_time: check_out_time,
          work_hours: roundedWorkHours,
          overtime_hours: overtimeHours,
          night_hours: nightHours,
          is_holiday: isHoliday,
          notes: notes || null,
          status: 'present',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Update attendance error:', error);
        return NextResponse.json(
          { error: '근무 기록 수정에 실패했습니다: ' + error.message },
          { status: 500 }
        );
      }

      result = data;
    } else {
      // 새 기록 생성
      const { data, error } = await supabase
        .from('attendance')
        .insert({
          employee_id: user.id,
          work_date: date,
          check_in_time: check_in_time,
          check_out_time: check_out_time,
          work_hours: roundedWorkHours,
          overtime_hours: overtimeHours,
          night_hours: nightHours,
          is_holiday: isHoliday,
          notes: notes || null,
          status: 'present',
          location: '본점',
        })
        .select()
        .single();

      if (error) {
        console.error('Insert attendance error:', error);
        return NextResponse.json(
          { error: '근무 기록 저장에 실패했습니다: ' + error.message },
          { status: 500 }
        );
      }

      result = data;
    }

    return NextResponse.json({
      success: true,
      message: isUpdate ? '근무 기록이 수정되었습니다' : '근무 기록이 저장되었습니다',
      data: {
        id: result.id,
        work_date: result.work_date,
        check_in_time: result.check_in_time,
        check_out_time: result.check_out_time,
        work_hours: result.work_hours,
        overtime_hours: result.overtime_hours,
        night_hours: result.night_hours,
        is_holiday: result.is_holiday,
        status: result.status,
      }
    });

  } catch (error) {
    console.error('Record attendance error:', error);
    return NextResponse.json(
      { error: '근무 기록 처리 중 오류가 발생했습니다' },
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
      // 1시간 단위가 아닌 실제 분 단위로 계산
      const nextHour = new Date(current);
      nextHour.setHours(current.getHours() + 1);
      
      if (nextHour > checkOut) {
        const minutes = (checkOut.getTime() - current.getTime()) / (1000 * 60);
        nightHours += minutes / 60;
      } else {
        nightHours += 1;
      }
    }
    current.setHours(current.getHours() + 1);
  }
  
  return Math.round(nightHours * 100) / 100;
}
