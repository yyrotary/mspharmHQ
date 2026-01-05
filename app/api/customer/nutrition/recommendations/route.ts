import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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

    // 1. 고객 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, special_notes, estimated_age, gender')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 최근 상담 기록 조회 (최근 5개)
    const { data: consultations, error: consultError } = await supabase
      .from('consultations')
      .select('symptoms, patient_condition, prescription, special_notes, result, consult_date')
      .eq('customer_id', customerId)
      .order('consult_date', { ascending: false })
      .limit(5);

    // 3. 최근 7일간 음식 기록 조회
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const startDate = sevenDaysAgo.toISOString().split('T')[0];

    const { data: foodRecords, error: foodError } = await supabase
      .from('food_records')
      .select('food_name, food_category, nutritional_info, gemini_analysis, recorded_date, meal_type, actual_calories')
      .eq('customer_id', customerId)
      .gte('recorded_date', startDate)
      .order('recorded_date', { ascending: false });

    // 4. 영양 통계 계산
    const nutritionSummary = calculateNutritionSummary(foodRecords || []);

    // 5. Gemini를 사용하여 맞춤 권장사항 생성
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
당신은 전문 약사입니다. 다음 환자 정보를 바탕으로 맞춤형 영양 및 생활습관 권장사항을 제공해주세요.

## 환자 기본 정보
- 이름: ${customer.name}
- 추정 나이: ${customer.estimated_age || '미상'}세
- 성별: ${customer.gender || '미상'}
- 특이사항: ${customer.special_notes || '없음'}

## 최근 상담 기록
${consultations && consultations.length > 0 ? consultations.map((c: any, i: number) => `
### 상담 ${i + 1} (${c.consult_date})
- 호소증상: ${c.symptoms || '없음'}
- 환자상태: ${c.patient_condition || '없음'}
- 처방약: ${c.prescription || '없음'}
- 특이사항: ${c.special_notes || '없음'}
- 결과: ${c.result || '없음'}
`).join('\n') : '상담 기록이 없습니다.'}

## 최근 7일 식사 패턴 분석
- 총 식사 횟수: ${nutritionSummary.totalMeals}회
- 평균 일일 칼로리: ${nutritionSummary.avgCalories}kcal
- 평균 탄수화물: ${nutritionSummary.avgCarbs}g
- 평균 단백질: ${nutritionSummary.avgProtein}g
- 평균 지방: ${nutritionSummary.avgFat}g
- 평균 나트륨: ${nutritionSummary.avgSodium}mg
- 평균 당류: ${nutritionSummary.avgSugar}g
- 주요 음식 카테고리: ${nutritionSummary.topCategories.join(', ')}
- 자주 먹는 음식: ${nutritionSummary.frequentFoods.join(', ')}

## 요청사항
위 정보를 바탕으로 다음 형식의 JSON으로 맞춤 권장사항을 제공해주세요:

{
  "overall_assessment": "전반적인 건강 상태 및 식습관 평가 (2-3문장)",
  "condition_specific_advice": [
    {
      "condition": "관련 질환/증상명",
      "dietary_advice": "식단 관련 조언",
      "foods_to_increase": ["권장 음식1", "권장 음식2"],
      "foods_to_avoid": ["주의 음식1", "주의 음식2"],
      "lifestyle_tips": "생활습관 조언"
    }
  ],
  "nutrition_improvements": [
    {
      "nutrient": "부족하거나 과잉인 영양소",
      "current_status": "현재 상태 설명",
      "recommendation": "개선 방안",
      "suggested_foods": ["권장 음식1", "권장 음식2"]
    }
  ],
  "meal_pattern_advice": {
    "positive_points": ["잘하고 있는 점1", "잘하고 있는 점2"],
    "areas_to_improve": ["개선이 필요한 점1", "개선이 필요한 점2"],
    "meal_schedule_tips": "식사 시간/규칙성 관련 조언"
  },
  "weekly_meal_suggestions": {
    "breakfast": ["아침 추천 메뉴1", "아침 추천 메뉴2"],
    "lunch": ["점심 추천 메뉴1", "점심 추천 메뉴2"],
    "dinner": ["저녁 추천 메뉴1", "저녁 추천 메뉴2"],
    "snacks": ["건강 간식1", "건강 간식2"]
  },
  "medication_food_interactions": "복용 중인 약과 음식 상호작용 주의사항 (있는 경우)",
  "priority_actions": ["가장 시급한 개선 사항1", "가장 시급한 개선 사항2", "가장 시급한 개선 사항3"],
  "encouraging_message": "환자에게 전하는 격려/동기부여 메시지"
}

