import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '상담 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 상담 기록 조회
    const { data: consultation, error } = await supabaseAdmin
      .from('consultations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !consultation) {
      console.error('Consultation fetch error:', error);
      return NextResponse.json(
        { success: false, error: '상담 기록을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // AI 요약이 있는지 확인
    const { data: summary } = await supabaseAdmin
      .from('consultation_summaries')
      .select('*')
      .eq('consultation_id', id)
      .single();

    // 요약 데이터 병합
    const mergedData = {
      ...consultation,
      patient_friendly_summary: summary?.patient_friendly_summary || null,
      key_symptoms: summary?.key_symptoms || [],
      prescribed_medications: summary?.prescribed_medications || [],
      lifestyle_recommendations: summary?.lifestyle_recommendations || [],
      follow_up_notes: summary?.follow_up_notes || null,
      urgency_level: summary?.urgency_level || 'low'
    };

    return NextResponse.json({ success: true, consultation: mergedData });
  } catch (error) {
    console.error('Consultation detail error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
