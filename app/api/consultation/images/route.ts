import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '500');

    // 기간 파라미터 검증
    if (!startDate || !endDate) {
      return NextResponse.json({ 
        error: '시작일과 종료일이 필요합니다.' 
      }, { status: 400 });
    }

    // 상담 데이터 조회 (이미지가 있는 것만)
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select(`
        id,
        customer_id,
        consult_date,
        symptoms,
        image_urls,
        customers (
          name,
          customer_code
        )
      `)
      .gte('consult_date', startDate)
      .lte('consult_date', endDate)
      .not('image_urls', 'is', null)
      .not('image_urls', 'eq', '{}')
      .order('consult_date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('상담 데이터 조회 오류:', error);
      return NextResponse.json({ 
        error: '상담 데이터 조회 중 오류가 발생했습니다.' 
      }, { status: 500 });
    }

    // 이미지 데이터 추출 및 변환
    const imageItems = [];
    
    for (const consultation of consultations || []) {
      const imageUrls = consultation.image_urls || [];
      const customerName = consultation.customers?.name || '이름 없음';
      const customerCode = consultation.customers?.customer_code || '';
      
      // 각 이미지에 대해 개별 아이템 생성
      imageUrls.forEach((imageUrl: string, index: number) => {
        if (imageUrl && imageUrl.trim()) {
          imageItems.push({
            id: `${consultation.id}-${index}`,
            url: imageUrl,
            customerName,
            customerCode,
            consultationDate: consultation.consult_date,
            consultationId: consultation.id,
            customerId: consultation.customer_id,
            consultationContent: consultation.symptoms || '',
            imageIndex: index
          });
        }
      });
    }

    // 날짜 순으로 정렬 (최신순)
    imageItems.sort((a, b) => 
      new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime()
    );

    return NextResponse.json({ 
      success: true,
      images: imageItems,
      count: imageItems.length,
      consultationCount: consultations?.length || 0
    });

  } catch (error) {
    console.error('이미지 조회 오류:', error);
    return NextResponse.json(
      { error: '이미지 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}