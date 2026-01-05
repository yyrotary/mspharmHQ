'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface ConsultationDetail {
  id: string;
  consultation_id: string;
  consult_date: string;
  symptoms: string;
  result: string;
  prescription: string;
  notes?: string;
  patient_friendly_summary?: string;
  key_symptoms?: string[];
  prescribed_medications?: string[];
  lifestyle_recommendations?: string[];
  follow_up_notes?: string;
  urgency_level?: 'low' | 'medium' | 'high';
}

export default function ConsultationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    const parsed = JSON.parse(sessionData);
    setSession(parsed);
    
    if (params.id) {
      loadConsultationDetail(params.id as string);
    }
  }, [router, params.id]);

  const loadConsultationDetail = async (id: string) => {
    try {
      const response = await fetch(`/api/customer/consultations/${id}`);
      const data = await response.json();
      
      if (data.success && data.consultation) {
        setConsultation(data.consultation);
      }
    } catch (error) {
      console.error('Error loading consultation:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
  };

  const getUrgencyInfo = (level?: string) => {
    switch (level) {
      case 'high':
        return { label: '긴급', color: 'bg-red-100 text-red-700', icon: '🚨' };
      case 'medium':
        return { label: '주의', color: 'bg-yellow-100 text-yellow-700', icon: '⚠️' };
      default:
        return { label: '일반', color: 'bg-green-100 text-green-700', icon: '✅' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="px-4 py-6">
        <div className="text-center py-12">
          <span className="text-5xl block mb-4">😕</span>
          <p className="text-gray-600">상담 기록을 찾을 수 없습니다</p>
          <Link
            href="/customer/consultations"
            className="inline-block mt-4 px-6 py-3 bg-purple-600 text-white rounded-full"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const urgencyInfo = getUrgencyInfo(consultation.urgency_level);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 px-4 py-6">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white text-lg font-bold ml-3">상담 상세</h1>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm">상담일</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${urgencyInfo.color}`}>
              {urgencyInfo.icon} {urgencyInfo.label}
            </span>
          </div>
          <p className="text-white text-lg font-semibold">
            {formatDate(consultation.consult_date)}
          </p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="px-4 py-6 space-y-4 -mt-4">
        {/* AI 요약 */}
        {consultation.patient_friendly_summary && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🤖</span>
              <h2 className="font-semibold text-gray-900">AI 요약</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">
              {consultation.patient_friendly_summary}
            </p>
          </div>
        )}

        {/* 증상 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🩺</span>
            <h2 className="font-semibold text-gray-900">증상</h2>
          </div>
          {consultation.key_symptoms && consultation.key_symptoms.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-3">
              {consultation.key_symptoms.map((symptom, idx) => (
                <span 
                  key={idx}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-sm"
                >
                  {symptom}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-gray-600 text-sm leading-relaxed">
            {consultation.symptoms || '기록된 증상이 없습니다'}
          </p>
        </div>

        {/* 상담 결과 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📋</span>
            <h2 className="font-semibold text-gray-900">상담 결과</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {consultation.result || '상담 결과가 기록되지 않았습니다'}
          </p>
        </div>

        {/* 처방 약품 */}
        {(consultation.prescribed_medications?.length > 0 || consultation.prescription) && (
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💊</span>
              <h2 className="font-semibold text-gray-900">처방 약품</h2>
            </div>
            {consultation.prescribed_medications && consultation.prescribed_medications.length > 0 ? (
              <div className="space-y-2">
                {consultation.prescribed_medications.map((med, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center gap-3 bg-white rounded-xl p-3"
                  >
                    <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm">
                      {idx + 1}
                    </span>
                    <span className="text-gray-700">{med}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">{consultation.prescription}</p>
            )}
          </div>
        )}

        {/* 생활 권장사항 */}
        {consultation.lifestyle_recommendations && consultation.lifestyle_recommendations.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">💡</span>
              <h2 className="font-semibold text-gray-900">생활 권장사항</h2>
            </div>
            <ul className="space-y-3">
              {consultation.lifestyle_recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 text-xs flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 text-sm leading-relaxed">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 추가 안내 */}
        {consultation.follow_up_notes && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📝</span>
              <h2 className="font-semibold text-gray-900">추가 안내사항</h2>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {consultation.follow_up_notes}
            </p>
          </div>
        )}

        {/* 추가 메모 */}
        {consultation.notes && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📌</span>
              <h2 className="font-semibold text-gray-900">메모</h2>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              {consultation.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
