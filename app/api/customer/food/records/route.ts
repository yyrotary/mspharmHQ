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
    const date = searchParams.get('date');

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('food_records')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_date', { ascending: false })
      .order('recorded_time', { ascending: false });

    // 특정 날짜가 지정된 경우
    if (date) {
      query = query.eq('recorded_date', date);
    }

    const { data: records, error } = await query;

    if (error) {
      console.error('음식 기록 조회 오류:', error);
      return NextResponse.json(
        { error: '음식 기록을 불러오는데 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      records: records || []
    });

  } catch (error) {
    console.error('음식 기록 API 오류:', error);
    return NextResponse.json(
      { error: '음식 기록 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
