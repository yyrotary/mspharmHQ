import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 근무 기록 생성 또는 수정
export async function POST(request: NextRequest) {
  try {
    const user = { role: 'owner', id: 'debug-user' }; // Mock user

    const body = await request.json();
    const { employee_id, work_date, check_in_time, check_out_time, notes, is_overtime, record_id } = body;

    // 관리자인 경우 요청받은 employee_id 사용
    let targetEmployeeId = employee_id || user.id;

    if (!work_date || !check_in_time || !check_out_time) {
      return NextResponse.json(
        { error: '날짜, 시작시간, 종료시간은 필수입니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 시간 계산
    const checkIn = new Date(check_in_time);
    const checkOut = new Date(check_out_time);

    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: '종료 시간은 시작 시간보다 늦어야 합니다' },
        { status: 400 }
      );
    }

    // 근무시간 계산 (시간 단위)
    const workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
    const roundedWorkHours = Math.round(workHours * 100) / 100;

    // is_overtime이 true면 work_hours를 overtime_hours로 저장 (정규직용)
    // is_overtime이 false면 work_hours는 실제 근무시간 (파트타임용)
    const overtimeHours = is_overtime ? roundedWorkHours : 0;
    const actualWorkHours = is_overtime ? 0 : roundedWorkHours;

    // 야간근무 제거 (불필요)
    const nightHours = 0;

    // 휴일 자동체크 제거 (불필요)
    const isHoliday = false;

    // record_id가 있으면 업데이트, 없으면 새로 생성
    let result;
    let isUpdate = false;

    if (record_id) {
      // 특정 ID로 업데이트
      isUpdate = true;
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_in_time: check_in_time,
          check_out_time: check_out_time,
          work_hours: actualWorkHours,
          overtime_hours: overtimeHours,
          night_hours: nightHours,
          is_holiday: isHoliday,
          notes: notes || null,
          status: 'present',
          updated_at: new Date().toISOString(),
        })
        .eq('id', record_id)
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
          employee_id: targetEmployeeId,
          work_date: work_date,
          check_in_time: check_in_time,
          check_out_time: check_out_time,
          work_hours: actualWorkHours,
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
