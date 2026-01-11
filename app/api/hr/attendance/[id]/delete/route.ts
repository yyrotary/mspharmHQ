import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 삭제 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '근무 기록 삭제 권한이 없습니다' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const supabase = getEmployeePurchaseSupabase();

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Attendance delete error:', error);
      return NextResponse.json(
        { error: '근무 기록 삭제에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '근무 기록이 삭제되었습니다',
    });

  } catch (error) {
    console.error('Delete attendance error:', error);
    return NextResponse.json(
      { error: '근무 기록 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
