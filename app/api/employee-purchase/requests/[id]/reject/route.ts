import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // manager 또는 owner만 거부 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabase = getEmployeePurchaseSupabase();
    const { id: requestId } = await params;

    // 구매 요청 존재 확인
    const { data: existingRequest, error: fetchError } = await supabase
      .from('purchase_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !existingRequest) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 });
    }

    // 본인의 요청은 거부할 수 없음 (내부 통제)
    if (existingRequest.employee_id === user.id) {
      return NextResponse.json({ 
        error: 'Cannot reject your own purchase request' 
      }, { status: 403 });
    }

    // 이미 처리된 요청인지 확인
    if (existingRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Request already processed' }, { status: 400 });
    }

    // 거부 처리
    const { data, error } = await supabase
      .from('purchase_requests')
      .update({
        status: 'cancelled',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting request:', error);
      return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Request rejected successfully',
      request: data 
    });

  } catch (error) {
    console.error('Reject request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 