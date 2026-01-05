import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface QuestionData {
  id: string;
  type: 'portion' | 'timing' | 'category' | 'confirmation';
  question: string;
  options?: string[];
  defaultValue?: string;
}

interface FoodAnalysisResult {
  food_name: string;
  food_category: string;
  confidence: number;
  questions: QuestionData[];
  estimated_calories_per_100g: number;
  nutritional_info: {
    carbohydrates: number;
    protein: number;
    fat: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { image, customerId, capturedAt } = await request.json();

    if (!image || !customerId) {
      return NextResponse.json(
        { error: '이미지와 고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Gemini Vision 모델로 음식 분석 (종류 파악 중심)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
이 음식 이미지를 분석하고, 상황에 맞는 질문을 동적으로 생성해주세요.

JSON 형태로 응답해주세요:
{
  "food_name": "구체적인 음식 이름 (한국어)",
  "food_category": "음식 카테고리 (한식/양식/중식/일식/간식/음료/과일/디저트 등)",
  "confidence": 0.85,
  "estimated_calories_per_serving": 400,
  "estimated_serving_size": "1인분/소량/대량",
  "nutritional_info": {
    "carbohydrates": 45,
    "protein": 20,
    "fat": 15
  },
  "analysis_context": {
    "appears_finished": true,
    "portion_clarity": "명확함/애매함/판단불가",
    "multiple_items": false,
    "eating_context": "식사중/식사완료/준비된음식"
  },
  "smart_questions": [
    {
      "id": "portion_check",
      "question": "이 정도 양을 드신 게 맞나요?",
      "reason": "접시가 깨끗해서 다 드신 것 같지만 확인이 필요합니다",
      "options": ["네, 다 먹었어요", "일부만 먹었어요"],
      "skip_if": "appears_finished === true && portion_clarity === '명확함'"
    },
    {
      "id": "food_confirmation", 
      "question": "이 음식이 '김치찌개'가 맞나요?",
      "reason": "AI 신뢰도가 낮아 확인이 필요합니다",
      "options": ["맞습니다", "아닙니다"],
      "skip_if": "confidence > 0.8"
    }
  ]
}

분석 기준:
1. **음식명 확신도**: 0.8 이상이면 음식명 확인 질문 생략
2. **섭취량 추정**: 
   - 접시가 깨끗하거나 잔여물이 거의 없으면 "다 먹음"으로 추정
   - 소량 포장 음식(과자, 음료 등)은 섭취량 질문 생략
   - 대량이거나 여러 개가 보이면 섭취량 질문 포함
3. **섭취 시간**: 
   - 실시간 촬영(음식이 준비된 상태, 먹는 중)이면 시간 질문 생략
   - 갤러리 사진이나 이미 먹은 흔적이 있으면 시간 질문 포함
4. **식사 구분**: 시간대 자동 추정으로 충분, 별도 질문 불필요

필요한 질문만 생성하되, 불필요한 질문은 과감히 제외하세요.
`;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱
    let analysisResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      analysisResult = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Gemini 응답 파싱 오류:', parseError);
      return NextResponse.json(
        { error: 'AI 분석 결과를 처리하는데 실패했습니다' },
        { status: 500 }
      );
    }

    // AI가 생성한 스마트 질문들을 필터링하고 처리
    const questions = processSmartQuestions(analysisResult.smart_questions || [], analysisResult, capturedAt);

    // 이미지를 Supabase Storage에 업로드
    const imageBuffer = Buffer.from(image, 'base64');
    const fileName = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('food-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg'
      });

    let imageUrl = null;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('food-images')
        .getPublicUrl(uploadData.path);
      imageUrl = urlData.publicUrl;
    }

    // 임시 음식 분석 세션을 데이터베이스에 저장
    const { data: sessionData, error: sessionError } = await supabase
      .from('food_analysis_sessions')
      .insert({
        customer_id: customerId,
        image_url: imageUrl,
        analysis_result: analysisResult,
        questions: questions,
        status: 'pending_questions',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) {
      console.error('세션 저장 오류:', sessionError);
      return NextResponse.json(
        { error: '분석 세션을 저장하는데 실패했습니다' },
        { status: 500 }
      );
    }

    const responseData: FoodAnalysisResult = {
      food_name: analysisResult.food_name || '알 수 없는 음식',
      food_category: analysisResult.food_category || '기타',
      confidence: analysisResult.confidence || 0.5,
      questions: questions,
      estimated_calories_per_100g: analysisResult.estimated_calories_per_100g || 200,
      nutritional_info: analysisResult.nutritional_info || {
        carbohydrates: 0,
        protein: 0,
        fat: 0
      }
    };

    return NextResponse.json({
      success: true,
      sessionId: sessionData.id,
      imageUrl: imageUrl,
      analysis: responseData
    });

  } catch (error) {
    console.error('음식 분석 오류:', error);
    return NextResponse.json(
      { error: '음식 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function processSmartQuestions(smartQuestions: any[], analysisResult: any, capturedAt?: string): QuestionData[] {
  const questions: QuestionData[] = [];
  const context = analysisResult.analysis_context || {};

  // AI가 생성한 스마트 질문들을 처리
  for (const smartQuestion of smartQuestions) {
    // skip_if 조건 확인
    if (shouldSkipQuestion(smartQuestion, analysisResult, context)) {
      console.log(`질문 스킵: ${smartQuestion.id} - ${smartQuestion.reason}`);
      continue;
    }

    // 질문을 실제 QuestionData 형태로 변환
    const question: QuestionData = {
      id: smartQuestion.id,
      type: getQuestionType(smartQuestion.id),
      question: smartQuestion.question,
      options: smartQuestion.options || [],
      defaultValue: smartQuestion.options?.[0] || ''
    };

    questions.push(question);
  }

  // 최소한의 필수 정보는 항상 확보 (질문이 너무 적을 때)
  if (questions.length === 0) {
    // 최소한 음식명이라도 확인
    questions.push({
      id: 'food_confirmation',
      type: 'confirmation',
      question: `이 음식이 "${analysisResult.food_name}"가 맞나요?`,
      options: ['맞습니다', '다른 음식입니다'],
      defaultValue: '맞습니다'
    });
  }

  return questions;
}

function shouldSkipQuestion(smartQuestion: any, analysisResult: any, context: any): boolean {
  const skipCondition = smartQuestion.skip_if;
  if (!skipCondition) return false;

  try {
    // 간단한 조건 파싱 (예: "confidence > 0.8")
    if (skipCondition.includes('confidence >')) {
      const threshold = parseFloat(skipCondition.match(/[\d.]+/)?.[0] || '0');
      return analysisResult.confidence > threshold;
    }

    if (skipCondition.includes('appears_finished === true')) {
      return context.appears_finished === true;
    }

    if (skipCondition.includes('portion_clarity === \'명확함\'')) {
      return context.portion_clarity === '명확함';
    }

    if (skipCondition.includes('eating_context === \'식사완료\'')) {
      return context.eating_context === '식사완료';
    }

    // 복합 조건 (appears_finished === true && portion_clarity === '명확함')
    if (skipCondition.includes('&&')) {
      const conditions = skipCondition.split('&&').map(c => c.trim());
      return conditions.every(condition => shouldSkipQuestion({skip_if: condition}, analysisResult, context));
    }

  } catch (error) {
    console.error('조건 파싱 오류:', error);
    return false; // 오류 시 질문 포함
  }

  return false;
}

function getQuestionType(questionId: string): 'portion' | 'timing' | 'category' | 'confirmation' {
  if (questionId.includes('portion')) return 'portion';
  if (questionId.includes('timing') || questionId.includes('time')) return 'timing';
  if (questionId.includes('meal') || questionId.includes('category')) return 'category';
  return 'confirmation';
}

// 시간대별 식사 구분 헬퍼 함수
function getMealTypeByTime(dateTime: Date): string {
  const hour = dateTime.getHours();
  
  if (hour >= 6 && hour < 10) return '아침';
  if (hour >= 11 && hour < 15) return '점심';
  if (hour >= 17 && hour < 21) return '저녁';
  if (hour >= 21 || hour < 2) return '야식';
  return '간식';
}