모든 내용은 한국어로 작성하고, 환자의 상태와 식습관에 맞춤화된 실질적인 조언을 제공해주세요.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱
    let recommendations;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      recommendations = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Gemini 응답 파싱 오류:', parseError);
      // 기본 권장사항 반환
      recommendations = generateDefaultRecommendations(nutritionSummary);
    }

    return NextResponse.json({
      success: true,
      customer: {
        name: customer.name,
        age: customer.estimated_age,
        gender: customer.gender,
        conditions: customer.special_notes
      },
      nutritionSummary,
      recommendations,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('권장사항 생성 API 오류:', error);
    return NextResponse.json(
      { error: '권장사항 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function calculateNutritionSummary(foodRecords: any[]) {
  if (foodRecords.length === 0) {
    return {
      totalMeals: 0,
      avgCalories: 0,
      avgCarbs: 0,
      avgProtein: 0,
      avgFat: 0,
      avgSodium: 0,
      avgSugar: 0,
      topCategories: [],
      frequentFoods: []
    };
  }

  // 일별로 그룹화하여 평균 계산
  const dailyTotals: { [date: string]: any } = {};
  const categoryCounts: { [category: string]: number } = {};
  const foodCounts: { [food: string]: number } = {};

  foodRecords.forEach(record => {
    const date = record.recorded_date;
    if (!dailyTotals[date]) {
      dailyTotals[date] = {
        calories: 0,
        carbs: 0,
        protein: 0,
        fat: 0,
        sodium: 0,
        sugar: 0,
        meals: 0
      };
    }

    const nutrition = record.nutritional_info || record.gemini_analysis?.nutrition || {};
    
    dailyTotals[date].calories += record.actual_calories || nutrition.calories || 0;
    dailyTotals[date].carbs += nutrition.carbohydrates || 0;
    dailyTotals[date].protein += nutrition.protein || 0;
    dailyTotals[date].fat += nutrition.fat || 0;
    dailyTotals[date].sodium += nutrition.sodium || 0;
    dailyTotals[date].sugar += nutrition.sugar || 0;
    dailyTotals[date].meals += 1;

    // 카테고리 카운트
    if (record.food_category) {
      categoryCounts[record.food_category] = (categoryCounts[record.food_category] || 0) + 1;
    }

    // 음식 카운트
    if (record.food_name) {
      foodCounts[record.food_name] = (foodCounts[record.food_name] || 0) + 1;
    }
  });

  const days = Object.keys(dailyTotals).length || 1;
  const totals = Object.values(dailyTotals).reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      carbs: acc.carbs + day.carbs,
      protein: acc.protein + day.protein,
      fat: acc.fat + day.fat,
      sodium: acc.sodium + day.sodium,
      sugar: acc.sugar + day.sugar
    }),
    { calories: 0, carbs: 0, protein: 0, fat: 0, sodium: 0, sugar: 0 }
  );

  // 상위 카테고리
  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);

  // 자주 먹는 음식
  const frequentFoods = Object.entries(foodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([food]) => food);

  return {
    totalMeals: foodRecords.length,
    avgCalories: Math.round(totals.calories / days),
    avgCarbs: Math.round(totals.carbs / days),
    avgProtein: Math.round(totals.protein / days),
    avgFat: Math.round(totals.fat / days),
    avgSodium: Math.round(totals.sodium / days),
    avgSugar: Math.round(totals.sugar / days),
    topCategories,
    frequentFoods
  };
}

function generateDefaultRecommendations(summary: any) {
  return {
    overall_assessment: "식사 기록을 바탕으로 분석한 결과, 전반적인 영양 상태를 점검해 주세요.",
    condition_specific_advice: [],
    nutrition_improvements: [
      {
        nutrient: "균형 잡힌 식단",
        current_status: "식사 기록 분석 중",
        recommendation: "매끼 단백질, 탄수화물, 채소를 균형 있게 섭취하세요.",
        suggested_foods: ["현미밥", "닭가슴살", "계절 채소"]
      }
    ],
    meal_pattern_advice: {
      positive_points: ["음식 기록을 시작하셨습니다"],
      areas_to_improve: ["꾸준한 식사 기록이 필요합니다"],
      meal_schedule_tips: "하루 세 끼 규칙적인 식사를 권장합니다."
    },
    weekly_meal_suggestions: {
      breakfast: ["현미밥과 된장국", "통밀빵과 계란"],
      lunch: ["비빔밥", "닭가슴살 샐러드"],
      dinner: ["생선구이와 채소", "두부 찌개"],
      snacks: ["견과류", "신선한 과일"]
    },
    medication_food_interactions: "복용 중인 약이 있다면 약사와 상담하세요.",
    priority_actions: [
      "매일 식사 기록을 꾸준히 해주세요",
      "물을 충분히 마셔주세요",
      "규칙적인 식사 시간을 유지해주세요"
    ],
    encouraging_message: "건강한 식습관을 위한 첫 걸음을 내딛으셨습니다! 꾸준히 기록하시면 더 나은 조언을 드릴 수 있습니다."
  };
}

