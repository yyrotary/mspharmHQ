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

interface CustomerInfo {
  name: string;
  birth_date?: string;
  phone?: string;
  address?: string;
  health_conditions?: string[];
  custom_alerts?: string[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [newCondition, setNewCondition] = useState('');

  const commonConditions = [
    '당뇨병', '고혈압', '고지혈증', '심장병', '신장질환',
    '간질환', '갑상선질환', '관절염', '골다공증', '위장질환'
  ];

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    loadCustomerInfo(parsed.customerId);
  }, [router]);

  const loadCustomerInfo = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customer/profile?customerId=${customerId}`);
      const data = await response.json();
      
      if (data.success && data.customer) {
        setCustomerInfo(data.customer);
        setHealthConditions(data.customer.health_conditions || []);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_session');
    toast.success('로그아웃 되었습니다');
    router.push('/customer/login');
  };

  const handleSaveConditions = async () => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: session.customerId,
          health_conditions: healthConditions
        })
      });

      if (response.ok) {
        toast.success('건강 정보가 저장되었습니다');
        setEditMode(false);
      }
    } catch (error) {
      toast.error('저장에 실패했습니다');
    }
  };

  const toggleCondition = (condition: string) => {
    setHealthConditions(prev => 
      prev.includes(condition)
        ? prev.filter(c => c !== condition)
        : [...prev, condition]
    );
  };

  const addCustomCondition = () => {
    if (newCondition.trim() && !healthConditions.includes(newCondition.trim())) {
      setHealthConditions(prev => [...prev, newCondition.trim()]);
      setNewCondition('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 프로필 헤더 */}
      <header className="text-center">
        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-xl">
          <span className="text-4xl text-white font-bold">
            {session?.customerName?.charAt(0) || '?'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">{session?.customerName}</h1>
        <p className="text-sm text-gray-500">고객번호: {session?.customerCode}</p>
      </header>

      {/* 메뉴 카드 */}
      <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
        <Link 
          href="/customer/change-pin"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">🔐</span>
            <div>
              <p className="font-medium text-gray-900">PIN 변경</p>
              <p className="text-xs text-gray-500">로그인 비밀번호 변경</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <button 
          onClick={() => setEditMode(!editMode)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-xl">🏥</span>
            <div>
              <p className="font-medium text-gray-900">건강 정보 관리</p>
              <p className="text-xs text-gray-500">질환 정보, 알레르기 등록</p>
            </div>
          </div>
          <svg className={`w-5 h-5 text-gray-300 transition-transform ${editMode ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* 건강 정보 편집 패널 */}
        {editMode && (
          <div className="p-4 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">기저 질환 선택</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {commonConditions.map(condition => (
                <button
                  key={condition}
                  onClick={() => toggleCondition(condition)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    healthConditions.includes(condition)
                      ? 'bg-green-500 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {healthConditions.includes(condition) && '✓ '}
                  {condition}
                </button>
              ))}
            </div>

            {/* 직접 입력 */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="기타 질환 직접 입력"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none"
              />
              <button
                onClick={addCustomCondition}
                className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium"
              >
                추가
              </button>
            </div>

            {/* 선택된 질환 */}
            {healthConditions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">선택된 건강 정보:</p>
                <div className="flex flex-wrap gap-2">
                  {healthConditions.map((condition, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1"
                    >
                      {condition}
                      <button 
                        onClick={() => toggleCondition(condition)}
                        className="text-green-500 hover:text-green-700"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleSaveConditions}
              className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-medium"
            >
              저장하기
            </button>
          </div>
        )}

        <Link 
          href="/customer/notifications"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center text-xl">🔔</span>
            <div>
              <p className="font-medium text-gray-900">알림 설정</p>
              <p className="text-xs text-gray-500">식사 알림, 복약 알림</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        <Link 
          href="/customer/data-export"
          className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">📊</span>
            <div>
              <p className="font-medium text-gray-900">내 데이터 내보내기</p>
              <p className="text-xs text-gray-500">식단 기록, 상담 내역 다운로드</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* 앱 정보 */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">앱 정보</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>버전</span>
            <span className="text-gray-400">1.0.0</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>로그인 시간</span>
            <span className="text-gray-400">
              {session?.loginTime ? new Date(session.loginTime).toLocaleString('ko-KR') : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 로그아웃 버튼 */}
      <button
        onClick={handleLogout}
        className="w-full py-4 bg-white rounded-2xl shadow-sm text-red-500 font-medium hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>

      {/* 고객센터 */}
      <div className="text-center text-sm text-gray-400">
        <p>문의사항이 있으신가요?</p>
        <p className="mt-1">약국에 직접 문의해 주세요</p>
      </div>
    </div>
  );
}



