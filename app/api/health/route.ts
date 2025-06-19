import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const envStatus = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '누락됨',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '설정됨' : '누락됨',
      SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET ? '설정됨' : '누락됨',
      timestamp: new Date().toISOString(),
    };

    console.log('헬스체크 - 환경 변수 상태:', envStatus);

    // Supabase 연결 테스트
    let supabaseStatus = 'unknown';
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        const { data, error } = await supabase
          .from('consultations')
          .select('count', { count: 'exact' })
          .limit(1);
        
        if (error) {
          supabaseStatus = `연결 실패: ${error.message}`;
        } else {
          supabaseStatus = '연결 성공';
        }
      } else {
        supabaseStatus = '환경 변수 누락';
      }
    } catch (error) {
      supabaseStatus = `연결 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`;
    }

    return NextResponse.json({
      status: 'ok',
      environment: envStatus,
      supabase: supabaseStatus,
      message: '시스템이 정상적으로 작동 중입니다.'
    });

  } catch (error) {
    console.error('헬스체크 오류:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 