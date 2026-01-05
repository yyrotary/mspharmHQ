import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { customerName } = await request.json();

    console.log('🔍 고객 검색 요청:', { customerName });

    if (!customerName || !customerName.trim()) {
      return NextResponse.json(
        { error: '고객명을 입력해주세요' },
        { status: 400 }
      );
    }

    // 동일한 이름의 고객들을 모두 조회
    console.log('📊 데이터베이스 검색 중...');
    const { data: customers, error } = await supabase
      .from('customers')
      .select('id, customer_code, name, phone')
      .eq('name', customerName.trim())
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ 고객 검색 오류:', error);
      return NextResponse.json(
        { error: `고객 검색 중 오류가 발생했습니다: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('📋 검색 결과:', { count: customers?.length || 0 });

    if (!customers || customers.length === 0) {
      console.log('⚠️ 검색 결과 없음');
      return NextResponse.json(
        { error: '해당 이름의 고객을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 안전한 전화번호 마스킹 처리
    const processedCustomers = customers.map(customer => {
      let maskedPhone = '등록된 번호 없음';
      
      try {
        if (customer.phone && typeof customer.phone === 'string' && customer.phone.length >= 7) {
          // 숫자만 추출
          const phoneNumbers = customer.phone.replace(/\D/g, '');
          if (phoneNumbers.length >= 7) {
            maskedPhone = `${phoneNumbers.slice(0, 3)}-****-${phoneNumbers.slice(-4)}`;
          }
        }
      } catch (phoneError) {
        console.warn('전화번호 처리 오류:', phoneError);
      }

      return {
        id: customer.id,
        customer_code: customer.customer_code,
        name: customer.name,
        phone: maskedPhone
      };
    });

    console.log('✅ 고객 검색 성공:', { 
      count: processedCustomers.length,
      customers: processedCustomers.map(c => ({ name: c.name, code: c.customer_code }))
    });

    return NextResponse.json({
      success: true,
      customers: processedCustomers
    });

  } catch (error) {
    console.error('❌ 고객 검색 API 오류:', error);
    return NextResponse.json(
      { error: '고객 검색 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
