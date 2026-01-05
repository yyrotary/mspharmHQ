'use client';

import { useState, useEffect } from 'react';

interface NutritionStats {
  period: string;
  periodStats: {
    avg_calories: number;
    avg_carbohydrates: number;
    avg_protein: number;
    avg_fat: number;
    avg_fiber: number;
    avg_sodium: number;
    avg_sugar: number;
    avg_meal_count: number;
    avg_health_score: number;
    total_meals: number;
    days_recorded: number;
  };
  dailyStats: any[];
  nutritionWarnings: string[];
  eatingPatterns: any;
  recommendations: string[];
}

interface FoodRecord {
  id: string;
  food_name: string;
  food_category: string;
  image_url: string;
  recorded_date: string;
  recorded_time: string;
  meal_type: string;
  actual_calories: number;
  nutritional_info: any;
}

interface Recommendations {
  overall_assessment: string;
  condition_specific_advice: any[];
  nutrition_improvements: any[];
  meal_pattern_advice: any;
  weekly_meal_suggestions: any;
  priority_actions: string[];
  encouraging_message: string;
}

interface NutritionAnalysisPanelProps {
  customerId: string;
  customerName?: string;
}

export default function NutritionAnalysisPanel({ customerId, customerName }: NutritionAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'recommendations'>('overview');
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NutritionStats | null>(null);
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId) {
      loadNutritionData();
    }
  }, [customerId, period]);

  const loadNutritionData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 영양 통계 로드
      const statsResponse = await fetch(
        `/api/customer/nutrition/stats?customerId=${customerId}&period=${period}`
      );
      const statsData = await statsResponse.json();

      if (statsData.success) {
        setStats(statsData);
      }

      // 최근 음식 기록 로드
      const recordsResponse = await fetch(
        `/api/customer/food/records?customerId=${customerId}`
      );
      const recordsData = await recordsResponse.json();

      if (recordsData.success) {
        setFoodRecords(recordsData.records?.slice(0, 20) || []);
      }

      // 권장사항 로드
      const recsResponse = await fetch(
        `/api/customer/nutrition/recommendations?customerId=${customerId}`
      );
      const recsData = await recsResponse.json();

      if (recsData.success) {
        setRecommendations(recsData.recommendations);
      }

    } catch (err) {
      console.error('영양 데이터 로드 오류:', err);
      setError('영양 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getNutrientBarColor = (percentage: number) => {
    if (percentage < 70) return 'bg-yellow-400';
    if (percentage > 130) return 'bg-red-400';
    return 'bg-green-400';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-3 text-gray-600">영양 데이터 분석 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8 text-red-600">
          <span className="text-2xl mb-2">⚠️</span>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            🥗 {customerName ? `${customerName}님의 ` : ''}영양 분석
          </h3>
          <div className="flex items-center space-x-2">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'day' | 'week' | 'month')}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="day">오늘</option>
              <option value="week">최근 7일</option>
              <option value="month">최근 30일</option>
            </select>
            <button
              onClick={loadNutritionData}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              🔄 새로고침
            </button>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex space-x-4 mt-4">
          {[
            { key: 'overview', label: '📊 개요' },
            { key: 'records', label: '🍽️ 식사기록' },
            { key: 'recommendations', label: '💡 권장사항' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-4">
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* 건강 점수 */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className={`text-5xl font-bold ${getHealthScoreColor(stats.periodStats.avg_health_score)}`}>
                  {stats.periodStats.avg_health_score}
                </div>
                <div className="text-sm text-gray-500 mt-1">평균 건강 점수</div>
              </div>
            </div>

            {/* 주요 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.periodStats.avg_calories}
                </div>
                <div className="text-xs text-gray-500">평균 칼로리 (kcal)</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.periodStats.total_meals}
                </div>
                <div className="text-xs text-gray-500">총 식사 횟수</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.periodStats.avg_meal_count}
                </div>
                <div className="text-xs text-gray-500">일평균 식사 횟수</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {stats.periodStats.days_recorded}일
                </div>
                <div className="text-xs text-gray-500">기록된 날</div>
              </div>
            </div>

            {/* 영양소 막대 그래프 */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-700">영양소 섭취 현황 (권장량 대비)</h4>
              {[
                { key: 'calories', name: '칼로리', value: stats.periodStats.avg_calories, recommended: 2000, unit: 'kcal' },
                { key: 'carbohydrates', name: '탄수화물', value: stats.periodStats.avg_carbohydrates, recommended: 300, unit: 'g' },
                { key: 'protein', name: '단백질', value: stats.periodStats.avg_protein, recommended: 65, unit: 'g' },
                { key: 'fat', name: '지방', value: stats.periodStats.avg_fat, recommended: 65, unit: 'g' },
                { key: 'sodium', name: '나트륨', value: stats.periodStats.avg_sodium, recommended: 2000, unit: 'mg' },
                { key: 'fiber', name: '식이섬유', value: stats.periodStats.avg_fiber, recommended: 25, unit: 'g' },
              ].map(nutrient => {
                const percentage = Math.round((nutrient.value / nutrient.recommended) * 100);
                return (
                  <div key={nutrient.key} className="flex items-center space-x-3">
                    <div className="w-20 text-sm text-gray-600">{nutrient.name}</div>
                    <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`h-full ${getNutrientBarColor(percentage)} transition-all`}
                        style={{ width: `${Math.min(percentage, 150)}%` }}
                      ></div>
                    </div>
                    <div className="w-24 text-sm text-right">
                      <span className="font-medium">{nutrient.value}</span>
                      <span className="text-gray-400">/{nutrient.recommended}{nutrient.unit}</span>
                    </div>
                    <div className={`w-12 text-sm font-medium ${
                      percentage < 70 ? 'text-yellow-600' : 
                      percentage > 130 ? 'text-red-600' : 
                      'text-green-600'
                    }`}>
                      {percentage}%
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 경고 메시지 */}
            {stats.nutritionWarnings && stats.nutritionWarnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">⚠️ 주의사항</h4>
                <ul className="space-y-1">
                  {stats.nutritionWarnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 권장사항 요약 */}
            {stats.recommendations && stats.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">💡 개선 권장사항</h4>
                <ul className="space-y-1">
                  {stats.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-sm text-blue-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-4">
            {foodRecords.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <span className="text-4xl mb-2">🍽️</span>
                <p>등록된 음식 기록이 없습니다.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {foodRecords.map(record => (
                  <div key={record.id} className="py-3 flex items-center space-x-4">
                    {record.image_url ? (
                      <img
                        src={record.image_url}
                        alt={record.food_name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">🍽️</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{record.food_name}</p>
                      <p className="text-sm text-gray-500">
                        {record.food_category} · {record.meal_type}
                      </p>
                      <p className="text-xs text-gray-400">
                        {record.recorded_date} {record.recorded_time?.slice(0, 5)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {record.actual_calories || record.nutritional_info?.calories || '-'} kcal
                      </p>
                      <div className="text-xs text-gray-500">
                        <span>탄{record.nutritional_info?.carbohydrates || '-'}g</span>
                        <span className="mx-1">·</span>
                        <span>단{record.nutritional_info?.protein || '-'}g</span>
                        <span className="mx-1">·</span>
                        <span>지{record.nutritional_info?.fat || '-'}g</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && recommendations && (
          <div className="space-y-6">
            {/* 전체 평가 */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="font-medium text-indigo-800 mb-2">📋 전체 평가</h4>
              <p className="text-sm text-indigo-700">{recommendations.overall_assessment}</p>
            </div>

            {/* 질환별 조언 */}
            {recommendations.condition_specific_advice && recommendations.condition_specific_advice.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-3">🏥 질환별 맞춤 조언</h4>
                <div className="space-y-3">
                  {recommendations.condition_specific_advice.map((advice, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 mb-2">{advice.condition}</h5>
                      <p className="text-sm text-gray-600 mb-2">{advice.dietary_advice}</p>
                      <div className="flex flex-wrap gap-4 text-xs">
                        {advice.foods_to_increase && advice.foods_to_increase.length > 0 && (
                          <div>
                            <span className="text-green-600 font-medium">권장 음식:</span>
                            <span className="text-gray-600 ml-1">{advice.foods_to_increase.join(', ')}</span>
                          </div>
                        )}
                        {advice.foods_to_avoid && advice.foods_to_avoid.length > 0 && (
                          <div>
                            <span className="text-red-600 font-medium">주의 음식:</span>
                            <span className="text-gray-600 ml-1">{advice.foods_to_avoid.join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 영양소 개선 */}
            {recommendations.nutrition_improvements && recommendations.nutrition_improvements.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-800 mb-3">📊 영양소 개선 권고</h4>
                <div className="space-y-2">
                  {recommendations.nutrition_improvements.map((improvement, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{improvement.nutrient}</span>
                          <p className="text-sm text-gray-600 mt-1">{improvement.recommendation}</p>
                        </div>
                      </div>
                      {improvement.suggested_foods && improvement.suggested_foods.length > 0 && (
                        <p className="text-xs text-gray-500 mt-2">
                          추천 음식: {improvement.suggested_foods.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 우선 개선 사항 */}
            {recommendations.priority_actions && recommendations.priority_actions.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 mb-2">🎯 우선 개선 사항</h4>
                <ol className="list-decimal list-inside space-y-1">
                  {recommendations.priority_actions.map((action, idx) => (
                    <li key={idx} className="text-sm text-orange-700">{action}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* 격려 메시지 */}
            {recommendations.encouraging_message && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700">💚 {recommendations.encouraging_message}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 상담 노트에 추가 버튼 */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={() => {
            // 상담 노트에 영양 분석 결과 복사
            const summaryText = generateSummaryText(stats, recommendations);
            navigator.clipboard.writeText(summaryText);
            alert('영양 분석 요약이 클립보드에 복사되었습니다.\n상담 노트에 붙여넣기 하세요.');
          }}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
        >
          📋 영양 분석 요약 복사 (상담 노트용)
        </button>
      </div>
    </div>
  );
}

function generateSummaryText(stats: NutritionStats | null, recommendations: Recommendations | null): string {
  if (!stats || !recommendations) return '';

  let text = `=== 영양 분석 요약 ===\n\n`;
  
  text += `📊 기간: ${stats.period === 'day' ? '오늘' : stats.period === 'week' ? '최근 7일' : '최근 30일'}\n`;
  text += `📅 기록된 날: ${stats.periodStats.days_recorded}일\n`;
  text += `🍽️ 총 식사 횟수: ${stats.periodStats.total_meals}회\n\n`;

  text += `[평균 영양 섭취량]\n`;
  text += `• 칼로리: ${stats.periodStats.avg_calories} kcal/일\n`;
  text += `• 탄수화물: ${stats.periodStats.avg_carbohydrates}g\n`;
  text += `• 단백질: ${stats.periodStats.avg_protein}g\n`;
  text += `• 지방: ${stats.periodStats.avg_fat}g\n`;
  text += `• 나트륨: ${stats.periodStats.avg_sodium}mg\n`;
  text += `• 식이섬유: ${stats.periodStats.avg_fiber}g\n\n`;

  if (stats.nutritionWarnings && stats.nutritionWarnings.length > 0) {
    text += `[주의사항]\n`;
    stats.nutritionWarnings.forEach(warning => {
      text += `${warning}\n`;
    });
    text += '\n';
  }

  if (recommendations.priority_actions && recommendations.priority_actions.length > 0) {
    text += `[우선 개선 사항]\n`;
    recommendations.priority_actions.forEach((action, idx) => {
      text += `${idx + 1}. ${action}\n`;
    });
    text += '\n';
  }

  text += `[전체 평가]\n${recommendations.overall_assessment}\n`;

  return text;
}

