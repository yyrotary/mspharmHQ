import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 휴가 거부
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 거부 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '휴가 거부 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id: leaveRequestId } = await params;
    const body = await request.json();
    const { rejection_reason } = body;

    const supabase = getEmployeePurchaseSupabase();

    // 휴가 신청 확인
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

    // 거부 처리
    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status: 'rejected',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        rejection_reason: rejection_reason || '관리자 거부',
      })
      .eq('id', leaveRequestId)
      .select()
      .single();

    if (error) {
      console.error('Leave reject error:', error);
      return NextResponse.json(
        { error: '휴가 거부에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '휴가가 거부되었습니다',
      data
    });

  } catch (error) {
    console.error('Leave reject error:', error);
    return NextResponse.json(
      { error: '휴가 거부 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
