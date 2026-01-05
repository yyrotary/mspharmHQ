import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recordId = params.id;

    if (!recordId) {
      return NextResponse.json(
        { error: '기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const { data: record, error } = await supabase
      .from('food_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      console.error('음식 기록 상세 조회 오류:', error);
      return NextResponse.json(
        { error: '음식 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      record
    });

  } catch (error) {
    console.error('음식 기록 상세 API 오류:', error);
    return NextResponse.json(
      { error: '음식 기록 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const recordId = params.id;
    const { notes } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: '기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const { data: record, error } = await supabase
      .from('food_records')
      .update({ 
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select()
      .single();

    if (error) {
      console.error('음식 기록 업데이트 오류:', error);
      return NextResponse.json(
        { error: '음식 기록 업데이트에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      record
    });

  } catch (error) {
    console.error('음식 기록 업데이트 API 오류:', error);
    return NextResponse.json(
      { error: '음식 기록 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
