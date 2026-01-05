import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Gemini AI 설정
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

interface LifestyleRecommendation {
  category: string;
  recommendations: string[];
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

interface PersonalizedTips {
  daily_routine: LifestyleRecommendation;
  nutrition: LifestyleRecommendation;
  exercise: LifestyleRecommendation;
  medication_management: LifestyleRecommendation;
  stress_management: LifestyleRecommendation;
  general_wellness: string[];
  custom_message: string;
}

export async function POST(request: NextRequest) {
  try {
    const { customerId } = await request.json();

    console.log('🎯 개인맞춤 생활 관리 팁 생성 시작:', customerId);

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 1. 고객의 최근 상담 기록과 건강 데이터 수집
    const healthProfile = await gatherHealthProfile(customerId);
    
    if (!healthProfile) {
      return NextResponse.json(
        { error: '건강 프로필을 수집할 수 없습니다' },
        { status: 500 }
      );
    }

    // 2. AI로 개인맞춤 생활 관리 팁 생성
    const personalizedTips = await generatePersonalizedTips(healthProfile);

    console.log('✅ 개인맞춤 생활 관리 팁 생성 완료');

    return NextResponse.json({
      success: true,
      tips: personalizedTips,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ 생활 관리 팁 생성 오류:', error);
    return NextResponse.json(
      { error: '생활 관리 팁 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

async function gatherHealthProfile(customerId: string) {
  try {
    // 1. 최근 상담 기록 조회
    const { data: consultations, error: consultError } = await supabase
      .from('consultations')
      .select('symptoms, patient_condition, tongue_analysis, prescription, result, consult_date')
      .eq('customer_id', customerId)
      .order('consult_date', { ascending: false })
      .limit(3);

    if (consultError) {
      console.error('상담 기록 조회 오류:', consultError);
      return null;
    }

    // 2. 고객 기본 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, gender, estimated_age, special_notes')
      .eq('id', customerId)
      .single();

    if (customerError) {
      console.error('고객 정보 조회 오류:', customerError);
      return null;
    }

    // 3. 최근 음식 기록 조회 (있다면)
    const { data: foodRecords } = await supabase
      .from('food_records')
      .select('food_name, meal_type, recorded_date')
      .eq('customer_id', customerId)
      .order('recorded_date', { ascending: false })
      .limit(5);

    return {
      customer,
      consultations: consultations || [],
      foodRecords: foodRecords || []
    };

  } catch (error) {
    console.error('건강 프로필 수집 오류:', error);
    return null;
  }
}

async function generatePersonalizedTips(healthProfile: any): Promise<PersonalizedTips> {
  const { customer, consultations, foodRecords } = healthProfile;

  const prompt = `
한의학 관점에서 다음 고객의 건강 상태를 분석하고 개인맞춤 생활 관리 팁을 제공해주세요.

고객 정보:
- 이름: ${customer.name}
- 성별: ${customer.gender}
- 추정 연령: ${customer.estimated_age}세
- 특이사항: ${customer.special_notes || '없음'}

최근 상담 기록 (최신 3건):
${consultations.map((c: any, idx: number) => `
${idx + 1}. 상담일: ${c.consult_date}
   - 증상: ${c.symptoms}
   - 환자 상태: ${c.patient_condition || '기록 없음'}
   - 설진: ${c.tongue_analysis || '기록 없음'}
   - 처방: ${c.prescription || '기록 없음'}
   - 소견: ${c.result || '기록 없음'}
`).join('')}

최근 식단 기록:
${foodRecords.length > 0 ? foodRecords.map((f: any, idx: number) => `
${idx + 1}. ${f.recorded_date}: ${f.meal_type} - ${f.food_name}
`).join('') : '식단 기록 없음'}

다음 JSON 형식으로 응답해주세요:
{
  "daily_routine": {
    "category": "일상 생활",
    "recommendations": ["구체적인 일과 관리 팁1", "구체적인 일과 관리 팁2"],
    "reasoning": "이 권장사항의 한의학적 근거",
    "priority": "high|medium|low"
  },
  "nutrition": {
    "category": "식습관",
    "recommendations": ["구체적인 식단 조절 팁1", "구체적인 식단 조절 팁2"],
    "reasoning": "이 권장사항의 한의학적 근거",
    "priority": "high|medium|low"
  },
  "exercise": {
    "category": "운동",
    "recommendations": ["적절한 운동법1", "적절한 운동법2"],
    "reasoning": "이 권장사항의 한의학적 근거",
    "priority": "high|medium|low"
  },
  "medication_management": {
    "category": "복약 관리",
    "recommendations": ["복약 관리 팁1", "복약 관리 팁2"],
    "reasoning": "이 권장사항의 한의학적 근거",
    "priority": "high|medium|low"
  },
  "stress_management": {
    "category": "스트레스 관리",
    "recommendations": ["스트레스 해소법1", "스트레스 해소법2"],
    "reasoning": "이 권장사항의 한의학적 근거",
    "priority": "high|medium|low"
  },
  "general_wellness": ["일반적인 건강 관리 팁1", "일반적인 건강 관리 팁2", "일반적인 건강 관리 팁3"],
  "custom_message": "고객에게 전하는 개인적인 격려 메시지 (100자 이내)"
}

주의사항:
- 한의학 이론(오행, 기혈, 음양)에 기반한 구체적인 조언
- 고객의 체질과 현재 상태를 고려한 맞춤형 권장사항
- 실생활에서 바로 적용 가능한 구체적인 방법 제시
- 긍정적이고 격려적인 톤으로 작성
- 의료진 상담이 필요한 경우 명시
`;

  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API 키가 설정되지 않았습니다');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    })
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

  let aiTips;
  try {
    aiTips = JSON.parse(jsonMatch[0]);
    console.log('✅ JSON 파싱 성공:', aiTips);
  } catch (parseError) {
    console.error('❌ JSON 파싱 실패:', parseError);
    console.error('파싱 시도한 문자열:', jsonMatch[0]);
    throw new Error('AI 응답 JSON 파싱에 실패했습니다');
  }
  return aiTips;
}
