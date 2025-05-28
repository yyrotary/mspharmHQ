import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/app/lib/employee-purchase/auth';
import { supabase } from '@/app/lib/employee-purchase/supabase';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 마스터 로그인을 위한 POST 메서드
export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { success: false, error: 'Name and password are required' },
        { status: 400 }
      );
    }

    // 특정 이름과 owner 권한을 가진 사용자 조회
    const { data: users, error } = await supabase
      .from('employees')
      .select('*')
      .eq('role', 'owner')
      .eq('name', name);

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Database error' },
        { status: 500 }
      );
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid name or not authorized' },
        { status: 401 }
      );
    }

    // 사용자 정보 확인
    const user = users[0];
    console.log('Found user:', { id: user.id, name: user.name, role: user.role });

    // 비밀번호 필드 확인 (올바른 필드명: password_hash)
    if (!user.password_hash) {
      console.error('User password_hash is undefined or empty');
      return NextResponse.json(
        { success: false, error: 'Password not set for this user' },
        { status: 500 }
      );
    }

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (isValidPassword) {
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          role: user.role
        }
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }

  } catch (error) {
    console.error('Master login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
} 