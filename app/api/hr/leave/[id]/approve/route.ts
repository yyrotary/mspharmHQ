import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 휴가 승인
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 승인 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '휴가 승인 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id: leaveRequestId } = await params;
    const supabase = getEmployeePurchaseSupabase();

    // 1. 휴가 신청 확인
    const { data: leaveRequest, error: fetchError } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('id', leaveRequestId)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: '휴가 신청을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (leaveRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '이미 처리된 휴가 신청입니다' },
        { status: 400 }
      );
    }

    // 본인의 휴가는 승인 불가
    if (leaveRequest.employee_id === user.id) {
      return NextResponse.json(
        { error: '본인의 휴가는 승인할 수 없습니다' },
        { status: 403 }
      );
    }

    // 2. 휴가 승인 처리
    const { data: approvedRequest, error: approveError } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', leaveRequestId)
      .select()
      .single();

    if (approveError) {
      console.error('Leave approve error:', approveError);
      return NextResponse.json(
        { error: '휴가 승인에 실패했습니다' },
        { status: 500 }
      );
    }

    // 3. 휴가 잔여 일수 차감
    const currentYear = new Date(leaveRequest.start_date).getFullYear();
    const { error: balanceError } = await supabase
      .rpc('update_leave_balance', {
        p_employee_id: leaveRequest.employee_id,
        p_leave_type_id: leaveRequest.leave_type_id,
        p_year: currentYear,
        p_days_to_add: -leaveRequest.total_days,
      });

    if (balanceError) {
      console.error('Leave balance update error:', balanceError);
      // 승인은 되었지만 잔여 일수 업데이트 실패 (수동으로 처리 필요)
    }

    // 4. 해당 기간의 근태에 휴가 자동 반영
    const dates = getDatesBetween(leaveRequest.start_date, leaveRequest.end_date);
    for (const date of dates) {
      await supabase
        .from('attendance')
        .upsert({
          employee_id: leaveRequest.employee_id,
          work_date: date,
          status: 'vacation',
          notes: `${leaveRequest.leave_type_id} 휴가`,
        }, {
          onConflict: 'employee_id,work_date'
        });
    }

    return NextResponse.json({
      success: true,
      message: '휴가가 승인되었습니다',
      data: approvedRequest
    });

  } catch (error) {
    console.error('Leave approve error:', error);
    return NextResponse.json(
      { error: '휴가 승인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 날짜 범위 생성 헬퍼
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
