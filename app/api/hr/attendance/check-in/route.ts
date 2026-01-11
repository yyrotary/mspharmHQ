import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 출근 체크
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { location, notes } = body;
    
    const supabase = getEmployeePurchaseSupabase();
    const today = new Date().toISOString().split('T')[0];

    // 오늘 이미 출근 체크했는지 확인
    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('work_date', today)
      .single();

    if (existing && existing.check_in_time) {
      return NextResponse.json(
        { error: '이미 출근 체크가 되어 있습니다' },
        { status: 400 }
      );
    }

    const checkInTime = new Date().toISOString();

    // 출근 기록 생성 또는 업데이트
    const { data, error } = await supabase
      .from('attendance')
      .upsert({
        employee_id: user.id,
        work_date: today,
        check_in_time: checkInTime,
        status: 'present',
        location: location || '본점',
        notes: notes || null,
      }, {
        onConflict: 'employee_id,work_date'
      })
      .select()
      .single();

    if (error) {
      console.error('Check-in error:', error);
      return NextResponse.json(
        { error: '출근 체크에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '출근 체크가 완료되었습니다',
      data: {
        id: data.id,
        check_in_time: data.check_in_time,
        status: data.status,
        location: data.location,
      }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: '출근 체크 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
