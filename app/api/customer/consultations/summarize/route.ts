import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gemini AI 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface ConsultationSummary {
  id: string;
  consultation_id: string;
  consult_date: string;
  patient_friendly_summary: string;
  key_symptoms: string[];
  prescribed_medications: string[];
  lifestyle_recommendations: string[];
  follow_up_notes: string;
  urgency_level: 'low' | 'medium' | 'high';
  created_at: string;
}

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json();

    console.log('🔍 고객 상담 요약 생성 시작:', customerId);

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 1. 고객의 최근 상담 기록 조회
    const { data: consultations, error: consultError } = await supabase
      .from('consultations')
      .select('*')
      .eq('customer_id', customerId)
      .order('consult_date', { ascending: false })
      .limit(5);

    if (consultError) {
      console.error('❌ 상담 기록 조회 오류:', consultError);
      return NextResponse.json(
        { error: '상담 기록을 불러올 수 없습니다' },
        { status: 500 }
      );
    }

    if (!consultations || consultations.length === 0) {
      return NextResponse.json({
        success: true,
        summaries: [],
        message: '상담 기록이 없습니다'
      });
    }

    console.log(`📋 ${consultations.length}개 상담 기록 발견`);

    // 2. 각 상담 기록을 AI로 요약
    const summaries: ConsultationSummary[] = [];
    
    for (const consultation of consultations) {
      try {
        const summary = await generatePatientFriendlySummary(consultation);
        summaries.push(summary);
        console.log(`✅ 상담 ${consultation.consultation_id} 요약 완료`);
      } catch (error) {
        console.error(`❌ 상담 ${consultation.consultation_id} 요약 실패:`, error);
        // 실패한 경우 기본 요약 생성
        summaries.push(createFallbackSummary(consultation));
      }
    }

    console.log(`🎉 총 ${summaries.length}개 상담 요약 생성 완료`);

    return NextResponse.json({
      success: true,
      summaries,
      total: summaries.length
    });

  } catch (error) {
    console.error('❌ 상담 요약 API 오류:', error);
    return NextResponse.json(
      { error: '상담 요약 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

async function generatePatientFriendlySummary(consultation: any): Promise<ConsultationSummary> {
  const prompt = `
다음 한의학 상담 기록을 환자(고객) 관점에서 이해하기 쉽게 요약해주세요. 
의료진만 알아야 할 세부사항은 제외하고, 환자가 알아야 할 핵심 내용만 포함해주세요.

상담 정보:
- 상담일: ${consultation.consult_date}
- 호소 증상: ${consultation.symptoms}
- 환자 상태: ${consultation.patient_condition || '기록 없음'}
- 설진 분석: ${consultation.tongue_analysis || '기록 없음'}
- 처방: ${consultation.prescription || '기록 없음'}
- 결과/소견: ${consultation.result || '기록 없음'}
- 특이사항: ${consultation.special_notes || '기록 없음'}

다음 JSON 형식으로 응답해주세요:
{
  "patient_friendly_summary": "환자가 이해하기 쉬운 한 문단 요약 (200자 이내)",
  "key_symptoms": ["주요 증상1", "주요 증상2"],
  "prescribed_medications": ["처방약/치료법1", "처방약/치료법2"],
  "lifestyle_recommendations": ["생활습관 권장사항1", "생활습관 권장사항2"],
  "follow_up_notes": "향후 주의사항이나 재방문 안내 (100자 이내)",
  "urgency_level": "low|medium|high"
}

주의사항:
- 의학 전문용어는 일반인이 이해할 수 있는 용어로 변경
- 환자가 불안해할 수 있는 표현은 순화
- 구체적인 복용법과 생활 관리 팁 포함
- 긍정적이고 도움이 되는 톤으로 작성
`;

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다');
  }

  console.log(`🔄 Gemini API 호출 시작 - 상담 ID: ${consultation.consultation_id}`);
  
  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.3,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  };
  
  console.log('📤 Gemini API 요청 내용:', JSON.stringify(requestBody, null, 2));

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw new Error(`Gemini API 오류: ${response.status}`);
  }

  const aiResponse = await response.json();
  console.log('🤖 Gemini AI 응답:', JSON.stringify(aiResponse, null, 2));
  
  // 응답 구조 확인
  if (!aiResponse.candidates || !Array.isArray(aiResponse.candidates) || aiResponse.candidates.length === 0) {
    console.error('❌ candidates 배열이 비어있음:', aiResponse);
    throw new Error('AI 응답에 candidates가 없습니다');
  }

  const candidate = aiResponse.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    console.error('❌ content 또는 parts가 비어있음:', candidate);
    throw new Error('AI 응답 content가 비어있습니다');
  }

  const content = candidate.content.parts[0]?.text;
  if (!content) {
    console.error('❌ text 내용이 비어있음:', candidate.content.parts[0]);
    throw new Error('AI 응답 텍스트가 비어있습니다');
  }

  // JSON 파싱
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('❌ JSON 패턴을 찾을 수 없음. 응답 내용:', content);
    throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');
  }

  let aiSummary;
  try {
    aiSummary = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON 파싱 성공:', aiSummary);
  } catch (parseError) {
    console.error('❌ JSON 파싱 실패:', parseError);
    console.error('파싱 시도한 문자열:', jsonMatch[0]);
    throw new Error('AI 응답 JSON 파싱에 실패했습니다');
  }

  return {
    id: consultation.id,
    consultation_id: consultation.consultation_id,
    consult_date: consultation.consult_date,
    patient_friendly_summary: aiSummary.patient_friendly_summary,
    key_symptoms: aiSummary.key_symptoms || [],
    prescribed_medications: aiSummary.prescribed_medications || [],
    lifestyle_recommendations: aiSummary.lifestyle_recommendations || [],
    follow_up_notes: aiSummary.follow_up_notes || '',
    urgency_level: aiSummary.urgency_level || 'low',
    created_at: consultation.created_at
  };
}

function createFallbackSummary(consultation: any): ConsultationSummary {
  return {
    id: consultation.id,
    consultation_id: consultation.consultation_id,
    consult_date: consultation.consult_date,
    patient_friendly_summary: consultation.symptoms ? 
      `${consultation.symptoms.substring(0, 150)}에 대한 상담을 받으셨습니다.` : 
      '상담 내용을 확인할 수 없습니다.',
    key_symptoms: consultation.symptoms ? [consultation.symptoms.substring(0, 50)] : [],
    prescribed_medications: consultation.prescription ? [consultation.prescription.substring(0, 100)] : [],
    lifestyle_recommendations: ['규칙적인 생활습관 유지', '적절한 휴식'],
    follow_up_notes: '증상 변화 시 재방문 권장',
    urgency_level: 'low' as const,
    created_at: consultation.created_at
  };
}
