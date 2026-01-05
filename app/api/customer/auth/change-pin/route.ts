import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { customerName, currentPin, newPin } = await request.json();

    // 입력 검증
    if (!customerName || !currentPin || !newPin) {
      return NextResponse.json(
        { error: '고객명, 현재 PIN, 새 PIN이 모두 필요합니다' },
        { status: 400 }
      );
    }

    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json(
        { error: '새 PIN은 6자리 숫자여야 합니다' },
        { status: 400 }
      );
    }

    if (currentPin === newPin) {
      return NextResponse.json(
        { error: '새 PIN은 현재 PIN과 달라야 합니다' },
        { status: 400 }
      );
    }

    // 현재 고객명 + PIN으로 고객 인증
    const { data: authData, error: authError } = await supabase
      .rpc('authenticate_customer_by_name_and_pin', { 
        input_customer_name: customerName.trim(), 
        input_pin: currentPin 
      })
      .single();

    if (authError || !authData || !authData.is_valid) {
      return NextResponse.json(
        { error: '현재 PIN이 올바르지 않습니다' },
        { status: 401 }
      );
    }

    // PIN 변경 시도
    const { data: changeResult, error: changeError } = await supabase
      .rpc('change_customer_pin', { 
        input_customer_uuid: authData.customer_id, 
        input_new_pin: newPin 
      });

    if (changeError) {
      console.error('PIN 변경 오류:', changeError);
      return NextResponse.json(
        { error: 'PIN 변경 중 오류가 발생했습니다' },
        { status: 500 }
      );
    }

    if (!changeResult) {
      return NextResponse.json(
        { error: '이미 사용중인 PIN입니다. 다른 PIN을 선택해주세요' },
        { status: 409 }
      );
    }

    // 성공 응답
    return NextResponse.json({
      success: true,
      message: 'PIN이 성공적으로 변경되었습니다',
      customer: {
        id: authData.customer_id,
        customer_code: authData.customer_code,
        name: authData.customer_name
      }
    });

  } catch (error) {
    console.error('PIN 변경 API 오류:', error);
    return NextResponse.json(
      { error: 'PIN 변경 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
