'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CustomerSession {
  customerId: string;
  customerCode: string;
  customerName: string;
}

interface DailyStat {
  date: string;
  total_calories: number;
  total_carbohydrates: number;
  total_protein: number;
  total_fat: number;
  meal_count: number;
  health_score: number;
  warnings: string[];
}

interface PeriodStats {
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
  total_days: number;
}

interface NutritionData {
  period: string;
  startDate: string;
  endDate: string;
  dailyStats: DailyStat[];
  periodStats: PeriodStats;
  nutritionWarnings: string[];
  eatingPatterns: any;
  recommendations: string[];
}

export default function NutritionStatsPage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NutritionData | null>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    
    const parsedSession = JSON.parse(sessionData);
    setSession(parsedSession);
    loadNutritionStats(parsedSession.customerId);
  }, [router, period]);

  const loadNutritionStats = async (customerId: string) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/customer/nutrition/stats?customerId=${customerId}&period=${period}`
      );
      const result = await response.json();

      if (result.success) {
        setData(result);
      } else {
        toast.error('영양 통계를 불러오는데 실패했습니다');
      }
    } catch (error) {
      toast.error('데이터 로딩 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!session) return;
    
    setShowRecommendations(true);
    try {
      const response = await fetch(
        `/api/customer/nutrition/recommendations?customerId=${session.customerId}`
      );
      const result = await response.json();

      if (result.success) {
        setRecommendations(result.recommendations);
      }
    } catch (error) {
      console.error('권장사항 로드 오류:', error);
    }
  };

  const getHealthScoreGradient = (score: number) => {
    if (score >= 80) return 'from-green-400 to-emerald-500';
    if (score >= 60) return 'from-yellow-400 to-orange-500';
    return 'from-red-400 to-rose-500';
  };

  const getProgressColor = (percentage: number, isRestricted: boolean = false) => {
    if (isRestricted) {
      // 나트륨, 당류 등 제한해야 하는 영양소
      if (percentage > 100) return 'bg-red-500';
      if (percentage > 80) return 'bg-yellow-500';
      return 'bg-green-500';
    } else {
      // 일반 영양소
      if (percentage < 50) return 'bg-yellow-500';
      if (percentage > 130) return 'bg-red-500';
      return 'bg-green-500';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const getWeekday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { weekday: 'short' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">영양 분석 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📊 영양 통계</h1>
          <p className="text-sm text-gray-500">식습관을 분석해보세요</p>
        </div>
        <Link
          href="/customer/food-diary"
          className="text-indigo-600 text-sm"
        >
          ← 돌아가기
        </Link>
      </div>

      {/* 기간 선택 */}
      <div className="bg-white rounded-xl shadow-sm p-1 flex">
        {[
          { value: 'day', label: '오늘' },
          { value: 'week', label: '이번 주' },
          { value: 'month', label: '이번 달' }
        ].map(option => (
          <button
            key={option.value}
            onClick={() => setPeriod(option.value as any)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === option.value
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {data && (
        <>
          {/* 건강 점수 카드 */}
          <div className={`bg-gradient-to-br ${getHealthScoreGradient(data.periodStats.avg_health_score)} rounded-xl p-6 text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">건강 점수</p>
                <p className="text-5xl font-bold mt-1">{data.periodStats.avg_health_score}</p>
                <p className="text-white/80 text-sm mt-2">
                  {data.periodStats.days_recorded}일 기록 · {data.periodStats.total_meals}끼 분석
                </p>
              </div>
              <div className="text-6xl opacity-30">
                {data.periodStats.avg_health_score >= 80 ? '😄' : 
                 data.periodStats.avg_health_score >= 60 ? '😐' : '😟'}
              </div>
            </div>
          </div>

          {/* 평균 칼로리 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-600 text-sm">평균 일일 칼로리</span>
              <span className="text-2xl font-bold text-gray-900">
                {data.periodStats.avg_calories} <span className="text-sm font-normal text-gray-500">kcal</span>
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${getProgressColor((data.periodStats.avg_calories / 2000) * 100)} transition-all`}
                style={{ width: `${Math.min((data.periodStats.avg_calories / 2000) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">권장량 2,000kcal 기준</p>
          </div>

          {/* 영양소 상세 */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-4">영양소 섭취 현황</h3>
            
            <div className="space-y-4">
              {[
                { name: '탄수화물', value: data.periodStats.avg_carbohydrates, recommended: 300, unit: 'g', emoji: '🍚' },
                { name: '단백질', value: data.periodStats.avg_protein, recommended: 65, unit: 'g', emoji: '🥩' },
                { name: '지방', value: data.periodStats.avg_fat, recommended: 65, unit: 'g', emoji: '🥑' },
                { name: '식이섬유', value: data.periodStats.avg_fiber, recommended: 25, unit: 'g', emoji: '🥬' },
                { name: '나트륨', value: data.periodStats.avg_sodium, recommended: 2000, unit: 'mg', emoji: '🧂', restricted: true },
                { name: '당류', value: data.periodStats.avg_sugar, recommended: 50, unit: 'g', emoji: '🍬', restricted: true },
              ].map(nutrient => {
                const percentage = Math.round((nutrient.value / nutrient.recommended) * 100);
                return (
                  <div key={nutrient.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{nutrient.emoji} {nutrient.name}</span>
                      <span className="text-sm font-medium">
                        {nutrient.value}{nutrient.unit}
                        <span className="text-gray-400 ml-1">/ {nutrient.recommended}{nutrient.unit}</span>
                      </span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getProgressColor(percentage, nutrient.restricted)} transition-all`}
                        style={{ width: `${Math.min(percentage, 150)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 일별 칼로리 그래프 (주간/월간일 때) */}
          {period !== 'day' && data.dailyStats && data.dailyStats.length > 1 && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-4">일별 칼로리 추이</h3>
              <div className="flex items-end justify-between h-32 px-2">
                {data.dailyStats.slice(-7).map((day, idx) => {
                  const heightPercent = Math.min((day.total_calories / 2500) * 100, 100);
                  return (
                    <div key={idx} className="flex flex-col items-center flex-1">
                      <div 
                        className="w-full max-w-8 bg-indigo-500 rounded-t transition-all mx-1"
                        style={{ height: `${heightPercent}%` }}
                      ></div>
                      <span className="text-xs text-gray-500 mt-1">{getWeekday(day.date)}</span>
                      <span className="text-xs text-gray-400">{day.total_calories}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 경고 사항 */}
          {data.nutritionWarnings && data.nutritionWarnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">⚠️ 주의사항</h3>
              <ul className="space-y-2">
                {data.nutritionWarnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-yellow-700">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 개선 권장사항 */}
          {data.recommendations && data.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-2">💡 개선 권장사항</h3>
              <ul className="space-y-2">
                {data.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-blue-700">{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 맞춤 권장사항 보기 버튼 */}
          <button
            onClick={loadRecommendations}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 rounded-xl font-medium shadow-lg hover:shadow-xl transition-shadow"
          >
            🤖 AI 맞춤 영양 조언 받기
          </button>

          {/* AI 권장사항 모달 */}
          {showRecommendations && recommendations && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold">🤖 AI 맞춤 영양 조언</h2>
                  <button
                    onClick={() => setShowRecommendations(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* 전체 평가 */}
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <h3 className="font-medium text-indigo-800 mb-2">📋 전체 평가</h3>
                    <p className="text-sm text-indigo-700">{recommendations.overall_assessment}</p>
                  </div>

                  {/* 우선 개선 사항 */}
                  {recommendations.priority_actions && recommendations.priority_actions.length > 0 && (
                    <div>
                      <h3 className="font-medium text-gray-800 mb-2">🎯 우선 개선 사항</h3>
                      <ol className="list-decimal list-inside space-y-1">
                        {recommendations.priority_actions.map((action: string, idx: number) => (
                          <li key={idx} className="text-sm text-gray-700">{action}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 추천 식단 */}
                  {recommendations.weekly_meal_suggestions && (
                    <div>
                      <h3 className="font-medium text-gray-800 mb-2">🍽️ 추천 식단</h3>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-yellow-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-yellow-800">아침</p>
                          <p className="text-xs text-yellow-700">
                            {recommendations.weekly_meal_suggestions.breakfast?.join(', ')}
                          </p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-orange-800">점심</p>
                          <p className="text-xs text-orange-700">
                            {recommendations.weekly_meal_suggestions.lunch?.join(', ')}
                          </p>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-800">저녁</p>
                          <p className="text-xs text-blue-700">
                            {recommendations.weekly_meal_suggestions.dinner?.join(', ')}
                          </p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-3">
                          <p className="text-xs font-medium text-purple-800">간식</p>
                          <p className="text-xs text-purple-700">
                            {recommendations.weekly_meal_suggestions.snacks?.join(', ')}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 격려 메시지 */}
                  {recommendations.encouraging_message && (
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-green-700">💚 {recommendations.encouraging_message}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* 빈 데이터 */}
      {!data?.periodStats?.total_meals && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            아직 기록된 데이터가 없습니다
          </h3>
          <p className="text-gray-600 mb-6">
            음식을 촬영하고 영양 분석을 시작해보세요!
          </p>
          <Link
            href="/customer/food-diary/camera"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            첫 음식 기록하기
          </Link>
        </div>
      )}
    </div>
  );
}

