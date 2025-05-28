import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth, hashPassword } from '@/app/lib/employee-purchase/auth';

// Family 목록 조회 (오너만 가능)
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 오너 권한 확인
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const supabase = getEmployeePurchaseSupabase();

    // 모든 Family 조회 (비밀번호 제외)
    const { data: employees, error } = await supabase
      .from('employees')
      .select('id, name, role, created_at, updated_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching employees:', error);
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      employees: employees || []
    });

  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 새 Family 추가 (오너만 가능)
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 오너 권한 확인
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const { name, role, password } = await request.json();

    // 입력값 검증
    if (!name || !role || !password) {
      return NextResponse.json({ 
        error: '이름, 권한, 비밀번호를 모두 입력해주세요' 
      }, { status: 400 });
    }

    // 이름 중복 확인
    if (!name.trim()) {
      return NextResponse.json({ 
        error: '이름을 입력해주세요' 
      }, { status: 400 });
    }

    // 권한 유효성 확인
    if (!['staff', 'manager', 'owner'].includes(role)) {
      return NextResponse.json({ 
        error: '올바른 권한을 선택해주세요' 
      }, { status: 400 });
    }

    // 비밀번호가 4자리 숫자인지 확인
    if (!/^\d{4}$/.test(password)) {
      return NextResponse.json({ 
        error: '비밀번호는 4자리 숫자여야 합니다' 
      }, { status: 400 });
    }

    const supabase = getEmployeePurchaseSupabase();

    // 이름 중복 확인
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id')
      .eq('name', name.trim())
      .single();

    if (existingEmployee) {
      return NextResponse.json({ 
        error: '이미 존재하는 이름입니다' 
      }, { status: 400 });
    }

    // 비밀번호 해시화
    const hashedPassword = await hashPassword(password);

    // 새 Family 추가
    const { data: newEmployee, error: insertError } = await supabase
      .from('employees')
      .insert({
        name: name.trim(),
        role,
        password_hash: hashedPassword,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, name, role, created_at')
      .single();

    if (insertError) {
      console.error('Error creating employee:', insertError);
      return NextResponse.json({ error: 'Family 추가에 실패했습니다' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '새 Family가 성공적으로 추가되었습니다',
      employee: newEmployee
    });

  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 