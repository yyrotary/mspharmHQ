import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { customerName, pin } = await request.json();

    console.log('🔐 로그인 시도:', { customerName, pin: pin ? `${pin.slice(0, 2)}****` : 'null' });

    if (!customerName || !pin) {
      return NextResponse.json(
        { error: '고객명과 PIN을 모두 입력해주세요' },
        { status: 400 }
      );
    }

    if (pin.length !== 6) {
      console.warn('⚠️ PIN 길이 오류:', pin.length);
      return NextResponse.json(
        { error: '6자리 PIN 코드를 입력해주세요' },
        { status: 400 }
      );
    }

    // 고객명 + PIN으로 인증
    console.log('🔍 인증 시도 중...');
    const { data, error } = await supabase
      .rpc('authenticate_customer_by_name_and_pin', { 
        input_customer_name: customerName.trim(), 
        input_pin: pin 
      })
      .single();

    if (error) {
      console.error('❌ PIN 인증 오류:', error);
      return NextResponse.json(
        { error: `인증 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('📊 인증 결과:', { 
      is_valid: data?.is_valid, 
      is_initial_pin: data?.is_initial_pin,
      customer_name: data?.customer_name 
    });

    if (!data || !data.is_valid) {
      console.warn('❌ 인증 실패:', data);
      return NextResponse.json(
        { error: '올바르지 않은 PIN 코드입니다' },
        { status: 401 }
      );
    }

    console.log('✅ 인증 성공!', { 
      customer: data.customer_name, 
      initialPin: data.is_initial_pin 
    });

    // 성공 응답 (초기 PIN 여부 포함)
    return NextResponse.json({
      success: true,
      requiresPinChange: data.is_initial_pin || false,
      customer: {
        id: data.customer_id,
        customer_code: data.customer_code,
        name: data.customer_name
      }
    });

  } catch (error) {
    console.error('❌ 고객 로그인 오류:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
