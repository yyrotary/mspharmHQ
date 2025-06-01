'use client';

import moment from 'moment-timezone';
import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Loading from '@/app/components/Loading';

// Supabase 고객 타입 정의
interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string;
  google_drive_folder_id?: string;
  consultation_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

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
  stateAnalysis?: string;  // 환자상태 필드 추가
  tongueAnalysis?: string; // 설진분석 필드 추가
  specialNote?: string;    // 특이사항 필드 추가
}

// 새 상담일지 폼 데이터 타입
interface NewConsultation {
  consultDate: string;
  content: string;
  medicine: string;
  result: string;
  stateAnalysis: string;  // 환자상태 필드 추가
  tongueAnalysis: string; // 설진분석 필드 추가
  specialNote: string;    // 특이사항 필드 추가
  images: Array<{
    data: string;
    fileName: string;
  }>;
}

export default function ConsultationPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Loading /></div>}>
      <ConsultationContent />
    </Suspense>
  );
}

function ConsultationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
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
    specialNote: '',
    estimatedAge: '' // 추정나이 필드 추가
  });
  
  const [newConsultation, setNewConsultation] = useState<NewConsultation>({
    consultDate: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM 형식
    content: '',
    medicine: '',
    result: '',
    stateAnalysis: '',
    tongueAnalysis: '',
    specialNote: '',
    images: []
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
      
      // 고객 검색
      const response = await fetch(`/api/customer?name=${encodeURIComponent(customerName)}`);
      const data = await response.json();
      
      if (data.success && data.customers && data.customers.length > 0) {
        // 여러 고객이 검색된 경우 모달로 선택
        if (data.customers.length > 1) {
          setMultipleCustomers(data.customers);
          setShowCustomerSelectModal(true);
          setMessage(`${data.customers.length}명의 고객이 검색되었습니다. 선택해주세요.`);
        } else {
          // 한 명만 검색된 경우 바로 선택
          const foundCustomer = data.customers[0];
          await selectCustomerAndLoadConsultations(foundCustomer);
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
  
  // 고객 선택 및 상담일지 로드 함수 (공통 로직)
  const selectCustomerAndLoadConsultations = async (foundCustomer: Customer) => {
    try {
      setCustomer(foundCustomer);
      
      // Supabase 형식으로 고객 정보 추출
      const customerInfo = {
        name: foundCustomer.name || '',
        phone: foundCustomer.phone || '',
        consultationCount: foundCustomer.consultation_count || 0
      };
      
      // 상담일지 조회 (consultation-v2 API 사용)
      const consultationsResponse = await fetch(`/api/consultation-v2?customerId=${foundCustomer.id}`);
      const consultationsData = await consultationsResponse.json();
      
      if (consultationsData.success) {
        // Supabase 데이터를 기존 형식으로 변환
        const formattedConsultations = consultationsData.consultations.map((consultation: any) => {
          // consult_date를 직접 사용 (이제 TIMESTAMP WITH TIME ZONE으로 시간 정보 포함)
          let consultationDateTime = consultation.consult_date || '';
          
          return {
            id: consultation.id,
            customerName: customerInfo.name,
            phoneNumber: customerInfo.phone,
            consultationDate: consultationDateTime,
            consultationContent: consultation.symptoms || '',
            prescription: consultation.prescription || '',
            result: consultation.result || '',
            stateAnalysis: consultation.patient_condition || '',
            tongueAnalysis: consultation.tongue_analysis || '',
            specialNote: consultation.special_notes || '',
            symptomImages: consultation.image_urls || []
          };
        });
        
        setConsultations(formattedConsultations);
        setMessage('');
      } else {
        setMessage('상담일지 조회 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 조회 오류:', error);
      setMessage('상담일지 조회 중 오류가 발생했습니다.');
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
          specialNote: newCustomer.specialNote,
          estimatedAge: newCustomer.estimatedAge // 추정나이 필드 추가
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('새 고객이 등록되었습니다.');
        setShowCustomerForm(false);
        
        // 등록된 고객 정보 설정
        setCustomer(result.customer);
        
        // 고객 등록 폼 초기화
        setNewCustomer({
          name: '',
          phone: '',
          gender: '',
          birth: '',
          address: '',
          specialNote: '',
          estimatedAge: undefined
        });
        
        // 새 상담일지 폼 열기
        setShowNewForm(true);
        
        // 성공 메시지 업데이트
        setMessage(`${result.customer.name} 고객이 등록되었습니다. 새 상담일지를 작성해주세요.`);
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
        const customerName = customer?.name || 'unknown';
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
          const customerName = customer?.name || 'unknown';
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
    setNewConsultation(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };
  
  // 이미지 업로드 함수
  const uploadImages = async (customerFolderId: string | null) => {
    if (newConsultation.images.length === 0) return [];
    
    try {
      const uploadedUrls: string[] = [];
      let failedUploads = 0;
      let errorMessages: string[] = [];
      
      // 각 이미지를 업로드하기 전에 리사이징
      const processedImages = await Promise.all(
        newConsultation.images.map(async (image, i) => {
          // 파일명 포맷 개선
          const customerId = customer?.id || 'unknown';
          const timestamp = moment().tz('Asia/Seoul').format('YYMMDDHHmmss');
          const fileNamePrefix = `${customerId}_${timestamp}`;
          const fileName = `${fileNamePrefix}.jpg`;
          
          return {
            index: i,
            data: image.data,
            fileName: fileName
          };
        })
      );
      
      // 병렬 처리를 위한 배치 크기 (한 번에 처리할 이미지 수)
      const batchSize = 2;
      
      // 배치 단위로 처리
      for (let i = 0; i < processedImages.length; i += batchSize) {
        const batch = processedImages.slice(i, i + batchSize);
        setMessage(`이미지 업로드 중 (${i+1}-${Math.min(i+batchSize, processedImages.length)}/${processedImages.length})...`);
        
        // 배치 내의 이미지 병렬 업로드
        const batchResults = await Promise.all(
          batch.map(async (img) => {
            try {
              console.log(`이미지 ${img.index+1} 업로드 시작: ${img.fileName}`);
              
              const response = await fetch('/api/google-drive', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imageData: img.data,
                  fileName: img.fileName,
                  customerFolderId: customerFolderId  // 고객 폴더 ID 전달
                }),
              });
              
              const result = await response.json();
              
              if (response.ok && result.success) {
                // 구글 드라이브 링크 사용
                const fileUrl = result.file?.link || result.fileId 
                  ? `https://drive.google.com/file/d/${result.fileId || result.file?.id}/view`
                  : null;
                
                if (fileUrl) {
                  console.log(`이미지 ${img.index+1} 업로드 성공: ${fileUrl.substring(0, 60)}...`);
                  return { success: true, url: fileUrl, index: img.index };
                } else {
                  throw new Error('유효한 파일 URL이 반환되지 않음');
                }
              } else {
                throw new Error(result.error || '알 수 없는 오류');
              }
            } catch (error) {
              console.error(`이미지 ${img.index+1} 업로드 중 예외 발생:`, error);
              return { 
                success: false, 
                index: img.index, 
                error: error instanceof Error ? error.message : '네트워크 오류' 
              };
            }
          })
        );
        
        // 결과 처리
        batchResults.forEach(result => {
          if (result.success && 'url' in result) {
            uploadedUrls.push(result.url);
          } else {
            failedUploads++;
            if ('error' in result) {
              errorMessages.push(result.error);
            }
          }
        });
      }
      
      // 업로드 결과 요약
      if (failedUploads > 0) {
        const totalImages = newConsultation.images.length;
        const successCount = totalImages - failedUploads;
        
        let errorSummary = errorMessages.length > 0 
          ? ` 오류: ${errorMessages[0]}${errorMessages.length > 1 ? ` 외 ${errorMessages.length - 1}건` : ''}`
          : '';
          
        setMessage(`이미지 ${successCount}/${totalImages}개 업로드 성공.${errorSummary}`);
        
        // 모든 이미지 업로드 실패 시 
        if (successCount === 0) {
          throw new Error(`모든 이미지 업로드 실패. ${errorMessages[0]}`);
        }
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setMessage(`이미지 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      return [];
    }
  };
  
  // 수정 폼용 이미지 업로드 함수
  const uploadEditImages = async (customerFolderId: string | null) => {
    if (editFormData.images.length === 0) return [];
    
    try {
      const uploadedUrls: string[] = [];
      let failedUploads = 0;
      let errorMessages: string[] = [];
      
      // 각 이미지를 업로드하기 전에 리사이징
      const processedImages = await Promise.all(
        editFormData.images.map(async (image, i) => {
          // 파일명 포맷 개선
          const customerId = customer?.id || 'unknown';
          const consultationId = editingConsultation?.id.substring(0, 10) || 'edit';
          const timestamp = moment().tz('Asia/Seoul').format('YYMMDDHHmmss');
          const fileNamePrefix = `${customerId}_${timestamp}`;
          const fileName = `${fileNamePrefix}.jpg`;
          
          return {
            index: i,
            data: image.data,
            fileName: fileName
          };
        })
      );
      
      // 병렬 처리를 위한 배치 크기 (한 번에 처리할 이미지 수)
      const batchSize = 2;
      
      // 배치 단위로 처리
      for (let i = 0; i < processedImages.length; i += batchSize) {
        const batch = processedImages.slice(i, i + batchSize);
        setMessage(`이미지 업로드 중 (${i+1}-${Math.min(i+batchSize, processedImages.length)}/${processedImages.length})...`);
        
        // 배치 내의 이미지 병렬 업로드
        const batchResults = await Promise.all(
          batch.map(async (img) => {
            try {
              console.log(`이미지 ${img.index+1} 업로드 시작: ${img.fileName}`);
              
              const response = await fetch('/api/google-drive', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  imageData: img.data,
                  fileName: img.fileName,
                  customerFolderId: customerFolderId  // 고객 폴더 ID 전달
                }),
              });
              
              const result = await response.json();
              
              if (response.ok && result.success) {
                // 구글 드라이브 링크 사용
                const fileUrl = result.file?.link || result.fileId 
                  ? `https://drive.google.com/file/d/${result.fileId || result.file?.id}/view`
                  : null;
                
                if (fileUrl) {
                  console.log(`이미지 ${img.index+1} 업로드 성공: ${fileUrl.substring(0, 60)}...`);
                  return { success: true, url: fileUrl, index: img.index };
                } else {
                  throw new Error('유효한 파일 URL이 반환되지 않음');
                }
              } else {
                throw new Error(result.error || '알 수 없는 오류');
              }
            } catch (error) {
              console.error(`이미지 ${img.index+1} 업로드 중 예외 발생:`, error);
              return { 
                success: false, 
                index: img.index, 
                error: error instanceof Error ? error.message : '네트워크 오류' 
              };
            }
          })
        );
        
        // 결과 처리
        batchResults.forEach(result => {
          if (result.success && 'url' in result) {
            uploadedUrls.push(result.url);
          } else {
            failedUploads++;
            if ('error' in result) {
              errorMessages.push(result.error);
            }
          }
        });
      }
      
      // 업로드 결과 요약
      if (failedUploads > 0) {
        const totalImages = editFormData.images.length;
        const successCount = totalImages - failedUploads;
        
        let errorSummary = errorMessages.length > 0 
          ? ` 오류: ${errorMessages[0]}${errorMessages.length > 1 ? ` 외 ${errorMessages.length - 1}건` : ''}`
          : '';
          
        setMessage(`이미지 ${successCount}/${totalImages}개 업로드 성공.${errorSummary}`);
        
        // 모든 이미지 업로드 실패 시 
        if (successCount === 0) {
          throw new Error(`모든 이미지 업로드 실패. ${errorMessages[0]}`);
        }
      }
      
      return uploadedUrls;
    } catch (error) {
      console.error('이미지 업로드 오류:', error);
      setMessage(`이미지 업로드 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      return [];
    }
  };
  
  // 1. 추가: 시스템 상태 진단 기능
  const [systemStatus, setSystemStatus] = useState<{ 
    googleDrive: 'unknown' | 'checking' | 'ok' | 'error',
    googleDriveMessage: string
  }>({
    googleDrive: 'unknown',
    googleDriveMessage: ''
  });

  // 시스템 상태 진단 함수
  const checkSystemStatus = async () => {
    // 구글 드라이브 연결 상태 확인
    try {
      setSystemStatus(prev => ({ ...prev, googleDrive: 'checking', googleDriveMessage: '구글 드라이브 연결 확인 중...' }));
      
      const response = await fetch('/api/google-drive/status', {
        method: 'GET'
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSystemStatus(prev => ({ 
            ...prev, 
            googleDrive: 'ok', 
            googleDriveMessage: '구글 드라이브 연결 정상'
          }));
        } else {
          setSystemStatus(prev => ({ 
            ...prev, 
            googleDrive: 'error', 
            googleDriveMessage: `구글 드라이브 연결 오류: ${result.error || '알 수 없는 오류'}`
          }));
        }
      } else {
        setSystemStatus(prev => ({ 
          ...prev, 
          googleDrive: 'error', 
          googleDriveMessage: '구글 드라이브 상태 확인 API 연결 실패'
        }));
      }
    } catch (error) {
      setSystemStatus(prev => ({ 
        ...prev, 
        googleDrive: 'error', 
        googleDriveMessage: `구글 드라이브 연결 확인 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`
      }));
    }
  };
  
  // 이미지 업로드 문제 발생 시 재시도 및 진단 기능
  const troubleshootImageUpload = async () => {
    setLoading(true);
    setMessage('이미지 업로드 시스템 진단 중...');
    
    try {
      // 시스템 상태 확인
      await checkSystemStatus();
      
      // 간단한 테스트 이미지 업로드 시도
      const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ3jyYOzAAAAABJRU5ErkJggg=='; // 1x1 투명 픽셀
      
      const response = await fetch('/api/google-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageData: testImageData,
          fileName: 'test_image.png'
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('테스트 이미지 업로드 성공. 이제 다시 시도해보세요.');
      } else {
        setMessage(`테스트 이미지 업로드 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      setMessage(`진단 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 2. 호소증상상 저장 부분 수정
  const saveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customer) {
      setMessage('고객 정보가 필요합니다.');
      return;
    }
    
    if (!newConsultation.content) {
      setMessage('호소증상은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('상담일지 저장 중...');
      
      // 상담일지 API 호출 데이터 준비 (Supabase 기반)
      const apiData = {
        customer_id: customer.id,
        consultDate: newConsultation.consultDate,
        symptoms: newConsultation.content,
        medicine: newConsultation.medicine,  // prescription → medicine
        result: newConsultation.result,
        stateAnalysis: newConsultation.stateAnalysis,
        tongueAnalysis: newConsultation.tongueAnalysis,
        specialNote: newConsultation.specialNote,  // specialNotes → specialNote
        imageDataArray: newConsultation.images.map(img => img.data) // Base64 이미지 데이터 배열
      };
      
      setMessage('상담일지 저장 요청 전송 중...');
      
      // 상담일지 저장 API 호출
      const response = await fetch('/api/consultation-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiData),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('상담일지가 저장되었습니다.');
        
        // 상담일지 폼 초기화
        setNewConsultation({
          consultDate: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM 형식
          content: '',
          medicine: '',
          result: '',
          stateAnalysis: '',
          tongueAnalysis: '',
          specialNote: '',
          images: []
        });
        
        setShowNewForm(false);
        
        // 상담일지 목록 갱신
        setMessage('상담일지 목록 갱신 중...');
        const consultationsResponse = await fetch(`/api/consultation-v2?customerId=${customer.id}`);
        const consultationsData = await consultationsResponse.json();
        
        if (consultationsData.success) {
          // Supabase 데이터를 기존 형식으로 변환
          const formattedConsultations = consultationsData.consultations.map((consultation: any) => {
            return {
              id: consultation.id,
              customerName: customer.name || '',
              phoneNumber: customer.phone || '',
              consultationDate: consultation.consult_date || '',
              consultationContent: consultation.symptoms || '',
              prescription: consultation.prescription || '',
              stateAnalysis: consultation.patient_condition || '',
              tongueAnalysis: consultation.tongue_analysis || '',
              result: consultation.result || '',
              specialNote: consultation.special_notes || '',
              symptomImages: consultation.image_urls || []
            };
          });
          
          setConsultations(formattedConsultations);
        }
        
        setMessage('');
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
            console.log('Google Drive URL 변환 실패:', url);
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
            console.log('Google Drive URL 변환 실패:', url);
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
            console.log('Google Drive URL 변환 실패:', url);
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
              console.log('Google Drive URL 변환 실패:', url);
              return url;
            }
          }
          
          return url;
        }
      }

      return null;
    } catch (error) {
      console.warn('이미지 URL 처리 중 오류 발생:', error);
      return null;
    }
  };

  // 상담일지 이미지 컴포넌트
  const ConsultationImage = ({ imageUrl, index }: { imageUrl: string, index: number }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState(false);
    const [processedUrl, setProcessedUrl] = useState('');
    const [fallbackTriggered, setFallbackTriggered] = useState(false);

    // 구글 드라이브 fileId 추출 함수
    const extractFileId = (url: string) => {
      try {
        if (url.includes('drive.google.com/file/d/')) {
          return url.split('/file/d/')[1].split('/')[0];
        } else if (url.includes('drive.google.com/uc?export=view&id=')) {
          return url.split('id=')[1].split('&')[0];
        } else if (url.includes('lh3.googleusercontent.com/d/')) {
          return url.split('/d/')[1].split('?')[0];
        }
        return null;
      } catch (e) {
        console.warn('File ID 추출 실패:', url);
        return null;
      }
    };

    // Supabase Storage URL 확인 함수
    const isSupabaseUrl = (url: string) => {
      return url.includes('supabase.co/storage/v1/object/public/');
    };

    // URL 변환 및 설정
    useEffect(() => {
      console.log('🔍 이미지 URL 처리 시작:', imageUrl);
      
      // null, undefined, 빈 문자열 체크
      if (!imageUrl || imageUrl === "" || imageUrl === "undefined" || imageUrl === "null") {
        console.log('❌ 유효하지 않은 이미지 URL:', imageUrl);
        setError(true);
        return;
      }
      
      // Supabase Storage URL인 경우 그대로 사용
      if (isSupabaseUrl(imageUrl)) {
        console.log('✅ Supabase URL 감지:', imageUrl);
        setProcessedUrl(imageUrl);
        return;
      }
      
      // 구글 드라이브 URL 처리
      try {
        const fileId = extractFileId(imageUrl);
        
        if (fileId) {
          // 구글 드라이브 API를 직접 사용하는 방식으로 변경
          // 이미지 직접 엑세스 URL 방식 (구글 API를 통한 인증 필요 없음)
          const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
          console.log('🔄 Google Drive URL 변환:', imageUrl, '→', alternativeUrl);
          setProcessedUrl(alternativeUrl);
        } else {
          // 그 외의 경우 원본 URL 사용
          console.log('📎 원본 URL 사용:', imageUrl);
          setProcessedUrl(imageUrl);
        }
      } catch (error) {
        // URL 변환 실패 시 원본 URL 사용
        console.warn('URL 변환 실패:', error);
        setProcessedUrl(imageUrl);
      }
    }, [imageUrl, index]);

    // 첫 번째 방식 실패 시 대체 URL로 재시도 (Google Drive만)
    const tryFallbackUrl = () => {
      if (fallbackTriggered || isSupabaseUrl(imageUrl)) return; // 이미 시도했거나 Supabase URL이면 다시 시도하지 않음
      
      try {
        const fileId = extractFileId(imageUrl);
        if (!fileId) {
          setError(true);
          return;
        }
        
        // 첫 번째 대체 URL 시도: uc?export=view&id 형식
        const fallbackUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        setProcessedUrl(fallbackUrl);
        setFallbackTriggered(true);
        setIsLoaded(false); // 로딩 상태 재설정
      } catch (error) {
        console.warn('대체 URL 변환 실패:', error);
        setError(true);
      }
    };

    // 이미지 로드 실패 시 처리 로직
    const handleImageError = () => {
      console.error('이미지 로드 실패:', processedUrl);
      
      if (isSupabaseUrl(imageUrl)) {
        // Supabase URL이 실패하면 바로 에러 표시
        setError(true);
      } else if (!fallbackTriggered) {
        // 첫 번째 URL이 실패하면 대체 URL로 시도
        tryFallbackUrl();
      } else {
        // 대체 URL도 실패하면 에러 표시
        setError(true);
      }
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
          <br />
          <small style={{ fontSize: '0.6rem', marginTop: '4px' }}>
            {isSupabaseUrl(imageUrl) ? 'Supabase' : 'Google Drive'}
          </small>
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
    
    // Supabase Storage URL 확인 함수
    const isSupabaseUrl = (url: string) => {
      return url.includes('supabase.co/storage/v1/object/public/');
    };
    
    // Supabase URL인 경우 그대로 사용
    if (isSupabaseUrl(imageUrl)) {
      setSelectedImage(imageUrl);
      setShowImageModal(true);
      setImageScale(1);
      setImagePosition({ x: 0, y: 0 });
      return;
    }
    
    // 구글 드라이브 fileId 추출 함수 - ConsultationImage 컴포넌트와 동일한 로직
    const extractFileId = (url: string) => {
      try {
        if (url.includes('drive.google.com/file/d/')) {
          return url.split('/file/d/')[1].split('/')[0];
        } else if (url.includes('drive.google.com/uc?export=view&id=')) {
          return url.split('id=')[1].split('&')[0];
        } else if (url.includes('lh3.googleusercontent.com/d/')) {
          return url.split('/d/')[1].split('?')[0];
        }
        return null;
      } catch (e) {
        console.warn('File ID 추출 실패:', url);
        return null;
      }
    };
    
    try {
      const fileId = extractFileId(imageUrl);
      
      if (fileId) {
        // 구글 드라이브 API를 직접 사용하는 방식으로 변경
        const alternativeUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
        setSelectedImage(alternativeUrl);
      } else {
        // 그 외의 경우 원본 URL 사용
        setSelectedImage(imageUrl);
      }
    } catch (error) {
      // URL 변환 실패 시 원본 URL 사용
      console.warn('URL 변환 실패:', error);
      setSelectedImage(imageUrl);
    }
    
    setShowImageModal(true);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
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
  const [showEditCustomerForm, setShowEditCustomerForm] = useState<boolean>(false);
  
  const [editCustomer, setEditCustomer] = useState({
    name: '',
    phone: '',
    gender: '',
    birth: '',
    address: '',
    specialNote: '',
    estimatedAge: '' // 추정나이 필드 추가
  });
  
  // 고객 정보 수정 폼 필드 ref 추가
  const editNameInputRef = useRef<HTMLInputElement>(null);
  
  // 고객 정보 수정 폼이 표시될 때 이름 필드에 포커스
  useEffect(() => {
    if (showEditCustomerForm && editNameInputRef.current) {
      editNameInputRef.current.focus();
    }
  }, [showEditCustomerForm]);
  
  // 고객 정보 수정 폼 초기화
  useEffect(() => {
    if (customer && showEditCustomerForm) {
      setEditCustomer({
        name: customer.name || '',
        phone: customer.phone || '',
        gender: customer.gender || '',
        birth: customer.birth_date || '',
        address: customer.address || '',
        specialNote: customer.special_notes || '',
        estimatedAge: customer.estimated_age?.toString() || ''
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
      
      // 고객 페이지 ID 저장 (업데이트 성공 후 다시 조회하기 위함)
      const customerPageId = customer.id;
      
      // 업데이트 요청
      const response = await fetch(`/api/customer/${customerPageId}`, {
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
          specialNote: editCustomer.specialNote,
          estimatedAge: editCustomer.estimatedAge
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage(result.message || '고객 정보가 업데이트되었습니다.');
        
        // 수정 폼 닫기
        setShowEditCustomerForm(false);
        
        // 고객 정보 다시 조회
        if (customerPageId) {
          try {
            const customerResponse = await fetch(`/api/customer?id=${customerPageId}`);
            if (customerResponse.ok) {
              const customerData = await customerResponse.json();
              if (customerData.success && customerData.customers && customerData.customers.length > 0) {
                setCustomer(customerData.customers[0]);
                console.log('고객 정보 새로고침 완료');
                
                // 고객 검색 필드 업데이트
                setCustomerName(customerData.customers[0].name);
              }
            }
          } catch (error) {
            console.error('고객 정보 조회 오류:', error);
          }
        }
      } else {
        throw new Error(result.message || result.error || '고객 정보 업데이트 중 오류가 발생했습니다.');
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
  const editContentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // 새 상담일지 폼이 표시될 때 자동 포커스
  useEffect(() => {
    if (showNewForm && contentTextareaRef.current) {
      contentTextareaRef.current.focus();
    }
  }, [showNewForm]);

  const [editingConsultation, setEditingConsultation] = useState<FormattedConsultation | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    consultDate: '',
    content: '',
    medicine: '',
    result: '',
    stateAnalysis: '',  // 환자상태 필드 추가
    tongueAnalysis: '', // 설진분석 필드 추가
    specialNote: '',    // 특이사항 필드 추가
    images: [] as {data: string, fileName: string}[]
  });
  
  // 상담일지 수정 폼이 표시될 때 호소증상 필드에 자동 포커스
  useEffect(() => {
    if (showEditForm && editContentTextareaRef.current) {
      editContentTextareaRef.current.focus();
    }
  }, [showEditForm]);
  
  // 상담일지 삭제 함수
  const deleteConsultation = async (consultationId: string) => {
    if (!window.confirm('정말로 이 상담일지를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      setLoading(true);
      setMessage('상담일지 삭제 중...');
      
      const response = await fetch(`/api/consultation-v2?id=${consultationId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setMessage('상담일지가 삭제되었습니다.');
        // 상담일지 목록에서 삭제된 항목 제거
        setConsultations(consultations.filter(c => c.id !== consultationId));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || '상담일지 삭제 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 삭제 오류:', error);
      setMessage((error as Error).message || '상담일지 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 상담일지 수정 폼 초기화
  const initEditForm = (consultation: FormattedConsultation) => {
    setEditingConsultation(consultation);
    
    // 날짜 형식 변환 (datetime-local 입력에 맞는 형식으로)
    let consultDate = consultation.consultationDate;
    
    try {
      // ISO 형식 날짜를 Date 객체로 변환
      const date = new Date(consultDate);
      
      if (!isNaN(date.getTime())) {
        // 유효한 날짜인 경우 로컬 시간대로 변환하여 datetime-local 형식으로 포맷
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        consultDate = `${year}-${month}-${day}T${hours}:${minutes}`;
      } else {
        // 날짜가 유효하지 않은 경우 현재 시간으로 설정
        const now = new Date();
        consultDate = now.toISOString().slice(0, 16);
      }
    } catch (error) {
      console.warn('날짜 변환 오류:', error);
      // 오류 발생 시 현재 시간으로 설정
      const now = new Date();
      consultDate = now.toISOString().slice(0, 16);
    }
    
    setEditFormData({
      consultDate,
      content: consultation.consultationContent || '',
      medicine: consultation.prescription || '',
      result: consultation.result || '',
      stateAnalysis: consultation.stateAnalysis || '',  // 환자상태 추가
      tongueAnalysis: consultation.tongueAnalysis || '', // 설진분석 추가
      specialNote: consultation.specialNote || '',       // 특이사항 추가
      images: [] // 새 이미지만 추가, 기존 이미지는 symptomImages에서 참조
    });
    
    setShowEditForm(true);
  };
  
  // 상담일지 수정 제출
  const submitEditForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingConsultation) {
      setMessage('수정할 상담일지 정보가 없습니다.');
      return;
    }
    
    if (!editFormData.content) {
      setMessage('호소증상은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('상담일지 수정 중...');
      
      // 새 이미지가 있는 경우 업로드 메시지 표시
      if (editFormData.images.length > 0) {
        setMessage(`상담일지 수정 중... (새 이미지 ${editFormData.images.length}개 업로드)`);
      }
      
      // 상담일지 업데이트 (consultation-v2 API에서 이미지 처리 포함)
      const response = await fetch(`/api/consultation-v2`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingConsultation.id,
          consultDate: editFormData.consultDate, // 날짜 필드 추가
          symptoms: editFormData.content,
          stateAnalysis: editFormData.stateAnalysis,
          tongueAnalysis: editFormData.tongueAnalysis,
          specialNote: editFormData.specialNote,
          medicine: editFormData.medicine,
          result: editFormData.result,
          imageDataArray: editFormData.images.map(img => img.data) // 새 이미지만 전송
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage(result.message || '상담일지가 업데이트되었습니다.');
        
        // 상담일지 목록 갱신 (consultation-v2 API 사용)
        const consultationsResponse = await fetch(`/api/consultation-v2?customerId=${customer!.id}`);
        const consultationsData = await consultationsResponse.json();
        
        if (consultationsData.success) {
          // Supabase 데이터를 기존 형식으로 변환
          const formattedConsultations = consultationsData.consultations.map((consultation: any) => {
            return {
              id: consultation.id,
              customerName: customer!.name || '',
              phoneNumber: customer!.phone || '',
              consultationDate: consultation.consult_date || '',
              consultationContent: consultation.symptoms || '',
              prescription: consultation.prescription || '',
              stateAnalysis: consultation.patient_condition || '',
              tongueAnalysis: consultation.tongue_analysis || '',
              result: consultation.result || '',
              specialNote: consultation.special_notes || '',
              symptomImages: consultation.image_urls || []
            };
          });
          
          setConsultations(formattedConsultations);
        }
        
        // 폼 초기화 및 닫기
        setShowEditForm(false);
        setEditingConsultation(null);
        setEditFormData({
          consultDate: '',
          content: '',
          medicine: '',
          result: '',
          stateAnalysis: '',  // 환자상태 초기화
          tongueAnalysis: '', // 설진분석 초기화
          specialNote: '',    // 특이사항 초기화
          images: []
        });
        
        // 성공 메시지를 잠시 후 지우기
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error(result.error || '상담일지 업데이트 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('상담일지 업데이트 오류:', error);
      setMessage((error as Error).message || '상담일지 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 수정 폼 이미지 캡처 처리
  const handleEditCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        // 현재 날짜와 시간을 파일 이름에 포함
        const now = new Date();
        const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
        const customerName = customer?.name || 'unknown';
        const fileName = `${customerName}_${dateString}_edit.jpg`;
        
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
            setEditFormData({
              ...editFormData,
              images: [...editFormData.images, {
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
  
  // 수정 폼 파일 업로드 처리
  const handleEditFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        
        reader.onloadend = () => {
          // 현재 날짜와 시간을 파일 이름에 포함
          const now = new Date();
          const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
          const customerName = customer?.name || 'unknown';
          const fileName = `${customerName}_${dateString}_edit_${i+1}.jpg`;
          
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
              setEditFormData({
                ...editFormData,
                images: [...editFormData.images, {
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
  
  // 수정 폼 이미지 삭제
  const removeEditImage = (index: number) => {
    setEditFormData({
      ...editFormData,
      images: editFormData.images.filter((_, i) => i !== index)
    });
  };
  
  // 카메라 및 파일 입력 참조 (수정 폼용)
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const editCameraInputRef = useRef<HTMLInputElement>(null);
  
  // 수정 폼용 카메라 열기
  const openEditCamera = () => {
    if (editCameraInputRef.current) {
      editCameraInputRef.current.click();
    }
  };

  // 상태 추가
  const [multipleCustomers, setMultipleCustomers] = useState<Customer[]>([]);
  const [showCustomerSelectModal, setShowCustomerSelectModal] = useState(false);

  // 고객 선택 함수 수정
  const selectCustomer = async (selectedCustomer: Customer) => {
    setShowCustomerSelectModal(false);
    await selectCustomerAndLoadConsultations(selectedCustomer);
  };

  // 밴드 관련 상태 추가
  const [showBandModal, setShowBandModal] = useState(false);
  const [bands, setBands] = useState<any[]>([]);
  const [selectedBandKey, setSelectedBandKey] = useState('');
  const [bandLoading, setBandLoading] = useState(false);
  const [bandMessage, setBandMessage] = useState('');

  // 밴드 목록 조회 함수
  const fetchBandList = async () => {
    try {
      setBandLoading(true);
      setBandMessage('');
      
      const response = await fetch('/api/bandapi/bands');
      const result = await response.json();
      
      if (result.success && result.bands) {
        setBands(result.bands);
      } else {
        setBandMessage(result.error || '밴드 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('밴드 목록 조회 오류:', error);
      setBandMessage('밴드 목록을 불러오는데 실패했습니다.');
    } finally {
      setBandLoading(false);
    }
  };

  // 밴드에 올리기 버튼 클릭 핸들러
  const handlePostToBand = async () => {
    if (consultations.length === 0) {
      setMessage('포스팅할 상담 내역이 없습니다.');
      return;
    }
    
    await fetchBandList();
    setShowBandModal(true);
  };

  // 선택한 밴드에 포스팅
  const postToBand = async () => {
    if (!selectedBandKey) {
      setBandMessage('밴드를 선택해주세요.');
      return;
    }
    
    try {
      setBandLoading(true);
      setBandMessage('');
      
      // 고객 이름 확인 (Supabase 형식)
      const customerName = customer?.name || '고객';
      
      // 밴드 포스팅 API 호출
      const response = await fetch('/api/bandapi/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bandKey: selectedBandKey,
          customerName: customerName,
          consultations: consultations
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBandMessage('밴드에 상담 내역이 성공적으로 포스팅되었습니다.');
        setTimeout(() => {
          setShowBandModal(false);
          setMessage('밴드에 상담 내역이 성공적으로 포스팅되었습니다.');
        }, 1500);
      } else {
        setBandMessage(result.error || '포스팅 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('밴드 포스팅 오류:', error);
      setBandMessage('포스팅 중 오류가 발생했습니다.');
    } finally {
      setBandLoading(false);
    }
  };

  // 새 상담일지 폼의 시간 형식 초기화를 위한 useEffect 추가
  useEffect(() => {
    // 페이지 로드 시 상담일지 폼 초기화
    setNewConsultation(prev => ({
      ...prev,
      consultDate: new Date().toISOString().slice(0, 16) // YYYY-MM-DDTHH:MM 형식
    }));
  }, []);

  // URL 파라미터에서 고객 ID를 가져와서 바로 조회하기
  useEffect(() => {
    const customerId = searchParams.get('customerId');
    const directView = searchParams.get('directView');
    
    if (customerId && directView === 'true') {
      // 고객 ID로 직접 고객 정보 조회
      const fetchCustomerById = async () => {
        try {
          setLoading(true);
          setMessage('고객 정보를 불러오는 중입니다...');
          
          // 고객 페이지 ID로 직접 조회
          const customerResponse = await fetch(`/api/customer?id=${customerId}`);
          const customerData = await customerResponse.json();
          
          if (customerData.success && customerData.customers && customerData.customers.length > 0) {
            const foundCustomer = customerData.customers[0];
            
            // 고객 정보 설정
            setCustomer(foundCustomer);
            
            // 상담일지 목록 조회
            const consultationsResponse = await fetch(`/api/consultation-v2?customerId=${foundCustomer.id}`);
            const consultationsData = await consultationsResponse.json();
            
            if (consultationsData.success) {
              // Supabase 데이터를 기존 형식으로 변환
              const formattedConsultations = consultationsData.consultations.map((consultation: any) => {
                return {
                  id: consultation.id,
                  customerName: foundCustomer.name || '',
                  phoneNumber: foundCustomer.phone || '',
                  consultationDate: consultation.consult_date || '',
                  consultationContent: consultation.symptoms || '',
                  prescription: consultation.prescription || '',
                  stateAnalysis: consultation.patient_condition || '',
                  tongueAnalysis: consultation.tongue_analysis || '',
                  result: consultation.result || '',
                  specialNote: consultation.special_notes || '',
                  symptomImages: consultation.image_urls || []
                };
              });
              
              setConsultations(formattedConsultations);
              setMessage('');
            } else {
              setMessage('상담일지 조회 중 오류가 발생했습니다.');
            }
          } else {
            setMessage('고객 정보를 찾을 수 없습니다.');
          }
        } catch (error) {
          console.error('고객 정보 조회 오류:', error);
          setMessage('고객 정보 조회 중 오류가 발생했습니다.');
        } finally {
          setLoading(false);
        }
      };
      
      fetchCustomerById();
    }
  }, [searchParams]);

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
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Link href="/" style={{ color: 'white', textDecoration: 'none' }}>
              ← 홈으로
            </Link>
            <Link href="/customer-list" style={{ color: 'white', textDecoration: 'none' }}>
              고객 목록
            </Link>
          </div>
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
              {/* 검색 버튼 */}
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
              {/* 신규 고객 등록 버튼 추가 */}
              <button
                onClick={() => {
                  setShowCustomerForm(true);
                  // 모든 고객 정보 필드 초기화
                  setNewCustomer({
                    name: '',
                    phone: '',
                    gender: '',
                    birth: '',
                    address: '',
                    specialNote: '',
                    estimatedAge: ''
                  });
                }}
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
                신규 고객 등록
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
                {message.includes('업로드 실패') && (
                  <button
                    onClick={troubleshootImageUpload}
                    style={{ marginLeft: '0.5rem', textDecoration: 'underline', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    시스템 진단하기
                  </button>
                )}
                
                {/* 시스템 상태 표시 */}
                {systemStatus.googleDrive !== 'unknown' && (
                  <div style={{ 
                    marginTop: '0.75rem',
                    padding: '0.75rem', 
                    backgroundColor: systemStatus.googleDrive === 'ok' ? '#f0fdf4' : '#fef2f2',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    border: `1px solid ${systemStatus.googleDrive === 'ok' ? '#86efac' : '#fecaca'}`
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      color: systemStatus.googleDrive === 'ok' ? '#166534' : '#b91c1c'
                    }}>
                      <span style={{ marginRight: '0.5rem' }}>
                        {systemStatus.googleDrive === 'checking' ? '⏳' : 
                         systemStatus.googleDrive === 'ok' ? '✅' : '❌'}
                      </span>
                      <strong>구글 드라이브 상태:</strong> 
                      <span style={{ marginLeft: '0.5rem' }}>{systemStatus.googleDriveMessage}</span>
                    </div>
                    
                    {systemStatus.googleDrive === 'error' && (
                      <div style={{ marginTop: '0.5rem', color: '#b91c1c' }}>
                        <p>문제 해결 방법:</p>
                        <ol style={{ paddingLeft: '1.5rem', marginTop: '0.25rem' }}>
                          <li>서비스 계정 키(JSON) 파일이 올바른 위치에 있는지 확인하세요.</li>
                          <li>환경 변수 GOOGLE_APPLICATION_CREDENTIALS가 올바르게
                          설정되었는지 확인하세요.</li>
                          <li>서비스 계정에 Google Drive API 권한이 있는지 확인하세요.</li>
                          <li>서버를 재시작해 보세요.</li>
                        </ol>
                      </div>
                    )}
                  </div>
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
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.name}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>전화번호</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customer.phone}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>성별</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{customer.gender}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>생년월일</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{customer.birth_date}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>추정나이</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}>{customer.estimated_age}</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}></td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }}></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontWeight: '600', color: '#1e40af', fontSize: '0.9rem' }}>주소</td>
                    <td style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.9rem' }} colSpan={3}>{customer.address}</td>
                  </tr>
                </tbody>
              </table>
              
              <div style={{ backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                <p style={{ fontWeight: '600', color: '#1e40af', marginBottom: '0.25rem', fontSize: '0.9rem' }}>특이사항</p>
                <p style={{ whiteSpace: 'pre-line', fontSize: '0.9rem' }}>{customer.special_notes}</p>
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
                      추정나이
                      <span style={{ 
                        fontSize: '0.75rem', 
                        marginLeft: '0.5rem', 
                        color: '#6b7280',
                        fontWeight: 'normal'
                      }}>
                        (생년월일을 모를 경우)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={newCustomer.estimatedAge}
                      onChange={(e) => setNewCustomer({...newCustomer, estimatedAge: e.target.value})}
                      placeholder="대략적인 나이"
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
          {showEditCustomerForm && (
            <div style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{ 
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                    고객 정보 수정
                  </h2>
                  <button
                    onClick={() => setShowEditCustomerForm(false)}
                    style={{ 
                      backgroundColor: 'transparent', 
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      color: '#6b7280'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <form onSubmit={updateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
                      ref={editNameInputRef}
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
                      추정나이
                      <span style={{ 
                        fontSize: '0.75rem', 
                        marginLeft: '0.5rem', 
                        color: '#6b7280',
                        fontWeight: 'normal'
                      }}>
                        (생년월일을 모를 경우)
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="150"
                      value={editCustomer.estimatedAge}
                      onChange={(e) => setEditCustomer({...editCustomer, estimatedAge: e.target.value})}
                      placeholder="대략적인 나이"
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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
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
            </div>
          )}

          {/* 새 상담일지 폼 */}
          {showNewForm && (
            <div style={{ 
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div style={{ 
                width: '100%',
                maxWidth: '640px',
                maxHeight: '90vh',
                overflowY: 'auto',
                backgroundColor: 'white',
                borderRadius: '0.75rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                padding: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
                    새 상담일지
                  </h2>
                  <button
                    onClick={() => setShowNewForm(false)}
                    style={{ 
                      backgroundColor: 'transparent', 
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '50%',
                      color: '#6b7280'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <form onSubmit={saveConsultation} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      상담일자 *
                    </label>
                    <input
                      type="datetime-local"
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
                  
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      호소증상 *
                    </label>
                    <textarea
                      value={newConsultation.content}
                      onChange={(e) => setNewConsultation({...newConsultation, content: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      rows={4}
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
                      증상 이미지
                    </label>
                    
                    {/* 이미지 업로드 버튼 추가 */}
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
                              aspectRatio: '1', 
                              transition: 'transform 0.2s', 
                              backgroundColor: '#f3f4f6' 
                            }}
                          >
                            <img 
                              src={image.data} 
                              alt={`증상 이미지 ${index + 1}`} 
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover' 
                              }} 
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              style={{ 
                                position: 'absolute', 
                                top: '0.25rem', 
                                right: '0.25rem', 
                                backgroundColor: 'rgba(239, 68, 68, 0.8)', 
                                color: 'white', 
                                width: '1.75rem', 
                                height: '1.75rem', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '1rem', 
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


                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      환자상태
                    </label>
                    <textarea
                      value={newConsultation.stateAnalysis}
                      onChange={(e) => setNewConsultation({...newConsultation, stateAnalysis: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      rows={4}
                      placeholder="환자상태 내용을 입력하세요"
                    />
                  </div>
                  
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af' 
                    }}>
                      설진분석
                    </label>
                    <textarea
                      value={newConsultation.tongueAnalysis}
                      onChange={(e) => setNewConsultation({...newConsultation, tongueAnalysis: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      rows={3}
                      placeholder="설진분석 내용을 입력하세요"
                    />
                  </div>
                  
                  <div>
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
                      rows={3}
                      placeholder="처방약 정보를 입력하세요"
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
                      value={newConsultation.specialNote}
                      onChange={(e) => setNewConsultation({...newConsultation, specialNote: e.target.value})}
                      style={{ 
                        width: '100%', 
                        padding: '1rem', 
                        fontSize: '1.125rem', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      rows={3}
                      placeholder="특이사항이 있으면 입력하세요"
                    />
                  </div>
                  <div>
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
                      rows={3}
                      placeholder="상담 결과를 입력하세요"
                    />
                  </div>


                  
                  
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{ 
                        flex: 1,
                        backgroundColor: '#10b981', 
                        color: 'white', 
                        padding: '1rem',
                        fontSize: '1.125rem', 
                        borderRadius: '0.5rem', 
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {loading ? '저장 중...' : '저장하기'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setShowNewForm(false)}
                      style={{ 
                        flex: 1,
                        backgroundColor: '#e5e7eb', 
                        color: '#1f2937', 
                        padding: '1rem',
                        fontSize: '1.125rem', 
                        borderRadius: '0.5rem', 
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      취소
                    </button>
                  </div>
                </form>
              </div>
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
                    
                    // 이미지 로드 실패 시 대체 URL 시도
                    try {
                      // 구글 드라이브 fileId 추출
                      const extractFileId = (url: string) => {
                        try {
                          if (url.includes('drive.google.com/file/d/')) {
                            return url.split('/file/d/')[1].split('/')[0];
                          } else if (url.includes('drive.google.com/uc?export=view&id=')) {
                            return url.split('id=')[1].split('&')[0];
                          } else if (url.includes('lh3.googleusercontent.com/d/')) {
                            return url.split('/d/')[1].split('?')[0];
                          }
                          return null;
                        } catch (e) {
                          return null;
                        }
                      };
                      
                      const fileId = extractFileId(selectedImage);
                      if (fileId) {
                        // lh3 URL이 실패했으면 uc 형식으로 시도
                        if (selectedImage.includes('lh3.googleusercontent.com')) {
                          const fallbackUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
                          setSelectedImage(fallbackUrl);
                          setModalLoading(true);
                          return;
                        }
                      }
                      
                      // 모든 시도 실패 시
                      alert('이미지를 불러올 수 없습니다. URL: ' + selectedImage);
                    } catch (error) {
                      alert('이미지를 불러올 수 없습니다. URL: ' + selectedImage);
                    }
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
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>
                              {consultation.customerName || '고객명 없음'}
                            </h2>
                            <p style={{ fontSize: '1rem', color: '#4b5563', margin: 0 }}>
                              {(() => {
                                try {
                                  const date = new Date(consultation.consultationDate);
                                  if (isNaN(date.getTime())) {
                                    // 날짜가 유효하지 않은 경우 원본 문자열 표시
                                    return consultation.consultationDate || '날짜 없음';
                                  }
                                  return date.toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  });
                                } catch (error) {
                                  console.warn('날짜 포맷팅 오류:', error);
                                  return consultation.consultationDate || '날짜 없음';
                                }
                              })()}
                            </p>
                            {consultation.phoneNumber && (
                              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                                📞 {consultation.phoneNumber}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button
                              onClick={() => initEditForm(consultation)}
                              style={{ 
                                backgroundColor: '#3b82f6', 
                                color: 'white', 
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem', 
                                fontSize: '0.875rem',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              disabled={loading}
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
                              disabled={loading}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 호소증상 */}
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
                          호소증상
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

                      {/* 환자상태 정보 */}
                      {consultation.stateAnalysis && (
                        <div 
                          style={{
                            border: '2px solid #f3f4f6', 
                            borderRadius: '0.5rem', 
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            marginTop: '0.75rem'
                          }}
                        >
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                            환자상태
                          </h3>
                          <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                            {consultation.stateAnalysis}
                          </p>
                        </div>
                      )}

                      {/* 설진분석 정보 */}
                      {consultation.tongueAnalysis && (
                        <div 
                          style={{
                            border: '2px solid #f3f4f6', 
                            borderRadius: '0.5rem', 
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            marginTop: '0.75rem'
                          }}
                        >
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                            설진분석
                          </h3>
                          <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                            {consultation.tongueAnalysis}
                          </p>
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
           

                      

                      

                      {/* 특이사항 정보 */}
                      {consultation.specialNote && (
                        <div 
                          style={{
                            border: '2px solid #f3f4f6', 
                            borderRadius: '0.5rem', 
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            marginTop: '0.75rem'
                          }}
                        >
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.75rem' }}>
                            특이사항
                          </h3>
                          <p style={{ fontSize: '1rem', color: '#374151', whiteSpace: 'pre-line', lineHeight: '1.625' }}>
                            {consultation.specialNote}
                          </p>
                        </div>
                      )}
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
                    
                    


                    {/* 수정 폼 (해당 상담일지가 수정 중일 때만 표시) */}
                    {showEditForm && editingConsultation && editingConsultation.id === consultation.id && (
                      <div style={{ 
                        backgroundColor: '#eff6ff', 
                        padding: '1.25rem', 
                        borderTop: '2px solid #e5e7eb',
                        borderRadius: '0 0 0.75rem 0.75rem'
                      }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>
                          상담일지 수정
                        </h3>
                        <form onSubmit={submitEditForm} style={{ 
                          backgroundColor: '#f0f9ff', 
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
                              type="datetime-local"
                              value={editFormData.consultDate}
                              onChange={(e) => setEditFormData({...editFormData, consultDate: e.target.value})}
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
                              호소증상 *
                            </label>
                            <textarea
                              ref={editContentTextareaRef}
                              value={editFormData.content}
                              onChange={(e) => setEditFormData({...editFormData, content: e.target.value})}
                              style={{ 
                                width: '100%', 
                                padding: '1rem', 
                                fontSize: '1.125rem', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '0.5rem',
                                transition: 'all 0.2s',
                                minHeight: '6rem'
                              }}
                              rows={5}
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
                              환자상태
                            </label>
                            <textarea
                              value={editFormData.stateAnalysis}
                              onChange={(e) => setEditFormData({...editFormData, stateAnalysis: e.target.value})}
                              style={{ 
                                width: '100%', 
                                padding: '1rem', 
                                fontSize: '1.125rem', 
                                border: '1px solid #d1d5db', 
                                borderRadius: '0.5rem',
                                transition: 'all 0.2s'
                              }}
                              rows={5}
                            />
                          </div>
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ 
                              display: 'block', 
                              marginBottom: '0.5rem', 
                              fontWeight: '600',
                              color: '#1e40af' 
                            }}>
                              설진분석
                            </label>
                            <textarea
                              value={editFormData.tongueAnalysis}
                              onChange={(e) => setEditFormData({...editFormData, tongueAnalysis: e.target.value})}
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
                              처방약
                            </label>
                            <textarea
                              value={editFormData.medicine}
                              onChange={(e) => setEditFormData({...editFormData, medicine: e.target.value})}
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
                              특이사항
                            </label>
                            <textarea
                              value={editFormData.specialNote}
                              onChange={(e) => setEditFormData({...editFormData, specialNote: e.target.value})}
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
                              value={editFormData.result}
                              onChange={(e) => setEditFormData({...editFormData, result: e.target.value})}
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
                              <span style={{ marginRight: '0.25rem' }}>📷</span> 새 이미지 추가
                            </label>
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '0.75rem', 
                              marginBottom: '0.75rem' 
                            }}>
                              <button
                                type="button"
                                onClick={openEditCamera}
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
                                onClick={() => editFileInputRef.current?.click()}
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
                                ref={editFileInputRef}
                                onChange={handleEditFileUpload}
                                style={{ display: 'none' }}
                                accept="image/*"
                                multiple
                              />
                              <input
                                type="file"
                                ref={editCameraInputRef}
                                onChange={handleEditCameraCapture}
                                style={{ display: 'none' }}
                                accept="image/*"
                                capture="environment"
                              />
                            </div>
                            {/* 새 이미지 미리보기 */}
                            {editFormData.images.length > 0 && (
                              <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ 
                                  fontSize: '1rem', 
                                  fontWeight: 'bold', 
                                  color: '#1f2937', 
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  📸 새로 추가할 이미지 ({editFormData.images.length}개)
                                  <span style={{
                                    fontSize: '0.75rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem'
                                  }}>
                                    추가됨
                                  </span>
                                </h4>
                                <div style={{ 
                                  display: 'grid', 
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
                                  gap: '0.75rem',
                                  padding: '0.75rem',
                                  backgroundColor: '#eff6ff',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  {editFormData.images.map((image, index) => (
                                    <div 
                                      key={index} 
                                      style={{ 
                                        position: 'relative', 
                                        borderRadius: '0.5rem', 
                                        overflow: 'hidden', 
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)', 
                                        transition: 'transform 0.2s', 
                                        transform: 'scale(1)',
                                        border: '2px solid #3b82f6'
                                      }}
                                      className="hover:scale-105"
                                    >
                                      <img 
                                        src={image.data} 
                                        alt={`새 이미지 ${index + 1}`} 
                                        style={{ 
                                          width: '100%', 
                                          height: '8rem', 
                                          objectFit: 'cover' 
                                        }}
                                      />
                                      <div style={{
                                        position: 'absolute',
                                        top: '2px',
                                        left: '2px',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        fontSize: '0.625rem',
                                        padding: '0.125rem 0.25rem',
                                        borderRadius: '0.125rem'
                                      }}>
                                        새로운
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeEditImage(index)}
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
                                <p style={{ 
                                  marginTop: '0.5rem', 
                                  fontSize: '0.875rem', 
                                  color: '#1d4ed8',
                                  fontWeight: '500'
                                }}>
                                  ➕ 이 이미지들이 기존 이미지에 추가됩니다.
                                </p>
                              </div>
                            )}
                            
                            {/* 기존 이미지 표시 */}
                            {editingConsultation && editingConsultation.symptomImages && editingConsultation.symptomImages.length > 0 && (
                              <div style={{ marginBottom: '1rem' }}>
                                <h4 style={{ 
                                  fontSize: '1rem', 
                                  fontWeight: 'bold', 
                                  color: '#1f2937', 
                                  marginBottom: '0.5rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  📷 기존 이미지 ({editingConsultation.symptomImages.filter(Boolean).length}개)
                                  <span style={{
                                    fontSize: '0.75rem',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem'
                                  }}>
                                    유지됨
                                  </span>
                                </h4>
                                <div style={{ 
                                  display: 'flex', 
                                  gap: '0.5rem', 
                                  flexWrap: 'wrap',
                                  padding: '0.75rem',
                                  backgroundColor: '#f0fdf4',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #bbf7d0'
                                }}>
                                  {editingConsultation.symptomImages.filter(Boolean).map((imageUrl: string, index: number) => (
                                    <div 
                                      key={`existing-${index}`} 
                                      style={{ 
                                        flex: '0 0 auto',
                                        width: '100px',
                                        height: '100px',
                                        borderRadius: '0.25rem',
                                        border: '2px solid #10b981',
                                        overflow: 'hidden',
                                        position: 'relative'
                                      }}
                                    >
                                      <img 
                                        src={imageUrl}
                                        alt={`기존 이미지 ${index + 1}`}
                                        style={{ 
                                          width: '100%', 
                                          height: '100%', 
                                          objectFit: 'cover' 
                                        }}
                                      />
                                      <div style={{
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px',
                                        backgroundColor: '#10b981',
                                        color: 'white',
                                        fontSize: '0.625rem',
                                        padding: '0.125rem 0.25rem',
                                        borderRadius: '0.125rem'
                                      }}>
                                        기존
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <p style={{ 
                                  marginTop: '0.5rem', 
                                  fontSize: '0.875rem', 
                                  color: '#059669',
                                  fontWeight: '500'
                                }}>
                                  ✅ 기존 이미지는 자동으로 유지됩니다. 새 이미지를 추가하면 기존 이미지와 함께 저장됩니다.
                                </p>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditForm(false);
                                setEditingConsultation(null);
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
                              {loading ? '저장 중...' : '변경사항 저장'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* 고객 선택 모달 */}
      {showCustomerSelectModal && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{ 
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#5f3dc4' }}>
                고객 선택
              </h2>
              <button
                onClick={() => setShowCustomerSelectModal(false)}
                style={{ 
                  backgroundColor: 'transparent', 
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ marginBottom: '1rem', color: '#4b5563' }}>
              검색된 고객 중에서 선택해주세요.
            </p>
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem', 
              marginBottom: '1.5rem',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0.5rem'
            }}>
              {multipleCustomers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => selectCustomer(customer)}
                  style={{
                    padding: '1rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f0ff';
                    e.currentTarget.style.borderColor = '#5f3dc4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: 'bold', 
                      color: '#1f2937', 
                      margin: 0
                    }}>
                      {customer.name}
                    </h3>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: '#6b7280',
                      backgroundColor: '#e5e7eb',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem'
                    }}>
                      {customer.customer_code}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {customer.phone && (
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280',
                        margin: 0
                      }}>
                        📞 {customer.phone}
                      </p>
                    )}
                    
                    {customer.birth_date && (
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280',
                        margin: 0
                      }}>
                        🎂 {customer.birth_date} {customer.estimated_age && `(${customer.estimated_age}세)`}
                      </p>
                    )}
                    
                    {customer.address && (
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280',
                        margin: 0
                      }}>
                        📍 {customer.address}
                      </p>
                    )}
                    
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#059669',
                      margin: 0,
                      fontWeight: '500'
                    }}>
                      💬 상담 {customer.consultation_count || 0}회
                    </p>
                    
                    {customer.special_notes && (
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#dc2626',
                        margin: 0,
                        fontStyle: 'italic'
                      }}>
                        ⚠️ {customer.special_notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              onClick={() => setShowCustomerSelectModal(false)}
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
          </div>
        </div>
      )}

      {/* 밴드 선택 모달 */}
      {showBandModal && (
        <div style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{ 
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#5f3dc4' }}>
                밴드에 올리기
              </h2>
              <button
                onClick={() => setShowBandModal(false)}
                style={{ 
                  backgroundColor: 'transparent', 
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2.5rem',
                  height: '2.5rem',
                  borderRadius: '50%',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            
            {bandMessage && (
              <div style={{ 
                padding: '0.75rem', 
                marginBottom: '1rem', 
                borderRadius: '0.375rem',
                backgroundColor: bandMessage.includes('성공') ? '#d1fae5' : '#fee2e2',
                color: bandMessage.includes('성공') ? '#047857' : '#b91c1c'
              }}>
                {bandMessage}
              </div>
            )}
            
            <p style={{ marginBottom: '1rem', color: '#4b5563' }}>
              상담 내역을 공유할 밴드를 선택하세요.
            </p>
            
            {bandLoading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: '#6b7280' 
              }}>
                로딩 중...
              </div>
            ) : bands.length > 0 ? (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '0.75rem', 
                marginBottom: '1.5rem',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '0.5rem'
              }}>
                {bands.map((band) => (
                  <div
                    key={band.band_key}
                    onClick={() => setSelectedBandKey(band.band_key)}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      border: `1px solid ${selectedBandKey === band.band_key ? '#5f3dc4' : '#e5e7eb'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: selectedBandKey === band.band_key ? '#f3f0ff' : '#f9fafb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}
                  >
                    {band.cover && (
                      <img 
                        src={band.cover} 
                        alt={band.name}
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '50%', 
                          objectFit: 'cover' 
                        }}
                      />
                    )}
                    <div>
                      <h3 style={{ 
                        fontSize: '1rem', 
                        fontWeight: 'bold', 
                        color: '#1f2937', 
                        marginBottom: '0.25rem' 
                      }}>
                        {band.name}
                      </h3>
                      <p style={{ 
                        fontSize: '0.875rem', 
                        color: '#6b7280' 
                      }}>
                        멤버 {band.member_count}명
                      </p>
                    </div>
                    {selectedBandKey === band.band_key && (
                      <div style={{ 
                        marginLeft: 'auto', 
                        color: '#5f3dc4', 
                        fontWeight: 'bold' 
                      }}>
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                backgroundColor: '#f3f4f6', 
                borderRadius: '0.5rem', 
                color: '#6b7280' 
              }}>
                밴드 목록이 없습니다.
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={postToBand}
                disabled={bandLoading || !selectedBandKey}
                style={{ 
                  width: '100%', 
                  backgroundColor: !selectedBandKey ? '#e5e7eb' : '#5f3dc4', 
                  color: !selectedBandKey ? '#9ca3af' : 'white', 
                  padding: '1rem',
                  fontSize: '1.125rem', 
                  borderRadius: '0.5rem', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: !selectedBandKey ? 'default' : 'pointer'
                }}
              >
                {bandLoading ? '처리 중...' : '선택한 밴드에 포스팅하기'}
              </button>
              
              <button
                onClick={() => setShowBandModal(false)}
                disabled={bandLoading}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 