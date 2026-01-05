'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CustomerSession {
  customerId: string;
  customerCode: string;
  customerName: string;
  loginTime: string;
}

interface NutritionSummary {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  totalMeals: number;
  healthScore: number;
}

interface TodayGoal {
  calories: { current: number; target: number };
  water: { current: number; target: number };
  meals: { current: number; target: number };
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutritionSummary, setNutritionSummary] = useState<NutritionSummary | null>(null);
  const [todayGoal, setTodayGoal] = useState<TodayGoal>({
    calories: { current: 0, target: 2000 },
    water: { current: 0, target: 8 },
    meals: { current: 0, target: 3 }
  });
  const [recentFoods, setRecentFoods] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }

    const parsedSession = JSON.parse(sessionData);
    setSession(parsedSession);
    
    // 시간대별 인사말
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('좋은 아침이에요');
    else if (hour < 18) setGreeting('좋은 오후예요');
    else setGreeting('좋은 저녁이에요');

    loadDashboardData(parsedSession.customerId);
  }, [router]);

  const loadDashboardData = async (customerId: string) => {
    try {
      // 오늘 음식 기록 로드
      const today = new Date().toISOString().split('T')[0];
      const foodResponse = await fetch(
        `/api/customer/food/records?customerId=${customerId}&date=${today}`
      );
      const foodData = await foodResponse.json();
      
      if (foodData.success && foodData.records) {
        setRecentFoods(foodData.records.slice(0, 3));
        
        // 오늘 목표 계산
        const totalCalories = foodData.records.reduce((sum: number, r: any) => 
          sum + (r.actual_calories || r.nutritional_info?.calories || 0), 0);
        
        setTodayGoal(prev => ({
          ...prev,
          calories: { ...prev.calories, current: totalCalories },
          meals: { ...prev.meals, current: foodData.records.length }
        }));
      }

      // 주간 영양 통계 로드
      const statsResponse = await fetch(
        `/api/customer/nutrition/stats?customerId=${customerId}&period=week`
      );
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setNutritionSummary({
          avgCalories: statsData.periodStats?.avg_calories || 0,
          avgProtein: statsData.periodStats?.avg_protein || 0,
          avgCarbs: statsData.periodStats?.avg_carbohydrates || 0,
          avgFat: statsData.periodStats?.avg_fat || 0,
          totalMeals: statsData.periodStats?.total_meals || 0,
          healthScore: statsData.periodStats?.avg_health_score || 0
        });
      }

    } catch (error) {
      console.error('Dashboard data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage < 50) return 'from-yellow-400 to-orange-400';
    if (percentage < 80) return 'from-blue-400 to-indigo-400';
    if (percentage <= 110) return 'from-green-400 to-emerald-400';
    return 'from-red-400 to-rose-400';
  };

  const getHealthScoreEmoji = (score: number) => {
    if (score >= 80) return '😄';
    if (score >= 60) return '🙂';
    if (score >= 40) return '😐';
    return '😟';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{greeting} 👋</p>
          <h1 className="text-2xl font-bold text-gray-900">{session?.customerName}님</h1>
        </div>
        <Link 
          href="/customer/profile"
          className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg"
        >
          {session?.customerName?.charAt(0) || '?'}
        </Link>
      </header>

      {/* 건강 점수 카드 */}
      <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-medium">이번 주 건강 점수</p>
            <div className="flex items-baseline mt-1">
              <span className="text-5xl font-bold">{nutritionSummary?.healthScore || 0}</span>
              <span className="text-xl ml-1">/100</span>
            </div>
            <p className="text-indigo-200 text-xs mt-2">
              {nutritionSummary?.totalMeals || 0}끼 기록 완료
            </p>
          </div>
          <div className="text-6xl">
            {getHealthScoreEmoji(nutritionSummary?.healthScore || 0)}
          </div>
        </div>
        
        {/* 주간 영양소 미니 차트 */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: '탄수화물', value: nutritionSummary?.avgCarbs || 0, max: 300, color: 'bg-yellow-300' },
            { label: '단백질', value: nutritionSummary?.avgProtein || 0, max: 65, color: 'bg-green-300' },
            { label: '지방', value: nutritionSummary?.avgFat || 0, max: 65, color: 'bg-pink-300' },
          ].map((item, idx) => (
            <div key={idx} className="text-center">
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${item.color} rounded-full transition-all`}
                  style={{ width: `${Math.min((item.value / item.max) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-indigo-100 mt-1">{item.label}</p>
              <p className="text-sm font-medium">{item.value}g</p>
            </div>
          ))}
        </div>
      </div>

      {/* 오늘의 목표 */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">오늘의 목표</h2>
        <div className="grid grid-cols-3 gap-3">
          {/* 칼로리 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="url(#calorieGradient)" 
                    strokeWidth="6" 
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${Math.min((todayGoal.calories.current / todayGoal.calories.target) * 176, 176)} 176`}
                  />
                  <defs>
                    <linearGradient id="calorieGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f97316" />
                      <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg">🔥</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">칼로리</p>
              <p className="text-sm font-bold text-gray-900">
                {todayGoal.calories.current}
                <span className="text-gray-400 font-normal">/{todayGoal.calories.target}</span>
              </p>
            </div>
          </div>

          {/* 식사 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="url(#mealGradient)" 
                    strokeWidth="6" 
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(todayGoal.meals.current / todayGoal.meals.target) * 176} 176`}
                  />
                  <defs>
                    <linearGradient id="mealGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#22c55e" />
                      <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg">🍽️</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">식사</p>
              <p className="text-sm font-bold text-gray-900">
                {todayGoal.meals.current}
                <span className="text-gray-400 font-normal">/{todayGoal.meals.target}끼</span>
              </p>
            </div>
          </div>

          {/* 물 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="text-center">
              <div className="relative w-16 h-16 mx-auto">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                  <circle 
                    cx="32" cy="32" r="28" 
                    stroke="url(#waterGradient)" 
                    strokeWidth="6" 
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(todayGoal.water.current / todayGoal.water.target) * 176} 176`}
                  />
                  <defs>
                    <linearGradient id="waterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg">💧</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">물</p>
              <p className="text-sm font-bold text-gray-900">
                {todayGoal.water.current}
                <span className="text-gray-400 font-normal">/{todayGoal.water.target}잔</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 빠른 기록 버튼 */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">빠른 기록</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/customer/food-diary/camera', icon: '📷', label: '음식촬영', color: 'from-green-400 to-emerald-500' },
            { href: '/customer/lifestyle?tab=sleep', icon: '😴', label: '수면', color: 'from-indigo-400 to-purple-500' },
            { href: '/customer/lifestyle?tab=exercise', icon: '🏃', label: '운동', color: 'from-orange-400 to-red-500' },
            { href: '/customer/lifestyle?tab=medication', icon: '💊', label: '복약', color: 'from-pink-400 to-rose-500' },
          ].map((item, idx) => (
            <Link
              key={idx}
              href={item.href}
              className={`bg-gradient-to-br ${item.color} rounded-2xl p-4 text-center text-white shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95`}
            >
              <span className="text-2xl block">{item.icon}</span>
              <span className="text-xs font-medium mt-1 block">{item.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 오늘 먹은 음식 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">오늘 먹은 음식</h2>
          <Link href="/customer/food-diary" className="text-sm text-indigo-600 font-medium">
            전체보기 →
          </Link>
        </div>

        {recentFoods.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <span className="text-4xl block mb-3">🍽️</span>
            <p className="text-gray-500 mb-4">아직 오늘 기록된 음식이 없어요</p>
            <Link
              href="/customer/food-diary/camera"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full text-sm font-medium shadow-md"
            >
              📷 첫 음식 기록하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentFoods.map((food, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm flex items-center space-x-4">
                {food.image_url ? (
                  <img 
                    src={food.image_url} 
                    alt={food.food_name}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🍽️</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{food.food_name}</p>
                  <p className="text-sm text-gray-500">{food.meal_type} · {food.recorded_time?.slice(0,5)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    {food.actual_calories || food.nutritional_info?.calories || '-'}
                  </p>
                  <p className="text-xs text-gray-500">kcal</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* AI 건강 팁 */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">💡</span>
          <div>
            <h3 className="font-bold text-gray-900 mb-1">오늘의 건강 팁</h3>
            <p className="text-sm text-gray-600">
              {nutritionSummary?.avgProtein && nutritionSummary.avgProtein < 50
                ? '단백질 섭취가 부족해요. 달걀, 닭가슴살, 두부 등을 추가해보세요!'
                : nutritionSummary?.avgCalories && nutritionSummary.avgCalories < 1500
                ? '칼로리 섭취가 부족해요. 균형 잡힌 식사를 챙겨드세요!'
                : '오늘도 건강한 식습관을 유지하고 계시네요! 좋아요 👍'}
            </p>
            <Link 
              href="/customer/health-report"
              className="text-amber-600 text-sm font-medium mt-2 inline-block"
            >
              자세한 분석 보기 →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
