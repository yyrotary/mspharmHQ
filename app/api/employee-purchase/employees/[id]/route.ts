import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// Family 삭제 (오너만 가능)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 오너 권한 확인
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const employeeId = params.id;

    // 자기 자신 삭제 방지
    if (user.id === employeeId) {
      return NextResponse.json({ 
        error: '자기 자신은 삭제할 수 없습니다' 
      }, { status: 400 });
    }

    const supabase = getEmployeePurchaseSupabase();

    // 삭제할 Family 정보 확인
    const { data: employeeToDelete, error: fetchError } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('id', employeeId)
      .single();

    if (fetchError || !employeeToDelete) {
      return NextResponse.json({ 
        error: '존재하지 않는 Family입니다' 
      }, { status: 404 });
    }

    // 해당 Family의 구매 요청이 있는지 확인
    const { data: purchaseRequests, error: requestsError } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('employee_id', employeeId)
      .limit(1);

    if (requestsError) {
      console.error('Error checking purchase requests:', requestsError);
      return NextResponse.json({ 
        error: 'Family 삭제 확인 중 오류가 발생했습니다' 
      }, { status: 500 });
    }

    // 구매 요청이 있는 경우 삭제 방지
    if (purchaseRequests && purchaseRequests.length > 0) {
      return NextResponse.json({ 
        error: '구매 요청 내역이 있는 Family는 삭제할 수 없습니다' 
      }, { status: 400 });
    }

    // Family 삭제
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId);

    if (deleteError) {
      console.error('Error deleting employee:', deleteError);
      return NextResponse.json({ 
        error: 'Family 삭제에 실패했습니다' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `${employeeToDelete.name} Family가 성공적으로 삭제되었습니다`
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Family 정보 수정 (권한 변경 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 오너 권한 확인
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const employeeId = params.id;
    const { role } = await request.json();

    // 입력값 검증
    if (!role) {
      return NextResponse.json({ 
        error: '변경할 권한을 선택해주세요' 
      }, { status: 400 });
    }

    // 권한 유효성 확인
    if (!['staff', 'manager', 'owner'].includes(role)) {
      return NextResponse.json({ 
        error: '올바른 권한을 선택해주세요' 
      }, { status: 400 });
    }

    const supabase = getEmployeePurchaseSupabase();

    // 수정할 Family 정보 확인
    const { data: employeeToUpdate, error: fetchError } = await supabase
      .from('employees')
      .select('id, name, role')
      .eq('id', employeeId)
      .single();

    if (fetchError || !employeeToUpdate) {
      return NextResponse.json({ 
        error: '존재하지 않는 Family입니다' 
      }, { status: 404 });
    }

    // 권한 변경
    const { data: updatedEmployee, error: updateError } = await supabase
      .from('employees')
      .update({ 
        role,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select('id, name, role, updated_at')
      .single();

    if (updateError) {
      console.error('Error updating employee:', updateError);
      return NextResponse.json({ 
        error: 'Family 정보 수정에 실패했습니다' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `${employeeToUpdate.name} Family의 권한이 ${role}로 변경되었습니다`,
      employee: updatedEmployee
    });

  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 