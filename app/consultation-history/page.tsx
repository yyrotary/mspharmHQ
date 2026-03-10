'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import moment from 'moment-timezone';
import { NotionConsultation } from '@/app/lib/notion-schema';
import Loading from '@/app/components/Loading';
import { getKoreaTime, formatKoreaDate } from '@/app/lib/date-utils';

interface ConsultationHistoryItem {
  id: string;
  customerId: string;
  customerName: string;
  consultationDate: string;
  consultationContent: string;
  prescription: string;
  result: string;
  symptomImages: string[];
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

  // 기간 설정을 위한 상태 (날짜 기준)
  const [startDate, setStartDate] = useState(() => {
    const koreaTime = getKoreaTime();
    koreaTime.setDate(koreaTime.getDate() - 7);
    return koreaTime.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const koreaTime = getKoreaTime();
    return koreaTime.toISOString().split('T')[0];
  });

  // 검색어 상태
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 확대 이미지 모달 상태
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // 상담 내역 조회
  const fetchConsultations = async () => {
    try {
      setLoading(true);
      setMessage('상담 내역을 불러오는 중입니다...');

      // API 호출 URL 생성 (검색어 포함)
      let url = `/api/consultation-v2?startDate=${startDate}&endDate=${endDate}&limit=100`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('상담 내역 조회에 실패했습니다.');
      }

      const data = await response.json();

      if (data.success) {
        // Supabase 데이터를 Notion 형식으로 변환 (API에서 이미 날짜 필터링됨)
        const sortedConsultations = data.consultations
          .map((consultation: any) => {
            try {
              return {
                id: consultation.id,
                customerId: consultation.customer_id,
                customerName: consultation.customer?.name || '이름 없음',
                consultationDate: consultation.consult_date || '',
                consultationContent: consultation.symptoms || '',
                prescription: consultation.prescription || '',
                result: consultation.result || '',
                symptomImages: consultation.image_urls || []
              };
            } catch (error) {
              console.error('상담 내역 데이터 변환 오류:', error);
              return null;
            }
          })
          .filter((item): item is ConsultationHistoryItem => item !== null)
          .sort((a: ConsultationHistoryItem, b: ConsultationHistoryItem) => {
            // 날짜 정렬
            const dateA = new Date(a.consultationDate).getTime();
            const dateB = new Date(b.consultationDate).getTime();
            return dateB - dateA;
          });

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

  // 기간 변경 또는 검색어 변경 시 상담 내역 다시 조회
  useEffect(() => {
    fetchConsultations();
  }, [startDate, endDate, searchQuery]);

  // 빠른 기간 설정 함수
  const setQuickPeriod = (days: number) => {
    const koreaTime = getKoreaTime();
    const endKoreaTime = getKoreaTime();

    koreaTime.setDate(koreaTime.getDate() - (days - 1));

    setStartDate(koreaTime.toISOString().split('T')[0]);
    setEndDate(endKoreaTime.toISOString().split('T')[0]);
  };

  // 상담 내역 클릭 처리
  const handleConsultationClick = (customerId: string) => {
    router.push(`/consultation?customerId=${customerId}&directView=true`);
  };

  // 이미지 URL 처리 함수 (consultation/page.tsx에서 복사)
  function processImageUrl(imageObj: any) {
    try {
      if (!imageObj) return null;
      if (imageObj.type === 'external' && imageObj.external && imageObj.external.url) {
        const url = imageObj.external.url.trim();
        if (!url) return null;
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch {
            return url;
          }
        }
        return url;
      }
      if (imageObj.type === 'file' && imageObj.file && imageObj.file.url) {
        const url = imageObj.file.url.trim();
        if (!url) return null;
        return url;
      }
      if (typeof imageObj === 'string') {
        const url = imageObj.trim();
        if (!url) return null;
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch {
            return url;
          }
        }
        return url;
      }
      if (imageObj.name && typeof imageObj.name === 'string') {
        const url = imageObj.name.trim();
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch {
            return url;
          }
        }
        if (url && !url.startsWith('http')) return null;
        return url;
      }
      const possibleUrlFields = [imageObj.url, imageObj.external?.url, imageObj.file?.url, imageObj.source, imageObj.src];
      for (const field of possibleUrlFields) {
        if (field && typeof field === 'string' && field.trim()) {
          const url = field.trim();
          if (url.includes('drive.google.com/file/d/')) {
            try {
              const fileId = url.split('/file/d/')[1].split('/')[0];
              return `https://lh3.googleusercontent.com/d/${fileId}`;
            } catch {
              return url;
            }
          }
          return url;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

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

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="호소증상, 처방약, 설진분석 등 세부 사항으로 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchQuery(searchInput);
                  }
                }}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  flex: 1
                }}
              />
              <button
                onClick={() => setSearchQuery(searchInput)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#1e40af',
                  color: 'white',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                검색
              </button>
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
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          {/* 썸네일 이미지 */}
                          {consultation.symptomImages && consultation.symptomImages.length > 0 ? (
                            <img
                              src={processImageUrl(consultation.symptomImages[0])}
                              alt="증상 이미지"
                              style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, marginRight: 12, border: '1px solid #e5e7eb', background: '#f3f4f6', cursor: 'pointer' }}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedImage(processImageUrl(consultation.symptomImages[0]));
                                setShowImageModal(true);
                              }}
                            />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 8, marginRight: 12, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 24 }}>
                              📷
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontWeight: 'bold', color: '#1e40af' }}>{consultation.customerName}</span>
                            <span style={{ color: '#6b7280', marginLeft: 8 }}>
                              {(() => {
                                try {
                                  if (!consultation.consultationDate) {
                                    return '날짜 없음';
                                  }
                                  return formatKoreaDate(consultation.consultationDate);
                                } catch (error) {
                                  console.warn('날짜 포맷팅 오류:', error);
                                  return consultation.consultationDate || '날짜 없음';
                                }
                              })()}
                            </span>
                          </div>
                        </div>
                        <div style={{ marginBottom: '0.5rem', color: '#374151' }}>
                          {consultation.consultationContent}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: '#6b7280', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>처방: </span>
                            {consultation.prescription || '없음'}
                          </div>
                          <div>
                            <span style={{ fontWeight: '500' }}>결과: </span>
                            {consultation.result || '없음'}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/consultation-history/image-gallery?customerId=${consultation.customerId}&customerName=${encodeURIComponent(consultation.customerName)}`);
                            }}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#10b981',
                              color: 'white',
                              borderRadius: '0.375rem',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              marginLeft: 'auto'
                            }}
                          >
                            📷 이미지 모아보기
                          </button>
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

      {/* 이미지 확대 모달 */}
      {showImageModal && selectedImage && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }}
          onClick={() => setShowImageModal(false)}
        >
          <img
            src={selectedImage}
            alt="확대 이미지"
            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'absolute', top: 32, right: 32, background: '#fff', border: 'none', borderRadius: '50%',
              width: 40, height: 40, fontSize: 24, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}
          >×</button>
        </div>
      )}
    </div>
  );
} 