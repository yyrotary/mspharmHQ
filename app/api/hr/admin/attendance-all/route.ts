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

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

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

    // 전체 직원의 근무 기록 조회 (직원 정보 조인)
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select(`
        *,
        employee:employees!attendance_employee_id_fkey(name, position)
      `)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false });

    if (error) {
      console.error('Attendance fetch error:', error);
      return NextResponse.json(
        { error: '근무 기록 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 직원 이름 추가
    const attendanceWithName = attendance?.map(record => ({
      ...record,
      employee_name: record.employee?.name || '알 수 없음',
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        attendance: attendanceWithName,
        month,
      },
    });

  } catch (error) {
    console.error('Admin attendance error:', error);
    return NextResponse.json(
      { error: '근무 기록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
