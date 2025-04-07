'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CUSTOMER_SCHEMA, CONSULTATION_SCHEMA, getNotionPropertyValue, NotionCustomer, NotionConsultation } from '@/app/lib/notion-schema';

// 확장된 타입 정의
interface FormattedConsultation {
  id: string;
  customerName: string;
  phoneNumber: string;
  consultationDate: string;
  consultationContent: string;
  symptomImages: string[];
  prescription: string;
  result: string;
  createdTime: string; // 생성일시 추가
}

// 새 상담일지 폼 데이터 타입
interface NewConsultation {
  consultDate: string;
  content: string;
  medicine: string;
  result: string;
  images: Array<{
    data: string;
    fileName: string;
  }>;
}

export default function ConsultationPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState<NotionCustomer | null>(null);
  const [consultations, setConsultations] = useState<FormattedConsultation[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    gender: '',
    birth: '',
    address: '',
    specialNote: ''
  });
  
  const [newConsultation, setNewConsultation] = useState({
    consultDate: new Date().toISOString().split('T')[0],
    content: '',
    medicine: '',
    result: '',
    images: [] as {data: string, fileName: string}[]
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // 카메라 접근 함수
  const openCamera = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };
  
  // 모바일 카메라 최적화 설정
  useEffect(() => {
    // 모바일 환경 감지
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // 카메라 입력 요소 설정
    if (cameraInputRef.current && isMobile) {
      // 모바일에서 카메라 접근 시 해상도 조정
      cameraInputRef.current.setAttribute('capture', 'environment');
    }
  }, []);
  
  // 고객 검색 함수
  const searchCustomer = async () => {
    if (!customerName.trim()) {
      setMessage('고객 이름을 입력해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('');
      setCustomer(null);
      setConsultations([]);
      setShowCustomerForm(false);
      
      // 고객 정보 조회
      const customerResponse = await fetch(`/api/customer?name=${encodeURIComponent(customerName)}`);
      const customerData = await customerResponse.json();
      
      if (customerData.success && customerData.customers.length > 0) {
        // 고객 정보 설정
        const foundCustomer = customerData.customers[0];
        setCustomer(foundCustomer);
        
        // 상담일지 목록 조회
        const consultationsResponse = await fetch(`/api/consultation?customerId=${foundCustomer.id}`);
        const consultationsData = await consultationsResponse.json();
        
        if (consultationsData.success) {
          // 상담일지 데이터 구조 변환
          const formattedConsultations = consultationsData.consultations.map((consultation: NotionConsultation) => {
            // 이미지 URL 추출 로직 개선
            const images: string[] = [];

            try {
              // 증상이미지 프로퍼티 존재 확인
              if (consultation.properties.증상이미지) {
                // 디버그 로그 제거 (오류 발생 원인)
                const filesArray = consultation.properties.증상이미지.files || [];
                
                // 각 이미지 파일 처리
                filesArray.forEach((file: any, index: number) => {
                  const imageUrl = processImageUrl(file);
                  if (imageUrl) {
                    images.push(imageUrl);
                  }
                });
              }
            } catch (error) {
              console.warn('이미지 URL 추출 중 오류 발생');
            }
            
            // 고객 정보 가져오기
            const customerName = getNotionPropertyValue(foundCustomer.properties.고객명, CUSTOMER_SCHEMA.고객명.type);
            const phoneNumber = getNotionPropertyValue(foundCustomer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type);
            
            // 상담 내용 가져오기
            const consultationDate = getNotionPropertyValue(consultation.properties.상담일자, CONSULTATION_SCHEMA.상담일자.type);
            const consultationContent = getNotionPropertyValue(consultation.properties.상담내용, CONSULTATION_SCHEMA.상담내용.type);
            
            // 생성일시 정보 가져오기
            const createdTime = getNotionPropertyValue(consultation.properties.생성일시, CONSULTATION_SCHEMA.생성일시.type);
            
            // 처방약 및 결과 가져오기
            let prescription = '';
            try {
              prescription = getNotionPropertyValue(consultation.properties.처방약, CONSULTATION_SCHEMA.처방약.type) || '';
            } catch (error) {
              console.warn('처방약 추출 중 오류 발생');
            }
            
            let result = '';
            try {
              result = getNotionPropertyValue(consultation.properties.결과, CONSULTATION_SCHEMA.결과.type) || '';
            } catch (error) {
              console.warn('결과 추출 중 오류 발생');
            }
            
            return {
              id: consultation.id,
              customerName,
              phoneNumber,
              consultationDate,
              consultationContent,
              symptomImages: images,
              prescription,
              result,
              createdTime // 생성일시 추가
            } as FormattedConsultation;
          });
          setConsultations(formattedConsultations);
        }
      } else {
        setMessage('고객을 찾을 수 없습니다. 새 고객으로 등록하시겠습니까?');
        setShowCustomerForm(true);
        setNewCustomer({
          ...newCustomer,
          name: customerName
        });
      }
    } catch (error) {
      console.error('고객 검색 오류:', error);
      setMessage('고객 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 새 고객 등록 함수
  const registerNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCustomer.name) {
      setMessage('고객 이름은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newCustomer.name,
          phone: newCustomer.phone,
          gender: newCustomer.gender,
          birth: newCustomer.birth,
          address: newCustomer.address,
          specialNote: newCustomer.specialNote
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('새 고객이 등록되었습니다.');
        setShowCustomerForm(false);
        setCustomer(result.customer);
        
        // 상담일지 폼 열기
        setShowNewForm(true);
      } else {
        throw new Error(result.error || '고객 정보 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('고객 등록 오류:', error);
      setMessage((error as Error).message || '고객 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 사진 캡처 처리
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        // 현재 날짜와 시간을 파일 이름에 포함
        const now = new Date();
        const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
        const customerName = customer?.properties?.고객명?.title?.[0]?.text?.content || 'unknown';
        const fileName = `${customerName}_${dateString}.jpg`;
        
        // 이미지 해상도 줄이기
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // 이미지 해상도를 2/3로 줄임
          const maxWidth = Math.floor(img.width * 0.67);
          const maxHeight = Math.floor(img.height * 0.67);
          
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
            const reducedImageData = canvas.toDataURL('image/jpeg', 0.9);
            
            // 이미지 데이터와 파일 이름 저장
            setNewConsultation({
              ...newConsultation,
              images: [...newConsultation.images, {
                data: reducedImageData,
                fileName
              }]
            });
          }
        };
        img.src = reader.result as string;
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  // 파일 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        
        reader.onloadend = () => {
          // 현재 날짜와 시간을 파일 이름에 포함
          const now = new Date();
          const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
          const customerName = customer?.properties?.고객명?.title?.[0]?.text?.content || 'unknown';
          const fileName = `${customerName}_${dateString}_${i+1}.jpg`;
          
          // 이미지 해상도 줄이기
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // 이미지 해상도를 2/3로 줄임
            const maxWidth = Math.floor(img.width * 0.67);
            const maxHeight = Math.floor(img.height * 0.67);
            
            canvas.width = maxWidth;
            canvas.height = maxHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
              const reducedImageData = canvas.toDataURL('image/jpeg', 0.9);
              
              // 이미지 데이터와 파일 이름 저장
              setNewConsultation({
                ...newConsultation,
                images: [...newConsultation.images, {
                  data: reducedImageData,
                  fileName
                }]
              });
            }
          };
          img.src = reader.result as string;
        };
        
        reader.readAsDataURL(file);
      }
    }
  };
  
  // 이미지 삭제
  const removeImage = (index: number) => {
    setNewConsultation({
      ...newConsultation,
      images: newConsultation.images.filter((_, i) => i !== index)
    });
  };
  
  // 이미지 업로드 함수
  const uploadImages = async () => {
    if (newConsultation.images.length === 0) return [];
    
    try {
      const uploadedUrls: string[] = [];
      
      for (const image of newConsultation.images) {
        const response = await fetch('/api/google-drive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageData: image.data,
            fileName: image.fileName
          }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          // 구글 드라이브 뷰 URL을 사용하여 노션에서 임베드 가능하게 함
          uploadedUrls.push(result.viewUrl);
        } else {
          console.error('이미지 업로드 실패:', result.error);
        }
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      return [];
    }
  };
  
  // 상담일지 저장
  const saveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customer) {
      setMessage('고객 정보가 필요합니다.');
      return;
    }
    
    if (!newConsultation.content) {
      setMessage('상담 내용은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('상담일지 저장 중...');
      
      // 1. 이미지 업로드
      setMessage('이미지 업로드 중...');
      const imageUrls = await uploadImages();
      
      // 2. 상담일지 저장
      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          consultDate: newConsultation.consultDate,
          content: newConsultation.content,
          medicine: newConsultation.medicine,
          result: newConsultation.result,
          imageUrls
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('상담일지가 저장되었습니다.');
        
        // 상담일지 폼 초기화
        setNewConsultation({
          consultDate: new Date().toISOString().split('T')[0],
          content: '',
          medicine: '',
          result: '',
          images: []
        });
        
        setShowNewForm(false);
        
        // 상담일지 목록 갱신
        const consultationsResponse = await fetch(`/api/consultation?customerId=${customer.id}`);
        const consultationsData = await consultationsResponse.json();
        
        if (consultationsData.success) {
          // 상담일지 데이터 구조 변환
          const formattedConsultations = consultationsData.consultations.map((consultation: NotionConsultation) => {
            // 이미지 URL 추출 로직 개선
            const images: string[] = [];

            try {
              // 증상이미지 프로퍼티 존재 확인
              if (consultation.properties.증상이미지) {
                const filesArray = consultation.properties.증상이미지.files || [];
                
                // 각 이미지 파일 처리
                filesArray.forEach((file: any, index: number) => {
                  const imageUrl = processImageUrl(file);
                  if (imageUrl) {
                    images.push(imageUrl);
                  }
                });
              }
            } catch (error) {
              console.warn('이미지 URL 추출 중 오류 발생');
            }
            
            // 고객 정보 가져오기
            const customerName = getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type);
            const phoneNumber = getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type);
            
            // 상담 내용 가져오기
            const consultationDate = getNotionPropertyValue(consultation.properties.상담일자, CONSULTATION_SCHEMA.상담일자.type);
            const consultationContent = getNotionPropertyValue(consultation.properties.상담내용, CONSULTATION_SCHEMA.상담내용.type);
            
            // 생성일시 정보 가져오기
            const createdTime = getNotionPropertyValue(consultation.properties.생성일시, CONSULTATION_SCHEMA.생성일시.type);
            
            // 처방약 및 결과 가져오기
            let prescription = '';
            try {
              prescription = getNotionPropertyValue(consultation.properties.처방약, CONSULTATION_SCHEMA.처방약.type) || '';
            } catch (error) {
              console.warn('처방약 추출 중 오류 발생');
            }
            
            let result = '';
            try {
              result = getNotionPropertyValue(consultation.properties.결과, CONSULTATION_SCHEMA.결과.type) || '';
            } catch (error) {
              console.warn('결과 추출 중 오류 발생');
            }
            
            return {
              id: consultation.id,
              customerName,
              phoneNumber,
              consultationDate,
              consultationContent,
              symptomImages: images,
              prescription,
              result,
              createdTime // 생성일시 추가
            } as FormattedConsultation;
          });
          setConsultations(formattedConsultations);
        }
      } else {
        throw new Error(result.error || '상담일지 저장 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 저장 오류:', error);
      setMessage((error as Error).message || '상담일지 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 이미지 URL 추출 로직을 개선하고 디버깅을 추가
  const processImageUrl = (imageObj: any) => {
    try {
      // null 또는 undefined 체크
      if (!imageObj) {
        return null;
      }

      // External 타입 처리 (일반적으로 외부 URL)
      if (imageObj.type === 'external' && imageObj.external && imageObj.external.url) {
        const url = imageObj.external.url.trim();
        
        // 빈 문자열 체크
        if (!url) {
          return null;
        }
        
        // Google Drive URL 변환
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            // 항상 lh3.googleusercontent.com 형식으로 변환
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch (error) {
            return url;
          }
        }
        
        return url;
      }

      // File 타입 처리 (Notion에 직접 업로드한 파일)
      if (imageObj.type === 'file' && imageObj.file && imageObj.file.url) {
        const url = imageObj.file.url.trim();
        
        // 빈 문자열 체크
        if (!url) {
          return null;
        }
        
        return url;
      }

      // 단순 문자열인 경우
      if (typeof imageObj === 'string') {
        const url = imageObj.trim();
        // 빈 문자열 체크
        if (!url) {
          return null;
        }
        
        // Google Drive URL 변환
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            // 항상 lh3.googleusercontent.com 형식으로 변환
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch (error) {
            return url;
          }
        }
        
        return url;
      }

      // Google Drive URL이 직접 name 필드에 있는 경우 (스크린샷에서 볼 수 있는 패턴)
      if (imageObj.name && typeof imageObj.name === 'string') {
        const url = imageObj.name.trim();
        if (url.includes('drive.google.com/file/d/')) {
          try {
            const fileId = url.split('/file/d/')[1].split('/')[0];
            // 항상 lh3.googleusercontent.com 형식으로 변환
            return `https://lh3.googleusercontent.com/d/${fileId}`;
          } catch (error) {
            return url;
          }
        }
        
        if (url && !url.startsWith('http')) {
          return null;
        }
        
        return url;
      }

      // 이미지 객체 내 여러 필드에서 URL 찾기
      const possibleUrlFields = [
        imageObj.url, 
        imageObj.external?.url, 
        imageObj.file?.url,
        imageObj.source,
        imageObj.src
      ];
      
      for (const field of possibleUrlFields) {
        if (field && typeof field === 'string' && field.trim()) {
          const url = field.trim();
          
          // Google Drive URL 변환
          if (url.includes('drive.google.com/file/d/')) {
            try {
              const fileId = url.split('/file/d/')[1].split('/')[0];
              // 항상 lh3.googleusercontent.com 형식으로 변환
              return `https://lh3.googleusercontent.com/d/${fileId}`;
            } catch (error) {
              return url;
            }
          }
          
          return url;
        }
      }

      return null;
    } catch (error) {
      console.warn('이미지 URL 처리 중 오류 발생');
      return null;
    }
  };

  // 상담일지 이미지 컴포넌트
  const ConsultationImage = ({ imageUrl, index }: { imageUrl: string, index: number }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [processedUrl, setProcessedUrl] = useState('');

    useEffect(() => {
      // null, undefined, 빈 문자열 체크
      if (!imageUrl || imageUrl === "" || imageUrl === "undefined" || imageUrl === "null") {
        setError(true);
        return;
      }
      
      // 바로 대체 URL 형식으로 설정
      try {
        // 구글 드라이브 URL인 경우
        if (imageUrl.includes('drive.google.com/file/d/')) {
          const fileId = imageUrl.split('/file/d/')[1].split('/')[0];
          // 구글 드라이브 뷰 URL을 직접 사용하지 않고, 항상 lh3.googleusercontent.com 형식 사용
          const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
          setProcessedUrl(alternativeUrl);
        } 
        // 이미 uc 형식인 경우 lh3로 변환
        else if (imageUrl.includes('drive.google.com/uc?export=view&id=')) {
          const fileId = imageUrl.split('id=')[1];
          const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
          setProcessedUrl(alternativeUrl);
        }
        // 이미 대체 URL 형식인 경우 그대로 사용
        else if (imageUrl.includes('lh3.googleusercontent.com/d/')) {
          setProcessedUrl(imageUrl);
        }
        // 그 외의 경우 원본 URL 사용
        else {
          setProcessedUrl(imageUrl);
        }
      } catch (error) {
        // URL 변환 실패 시 원본 URL 사용
        setProcessedUrl(imageUrl);
      }
    }, [imageUrl, index]);

    // 이미지 로드 실패 시 처리 로직
    const handleImageError = () => {
      setError(true);
    };

    if (error) {
      return (
        <div 
          style={{ 
            position: 'relative',
            flex: '0 0 auto',
            width: '120px',
            height: '120px',
            overflow: 'hidden',
            borderRadius: '0.5rem',
            border: '2px solid #fca5a5',
            backgroundColor: '#fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#dc2626',
            fontSize: '0.8rem',
            textAlign: 'center',
            padding: '0.5rem'
          }}
        >
          이미지 로드 실패
        </div>
      );
    }

    return (
      <div 
        style={{ 
          position: 'relative',
          flex: '0 0 auto',
          width: '120px',
          height: '120px',
          overflow: 'hidden',
          borderRadius: '0.5rem',
          border: '2px solid #e5e7eb',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          display: isLoaded ? 'block' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6'
        }}
      >
        {!isLoaded && (
          <div style={{ textAlign: 'center', padding: '8px', fontSize: '0.8rem', color: '#6b7280' }}>
            로딩 중...
          </div>
        )}
        {processedUrl && (
          <img
            src={processedUrl}
            alt={`증상 이미지 ${index + 1}`}
            style={{ 
              cursor: 'pointer',
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              transition: 'opacity 0.2s',
              display: isLoaded ? 'block' : 'none'
            }}
            onClick={() => openImageModal(processedUrl)}
            onLoad={() => {
              setIsLoaded(true);
            }}
            onError={handleImageError}
          />
        )}
      </div>
    );
  };

  // 이미지 모달 관련 상태 추가
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // 이미지 모달 열기 함수 개선
  const openImageModal = (imageUrl: string) => {
    if (!imageUrl || imageUrl === "" || imageUrl === "undefined" || imageUrl === "null") {
      return;
    }
    
    try {
      // 바로 대체 URL 형식으로 설정
      if (imageUrl.includes('drive.google.com/file/d/')) {
        const fileId = imageUrl.split('/file/d/')[1].split('/')[0];
        const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        setSelectedImage(alternativeUrl);
      } 
      // 이미 uc 형식인 경우 lh3로 변환
      else if (imageUrl.includes('drive.google.com/uc?export=view&id=')) {
        const fileId = imageUrl.split('id=')[1];
        const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        setSelectedImage(alternativeUrl);
      }
      // 이미 대체 URL 형식인 경우 그대로 사용
      else {
        setSelectedImage(imageUrl);
      }
    } catch (error) {
      // URL 변환 실패 시 원본 URL 사용
      setSelectedImage(imageUrl);
    }

    setModalLoading(true);
    setShowImageModal(true);
  };
  
  // 이미지 모달 닫기 함수 - 상태 초기화 추가
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage('');
    setModalLoading(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };
  
  // 확대/축소 처리
  const handleZoom = (zoomIn: boolean) => {
    if (zoomIn) {
      // 확대 (최대 3배)
      setImageScale(prev => Math.min(prev + 0.5, 3));
    } else {
      // 축소 (최소 0.5배)
      setImageScale(prev => Math.max(prev - 0.5, 0.5));
    }
  };
  
  // 드래그 시작 처리
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (imageScale <= 1) return; // 확대되지 않은 상태에서는 드래그 불필요
    
    setIsDragging(true);
    
    // 마우스 이벤트와 터치 이벤트 구분
    if ('clientX' in e) {
      setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
    } else {
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - imagePosition.x, y: touch.clientY - imagePosition.y });
    }
  };
  
  // 드래그 중 처리
  const handleDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || imageScale <= 1) return;
    
    // 마우스 이벤트와 터치 이벤트 구분
    if ('clientX' in e) {
      setImagePosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else {
      const touch = e.touches[0];
      setImagePosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };
  
  // 드래그 종료 처리
  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 이미지 로드 완료 처리
  const handleImageLoaded = () => {
    setModalLoading(false);
  };

  // 고객 검색 영역에서 엔터키 처리 함수 추가
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      searchCustomer();
    }
  };

  // 고객 정보 수정 폼
  const [showEditCustomerForm, setShowEditCustomerForm] = useState(false);
  const [editCustomer, setEditCustomer] = useState({
    name: '',
    phone: '',
    gender: '',
    birth: '',
    address: '',
    specialNote: ''
  });

  // 고객 정보 수정 폼 초기화
  useEffect(() => {
    if (customer && showEditCustomerForm) {
      setEditCustomer({
        name: getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type) || '',
        phone: getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type) || '',
        gender: getNotionPropertyValue(customer.properties.성별, CUSTOMER_SCHEMA.성별.type) || '',
        birth: getNotionPropertyValue(customer.properties.생년월일, CUSTOMER_SCHEMA.생년월일.type) || '',
        address: getNotionPropertyValue(customer.properties.주소, CUSTOMER_SCHEMA.주소.type) || '',
        specialNote: getNotionPropertyValue(customer.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type) || ''
      });
    }
  }, [customer, showEditCustomerForm]);

  // 고객 정보 수정 함수
  const updateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customer) {
      setMessage('고객 정보가 필요합니다.');
      return;
    }
    
    if (!editCustomer.name) {
      setMessage('고객 이름은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/customer/${customer.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editCustomer.name,
          phone: editCustomer.phone,
          gender: editCustomer.gender,
          birth: editCustomer.birth,
          address: editCustomer.address,
          specialNote: editCustomer.specialNote
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('고객 정보가 업데이트되었습니다.');
        setShowEditCustomerForm(false);
        setCustomer(result.customer);
      } else {
        throw new Error(result.error || '고객 정보 업데이트 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('고객 정보 업데이트 오류:', error);
      setMessage((error as Error).message || '고객 정보 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상담일지 폼 자동 포커스 위한 ref 추가
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 새 상담일지 폼이 표시될 때 자동 포커스
  useEffect(() => {
    if (showNewForm && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [showNewForm]);

  // 상담일지 수정/삭제 처리 함수 추가
  const [editConsultation, setEditConsultation] = useState<FormattedConsultation | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // 상담일지 삭제 함수
  const deleteConsultation = async (consultationId: string) => {
    if (!confirm('정말 이 상담일지를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch(`/api/consultation?id=${consultationId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 목록에서 삭제된 상담일지 제거
        setConsultations(prev => prev.filter(item => item.id !== consultationId));
        setMessage('상담일지가 삭제되었습니다.');
      } else {
        throw new Error(result.error || '삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 삭제 오류:', error);
      setMessage((error as Error).message || '상담일지 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상담일지 수정 폼 열기
  const openEditForm = (consultation: FormattedConsultation) => {
    setEditConsultation(consultation);
    setShowEditForm(true);
  };

  // 상담일지 수정 저장
  const updateConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editConsultation) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/consultation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consultationId: editConsultation.id,
          consultDate: editConsultation.consultationDate,
          content: editConsultation.consultationContent,
          medicine: editConsultation.prescription,
          result: editConsultation.result,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 목록 업데이트
        setConsultations(prev => 
          prev.map(item => 
            item.id === editConsultation.id ? {...item, ...editConsultation} : item
          )
        );
        setMessage('상담일지가 수정되었습니다.');
        setShowEditForm(false);
        setEditConsultation(null);
      } else {
        throw new Error(result.error || '수정 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 수정 오류:', error);
      setMessage((error as Error).message || '상담일지 수정 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>고객 상담</h1>
          <div style={{ width: '2.5rem' }}></div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ flexGrow: 1, padding: '1rem' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          {/* 고객 검색 영역 */}
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>고객 검색</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="고객 이름을 입력하세요"
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  fontSize: '1.125rem', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '0.5rem',
                  transition: 'all 0.2s'
                }}
              />
              <button
                onClick={searchCustomer}
                disabled={loading}
                style={{ 
                  width: '100%', 
                  backgroundColor: '#2563eb', 
                  color: 'white', 
                  padding: '1rem 1.5rem',
                  fontSize: '1.125rem', 
                  borderRadius: '0.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {loading ? '검색 중...' : '검색'}
              </button>
            </div>
            {message && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                backgroundColor: '#fefce8', 
                color: '#854d0e', 
                borderRadius: '0.5rem', 
                borderLeft: '4px solid #facc15' 
              }}>
                {message}
                {message.includes('새 고객으로 등록') && !showCustomerForm && (
                  <button
                    onClick={() => setShowCustomerForm(true)}
                    style={{ marginLeft: '0.5rem', textDecoration: 'underline', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    등록하기
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 고객 정보 영역 */}
          {customer && (
            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af' }}>
                  고객 정보
                </h2>
                <button
                  onClick={() => setShowEditCustomerForm(true)}
                  style={{ 
                    backgroundColor: '#3b82f6', 
                    color: 'white', 
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem', 
                    borderRadius: '0.375rem', 
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <span style={{ marginRight: '0.25rem' }}>✏️</span>
                  정보 수정
                </button>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '35%' }} />
                </colgroup>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>이름</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type)}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>전화번호</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>성별</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{getNotionPropertyValue(customer.properties.성별, CUSTOMER_SCHEMA.성별.type)}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>생년월일</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{getNotionPropertyValue(customer.properties.생년월일, CUSTOMER_SCHEMA.생년월일.type)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>주소</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }} colSpan={3}>{getNotionPropertyValue(customer.properties.주소, CUSTOMER_SCHEMA.주소.type)}</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.25rem', fontSize: '0.9rem' }}>특이사항</p>
                <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{getNotionPropertyValue(customer.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type)}</p>
              </div>
              
              <button
                onClick={() => setShowNewForm(true)}
                style={{ 
                  width: '100%', 
                  backgroundColor: '#10b981', 
                  color: 'white', 
                  padding: '1rem 1.5rem',
                  fontSize: '1.125rem', 
                  borderRadius: '0.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ marginRight: '0.5rem', fontSize: '1.25rem' }}>+</span>
                새 상담일지
              </button>
            </div>
          )}

          {/* 신규 고객 등록 폼 */}
          {showCustomerForm && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                marginBottom: '1rem', 
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center'
              }}>
                신규 고객 등록
              </h2>
              <form onSubmit={registerNewCustomer} style={{ 
                backgroundColor: '#eff6ff', 
                padding: '1.25rem', 
                borderRadius: '0.5rem', 
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(1, 1fr)', 
                  gap: '1rem', 
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      이름 *
                    </label>
                    <input
                      type="text"
                      value={newCustomer.name}
                      onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      전화번호
                    </label>
                    <input
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      성별
                    </label>
                    <select
                      value={newCustomer.gender}
                      onChange={(e) => setNewCustomer({...newCustomer, gender: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <option value="">선택하세요</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      생년월일
                    </label>
                    <input
                      type="date"
                      value={newCustomer.birth}
                      onChange={(e) => setNewCustomer({...newCustomer, birth: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      주소
                    </label>
                    <input
                      type="text"
                      value={newCustomer.address}
                      onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      특이사항
                    </label>
                    <textarea
                      value={newCustomer.specialNote}
                      onChange={(e) => setNewCustomer({...newCustomer, specialNote: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s',
                        minHeight: '5rem'
                      }}
                      rows={3}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCustomerForm(false)}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#e5e7eb', 
                      color: '#1f2937', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#10b981', 
                      color: 'white', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 고객 정보 수정 폼 */}
          {showEditCustomerForm && customer && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                marginBottom: '1rem', 
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center'
              }}>
                고객 정보 수정
              </h2>
              <form onSubmit={updateCustomer} style={{ 
                backgroundColor: '#eff6ff', 
                padding: '1.25rem', 
                borderRadius: '0.5rem', 
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(1, 1fr)', 
                  gap: '1rem', 
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      이름 *
                    </label>
                    <input
                      type="text"
                      value={editCustomer.name}
                      onChange={(e) => setEditCustomer({...editCustomer, name: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      전화번호
                    </label>
                    <input
                      type="tel"
                      value={editCustomer.phone}
                      onChange={(e) => setEditCustomer({...editCustomer, phone: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      성별
                    </label>
                    <select
                      value={editCustomer.gender}
                      onChange={(e) => setEditCustomer({...editCustomer, gender: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <option value="">선택하세요</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      생년월일
                    </label>
                    <input
                      type="date"
                      value={editCustomer.birth}
                      onChange={(e) => setEditCustomer({...editCustomer, birth: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      주소
                    </label>
                    <input
                      type="text"
                      value={editCustomer.address}
                      onChange={(e) => setEditCustomer({...editCustomer, address: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      특이사항
                    </label>
                    <textarea
                      value={editCustomer.specialNote}
                      onChange={(e) => setEditCustomer({...editCustomer, specialNote: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s',
                        minHeight: '5rem'
                      }}
                      rows={3}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditCustomerForm(false)}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#e5e7eb', 
                      color: '#1f2937', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#3b82f6', 
                      color: 'white', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 새 상담일지 입력 폼 */}
          {showNewForm && customer && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                marginBottom: '1rem', 
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center'
              }}>
                새 상담일지
              </h2>
              <form onSubmit={saveConsultation} style={{ 
                backgroundColor: '#eff6ff', 
                padding: '1.25rem', 
                borderRadius: '0.5rem', 
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    상담일자 *
                  </label>
                  <input
                    type="date"
                    value={newConsultation.consultDate}
                    onChange={(e) => setNewConsultation({...newConsultation, consultDate: e.target.value})}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    상담내용 *
                  </label>
                  <textarea
                    ref={contentTextareaRef}
                    value={newConsultation.content}
                    onChange={(e) => setNewConsultation({...newConsultation, content: e.target.value})}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s',
                      minHeight: '6rem'
                    }}
                    rows={4}
                    required
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    처방약
                  </label>
                  <textarea
                    value={newConsultation.medicine}
                    onChange={(e) => setNewConsultation({...newConsultation, medicine: e.target.value})}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    rows={2}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    결과
                  </label>
                  <textarea
                    value={newConsultation.result}
                    onChange={(e) => setNewConsultation({...newConsultation, result: e.target.value})}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    rows={2}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    <span style={{ marginRight: '0.25rem' }}>📷</span> 증상 이미지
                  </label>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.75rem', 
                    marginBottom: '0.75rem' 
                  }}>
                    <button
                      type="button"
                      onClick={openCamera}
                      style={{ 
                        backgroundColor: '#2563eb', 
                        color: 'white', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        borderRadius: '0.5rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ marginRight: '0.5rem' }}>📷</span> 카메라
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ 
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        borderRadius: '0.5rem', 
                        display: 'flex', 
                        alignItems: 'center',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <span style={{ marginRight: '0.5rem' }}>📁</span> 파일 업로드
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      accept="image/*"
                      multiple
                    />
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleCameraCapture}
                      style={{ display: 'none' }}
                      accept="image/*"
                      capture="environment"
                    />
                  </div>
                  {/* 이미지 미리보기 */}
                  {newConsultation.images.length > 0 && (
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(2, 1fr)', 
                      gap: '0.75rem', 
                      marginTop: '0.75rem' 
                    }}>
                      {newConsultation.images.map((image, index) => (
                        <div 
                          key={index} 
                          style={{ 
                            position: 'relative', 
                            borderRadius: '0.5rem', 
                            overflow: 'hidden', 
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', 
                            transition: 'transform 0.2s', 
                            transform: 'scale(1)'
                          }}
                          className="hover:scale-105"
                        >
                          <img 
                            src={image.data} 
                            alt={`증상 이미지 ${index + 1}`} 
                            style={{ 
                              width: '100%', 
                              height: '8rem', 
                              objectFit: 'cover' 
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            style={{ 
                              position: 'absolute', 
                              top: '0.5rem', 
                              right: '0.5rem', 
                              backgroundColor: '#ef4444', 
                              color: 'white', 
                              borderRadius: '50%', 
                              width: '2rem', 
                              height: '2rem', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              opacity: '1', 
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', 
                              fontSize: '1.25rem', 
                              fontWeight: 'bold',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#e5e7eb', 
                      color: '#1f2937', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#10b981', 
                      color: 'white', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 이미지 모달 */}
          {showImageModal && (
            <div 
              style={{ 
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.9)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem'
              }}
              onClick={closeImageModal}
            >
              <div 
                style={{ 
                  position: 'relative',
                  maxWidth: '90vw',
                  maxHeight: '90vh',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  padding: '0.5rem',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
                }} 
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  style={{ 
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    backgroundColor: 'white',
                    color: 'black',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                    zIndex: 10,
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={closeImageModal}
                >
                  ×
                </button>
                {modalLoading && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '50%', 
                    left: '50%', 
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: 'white',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.25rem',
                    fontSize: '1rem',
                    zIndex: 5
                  }}>
                    이미지 로딩 중...
                  </div>
                )}
                <img 
                  src={selectedImage} 
                  alt="증상 이미지 확대" 
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: '85vh',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                    borderRadius: '0.25rem'
                  }}
                  onLoad={handleImageLoaded}
                  onError={() => {
                    setModalLoading(false);
                    alert('이미지를 불러올 수 없습니다. URL: ' + selectedImage);
                  }}
                />
              </div>
            </div>
          )}

          {/* 상담일지 목록 (카드 형태) */}
          {consultations.length > 0 && (
            <div style={{ margin: '0 auto', padding: '1.5rem 0' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>상담 일지</h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {consultations.map((consultation: FormattedConsultation) => (
                  <div 
                    key={consultation.id} 
                    style={{
                      border: '2px solid #e5e7eb', 
                      borderRadius: '0.75rem', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                      overflow: 'hidden',
                      backgroundColor: 'white',
                      marginBottom: '1rem'
                    }}
                  >
                    {/* 상담 정보 헤더 */}
                    <div 
                      style={{
                        backgroundColor: '#eff6ff', 
                        padding: '1.25rem', 
                        borderBottom: '2px solid #e5e7eb'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ fontSize: '1rem', color: '#4b5563' }}>
                            {new Date(consultation.createdTime || consultation.consultationDate).toLocaleDateString('ko-KR', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ fontSize: '1rem', color: '#2563eb', fontWeight: '500' }}>
                              {consultation.phoneNumber}
                            </div>
                            <button
                              onClick={() => openEditForm(consultation)}
                              style={{
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875rem',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              수정
                            </button>
                            <button
                              onClick={() => deleteConsultation(consultation.id)}
                              style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.875rem',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 상담 내용 */}
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div 
                        style={{
                          border: '2px solid #f3f4f6', 
                          borderRadius: '0.5rem', 
                          padding: '1rem',
                          backgroundColor: '#f9fafb'
                        }}
                      >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                          상담 내용
                        </h3>
                        <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                          {consultation.consultationContent || '내용 없음'}
                        </p>
                      </div>

                      {/* 이미지가 있는 경우만 표시 */}
                      {consultation.symptomImages && consultation.symptomImages.length > 0 && consultation.symptomImages.some((url: string) => url) && (
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                            증상 이미지 ({consultation.symptomImages.filter(Boolean).length}장)
                          </h3>
                          <div style={{ 
                            display: 'flex',
                            flexWrap: 'nowrap',
                            overflowX: 'auto',
                            gap: '0.75rem',
                            padding: '0.5rem 0',
                            WebkitOverflowScrolling: 'touch',
                            scrollbarWidth: 'none'
                          }}>
                            {consultation.symptomImages.filter(Boolean).map((imageUrl: string, index: number) => (
                              <ConsultationImage 
                                key={index} 
                                imageUrl={imageUrl} 
                                index={index} 
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 처방약 정보 - 항상 표시 */}
                      <div 
                        style={{
                          border: '2px solid #f3f4f6', 
                          borderRadius: '0.5rem', 
                          padding: '1rem',
                          backgroundColor: '#f9fafb'
                        }}
                      >
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                          처방약
                        </h3>
                        <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                          {consultation.prescription || '처방약 정보가 없습니다.'}
                        </p>
                      </div>

                      {/* 결과 정보 */}
                      {consultation.result && (
                        <div 
                          style={{
                            border: '2px solid #f3f4f6', 
                            borderRadius: '0.5rem', 
                            padding: '1rem',
                            backgroundColor: '#f9fafb'
                          }}
                        >
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                            결과
                          </h3>
                          <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                            {consultation.result}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 상담일지 수정 폼 */}
          {showEditForm && editConsultation && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
              padding: '1.5rem', 
              marginBottom: '1.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <h2 style={{ 
                fontSize: '1.25rem', 
                fontWeight: 'bold', 
                marginBottom: '1rem', 
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center'
              }}>
                상담일지 수정
              </h2>
              <form onSubmit={updateConsultation} style={{ 
                backgroundColor: '#eff6ff', 
                padding: '1.25rem', 
                borderRadius: '0.5rem', 
                borderLeft: '4px solid #3b82f6'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    상담일자 *
                  </label>
                  <input
                    type="date"
                    value={editConsultation.consultationDate.split('T')[0]}
                    onChange={(e) => setEditConsultation({
                      ...editConsultation, 
                      consultationDate: e.target.value
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    required
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    상담내용 *
                  </label>
                  <textarea
                    value={editConsultation.consultationContent}
                    onChange={(e) => setEditConsultation({
                      ...editConsultation, 
                      consultationContent: e.target.value
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s',
                      minHeight: '6rem'
                    }}
                    rows={4}
                    required
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    처방약
                  </label>
                  <textarea
                    value={editConsultation.prescription}
                    onChange={(e) => setEditConsultation({
                      ...editConsultation, 
                      prescription: e.target.value
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    rows={2}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af' 
                  }}>
                    결과
                  </label>
                  <textarea
                    value={editConsultation.result}
                    onChange={(e) => setEditConsultation({
                      ...editConsultation, 
                      result: e.target.value
                    })}
                    style={{ 
                      width: '100%', 
                      padding: '1rem', 
                      fontSize: '1.125rem', 
                      border: '1px solid #d1d5db', 
                      borderRadius: '0.5rem',
                      transition: 'all 0.2s'
                    }}
                    rows={2}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditForm(false);
                      setEditConsultation(null);
                    }}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#e5e7eb', 
                      color: '#1f2937', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{ 
                      width: '100%', 
                      backgroundColor: '#3b82f6', 
                      color: 'white', 
                      padding: '1rem',
                      fontSize: '1.125rem', 
                      borderRadius: '0.5rem', 
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {loading ? '저장 중...' : '저장'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 