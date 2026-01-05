'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PeriodStats {
  avg_calories: number;
  avg_protein: number;
  avg_carbohydrates: number;
  avg_fat: number;
  avg_sodium: number;
  avg_sugar: number;
  avg_fiber: number;
  total_meals: number;
  avg_health_score: number;
}

interface DailyRecord {
  date: string;
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  meal_count: number;
}

interface NutrientAlert {
  nutrient: string;
  status: 'deficient' | 'excessive' | 'optimal';
  current: number;
  recommended: number;
  message: string;
}

export default function HealthReportPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [alerts, setAlerts] = useState<NutrientAlert[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    loadReportData(parsed.customerId);
  }, [router, period]);

  const loadReportData = async (customerId: string) => {
    setLoading(true);
    try {
      // 통계 데이터 로드
      const statsRes = await fetch(
        `/api/customer/nutrition/stats?customerId=${customerId}&period=${period}`
      );
      const statsData = await statsRes.json();
      
      if (statsData.success) {
        setStats(statsData.periodStats);
        setDailyData(statsData.dailyRecords || []);
        
        // 영양소 알림 계산
        calculateAlerts(statsData.periodStats);
      }

      // AI 권장사항 로드
      const recsRes = await fetch(
        `/api/customer/nutrition/recommendations?customerId=${customerId}`
      );
      const recsData = await recsRes.json();
      
      if (recsData.success && recsData.recommendations) {
        setRecommendations(recsData.recommendations.nutritionTips || []);
      }

    } catch (error) {
      console.error('Report data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAlerts = (data: PeriodStats) => {
    const newAlerts: NutrientAlert[] = [];
    
    // 칼로리
    if (data.avg_calories < 1500) {
      newAlerts.push({
        nutrient: '칼로리',
        status: 'deficient',
        current: data.avg_calories,
        recommended: 2000,
        message: '칼로리 섭취가 부족해요. 균형 잡힌 식사를 하세요.'
      });
    } else if (data.avg_calories > 2500) {
      newAlerts.push({
        nutrient: '칼로리',
        status: 'excessive',
        current: data.avg_calories,
        recommended: 2000,
        message: '칼로리 섭취가 많아요. 양을 조절해보세요.'
      });
    }

    // 단백질
    if (data.avg_protein < 50) {
      newAlerts.push({
        nutrient: '단백질',
        status: 'deficient',
        current: data.avg_protein,
        recommended: 60,
        message: '단백질이 부족해요. 육류, 생선, 두부 등을 섭취하세요.'
      });
    }

    // 나트륨
    if (data.avg_sodium > 2000) {
      newAlerts.push({
        nutrient: '나트륨',
        status: 'excessive',
        current: data.avg_sodium,
        recommended: 2000,
        message: '나트륨 섭취가 많아요. 짠 음식을 줄여보세요.'
      });
    }

    // 당류
    if (data.avg_sugar > 50) {
      newAlerts.push({
        nutrient: '당류',
        status: 'excessive',
        current: data.avg_sugar,
        recommended: 25,
        message: '당 섭취가 많아요. 단 음식을 줄여보세요.'
      });
    }

    // 식이섬유
    if (data.avg_fiber < 20) {
      newAlerts.push({
        nutrient: '식이섬유',
        status: 'deficient',
        current: data.avg_fiber,
        recommended: 25,
        message: '식이섬유가 부족해요. 채소, 과일을 더 섭취하세요.'
      });
    }

    setAlerts(newAlerts);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deficient': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'excessive': return 'bg-red-100 text-red-800 border-red-200';
      case 'optimal': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deficient': return '⚠️';
      case 'excessive': return '🔴';
      case 'optimal': return '✅';
      default: return '•';
    }
  };

  const maxCalories = dailyData.length > 0 
    ? Math.max(...dailyData.map(d => d.total_calories), 2500) 
    : 2500;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">분석 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">건강 리포트</h1>
        <p className="text-sm text-gray-500 mt-1">나의 영양 섭취 현황을 확인하세요</p>
      </header>

      {/* 기간 선택 */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setPeriod('week')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            period === 'week' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-600'
          }`}
        >
          이번 주
        </button>
        <button
          onClick={() => setPeriod('month')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
            period === 'month' 
              ? 'bg-white text-indigo-600 shadow-sm' 
              : 'text-gray-600'
          }`}
        >
          이번 달
        </button>
      </div>

      {/* 종합 점수 */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">종합 건강 점수</p>
            <div className="flex items-baseline mt-2">
              <span className={`text-6xl font-bold ${getScoreColor(stats?.avg_health_score || 0)}`}>
                {Math.round(stats?.avg_health_score || 0)}
              </span>
              <span className="text-2xl text-slate-400 ml-1">/100</span>
            </div>
          </div>
          <div className="w-24 h-24 relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="#374151" strokeWidth="8" fill="none" />
              <circle 
                cx="48" cy="48" r="40" 
                stroke="url(#scoreGradient)" 
                strokeWidth="8" 
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${((stats?.avg_health_score || 0) / 100) * 251} 251`}
              />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-400 text-xs">총 기록</p>
            <p className="text-xl font-bold">{stats?.total_meals || 0}끼</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-slate-400 text-xs">평균 칼로리</p>
            <p className="text-xl font-bold">{Math.round(stats?.avg_calories || 0)} kcal</p>
          </div>
        </div>
      </div>

      {/* 칼로리 차트 */}
      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">일별 칼로리 섭취</h2>
        <div className="h-40 flex items-end justify-between gap-1">
          {dailyData.slice(-7).map((day, idx) => {
            const height = (day.total_calories / maxCalories) * 100;
            const isToday = new Date(day.date).toDateString() === new Date().toDateString();
            return (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-gray-500 mb-1">{day.total_calories}</span>
                <div 
                  className={`w-full rounded-t-lg transition-all ${
                    isToday 
                      ? 'bg-gradient-to-t from-indigo-500 to-purple-500' 
                      : 'bg-gradient-to-t from-indigo-200 to-indigo-300'
                  }`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
                <span className="text-xs text-gray-400 mt-2">
                  {new Date(day.date).toLocaleDateString('ko-KR', { weekday: 'short' })}
                </span>
              </div>
            );
          })}
          {dailyData.length === 0 && (
            <div className="flex-1 text-center text-gray-400 py-10">
              아직 기록된 데이터가 없어요
            </div>
          )}
        </div>
      </section>

      {/* 영양소 상세 */}
      <section className="bg-white rounded-2xl p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">영양소 분석</h2>
        <div className="space-y-4">
          {[
            { name: '탄수화물', value: stats?.avg_carbohydrates || 0, target: 300, unit: 'g', color: 'from-amber-400 to-orange-400' },
            { name: '단백질', value: stats?.avg_protein || 0, target: 60, unit: 'g', color: 'from-green-400 to-emerald-400' },
            { name: '지방', value: stats?.avg_fat || 0, target: 65, unit: 'g', color: 'from-pink-400 to-rose-400' },
            { name: '나트륨', value: stats?.avg_sodium || 0, target: 2000, unit: 'mg', color: 'from-blue-400 to-indigo-400' },
            { name: '당류', value: stats?.avg_sugar || 0, target: 25, unit: 'g', color: 'from-purple-400 to-violet-400' },
            { name: '식이섬유', value: stats?.avg_fiber || 0, target: 25, unit: 'g', color: 'from-teal-400 to-cyan-400' },
          ].map((nutrient, idx) => {
            const percentage = Math.min((nutrient.value / nutrient.target) * 100, 150);
            const isOver = percentage > 100;
            return (
              <div key={idx}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{nutrient.name}</span>
                  <span className={`text-sm ${isOver ? 'text-red-500 font-bold' : 'text-gray-500'}`}>
                    {Math.round(nutrient.value)} / {nutrient.target} {nutrient.unit}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${nutrient.color} rounded-full transition-all ${
                      isOver ? 'opacity-50' : ''
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 주의 알림 */}
      {alerts.length > 0 && (
        <section className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4">⚠️ 영양 알림</h2>
          <div className="space-y-3">
            {alerts.map((alert, idx) => (
              <div 
                key={idx}
                className={`p-4 rounded-xl border ${getStatusColor(alert.status)}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg">{getStatusIcon(alert.status)}</span>
                  <div className="flex-1">
                    <p className="font-medium">{alert.nutrient}</p>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs mt-2 opacity-70">
                      현재: {Math.round(alert.current)} / 권장: {alert.recommended}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI 권장사항 */}
      {recommendations.length > 0 && (
        <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-4">💡 AI 맞춤 권장사항</h2>
          <div className="space-y-3">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <div key={idx} className="flex items-start gap-3 bg-white/60 rounded-xl p-3">
                <span className="text-green-500 font-bold">{idx + 1}</span>
                <p className="text-sm text-gray-700">{rec}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}



