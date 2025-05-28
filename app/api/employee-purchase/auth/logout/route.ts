import { NextResponse } from 'next/server';
import { createClearCookieHeader } from '@/app/lib/employee-purchase/auth';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다',
    });

    // 쿠키 삭제
    response.headers.set('Set-Cookie', createClearCookieHeader());

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 