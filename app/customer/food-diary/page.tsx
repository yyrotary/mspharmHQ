'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface FoodRecord {
  id: string;
  food_name: string;
  meal_type: string;
  recorded_time: string;
  actual_calories: number;
  portion_consumed: string;
  image_url: string;
  nutritional_info: {
    calories: number;
    carbohydrates: number;
    protein: number;
    fat: number;
    sodium?: number;
    sugar?: number;
  };
  health_score?: number;
}

interface DailySummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}

export default function FoodDiaryPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState<FoodRecord[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary>({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    mealCount: 0
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
  }, [router]);

  useEffect(() => {
    if (session) {
      loadFoodRecords(session.customerId, selectedDate);
    }
  }, [session, selectedDate]);

  const loadFoodRecords = async (customerId: string, date: Date) => {
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const response = await fetch(
        `/api/customer/food/records?customerId=${customerId}&date=${dateStr}`
      );
      const data = await response.json();

      if (data.success) {
        setRecords(data.records || []);
        
        // 일일 요약 계산
        const summary = (data.records || []).reduce((acc: DailySummary, record: FoodRecord) => {
          const calories = record.actual_calories || record.nutritional_info?.calories || 0;
          const protein = record.nutritional_info?.protein || 0;
          const carbs = record.nutritional_info?.carbohydrates || 0;
          const fat = record.nutritional_info?.fat || 0;
          
          return {
            totalCalories: acc.totalCalories + calories,
            totalProtein: acc.totalProtein + protein,
            totalCarbs: acc.totalCarbs + carbs,
            totalFat: acc.totalFat + fat,
            mealCount: acc.mealCount + 1
          };
        }, { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, mealCount: 0 });
        
        setDailySummary(summary);
      }
    } catch (error) {
      console.error('Error loading food records:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    if (newDate <= new Date()) {
      setSelectedDate(newDate);
    }
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const isYesterday = selectedDate.toDateString() === new Date(Date.now() - 86400000).toDateString();

  const formatDateLabel = () => {
    if (isToday) return '오늘';
    if (isYesterday) return '어제';
    return selectedDate.toLocaleDateString('ko-KR', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    });
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case '아침': return '🌅';
      case '점심': return '☀️';
      case '저녁': return '🌙';
      case '간식': return '🍪';
      default: return '🍽️';
    }
  };

  const groupRecordsByMeal = () => {
    const groups: Record<string, FoodRecord[]> = {
      '아침': [],
      '점심': [],
      '저녁': [],
      '간식': []
    };
    
    records.forEach(record => {
      const mealType = record.meal_type || '기타';
      if (groups[mealType]) {
        groups[mealType].push(record);
      } else {
        if (!groups['기타']) groups['기타'] = [];
        groups['기타'].push(record);
      }
    });
    
    return groups;
  };

  const mealGroups = groupRecordsByMeal();

  // 주간 캘린더 날짜 생성
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push(date);
    }
    return days;
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">음식 일기</h1>
          <p className="text-sm text-gray-500">오늘 먹은 음식을 기록해요</p>
        </div>
        <Link
          href="/customer/food-diary/camera"
          className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg"
        >
          <span className="text-2xl">📷</span>
        </Link>
      </header>

      {/* 날짜 선택 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => changeDate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{formatDateLabel()}</p>
            <p className="text-xs text-gray-500">
              {selectedDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <button
            onClick={() => changeDate(1)}
            disabled={isToday}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isToday ? 'text-gray-300' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 주간 미니 캘린더 */}
        <div className="flex justify-between">
          {getWeekDays().map((date, idx) => {
            const isSelected = date.toDateString() === selectedDate.toDateString();
            const isCurrentDay = date.toDateString() === new Date().toDateString();
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center py-2 px-2 rounded-xl transition-all ${
                  isSelected 
                    ? 'bg-green-500 text-white' 
                    : isCurrentDay
                    ? 'bg-green-50 text-green-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <span className="text-xs">
                  {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                </span>
                <span className={`text-sm font-medium mt-1 ${isSelected ? 'font-bold' : ''}`}>
                  {date.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 일일 영양 요약 */}
      <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-green-100 text-sm">총 섭취 칼로리</p>
            <p className="text-3xl font-bold">{dailySummary.totalCalories} kcal</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-3xl">{dailySummary.mealCount > 0 ? '🎯' : '🍽️'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="h-2 bg-white/30 rounded-full mb-1">
              <div 
                className="h-full bg-yellow-300 rounded-full"
                style={{ width: `${Math.min((dailySummary.totalCarbs / 300) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-green-100">탄수화물</p>
            <p className="text-sm font-bold">{Math.round(dailySummary.totalCarbs)}g</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-white/30 rounded-full mb-1">
              <div 
                className="h-full bg-blue-300 rounded-full"
                style={{ width: `${Math.min((dailySummary.totalProtein / 60) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-green-100">단백질</p>
            <p className="text-sm font-bold">{Math.round(dailySummary.totalProtein)}g</p>
          </div>
          <div className="text-center">
            <div className="h-2 bg-white/30 rounded-full mb-1">
              <div 
                className="h-full bg-pink-300 rounded-full"
                style={{ width: `${Math.min((dailySummary.totalFat / 65) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-green-100">지방</p>
            <p className="text-sm font-bold">{Math.round(dailySummary.totalFat)}g</p>
          </div>
        </div>
      </div>

      {/* 식사별 기록 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <span className="text-5xl block mb-4">📝</span>
          <p className="text-gray-600 mb-2">아직 기록된 음식이 없어요</p>
          <p className="text-sm text-gray-400 mb-6">오늘 먹은 음식을 촬영해보세요!</p>
          <Link
            href="/customer/food-diary/camera"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-full font-medium shadow-md"
          >
            📷 음식 촬영하기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(mealGroups)
            .filter(([_, items]) => items.length > 0)
            .map(([mealType, items]) => (
              <div key={mealType} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getMealIcon(mealType)}</span>
                    <h3 className="font-semibold text-gray-900">{mealType}</h3>
                  </div>
                  <span className="text-sm text-gray-500">
                    {items.reduce((sum, i) => sum + (i.actual_calories || i.nutritional_info?.calories || 0), 0)} kcal
                  </span>
                </div>
                
                <div className="divide-y divide-gray-100">
                  {items.map((record, idx) => (
                    <div key={idx} className="flex items-center p-4 gap-4">
                      {record.image_url ? (
                        <img 
                          src={record.image_url}
                          alt={record.food_name}
                          className="w-16 h-16 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                          <span className="text-2xl">🍽️</span>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{record.food_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {record.recorded_time?.slice(0, 5)} · {record.portion_consumed || '1인분'}
                        </p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            탄 {record.nutritional_info?.carbohydrates || 0}g
                          </span>
                          <span className="text-xs text-gray-400">
                            단 {record.nutritional_info?.protein || 0}g
                          </span>
                          <span className="text-xs text-gray-400">
                            지 {record.nutritional_info?.fat || 0}g
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          {record.actual_calories || record.nutritional_info?.calories || 0}
                        </p>
                        <p className="text-xs text-gray-400">kcal</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 빠른 액션 버튼들 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/customer/health-report"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
        >
          <span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">📊</span>
          <div>
            <p className="font-medium text-gray-900 text-sm">영양 통계</p>
            <p className="text-xs text-gray-500">주간/월간 분석</p>
          </div>
        </Link>
        
        <Link
          href="/customer/food-diary/history"
          className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
        >
          <span className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">📅</span>
          <div>
            <p className="font-medium text-gray-900 text-sm">전체 기록</p>
            <p className="text-xs text-gray-500">지난 기록 보기</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
