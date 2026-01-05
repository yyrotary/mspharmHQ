import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recordId = searchParams.get('recordId');

    console.log('🔍 음식 기록 API 호출:', { recordId });

    if (!recordId) {
      console.warn('⚠️ recordId 누락');
      return NextResponse.json(
        { error: '음식 기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 음식 기록 조회 (is_deleted 체크 제거)
    console.log('📊 Supabase 쿼리 시작...');
    const { data: record, error } = await supabase
      .from('food_records')
      .select('*')
      .eq('id', recordId)
      .single();

    console.log('📊 Supabase 응답:', { record: record ? 'found' : 'not found', error });

    if (error) {
      console.error('❌ 음식 기록 조회 오류:', error);
      return NextResponse.json(
        { error: `음식 기록을 찾을 수 없습니다: ${error.message}` },
        { status: 404 }
      );
    }

    if (!record) {
      console.warn('⚠️ 레코드가 null입니다');
      return NextResponse.json(
        { error: '해당 ID의 음식 기록이 존재하지 않습니다' },
        { status: 404 }
      );
    }

    console.log('✅ 음식 기록 조회 성공:', record.food_name);
    return NextResponse.json({
      success: true,
      record: record
    });

  } catch (error) {
    console.error('❌ 음식 기록 조회 중 오류:', error);
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}
