import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 급여 승인
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // owner만 급여 승인 가능
    if (user.role !== 'owner') {
      return NextResponse.json(
        { error: '급여 승인 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id: payrollId } = await params;
    const supabase = getEmployeePurchaseSupabase();

    // 급여 레코드 확인
    const { data: payroll, error: fetchError } = await supabase
      .from('payroll')
      .select('*')
      .eq('id', payrollId)
      .single();

    if (fetchError || !payroll) {
      return NextResponse.json(
        { error: '급여 레코드를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    if (payroll.status !== 'draft') {
      return NextResponse.json(
        { error: '이미 처리된 급여입니다' },
        { status: 400 }
      );
    }

    // 승인 처리
    const { data, error } = await supabase
      .from('payroll')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', payrollId)
      .select()
      .single();

    if (error) {
      console.error('Payroll approve error:', error);
      return NextResponse.json(
        { error: '급여 승인에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '급여가 승인되었습니다',
      data
    });

  } catch (error) {
    console.error('Payroll approve error:', error);
    return NextResponse.json(
      { error: '급여 승인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
