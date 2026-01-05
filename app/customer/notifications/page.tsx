'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface NotificationSettings {
  meal_reminder: boolean;
  meal_times: string[];
  medication_reminder: boolean;
  medication_times: string[];
  water_reminder: boolean;
  water_interval: number;
  weekly_report: boolean;
  health_tips: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<NotificationSettings>({
    meal_reminder: true,
    meal_times: ['08:00', '12:30', '18:30'],
    medication_reminder: false,
    medication_times: ['09:00', '21:00'],
    water_reminder: true,
    water_interval: 2,
    weekly_report: true,
    health_tips: true
  });

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    loadSettings(parsed.customerId);
  }, [router]);

  const loadSettings = async (customerId: string) => {
    try {
      // 로컬 스토리지에서 설정 로드 (향후 API로 변경 가능)
      const savedSettings = localStorage.getItem(`notification_settings_${customerId}`);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!session) return;
    
    try {
      localStorage.setItem(`notification_settings_${session.customerId}`, JSON.stringify(settings));
      toast.success('설정이 저장되었습니다');
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
  };

  const updateSetting = <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const updateMealTime = (index: number, time: string) => {
    const newTimes = [...settings.meal_times];
    newTimes[index] = time;
    updateSetting('meal_times', newTimes);
  };

  const updateMedicationTime = (index: number, time: string) => {
    const newTimes = [...settings.medication_times];
    newTimes[index] = time;
    updateSetting('medication_times', newTimes);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">알림 설정</h1>
          <p className="text-sm text-gray-500">건강 관리 알림을 설정하세요</p>
        </div>
      </header>

      {/* 식사 알림 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🍽️</span>
            <div>
              <p className="font-medium text-gray-900">식사 알림</p>
              <p className="text-xs text-gray-500">식사 시간에 기록 알림</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('meal_reminder', !settings.meal_reminder)}
            className={`w-12 h-7 rounded-full transition-all ${
              settings.meal_reminder ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              settings.meal_reminder ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        
        {settings.meal_reminder && (
          <div className="p-4 space-y-3 bg-gray-50">
            {['아침', '점심', '저녁'].map((meal, idx) => (
              <div key={meal} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{meal}</span>
                <input
                  type="time"
                  value={settings.meal_times[idx] || ''}
                  onChange={(e) => updateMealTime(idx, e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 복약 알림 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center text-xl">💊</span>
            <div>
              <p className="font-medium text-gray-900">복약 알림</p>
              <p className="text-xs text-gray-500">약 복용 시간에 알림</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('medication_reminder', !settings.medication_reminder)}
            className={`w-12 h-7 rounded-full transition-all ${
              settings.medication_reminder ? 'bg-pink-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              settings.medication_reminder ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        
        {settings.medication_reminder && (
          <div className="p-4 space-y-3 bg-gray-50">
            {['오전', '오후'].map((time, idx) => (
              <div key={time} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{time} 복용</span>
                <input
                  type="time"
                  value={settings.medication_times[idx] || ''}
                  onChange={(e) => updateMedicationTime(idx, e.target.value)}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 물 마시기 알림 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">💧</span>
            <div>
              <p className="font-medium text-gray-900">물 마시기 알림</p>
              <p className="text-xs text-gray-500">정기적으로 물 마시기 알림</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('water_reminder', !settings.water_reminder)}
            className={`w-12 h-7 rounded-full transition-all ${
              settings.water_reminder ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              settings.water_reminder ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        
        {settings.water_reminder && (
          <div className="p-4 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">알림 간격</span>
              <select
                value={settings.water_interval}
                onChange={(e) => updateSetting('water_interval', parseInt(e.target.value))}
                className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
              >
                <option value={1}>1시간마다</option>
                <option value={2}>2시간마다</option>
                <option value={3}>3시간마다</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 기타 알림 */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">주간 리포트</p>
              <p className="text-xs text-gray-500">매주 건강 요약 리포트</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('weekly_report', !settings.weekly_report)}
            className={`w-12 h-7 rounded-full transition-all ${
              settings.weekly_report ? 'bg-purple-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              settings.weekly_report ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
        
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl">💡</span>
            <div>
              <p className="font-medium text-gray-900">건강 팁</p>
              <p className="text-xs text-gray-500">맞춤형 건강 정보 알림</p>
            </div>
          </div>
          <button
            onClick={() => updateSetting('health_tips', !settings.health_tips)}
            className={`w-12 h-7 rounded-full transition-all ${
              settings.health_tips ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
              settings.health_tips ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={saveSettings}
        className="w-full py-4 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl text-white font-medium shadow-lg"
      >
        설정 저장하기
      </button>

      {/* 안내 문구 */}
      <p className="text-center text-xs text-gray-400">
        알림 기능은 앱 설치 후 사용 가능합니다.<br />
        현재 웹 버전에서는 설정만 저장됩니다.
      </p>
    </div>
  );
}



