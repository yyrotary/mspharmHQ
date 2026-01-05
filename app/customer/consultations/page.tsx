'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Consultation {
  id: string;
  consultation_id: string;
  consult_date: string;
  symptoms: string;
  result: string;
  prescription: string;
  patient_friendly_summary?: string;
  key_symptoms?: string[];
  prescribed_medications?: string[];
  urgency_level?: 'low' | 'medium' | 'high';
}

export default function ConsultationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    loadConsultations(parsed.customerId);
  }, [router]);

  const loadConsultations = async (customerId: string) => {
    try {
      const response = await fetch(`/api/customer/consultations?customerId=${customerId}`);
      const data = await response.json();
      
      if (response.ok) {
        setConsultations(data.consultations || []);
      }
    } catch (error) {
      console.error('Error loading consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredConsultations = consultations.filter(c => {
    const matchesSearch = searchQuery === '' || 
      c.symptoms?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.result?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.prescription?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesYear = new Date(c.consult_date).getFullYear() === selectedYear;
    
    return matchesSearch && matchesYear;
  });

  const groupedByMonth = filteredConsultations.reduce((acc, c) => {
    const month = new Date(c.consult_date).toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long' 
    });
    if (!acc[month]) acc[month] = [];
    acc[month].push(c);
    return acc;
  }, {} as Record<string, Consultation[]>);

  const years = [...new Set(consultations.map(c => new Date(c.consult_date).getFullYear()))].sort((a, b) => b - a);

  const getUrgencyBadge = (level?: string) => {
    switch (level) {
      case 'high':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">긴급</span>;
      case 'medium':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full font-medium">주의</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">상담 기록 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* 헤더 */}
      <header>
        <h1 className="text-2xl font-bold text-gray-900">상담 내역</h1>
        <p className="text-sm text-gray-500 mt-1">약국에서 받은 상담 기록을 확인하세요</p>
      </header>

      {/* 검색 */}
      <div className="relative">
        <input
          type="text"
          placeholder="증상, 약 이름으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 pl-10 bg-white rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      </div>

      {/* 연도 필터 */}
      {years.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {years.map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedYear === year
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {year}년
            </button>
          ))}
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-2xl p-4 text-white text-center">
          <p className="text-2xl font-bold">{consultations.length}</p>
          <p className="text-xs text-purple-100 mt-1">총 상담</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl p-4 text-white text-center">
          <p className="text-2xl font-bold">{filteredConsultations.length}</p>
          <p className="text-xs text-blue-100 mt-1">{selectedYear}년</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-4 text-white text-center">
          <p className="text-2xl font-bold">
            {consultations.filter(c => {
              const date = new Date(c.consult_date);
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length}
          </p>
          <p className="text-xs text-green-100 mt-1">이번 달</p>
        </div>
      </div>

      {/* 상담 목록 */}
      {Object.keys(groupedByMonth).length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <span className="text-4xl block mb-3">💬</span>
          <p className="text-gray-500">
            {searchQuery ? '검색 결과가 없습니다' : '상담 기록이 없습니다'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByMonth).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 sticky top-0 bg-gradient-to-b from-slate-100 to-transparent py-2">
                {month}
              </h2>
              <div className="space-y-3">
                {items.map((consultation) => (
                  <Link
                    key={consultation.id}
                    href={`/customer/consultation/${consultation.id}`}
                    className="block bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                            {new Date(consultation.consult_date).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </span>
                          {getUrgencyBadge(consultation.urgency_level)}
                        </div>
                        
                        {consultation.patient_friendly_summary ? (
                          <p className="text-gray-800 text-sm leading-relaxed line-clamp-2">
                            {consultation.patient_friendly_summary}
                          </p>
                        ) : (
                          <p className="text-gray-800 text-sm leading-relaxed line-clamp-2">
                            {consultation.symptoms || '증상 기록 없음'}
                          </p>
                        )}

                        {consultation.key_symptoms && consultation.key_symptoms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {consultation.key_symptoms.slice(0, 3).map((symptom, idx) => (
                              <span 
                                key={idx}
                                className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full"
                              >
                                {symptom}
                              </span>
                            ))}
                          </div>
                        )}

                        {consultation.prescribed_medications && consultation.prescribed_medications.length > 0 && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            💊 {consultation.prescribed_medications.slice(0, 2).join(', ')}
                            {consultation.prescribed_medications.length > 2 && ` 외 ${consultation.prescribed_medications.length - 2}개`}
                          </p>
                        )}
                      </div>
                      <svg className="w-5 h-5 text-gray-300 flex-shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




