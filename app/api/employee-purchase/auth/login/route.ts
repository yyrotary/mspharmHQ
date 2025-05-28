import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken, createAuthCookieHeader } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: '이름과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(name, password);
    if (!user) {
      return NextResponse.json(
        { error: '잘못된 이름 또는 비밀번호입니다' },
        { status: 401 }
      );
    }

    const token = generateToken(user);
    
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    // 쿠키 설정
    response.headers.set('Set-Cookie', createAuthCookieHeader(token));

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 