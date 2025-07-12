'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loading from '@/app/components/Loading';
import { formatKoreaDateTime } from '@/app/lib/date-utils';

interface ImageItem {
  id: string;
  url: string;
  customerName: string;
  consultationDate: string;
  consultationId: string;
  customerId: string;
  consultationContent: string;
}

export default function ImageGalleryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex justify-center items-center"><Loading /></div>}>
      <ImageGalleryContent />
    </Suspense>
  );
}

function ImageGalleryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<ImageItem[]>([]);
  
  // 쿼리 파라미터에서 고객 정보 가져오기
  const customerId = searchParams.get('customerId') || '';
  const customerName = searchParams.get('customerName') || '';

  // 확대 이미지 모달 상태
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // 이미지 URL 처리 함수
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
      return null;
    } catch {
      return null;
    }
  }

  // 이미지 데이터 조회
  const fetchImages = async () => {
    try {
      setLoading(true);
      setMessage('이미지를 불러오는 중입니다...');

      if (!customerId) {
        setMessage('고객 정보가 필요합니다.');
        setLoading(false);
        return;
      }

      // 특정 고객의 상담 데이터 조회
      const response = await fetch(`/api/consultation-v2?customerId=${customerId}&limit=500`);
      
      if (!response.ok) {
        throw new Error('이미지 데이터 조회에 실패했습니다.');
      }

      const data = await response.json();

      if (data.success) {
        const imageList: ImageItem[] = [];
        
        // 각 상담에서 이미지 추출
        data.consultations.forEach((consultation: any) => {
          const symptomImages = consultation.image_urls || [];
          const customerName = consultation.customer?.name || '이름 없음';
          const consultationDate = consultation.consult_date || '';
          const consultationContent = consultation.symptoms || '';
          
          symptomImages.forEach((imageUrl: string, index: number) => {
            const processedUrl = processImageUrl(imageUrl);
            if (processedUrl) {
              imageList.push({
                id: `${consultation.id}-${index}`,
                url: processedUrl,
                customerName,
                consultationDate,
                consultationId: consultation.id,
                customerId: consultation.customer_id,
                consultationContent
              });
            }
          });
        });

        // 날짜 순으로 정렬 (최신순)
        imageList.sort((a, b) => new Date(b.consultationDate).getTime() - new Date(a.consultationDate).getTime());

        setImages(imageList);
        setMessage(`${imageList.length}개의 이미지를 불러왔습니다. (${data.consultations.length}건의 상담)`);
      } else {
        setMessage('이미지 데이터를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('이미지 조회 오류:', error);
      setMessage('이미지 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 이미지 조회
  useEffect(() => {
    if (customerId) {
      fetchImages();
    }
  }, [customerId]);

  // 이미지 클릭 핸들러
  const handleImageClick = (image: ImageItem) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  // 상담 상세 보기 핸들러
  const handleViewConsultation = (customerId: string, consultationId: string) => {
    router.push(`/consultation?customerId=${customerId}&directView=true&consultationId=${consultationId}`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header 
        style={{ 
          background: 'linear-gradient(to right, #10b981, #059669)', 
          color: 'white', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/consultation-history" style={{ color: 'white', textDecoration: 'none' }}>
            ← 상담 내역으로
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{customerName} 이미지 모아보기</h1>
          <div style={{ width: '6rem' }}></div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ flexGrow: 1, padding: '1rem' }}>
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          {/* 고객 정보 */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ color: '#10b981', fontWeight: 'bold' }}>👤 고객:</div>
              <div style={{ color: '#374151' }}>{customerName}</div>
              <div style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
                {message}
              </div>
            </div>
          </div>

          {/* 이미지 갤러리 */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
                <Loading />
              </div>
            ) : (
              <>
                {images.length > 0 ? (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                    gap: '1rem' 
                  }}>
                    {images.map((image) => (
                      <div
                        key={image.id}
                        style={{
                          position: 'relative',
                          borderRadius: '0.75rem',
                          overflow: 'hidden',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          backgroundColor: '#f9fafb'
                        }}
                        onClick={() => handleImageClick(image)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                      >
                        {/* 이미지 */}
                        <div style={{ position: 'relative', paddingBottom: '75%' }}>
                          <img
                            src={image.url}
                            alt={`${image.customerName} 증상 이미지`}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                          {/* 오버레이 */}
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
                            padding: '1rem',
                            color: 'white'
                          }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{image.customerName}</div>
                            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                              {formatKoreaDateTime(image.consultationDate)}
                            </div>
                          </div>
                        </div>
                        
                        {/* 상담 내용 미리보기 */}
                        <div style={{ padding: '1rem' }}>
                          <div style={{ 
                            fontSize: '0.875rem', 
                            color: '#6b7280', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}>
                            {image.consultationContent || '상담 내용 없음'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    padding: '3rem', 
                    textAlign: 'center', 
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.75rem'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📷</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      이미지가 없습니다
                    </div>
                    <div>
                      해당 기간에 등록된 증상 이미지가 없습니다.
                    </div>
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
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh',
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000,
            flexDirection: 'column'
          }}
          onClick={() => setShowImageModal(false)}
        >
          {/* 이미지 정보 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1rem',
            maxWidth: '90vw',
            textAlign: 'center'
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              {selectedImage.customerName}
            </div>
            <div style={{ color: '#6b7280', marginBottom: '0.5rem' }}>
              {formatKoreaDateTime(selectedImage.consultationDate)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>
              {selectedImage.consultationContent}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewConsultation(selectedImage.customerId, selectedImage.consultationId);
              }}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              상담 상세 보기
            </button>
          </div>
          
          {/* 이미지 */}
          <img
            src={selectedImage.url}
            alt={`${selectedImage.customerName} 증상 이미지`}
            style={{ 
              maxWidth: '85vw', 
              maxHeight: '70vh', 
              borderRadius: '0.75rem', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              objectFit: 'contain'
            }}
            onClick={e => e.stopPropagation()}
          />
          
          {/* 닫기 버튼 */}
          <button
            onClick={() => setShowImageModal(false)}
            style={{
              position: 'absolute', 
              top: 32, 
              right: 32, 
              background: '#fff', 
              border: 'none', 
              borderRadius: '50%',
              width: 48, 
              height: 48, 
              fontSize: 24, 
              cursor: 'pointer', 
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}