'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

type TabType = 'overview' | 'sleep' | 'exercise' | 'medication' | 'water';

interface LifestyleRecord {
  id: string;
  type: string;
  value: any;
  recorded_at: string;
  notes?: string;
}

interface TodayStats {
  sleep_hours: number;
  exercise_minutes: number;
  water_glasses: number;
  medications_taken: number;
}

function LifestyleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [todayStats, setTodayStats] = useState<TodayStats>({
    sleep_hours: 0,
    exercise_minutes: 0,
    water_glasses: 0,
    medications_taken: 0
  });
  const [records, setRecords] = useState<LifestyleRecord[]>([]);

  // 입력 상태
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<'좋음' | '보통' | '나쁨'>('보통');
  const [exerciseType, setExerciseType] = useState('');
  const [exerciseMinutes, setExerciseMinutes] = useState(30);
  const [medicationName, setMedicationName] = useState('');
  const [medicationTaken, setMedicationTaken] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    loadLifestyleData(parsed.customerId);

    // URL 파라미터로 탭 설정
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'sleep', 'exercise', 'medication', 'water'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [router, searchParams]);

  const loadLifestyleData = async (customerId: string) => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `/api/customer/lifestyle?customerId=${customerId}&date=${today}`
      );
      const data = await response.json();

      if (data.success) {
        setRecords(data.records || []);
        calculateTodayStats(data.records || []);
      }
    } catch (error) {
      console.error('Lifestyle data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTodayStats = (records: LifestyleRecord[]) => {
    const stats: TodayStats = {
      sleep_hours: 0,
      exercise_minutes: 0,
      water_glasses: 0,
      medications_taken: 0
    };

    records.forEach(record => {
      switch (record.type) {
        case 'sleep':
          stats.sleep_hours = record.value.hours || 0;
          break;
        case 'exercise':
          stats.exercise_minutes += record.value.minutes || 0;
          break;
        case 'water':
          stats.water_glasses += record.value.glasses || 1;
          break;
        case 'medication':
          if (record.value.taken) stats.medications_taken += 1;
          break;
      }
    });

    setTodayStats(stats);
  };

  const saveRecord = async (type: string, value: any, notes?: string) => {
    if (!session) return;

    try {
      const response = await fetch('/api/customer/lifestyle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: session.customerId,
          type,
          value,
          notes
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('기록되었습니다!');
        loadLifestyleData(session.customerId);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
  };

  const addWater = () => {
    saveRecord('water', { glasses: 1 });
  };

  const tabs = [
    { id: 'overview', label: '전체', icon: '📊' },
    { id: 'sleep', label: '수면', icon: '😴' },
    { id: 'exercise', label: '운동', icon: '🏃' },
    { id: 'medication', label: '복약', icon: '💊' },
    { id: 'water', label: '물', icon: '💧' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">생활 기록</h1>
        <p className="text-sm text-gray-500">건강한 생활 습관을 기록해요</p>
      </header>

      {/* 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 shadow-sm'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 오늘의 요약 (전체 탭) */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl p-5 text-white">
              <span className="text-3xl">😴</span>
              <p className="text-sm text-indigo-100 mt-2">수면</p>
              <p className="text-2xl font-bold">{todayStats.sleep_hours}시간</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-5 text-white">
              <span className="text-3xl">🏃</span>
              <p className="text-sm text-orange-100 mt-2">운동</p>
              <p className="text-2xl font-bold">{todayStats.exercise_minutes}분</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-5 text-white">
              <span className="text-3xl">💧</span>
              <p className="text-sm text-blue-100 mt-2">물</p>
              <p className="text-2xl font-bold">{todayStats.water_glasses}잔</p>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-5 text-white">
              <span className="text-3xl">💊</span>
              <p className="text-sm text-pink-100 mt-2">복약</p>
              <p className="text-2xl font-bold">{todayStats.medications_taken}회</p>
            </div>
          </div>

          {/* 빠른 기록 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4">빠른 기록</h3>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={addWater}
                className="flex flex-col items-center p-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
              >
                <span className="text-2xl">💧</span>
                <span className="text-xs text-gray-600 mt-1">물 +1잔</span>
              </button>
              <button
                onClick={() => setActiveTab('sleep')}
                className="flex flex-col items-center p-3 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors"
              >
                <span className="text-2xl">😴</span>
                <span className="text-xs text-gray-600 mt-1">수면</span>
              </button>
              <button
                onClick={() => setActiveTab('exercise')}
                className="flex flex-col items-center p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors"
              >
                <span className="text-2xl">🏃</span>
                <span className="text-xs text-gray-600 mt-1">운동</span>
              </button>
              <button
                onClick={() => setActiveTab('medication')}
                className="flex flex-col items-center p-3 bg-pink-50 rounded-xl hover:bg-pink-100 transition-colors"
              >
                <span className="text-2xl">💊</span>
                <span className="text-xs text-gray-600 mt-1">복약</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수면 탭 */}
      {activeTab === 'sleep' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">수면 기록</h3>
          
          {/* 수면 시간 */}
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">수면 시간</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSleepHours(Math.max(0, sleepHours - 0.5))}
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl"
              >
                -
              </button>
              <div className="flex-1 text-center">
                <span className="text-4xl font-bold text-indigo-600">{sleepHours}</span>
                <span className="text-lg text-gray-500 ml-1">시간</span>
              </div>
              <button
                onClick={() => setSleepHours(Math.min(24, sleepHours + 0.5))}
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl"
              >
                +
              </button>
            </div>
          </div>

          {/* 수면 품질 */}
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">수면 품질</label>
            <div className="flex gap-3">
              {[
                { value: '좋음', emoji: '😊', color: 'green' },
                { value: '보통', emoji: '😐', color: 'yellow' },
                { value: '나쁨', emoji: '😴', color: 'red' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setSleepQuality(option.value as any)}
                  className={`flex-1 py-4 rounded-xl border-2 transition-all ${
                    sleepQuality === option.value
                      ? `border-${option.color}-500 bg-${option.color}-50`
                      : 'border-gray-200'
                  }`}
                >
                  <span className="text-2xl block">{option.emoji}</span>
                  <span className="text-sm text-gray-600 mt-1 block">{option.value}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => saveRecord('sleep', { hours: sleepHours, quality: sleepQuality })}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl text-white font-medium"
          >
            저장하기
          </button>
        </div>
      )}

      {/* 운동 탭 */}
      {activeTab === 'exercise' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">운동 기록</h3>
          
          {/* 운동 종류 */}
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">운동 종류</label>
            <div className="grid grid-cols-3 gap-2">
              {['걷기', '달리기', '자전거', '수영', '헬스', '요가', '등산', '테니스', '기타'].map(type => (
                <button
                  key={type}
                  onClick={() => setExerciseType(type)}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    exerciseType === type
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 운동 시간 */}
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">운동 시간</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setExerciseMinutes(Math.max(0, exerciseMinutes - 10))}
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl"
              >
                -
              </button>
              <div className="flex-1 text-center">
                <span className="text-4xl font-bold text-orange-500">{exerciseMinutes}</span>
                <span className="text-lg text-gray-500 ml-1">분</span>
              </div>
              <button
                onClick={() => setExerciseMinutes(exerciseMinutes + 10)}
                className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl"
              >
                +
              </button>
            </div>
          </div>

          <button
            onClick={() => saveRecord('exercise', { type: exerciseType, minutes: exerciseMinutes })}
            disabled={!exerciseType}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl text-white font-medium disabled:opacity-50"
          >
            저장하기
          </button>
        </div>
      )}

      {/* 복약 탭 */}
      {activeTab === 'medication' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">복약 기록</h3>
          
          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">약 이름</label>
            <input
              type="text"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="복용한 약 이름을 입력하세요"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-200 focus:border-pink-400 outline-none"
            />
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-3 block">복용 여부</label>
            <div className="flex gap-4">
              <button
                onClick={() => setMedicationTaken(true)}
                className={`flex-1 py-4 rounded-xl border-2 transition-all ${
                  medicationTaken
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200'
                }`}
              >
                <span className="text-2xl block">✅</span>
                <span className="text-sm text-gray-600 mt-1 block">복용함</span>
              </button>
              <button
                onClick={() => setMedicationTaken(false)}
                className={`flex-1 py-4 rounded-xl border-2 transition-all ${
                  !medicationTaken
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200'
                }`}
              >
                <span className="text-2xl block">❌</span>
                <span className="text-sm text-gray-600 mt-1 block">미복용</span>
              </button>
            </div>
          </div>

          <button
            onClick={() => saveRecord('medication', { name: medicationName, taken: medicationTaken })}
            disabled={!medicationName}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl text-white font-medium disabled:opacity-50"
          >
            저장하기
          </button>
        </div>
      )}

      {/* 물 탭 */}
      {activeTab === 'water' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-6">물 섭취 기록</h3>
          
          <div className="text-center mb-8">
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  stroke="url(#waterGrad)" 
                  strokeWidth="12" 
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(todayStats.water_glasses / 8) * 352} 352`}
                />
                <defs>
                  <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-blue-600">{todayStats.water_glasses}</span>
                <span className="text-sm text-gray-500">/8잔</span>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-600 mb-6">
            오늘 {todayStats.water_glasses}잔 마셨어요!<br />
            {todayStats.water_glasses < 8 
              ? `${8 - todayStats.water_glasses}잔 더 마시면 목표 달성! 💪`
              : '오늘 목표를 달성했어요! 🎉'}
          </p>

          <button
            onClick={addWater}
            className="w-full py-4 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white font-medium flex items-center justify-center gap-2"
          >
            <span className="text-xl">💧</span>
            물 한 잔 추가
          </button>
        </div>
      )}
    </div>
  );
}

export default function LifestylePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <LifestyleContent />
    </Suspense>
  );
}
