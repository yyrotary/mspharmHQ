import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { customerId, pin } = await request.json();

    console.log('🔐 ID로 로그인 시도:', { customerId: customerId?.slice(0, 8) + '...', pin: pin ? `${pin.slice(0, 2)}****` : 'null' });

    if (!customerId || !pin) {
      return NextResponse.json(
        { error: '고객 ID와 PIN을 모두 입력해주세요' },
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

    // 먼저 해당 고객 정보를 조회
    console.log('🔍 고객 정보 조회 중...');
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_code, name')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      console.error('❌ 고객 조회 오류:', customerError);
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    console.log('👤 고객 정보:', { name: customer.name, code: customer.customer_code });

    // 기존 이름+PIN 인증 함수를 사용하여 PIN 검증
    console.log('🔍 PIN 인증 중...');
    const { data: authData, error: authError } = await supabase
      .rpc('authenticate_customer_by_name_and_pin', { 
        input_customer_name: customer.name, 
        input_pin: pin 
      })
      .single();

    if (authError) {
      console.error('❌ PIN 인증 오류:', authError);
      return NextResponse.json(
        { error: `인증 중 오류가 발생했습니다: ${authError.message}` },
        { status: 500 }
      );
    }

    console.log('📊 인증 결과:', { 
      is_valid: authData?.is_valid, 
      is_initial_pin: authData?.is_initial_pin,
      returned_id: authData?.customer_id,
      requested_id: customerId
    });

    if (!authData || !authData.is_valid) {
      console.warn('❌ 인증 실패:', authData);
      return NextResponse.json(
        { error: '올바르지 않은 PIN 코드입니다' },
        { status: 401 }
      );
    }

    // 인증된 고객 ID가 요청한 ID와 일치하는지 확인
    if (authData.customer_id !== customerId) {
      console.warn('❌ ID 불일치:', { 
        authenticated_id: authData.customer_id, 
        requested_id: customerId 
      });
      return NextResponse.json(
        { error: '인증 정보가 일치하지 않습니다' },
        { status: 401 }
      );
    }

    console.log('✅ ID로 인증 성공!', { 
      customer: authData.customer_name, 
      initialPin: authData.is_initial_pin 
    });

    // 성공 응답 (초기 PIN 여부 포함)
    return NextResponse.json({
      success: true,
      requiresPinChange: authData.is_initial_pin || false,
      customer: {
        id: authData.customer_id,
        customer_code: authData.customer_code,
        name: authData.customer_name
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
