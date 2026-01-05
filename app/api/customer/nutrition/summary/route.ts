import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 일일 권장 섭취량
const DAILY_RECOMMENDED = {
  calories: 2000,
  carbohydrates: 300,
  protein: 65,
  fat: 65,
  fiber: 25,
  sodium: 2000,
  sugar: 50,
};

/**
 * 환자의 영양 분석 요약을 텍스트 형식으로 반환
 * 상담 노트에 포함하기 위한 API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const days = parseInt(searchParams.get('days') || '7');
    const format = searchParams.get('format') || 'text'; // text, json, html

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 고객 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('name, special_notes')
      .eq('id', customerId)
      .single();

    if (customerError) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 기간 계산
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date().toISOString().split('T')[0];

    // 음식 기록 조회
    const { data: foodRecords, error: foodError } = await supabase
      .from('food_records')
      .select('*')
      .eq('customer_id', customerId)
      .gte('recorded_date', startDateStr)
      .lte('recorded_date', endDateStr)
      .order('recorded_date', { ascending: false });

    if (foodError) {
      console.error('음식 기록 조회 오류:', foodError);
    }

    // 통계 계산
    const stats = calculateStats(foodRecords || [], days);
    
    // 환자별 경고 생성
    const warnings = generatePatientWarnings(stats, customer.special_notes || '');
    
    // 권장사항 생성
    const recommendations = generateQuickRecommendations(stats, warnings);

    // 포맷에 따라 출력
    let summary: string;
    if (format === 'html') {
      summary = generateHtmlSummary(customer.name, stats, warnings, recommendations, days);
    } else if (format === 'json') {
      return NextResponse.json({
        success: true,
        summary: {
          customer: customer.name,
          period: `최근 ${days}일`,
          stats,
          warnings,
          recommendations
        }
      });
    } else {
      summary = generateTextSummary(customer.name, stats, warnings, recommendations, days);
    }

    return NextResponse.json({
      success: true,
      summary,
      stats,
      warnings,
      recommendations
    });

  } catch (error) {
    console.error('영양 요약 API 오류:', error);
    return NextResponse.json(
      { error: '영양 요약 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function calculateStats(records: any[], days: number) {
  if (records.length === 0) {
    return {
      totalMeals: 0,
      daysRecorded: 0,
      avgMealsPerDay: 0,
      avgCalories: 0,
      avgCarbohydrates: 0,
      avgProtein: 0,
      avgFat: 0,
      avgFiber: 0,
      avgSodium: 0,
      avgSugar: 0,
      topFoods: [],
      mealTypeDistribution: { 아침: 0, 점심: 0, 저녁: 0, 간식: 0, 야식: 0 }
    };
  }

  // 날짜별로 그룹화
  const dailyTotals: { [date: string]: any } = {};
  const foodCounts: { [food: string]: number } = {};
  const mealTypeCounts = { 아침: 0, 점심: 0, 저녁: 0, 간식: 0, 야식: 0 };

  records.forEach(record => {
    const date = record.recorded_date;
    if (!dailyTotals[date]) {
      dailyTotals[date] = {
        calories: 0,
        carbohydrates: 0,
        protein: 0,
        fat: 0,
        fiber: 0,
        sodium: 0,
        sugar: 0
      };
    }

    const nutrition = record.nutritional_info || record.gemini_analysis?.nutrition || {};
    
    dailyTotals[date].calories += record.actual_calories || nutrition.calories || 0;
    dailyTotals[date].carbohydrates += nutrition.carbohydrates || 0;
    dailyTotals[date].protein += nutrition.protein || 0;
    dailyTotals[date].fat += nutrition.fat || 0;
    dailyTotals[date].fiber += nutrition.fiber || 0;
    dailyTotals[date].sodium += nutrition.sodium || 0;
    dailyTotals[date].sugar += nutrition.sugar || 0;

    // 음식 카운트
    if (record.food_name) {
      foodCounts[record.food_name] = (foodCounts[record.food_name] || 0) + 1;
    }

    // 식사 타입 카운트
    const mealType = record.meal_type as keyof typeof mealTypeCounts;
    if (mealTypeCounts[mealType] !== undefined) {
      mealTypeCounts[mealType]++;
    }
  });

  const daysRecorded = Object.keys(dailyTotals).length || 1;
  const totals = Object.values(dailyTotals).reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories,
      carbohydrates: acc.carbohydrates + day.carbohydrates,
      protein: acc.protein + day.protein,
      fat: acc.fat + day.fat,
      fiber: acc.fiber + day.fiber,
      sodium: acc.sodium + day.sodium,
      sugar: acc.sugar + day.sugar
    }),
    { calories: 0, carbohydrates: 0, protein: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 }
  );

  // 상위 음식
  const topFoods = Object.entries(foodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([food, count]) => `${food}(${count}회)`);

  return {
    totalMeals: records.length,
    daysRecorded,
    avgMealsPerDay: Math.round((records.length / daysRecorded) * 10) / 10,
    avgCalories: Math.round(totals.calories / daysRecorded),
    avgCarbohydrates: Math.round(totals.carbohydrates / daysRecorded),
    avgProtein: Math.round(totals.protein / daysRecorded),
    avgFat: Math.round(totals.fat / daysRecorded),
    avgFiber: Math.round(totals.fiber / daysRecorded),
    avgSodium: Math.round(totals.sodium / daysRecorded),
    avgSugar: Math.round(totals.sugar / daysRecorded),
    topFoods,
    mealTypeDistribution: mealTypeCounts
  };
}

function generatePatientWarnings(stats: any, specialNotes: string): string[] {
  const warnings: string[] = [];
  const notes = specialNotes.toLowerCase();

  // 당뇨 환자
  if (notes.includes('당뇨') || notes.includes('혈당')) {
    if (stats.avgSugar > 30) {
      warnings.push('당뇨 환자: 당류 섭취량이 높습니다 (일평균 ' + stats.avgSugar + 'g)');
    }
    if (stats.avgCarbohydrates > 250) {
      warnings.push('당뇨 환자: 탄수화물 섭취 주의 필요');
    }
  }

  // 고혈압 환자
  if (notes.includes('고혈압') || notes.includes('혈압')) {
    if (stats.avgSodium > 2000) {
      warnings.push('고혈압 환자: 나트륨 섭취 과다 (일평균 ' + stats.avgSodium + 'mg)');
    }
  }

  // 신장질환
  if (notes.includes('신장') || notes.includes('신부전') || notes.includes('투석')) {
    if (stats.avgProtein > 70) {
      warnings.push('신장질환 환자: 단백질 섭취량 주의 필요');
    }
    if (stats.avgSodium > 1500) {
      warnings.push('신장질환 환자: 나트륨 제한 필요');
    }
  }

  // 비만/체중관리
  if (notes.includes('비만') || notes.includes('체중') || notes.includes('다이어트')) {
    if (stats.avgCalories > 2200) {
      warnings.push('체중관리: 칼로리 섭취 과다 (일평균 ' + stats.avgCalories + 'kcal)');
    }
  }

  // 일반적인 경고
  if (stats.avgSodium > 2300) {
    warnings.push('나트륨 섭취 과다 주의');
  }
  if (stats.avgFiber < 15) {
    warnings.push('식이섬유 섭취 부족');
  }
  if (stats.avgProtein < 40) {
    warnings.push('단백질 섭취 부족');
  }
  if (stats.avgMealsPerDay < 2) {
    warnings.push('식사 횟수 부족 (불규칙한 식사)');
  }

  return warnings;
}

function generateQuickRecommendations(stats: any, warnings: string[]): string[] {
  const recommendations: string[] = [];

  if (stats.avgCalories < 1500) {
    recommendations.push('영양가 높은 식사량 증가 필요');
  } else if (stats.avgCalories > 2500) {
    recommendations.push('식사량 조절 및 저칼로리 식품 선택 권장');
  }

  if (stats.avgFiber < 20) {
    recommendations.push('채소, 과일, 잡곡 섭취 권장');
  }

  if (stats.avgProtein < 50) {
    recommendations.push('단백질 섭취 증가 필요 (육류, 생선, 콩류)');
  }

  if (stats.avgSodium > 2000) {
    recommendations.push('짠 음식 섭취 줄이기 권장');
  }

  if (stats.mealTypeDistribution.아침 === 0) {
    recommendations.push('아침 식사 섭취 권장');
  }

  if (stats.mealTypeDistribution.야식 > 3) {
    recommendations.push('야식 줄이기 권장');
  }

  return recommendations;
}

function generateTextSummary(
  customerName: string,
  stats: any,
  warnings: string[],
  recommendations: string[],
  days: number
): string {
  let summary = `=== ${customerName}님 영양 분석 요약 (최근 ${days}일) ===\n\n`;

  if (stats.totalMeals === 0) {
    summary += '※ 등록된 식사 기록이 없습니다.\n';
    return summary;
  }

  summary += `[기록 현황]\n`;
  summary += `• 총 식사 기록: ${stats.totalMeals}끼\n`;
  summary += `• 기록된 날: ${stats.daysRecorded}일\n`;
  summary += `• 일평균 식사: ${stats.avgMealsPerDay}끼\n\n`;

  summary += `[일평균 영양 섭취량]\n`;
  summary += `• 칼로리: ${stats.avgCalories} kcal (권장 ${DAILY_RECOMMENDED.calories})\n`;
  summary += `• 탄수화물: ${stats.avgCarbohydrates}g (권장 ${DAILY_RECOMMENDED.carbohydrates}g)\n`;
  summary += `• 단백질: ${stats.avgProtein}g (권장 ${DAILY_RECOMMENDED.protein}g)\n`;
  summary += `• 지방: ${stats.avgFat}g (권장 ${DAILY_RECOMMENDED.fat}g)\n`;
  summary += `• 나트륨: ${stats.avgSodium}mg (권장 ${DAILY_RECOMMENDED.sodium}mg 이하)\n`;
  summary += `• 식이섬유: ${stats.avgFiber}g (권장 ${DAILY_RECOMMENDED.fiber}g)\n`;
  summary += `• 당류: ${stats.avgSugar}g (권장 ${DAILY_RECOMMENDED.sugar}g 이하)\n\n`;

  if (stats.topFoods.length > 0) {
    summary += `[자주 섭취한 음식]\n`;
    summary += `• ${stats.topFoods.join(', ')}\n\n`;
  }

  summary += `[식사 분포]\n`;
  summary += `• 아침: ${stats.mealTypeDistribution.아침}회\n`;
  summary += `• 점심: ${stats.mealTypeDistribution.점심}회\n`;
  summary += `• 저녁: ${stats.mealTypeDistribution.저녁}회\n`;
  summary += `• 간식: ${stats.mealTypeDistribution.간식}회\n`;
  if (stats.mealTypeDistribution.야식 > 0) {
    summary += `• 야식: ${stats.mealTypeDistribution.야식}회\n`;
  }
  summary += '\n';

  if (warnings.length > 0) {
    summary += `[주의사항]\n`;
    warnings.forEach(warning => {
      summary += `⚠️ ${warning}\n`;
    });
    summary += '\n';
  }

  if (recommendations.length > 0) {
    summary += `[권장사항]\n`;
    recommendations.forEach((rec, idx) => {
      summary += `${idx + 1}. ${rec}\n`;
    });
  }

  return summary;
}

function generateHtmlSummary(
  customerName: string,
  stats: any,
  warnings: string[],
  recommendations: string[],
  days: number
): string {
  let html = `<div style="padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;">`;
  html += `<h3 style="margin: 0 0 12px 0; color: #1e40af;">🥗 ${customerName}님 영양 분석 (최근 ${days}일)</h3>`;

  if (stats.totalMeals === 0) {
    html += `<p style="color: #6b7280;">등록된 식사 기록이 없습니다.</p>`;
    html += `</div>`;
    return html;
  }

  html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">`;
  html += `<div style="text-align: center; padding: 8px; background: white; border-radius: 4px;">
    <div style="font-size: 20px; font-weight: bold; color: #1e40af;">${stats.avgCalories}</div>
    <div style="font-size: 11px; color: #6b7280;">평균 칼로리</div>
  </div>`;
  html += `<div style="text-align: center; padding: 8px; background: white; border-radius: 4px;">
    <div style="font-size: 20px; font-weight: bold; color: #059669;">${stats.totalMeals}</div>
    <div style="font-size: 11px; color: #6b7280;">총 식사</div>
  </div>`;
  html += `<div style="text-align: center; padding: 8px; background: white; border-radius: 4px;">
    <div style="font-size: 20px; font-weight: bold; color: #7c3aed;">${stats.avgMealsPerDay}</div>
    <div style="font-size: 11px; color: #6b7280;">일평균 식사</div>
  </div>`;
  html += `</div>`;

  if (warnings.length > 0) {
    html += `<div style="background: #fef3c7; padding: 8px; border-radius: 4px; margin-bottom: 8px;">`;
    html += `<strong style="color: #92400e;">⚠️ 주의:</strong> `;
    html += `<span style="color: #78350f; font-size: 13px;">${warnings.join(' / ')}</span>`;
    html += `</div>`;
  }

  if (recommendations.length > 0) {
    html += `<div style="background: #dbeafe; padding: 8px; border-radius: 4px;">`;
    html += `<strong style="color: #1e40af;">💡 권장:</strong> `;
    html += `<span style="color: #1e3a8a; font-size: 13px;">${recommendations.join(' / ')}</span>`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

