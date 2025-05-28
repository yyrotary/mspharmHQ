import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth, hashPassword, verifyPassword } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    // 입력값 검증
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ 
        error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' 
      }, { status: 400 });
    }

    // 새 비밀번호가 4자리 숫자인지 검증
    if (!/^\d{4}$/.test(newPassword)) {
      return NextResponse.json({ 
        error: '새 비밀번호는 4자리 숫자여야 합니다' 
      }, { status: 400 });
    }

    // 현재 비밀번호와 새 비밀번호가 같은지 확인
    if (currentPassword === newPassword) {
      return NextResponse.json({ 
        error: '새 비밀번호는 현재 비밀번호와 달라야 합니다' 
      }, { status: 400 });
    }

    const supabase = getEmployeePurchaseSupabase();

    // 현재 사용자 정보 조회
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (fetchError || !employee) {
      return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await verifyPassword(currentPassword, employee.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ 
        error: '현재 비밀번호가 올바르지 않습니다' 
      }, { status: 400 });
    }

    // 새 비밀번호 해시화
    const newPasswordHash = await hashPassword(newPassword);

    // 비밀번호 업데이트
    const { error: updateError } = await supabase
      .from('employees')
      .update({ 
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return NextResponse.json({ error: '비밀번호 변경에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다' 
    });

  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 