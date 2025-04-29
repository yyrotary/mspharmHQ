'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-timezone';
import { NotionConsultation } from '@/app/lib/notion-schema';
import Loading from '@/app/components/Loading';

interface ConsultationHistoryItem {
  id: string;
  customerId: string;
  customerName: string;
  consultationDate: string;
  consultationContent: string;
  prescription: string;
  result: string;
}

export default function ConsultationHistoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex justify-center items-center"><Loading /></div>}>
      <ConsultationHistoryContent />
    </Suspense>
  );
}

function ConsultationHistoryContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [consultations, setConsultations] = useState<ConsultationHistoryItem[]>([]);
  
  // 기간 설정을 위한 상태
  const [startDate, setStartDate] = useState(moment().subtract(7, 'days').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(moment().format('YYYY-MM-DD'));

  // 상담 내역 조회
  const fetchConsultations = async () => {
    try {
      setLoading(true);
      setMessage('상담 내역을 불러오는 중입니다...');

      const response = await fetch(`/api/consultation/history?startDate=${startDate}&endDate=${endDate}`);
      
      if (!response.ok) {
        throw new Error('상담 내역 조회에 실패했습니다.');
      }

      const data = await response.json();

      if (data.success) {
        // 날짜 기준 내림차순 정렬
        const sortedConsultations = data.consultations
          .map((consultation: any) => {
            try {
              return {
                id: consultation.id,
                customerId: consultation.properties.고객.relation[0]?.id || '',
                customerName: consultation.properties.고객명?.rich_text?.[0]?.text?.content || '이름 없음',
                consultationDate: consultation.properties.상담일자?.date?.start || '',
                consultationContent: consultation.properties.호소증상?.rich_text?.[0]?.text?.content || '',
                prescription: consultation.properties.처방약?.rich_text?.[0]?.text?.content || '',
                result: consultation.properties.결과?.rich_text?.[0]?.text?.content || ''
              };
            } catch (error) {
              console.error('상담 내역 데이터 변환 오류:', error);
              return null;
            }
          })
          .filter((item): item is ConsultationHistoryItem => item !== null)
          .sort((a: ConsultationHistoryItem, b: ConsultationHistoryItem) => 
            moment(b.consultationDate).valueOf() - moment(a.consultationDate).valueOf()
          );

        setConsultations(sortedConsultations);
        setMessage(`${sortedConsultations.length}건의 상담 내역을 불러왔습니다.`);
      } else {
        setMessage('상담 내역을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담 내역 조회 오류:', error);
      setMessage('상담 내역 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 기간 변경 시 상담 내역 다시 조회
  useEffect(() => {
    fetchConsultations();
  }, [startDate, endDate]);

  // 빠른 기간 설정 함수
  const setQuickPeriod = (days: number) => {
    setStartDate(moment().subtract(days - 1, 'days').format('YYYY-MM-DD'));
    setEndDate(moment().format('YYYY-MM-DD'));
  };

  // 상담 내역 클릭 처리
  const handleConsultationClick = (customerId: string) => {
    router.push(`/consultation?customerId=${customerId}&directView=true`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header 
        style={{ 
          background: 'linear-gradient(to right, #2563eb, #1e40af)', 
          color: 'white', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: 'white', textDecoration: 'none' }}>
            ← 홈으로
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>상담 내역</h1>
          <div style={{ width: '2.5rem' }}></div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ flexGrow: 1, padding: '1rem' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          {/* 기간 설정 영역 */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>기간 설정</h2>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ 
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  flex: 1
                }}
              />
              <span style={{ display: 'flex', alignItems: 'center' }}>~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ 
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  flex: 1
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setQuickPeriod(7)}
                style={{ 
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                1주일
              </button>
              <button
                onClick={() => setQuickPeriod(30)}
                style={{ 
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                1개월
              </button>
              <button
                onClick={() => setQuickPeriod(90)}
                style={{ 
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                3개월
              </button>
            </div>
          </div>

          {/* 상담 내역 목록 */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>상담 내역</h2>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
                <Loading />
              </div>
            ) : (
              <>
                {message && (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    backgroundColor: '#fefce8', 
                    color: '#854d0e', 
                    borderRadius: '0.5rem', 
                    borderLeft: '4px solid #facc15' 
                  }}>
                    {message}
                  </div>
                )}

                {consultations.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {consultations.map((consultation) => (
                      <div
                        key={consultation.id}
                        onClick={() => handleConsultationClick(consultation.customerId)}
                        style={{
                          padding: '1rem',
                          borderRadius: '0.5rem',
                          border: '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          backgroundColor: '#f9fafb'
                        }}
                        onMouseEnter={(e) => {
                          const target = e.currentTarget;
                          target.style.backgroundColor = '#f3f4f6';
                          target.style.borderColor = '#d1d5db';
                        }}
                        onMouseLeave={(e) => {
                          const target = e.currentTarget;
                          target.style.backgroundColor = '#f9fafb';
                          target.style.borderColor = '#e5e7eb';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{consultation.customerName}</span>
                          <span style={{ color: '#6b7280' }}>
                            {moment(consultation.consultationDate).format('YYYY-MM-DD HH:mm')}
                          </span>
                        </div>
                        <div style={{ marginBottom: '0.5rem', color: '#374151' }}>
                          {consultation.consultationContent}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>처방: </span>
                            {consultation.prescription || '없음'}
                          </div>
                          <div>
                            <span style={{ fontWeight: '500' }}>결과: </span>
                            {consultation.result || '없음'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.5rem'
                  }}>
                    해당 기간에 상담 내역이 없습니다.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 