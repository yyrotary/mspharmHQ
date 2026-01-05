import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 일일 권장 섭취량
const DAILY_RECOMMENDED = {
  calories: 2000,
  carbohydrates: 300, // g
  protein: 65, // g
  fat: 65, // g
  fiber: 25, // g
  sodium: 2000, // mg
  sugar: 50, // g
  cholesterol: 300, // mg
  saturated_fat: 20, // g
};

// 영양소 상태 판정
type NutrientStatus = 'deficient' | 'normal' | 'excess';

interface NutrientAnalysis {
  value: number;
  recommended: number;
  percentage: number;
  status: NutrientStatus;
  message: string;
}

interface DailyStats {
  date: string;
  total_calories: number;
  total_carbohydrates: number;
  total_protein: number;
  total_fat: number;
  total_fiber: number;
  total_sodium: number;
  total_sugar: number;
  meal_count: number;
  meals_by_type: {
    아침: number;
    점심: number;
    저녁: number;
    간식: number;
    야식: number;
  };
  nutrient_analysis: {
    calories: NutrientAnalysis;
    carbohydrates: NutrientAnalysis;
    protein: NutrientAnalysis;
    fat: NutrientAnalysis;
    fiber: NutrientAnalysis;
    sodium: NutrientAnalysis;
    sugar: NutrientAnalysis;
  };
  warnings: string[];
  health_score: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const period = searchParams.get('period') || 'day'; // day, week, month
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!customerId) {
      return NextResponse.json(
        { error: '고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 기간에 따른 날짜 범위 계산
    const { startDate, endDate } = calculateDateRange(targetDate, period);

    // 음식 기록 조회
    const { data: foodRecords, error } = await supabase
      .from('food_records')
      .select('*')
      .eq('customer_id', customerId)
      .gte('recorded_date', startDate)
      .lte('recorded_date', endDate)
      .order('recorded_date', { ascending: true })
      .order('recorded_time', { ascending: true });

    if (error) {
      console.error('음식 기록 조회 오류:', error);
      return NextResponse.json(
        { error: '음식 기록을 불러오는데 실패했습니다' },
        { status: 500 }
      );
    }

    // 일별 통계 계산
    const dailyStats = calculateDailyStats(foodRecords || [], startDate, endDate);
    
    // 전체 기간 통계
    const periodStats = calculatePeriodStats(dailyStats);

    // 영양소별 과잉/부족 경고
    const nutritionWarnings = generateNutritionWarnings(periodStats, period);

    // 식습관 패턴 분석
    const eatingPatterns = analyzeEatingPatterns(foodRecords || []);

    // 개선 권장사항
    const recommendations = generateRecommendations(periodStats, eatingPatterns, nutritionWarnings);

    return NextResponse.json({
      success: true,
      period,
      startDate,
      endDate,
      dailyStats,
      periodStats,
      nutritionWarnings,
      eatingPatterns,
      recommendations
    });

  } catch (error) {
    console.error('영양 통계 API 오류:', error);
    return NextResponse.json(
      { error: '영양 통계 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

function calculateDateRange(targetDate: string, period: string): { startDate: string; endDate: string } {
  const target = new Date(targetDate);
  let startDate: Date;
  let endDate: Date;

  switch (period) {
    case 'week':
      // 일주일 전부터 오늘까지
      startDate = new Date(target);
      startDate.setDate(target.getDate() - 6);
      endDate = target;
      break;
    case 'month':
      // 한 달 전부터 오늘까지
      startDate = new Date(target);
      startDate.setMonth(target.getMonth() - 1);
      startDate.setDate(startDate.getDate() + 1);
      endDate = target;
      break;
    case 'day':
    default:
      startDate = target;
      endDate = target;
      break;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function calculateDailyStats(records: any[], startDate: string, endDate: string): DailyStats[] {
  // 날짜별로 그룹화
  const groupedByDate: { [key: string]: any[] } = {};
  
  // 날짜 범위 내의 모든 날짜 초기화
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    groupedByDate[dateStr] = [];
  }

  // 기록을 날짜별로 분류
  records.forEach(record => {
    const date = record.recorded_date;
    if (groupedByDate[date]) {
      groupedByDate[date].push(record);
    }
  });

  // 각 날짜별 통계 계산
  const dailyStats: DailyStats[] = Object.entries(groupedByDate).map(([date, dayRecords]) => {
    const totals = {
      calories: 0,
      carbohydrates: 0,
      protein: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
      sugar: 0,
    };

    const mealsByType = {
      '아침': 0,
      '점심': 0,
      '저녁': 0,
      '간식': 0,
      '야식': 0,
    };

    dayRecords.forEach(record => {
      const nutrition = record.nutritional_info || record.gemini_analysis?.nutrition || {};
      
      totals.calories += record.actual_calories || nutrition.calories || 0;
      totals.carbohydrates += nutrition.carbohydrates || 0;
      totals.protein += nutrition.protein || 0;
      totals.fat += nutrition.fat || 0;
      totals.fiber += nutrition.fiber || 0;
      totals.sodium += nutrition.sodium || 0;
      totals.sugar += nutrition.sugar || 0;

      const mealType = record.meal_type as keyof typeof mealsByType;
      if (mealsByType[mealType] !== undefined) {
        mealsByType[mealType]++;
      }
    });

    // 영양소 분석
    const nutrientAnalysis = analyzeNutrients(totals);
    
    // 건강 점수 계산 (0-100)
    const healthScore = calculateHealthScore(nutrientAnalysis);

    // 경고 메시지 수집
    const warnings = Object.values(nutrientAnalysis)
      .filter(n => n.status !== 'normal')
      .map(n => n.message);

    return {
      date,
      total_calories: Math.round(totals.calories),
      total_carbohydrates: Math.round(totals.carbohydrates),
      total_protein: Math.round(totals.protein),
      total_fat: Math.round(totals.fat),
      total_fiber: Math.round(totals.fiber),
      total_sodium: Math.round(totals.sodium),
      total_sugar: Math.round(totals.sugar),
      meal_count: dayRecords.length,
      meals_by_type: mealsByType,
      nutrient_analysis: nutrientAnalysis,
      warnings,
      health_score: healthScore
    };
  });

  return dailyStats.sort((a, b) => a.date.localeCompare(b.date));
}

function analyzeNutrients(totals: any): { [key: string]: NutrientAnalysis } {
  const nutrients = ['calories', 'carbohydrates', 'protein', 'fat', 'fiber', 'sodium', 'sugar'];
  const analysis: { [key: string]: NutrientAnalysis } = {};

  nutrients.forEach(nutrient => {
    const value = totals[nutrient] || 0;
    const recommended = DAILY_RECOMMENDED[nutrient as keyof typeof DAILY_RECOMMENDED] || 0;
    const percentage = recommended > 0 ? Math.round((value / recommended) * 100) : 0;
    
    let status: NutrientStatus = 'normal';
    let message = '';

    // 영양소별 판정 기준
    if (nutrient === 'calories') {
      if (percentage < 70) {
        status = 'deficient';
        message = `칼로리 섭취가 부족합니다 (${percentage}%)`;
      } else if (percentage > 130) {
        status = 'excess';
        message = `칼로리 섭취가 과다합니다 (${percentage}%)`;
      }
    } else if (['sodium', 'sugar', 'saturated_fat'].includes(nutrient)) {
      // 제한해야 하는 영양소
      if (percentage > 100) {
        status = 'excess';
        message = `${getNutrientName(nutrient)} 섭취가 권장량을 초과했습니다 (${percentage}%)`;
      }
    } else if (['fiber', 'protein'].includes(nutrient)) {
      // 충분히 섭취해야 하는 영양소
      if (percentage < 50) {
        status = 'deficient';
        message = `${getNutrientName(nutrient)} 섭취가 부족합니다 (${percentage}%)`;
      } else if (percentage > 150) {
        status = 'excess';
        message = `${getNutrientName(nutrient)} 섭취가 과다합니다 (${percentage}%)`;
      }
    } else {
      if (percentage < 50) {
        status = 'deficient';
        message = `${getNutrientName(nutrient)} 섭취가 부족합니다 (${percentage}%)`;
      } else if (percentage > 150) {
        status = 'excess';
        message = `${getNutrientName(nutrient)} 섭취가 과다합니다 (${percentage}%)`;
      }
    }

    analysis[nutrient] = { value, recommended, percentage, status, message };
  });

  return analysis;
}

function getNutrientName(nutrient: string): string {
  const names: { [key: string]: string } = {
    calories: '칼로리',
    carbohydrates: '탄수화물',
    protein: '단백질',
    fat: '지방',
    fiber: '식이섬유',
    sodium: '나트륨',
    sugar: '당류',
    cholesterol: '콜레스테롤',
    saturated_fat: '포화지방'
  };
  return names[nutrient] || nutrient;
}

function calculateHealthScore(analysis: { [key: string]: NutrientAnalysis }): number {
  let score = 100;
  
  Object.values(analysis).forEach(n => {
    if (n.status === 'deficient') {
      score -= 10;
    } else if (n.status === 'excess') {
      score -= 15;
    }
  });

  return Math.max(0, Math.min(100, score));
}

function calculatePeriodStats(dailyStats: DailyStats[]) {
  const daysWithData = dailyStats.filter(d => d.meal_count > 0);
  const totalDays = daysWithData.length || 1;

  const avgStats = {
    avg_calories: Math.round(daysWithData.reduce((sum, d) => sum + d.total_calories, 0) / totalDays),
    avg_carbohydrates: Math.round(daysWithData.reduce((sum, d) => sum + d.total_carbohydrates, 0) / totalDays),
    avg_protein: Math.round(daysWithData.reduce((sum, d) => sum + d.total_protein, 0) / totalDays),
    avg_fat: Math.round(daysWithData.reduce((sum, d) => sum + d.total_fat, 0) / totalDays),
    avg_fiber: Math.round(daysWithData.reduce((sum, d) => sum + d.total_fiber, 0) / totalDays),
    avg_sodium: Math.round(daysWithData.reduce((sum, d) => sum + d.total_sodium, 0) / totalDays),
    avg_sugar: Math.round(daysWithData.reduce((sum, d) => sum + d.total_sugar, 0) / totalDays),
    avg_meal_count: Math.round((daysWithData.reduce((sum, d) => sum + d.meal_count, 0) / totalDays) * 10) / 10,
    avg_health_score: Math.round(daysWithData.reduce((sum, d) => sum + d.health_score, 0) / totalDays),
    total_meals: daysWithData.reduce((sum, d) => sum + d.meal_count, 0),
    days_recorded: daysWithData.length,
    total_days: dailyStats.length
  };

  return avgStats;
}

function generateNutritionWarnings(periodStats: any, period: string): string[] {
  const warnings: string[] = [];
  const periodName = period === 'day' ? '오늘' : period === 'week' ? '이번 주' : '이번 달';

  // 칼로리
  const calPercentage = (periodStats.avg_calories / DAILY_RECOMMENDED.calories) * 100;
  if (calPercentage < 70) {
    warnings.push(`⚠️ ${periodName} 평균 칼로리 섭취량이 권장량의 ${Math.round(calPercentage)}%로 부족합니다.`);
  } else if (calPercentage > 130) {
    warnings.push(`🔴 ${periodName} 평균 칼로리 섭취량이 권장량의 ${Math.round(calPercentage)}%로 과다합니다.`);
  }

  // 나트륨
  const sodiumPercentage = (periodStats.avg_sodium / DAILY_RECOMMENDED.sodium) * 100;
  if (sodiumPercentage > 100) {
    warnings.push(`🔴 ${periodName} 평균 나트륨 섭취량이 권장량을 ${Math.round(sodiumPercentage - 100)}% 초과했습니다. 짠 음식을 줄여주세요.`);
  }

  // 당류
  const sugarPercentage = (periodStats.avg_sugar / DAILY_RECOMMENDED.sugar) * 100;
  if (sugarPercentage > 100) {
    warnings.push(`🔴 ${periodName} 평균 당류 섭취량이 권장량을 초과했습니다. 단 음식을 줄여주세요.`);
  }

  // 단백질
  const proteinPercentage = (periodStats.avg_protein / DAILY_RECOMMENDED.protein) * 100;
  if (proteinPercentage < 70) {
    warnings.push(`⚠️ ${periodName} 평균 단백질 섭취량이 부족합니다. 육류, 생선, 콩류 섭취를 늘려주세요.`);
  }

  // 식이섬유
  const fiberPercentage = (periodStats.avg_fiber / DAILY_RECOMMENDED.fiber) * 100;
  if (fiberPercentage < 70) {
    warnings.push(`⚠️ ${periodName} 평균 식이섬유 섭취량이 부족합니다. 채소와 과일 섭취를 늘려주세요.`);
  }

  // 식사 횟수
  if (periodStats.avg_meal_count < 2) {
    warnings.push(`⚠️ 하루 평균 식사 횟수가 ${periodStats.avg_meal_count}회로 적습니다. 규칙적인 식사가 필요합니다.`);
  }

  return warnings;
}

function analyzeEatingPatterns(records: any[]) {
  const patterns = {
    meal_regularity: {
      breakfast_ratio: 0,
      lunch_ratio: 0,
      dinner_ratio: 0,
      snack_ratio: 0,
      late_night_ratio: 0
    },
    frequent_categories: [] as { category: string; count: number }[],
    avg_meal_time: {
      breakfast: '',
      lunch: '',
      dinner: ''
    },
    eating_frequency_by_hour: {} as { [hour: string]: number }
  };

  if (records.length === 0) return patterns;

  // 식사 타입별 비율
  const totalMeals = records.length;
  const mealCounts = {
    '아침': 0,
    '점심': 0,
    '저녁': 0,
    '간식': 0,
    '야식': 0
  };

  const categoryCounts: { [key: string]: number } = {};
  const mealTimes: { [key: string]: string[] } = {
    '아침': [],
    '점심': [],
    '저녁': []
  };

  records.forEach(record => {
    // 식사 타입 카운트
    const mealType = record.meal_type as keyof typeof mealCounts;
    if (mealCounts[mealType] !== undefined) {
      mealCounts[mealType]++;
    }

    // 음식 카테고리 카운트
    const category = record.food_category || '기타';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    // 식사 시간 수집
    if (record.recorded_time && mealTimes[mealType]) {
      mealTimes[mealType].push(record.recorded_time);
    }

    // 시간대별 식사 빈도
    if (record.recorded_time) {
      const hour = record.recorded_time.split(':')[0];
      patterns.eating_frequency_by_hour[hour] = (patterns.eating_frequency_by_hour[hour] || 0) + 1;
    }
  });

  patterns.meal_regularity = {
    breakfast_ratio: Math.round((mealCounts['아침'] / totalMeals) * 100),
    lunch_ratio: Math.round((mealCounts['점심'] / totalMeals) * 100),
    dinner_ratio: Math.round((mealCounts['저녁'] / totalMeals) * 100),
    snack_ratio: Math.round((mealCounts['간식'] / totalMeals) * 100),
    late_night_ratio: Math.round((mealCounts['야식'] / totalMeals) * 100)
  };

  // 빈도 높은 카테고리
  patterns.frequent_categories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 평균 식사 시간
  Object.entries(mealTimes).forEach(([mealType, times]) => {
    if (times.length > 0) {
      const avgMinutes = times.reduce((sum, time) => {
        const [h, m] = time.split(':').map(Number);
        return sum + h * 60 + m;
      }, 0) / times.length;
      
      const avgHour = Math.floor(avgMinutes / 60);
      const avgMin = Math.round(avgMinutes % 60);
      patterns.avg_meal_time[mealType as keyof typeof patterns.avg_meal_time] = 
        `${avgHour.toString().padStart(2, '0')}:${avgMin.toString().padStart(2, '0')}`;
    }
  });

  return patterns;
}

function generateRecommendations(periodStats: any, eatingPatterns: any, warnings: string[]): string[] {
  const recommendations: string[] = [];

  // 칼로리 기반 권장
  const calPercentage = (periodStats.avg_calories / DAILY_RECOMMENDED.calories) * 100;
  if (calPercentage < 70) {
    recommendations.push('💡 영양가 높은 간식을 추가하거나 식사량을 늘려보세요.');
  } else if (calPercentage > 130) {
    recommendations.push('💡 음식의 양을 조금 줄이고, 저칼로리 음식으로 대체해보세요.');
  }

  // 아침 식사 권장
  if (eatingPatterns.meal_regularity?.breakfast_ratio < 30) {
    recommendations.push('💡 아침 식사를 챙겨 드시면 신진대사와 집중력 향상에 도움이 됩니다.');
  }

  // 야식 줄이기
  if (eatingPatterns.meal_regularity?.late_night_ratio > 20) {
    recommendations.push('💡 야식 빈도가 높습니다. 저녁 식사를 충분히 하고 야식을 줄여보세요.');
  }

  // 단백질 섭취 권장
  if ((periodStats.avg_protein / DAILY_RECOMMENDED.protein) * 100 < 70) {
    recommendations.push('💡 달걀, 닭가슴살, 두부, 생선 등 단백질이 풍부한 음식을 추가해보세요.');
  }

  // 식이섬유 섭취 권장
  if ((periodStats.avg_fiber / DAILY_RECOMMENDED.fiber) * 100 < 70) {
    recommendations.push('💡 현미, 잡곡, 채소, 과일 등 식이섬유가 풍부한 음식을 더 드세요.');
  }

  // 나트륨 줄이기
  if ((periodStats.avg_sodium / DAILY_RECOMMENDED.sodium) * 100 > 100) {
    recommendations.push('💡 국물 음식, 찌개, 라면 등 짠 음식을 줄이고 신선한 재료로 조리해보세요.');
  }

  // 식사 규칙성
  if (periodStats.avg_meal_count < 3) {
    recommendations.push('💡 하루 3끼 규칙적인 식사는 건강한 신진대사에 중요합니다.');
  }

  return recommendations;
}

