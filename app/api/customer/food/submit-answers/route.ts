import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AnswerData {
  questionId: string;
  answer: string;
  customValue?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, answers, customerId } = await request.json();

    if (!sessionId || !answers || !customerId) {
      return NextResponse.json(
        { error: '세션 ID, 답변, 고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 분석 세션 조회
    const { data: session, error: sessionError } = await supabase
      .from('food_analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('customer_id', customerId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: '분석 세션을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 답변 처리
    const processedAnswers = processAnswers(answers);
    const finalFoodData = calculateFinalData(session.analysis_result, processedAnswers);

    // 최종 음식 기록을 데이터베이스에 저장
    const { data: foodRecord, error: dbError } = await supabase
      .from('food_records')
      .insert({
        customer_id: customerId,
        food_name: finalFoodData.food_name,
        food_description: finalFoodData.food_description,
        food_category: finalFoodData.food_category,
        image_url: session.image_url,
        confidence_score: finalFoodData.confidence_score,
        
        // 새로운 필드들
        portion_consumed: finalFoodData.portion_consumed,
        actual_calories: finalFoodData.actual_calories,
        meal_type: finalFoodData.meal_type,
        
        // 시간 정보
        recorded_date: finalFoodData.recorded_date,
        recorded_time: finalFoodData.recorded_time,
        consumed_at: finalFoodData.consumed_at,
        
        // 원본 분석 결과와 사용자 답변 저장
        gemini_analysis: session.analysis_result,
        user_answers: processedAnswers,
        
        // 영양 정보
        nutritional_info: finalFoodData.nutritional_info
      })
      .select()
      .single();

    if (dbError) {
      console.error('음식 기록 저장 오류:', dbError);
      return NextResponse.json(
        { error: '음식 기록을 저장하는데 실패했습니다' },
        { status: 500 }
      );
    }

    // 분석 세션 상태 업데이트
    await supabase
      .from('food_analysis_sessions')
      .update({
        status: 'completed',
        final_record_id: foodRecord.id,
        user_answers: processedAnswers,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      recordId: foodRecord.id,
      finalData: finalFoodData
    });

  } catch (error) {
    console.error('답변 처리 오류:', error);
    return NextResponse.json(
      { error: '답변 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function processAnswers(answers: AnswerData[]): Record<string, any> {
  const processed: Record<string, any> = {};

  answers.forEach(answer => {
    switch (answer.questionId) {
      case 'portion':
        // 섭취량 처리
        const portionMatch = answer.answer.match(/(\d+)%/);
        processed.portion_percentage = portionMatch ? parseInt(portionMatch[1]) : 100;
        break;

      case 'timing':
        // 섭취 시간 처리
        if (answer.answer.includes('방금 전')) {
          processed.consumed_time = new Date();
        } else if (answer.answer.includes('30분 전')) {
          const time = new Date();
          time.setMinutes(time.getMinutes() - 30);
          processed.consumed_time = time;
        } else if (answer.answer.includes('1시간 전')) {
          const time = new Date();
          time.setHours(time.getHours() - 1);
          processed.consumed_time = time;
        } else if (answer.answer.includes('2-3시간 전')) {
          const time = new Date();
          time.setHours(time.getHours() - 2.5);
          processed.consumed_time = time;
        } else if (answer.customValue) {
          // 직접 입력한 시간
          processed.consumed_time = new Date(answer.customValue);
        } else {
          processed.consumed_time = new Date();
        }
        break;

      case 'meal_type':
        processed.meal_type = answer.answer;
        break;

      case 'food_confirmation':
        if (answer.answer === '아닙니다 (직접 입력)' && answer.customValue) {
          processed.corrected_food_name = answer.customValue;
        }
        break;

      default:
        processed[answer.questionId] = answer.answer;
    }
  });

  return processed;
}

function calculateFinalData(analysisResult: any, processedAnswers: any): any {
  const consumedTime = processedAnswers.consumed_time || new Date();
  
  // AI가 이미 1인분 기준으로 칼로리를 추정했다고 가정
  const baseCalories = analysisResult.estimated_calories_per_serving || analysisResult.estimated_calories_per_100g || 200;
  const servingSize = analysisResult.estimated_serving_size || '1인분';
  
  // 섭취량 결정 - AI 분석과 사용자 답변을 종합
  let portionPercentage = 100; // 기본값: 100% 섭취
  
  if (processedAnswers.portion_percentage) {
    portionPercentage = processedAnswers.portion_percentage;
  } else if (analysisResult.analysis_context?.appears_finished) {
    portionPercentage = 100; // AI가 "다 먹은 것 같다"고 판단
  } else if (analysisResult.analysis_context?.portion_clarity === '애매함') {
    portionPercentage = 75; // 애매할 때는 3/4 정도로 추정
  }

  // 실제 섭취 칼로리 계산
  const actualCalories = Math.round(baseCalories * (portionPercentage / 100));

  // 영양 정보 계산 (1인분 기준)
  const nutritionalRatio = portionPercentage / 100;
  const nutritionalInfo = {
    carbohydrates: Math.round((analysisResult.nutritional_info?.carbohydrates || 0) * nutritionalRatio),
    protein: Math.round((analysisResult.nutritional_info?.protein || 0) * nutritionalRatio),
    fat: Math.round((analysisResult.nutritional_info?.fat || 0) * nutritionalRatio),
    estimated_weight_grams: getEstimatedWeight(servingSize, portionPercentage)
  };

  // 식사 구분은 시간대로 자동 결정
  const mealType = getMealTypeByTime(consumedTime);

  return {
    food_name: processedAnswers.corrected_food_name || analysisResult.food_name,
    food_description: generateDescription(analysisResult, portionPercentage),
    food_category: analysisResult.food_category,
    confidence_score: processedAnswers.corrected_food_name ? 1.0 : analysisResult.confidence,
    
    portion_consumed: portionPercentage,
    actual_calories: actualCalories,
    meal_type: mealType,
    
    recorded_date: new Date().toISOString().split('T')[0],
    recorded_time: new Date().toTimeString().split(' ')[0],
    consumed_at: consumedTime.toISOString(),
    
    nutritional_info: nutritionalInfo
  };
}

function getMealTypeByTime(consumedTime: Date): string {
  const hour = consumedTime.getHours();
  
  if (hour >= 6 && hour < 10) return '아침';
  if (hour >= 11 && hour < 15) return '점심'; 
  if (hour >= 17 && hour < 21) return '저녁';
  if (hour >= 21 || hour < 2) return '야식';
  return '간식';
}

function getEstimatedWeight(servingSize: string, portionPercentage: number): number {
  let baseWeight = 150; // 기본 1인분 150g
  
  if (servingSize.includes('소량')) baseWeight = 50;
  else if (servingSize.includes('대량')) baseWeight = 300;
  
  return Math.round(baseWeight * (portionPercentage / 100));
}

function generateDescription(analysisResult: any, portionPercentage: number): string {
  const foodName = analysisResult.food_name;
  const context = analysisResult.analysis_context;
  
  if (portionPercentage >= 95) {
    return `${foodName} (완전 섭취)`;
  } else if (portionPercentage >= 50) {
    return `${foodName} (대부분 섭취, ${portionPercentage}%)`;
  } else {
    return `${foodName} (일부 섭취, ${portionPercentage}%)`;
  }
}
