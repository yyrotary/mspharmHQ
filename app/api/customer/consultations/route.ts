import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 해당 고객의 상담 기록 조회
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select(`
        id,
        consultation_id,
        consult_date,
        symptoms,
        patient_condition,
        tongue_analysis,
        special_notes,
        prescription,
        result,
        image_urls,
        created_at
      `)
      .eq('customer_id', customerId)
      .order('consult_date', { ascending: false });

    if (error) {
      console.error('상담 기록 조회 오류:', error);
      return NextResponse.json(
        { error: '상담 기록을 불러오는데 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      consultations: consultations || []
    });

  } catch (error) {
    console.error('상담 기록 API 오류:', error);
    return NextResponse.json(
      { error: '상담 기록 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
