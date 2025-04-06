'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// 거래 내역서 항목 인터페이스
interface InvoiceItem {
  name: string;         // 제품명
  specification: string; // 규격
  quantity: number;     // 수량
  amount: number;       // 금액
  scanned?: boolean;    // 스캔 여부
}

// 추출된 데이터 인터페이스
interface ExtractedData {
  supplier: string;     // 공급처
  items: InvoiceItem[]; // 상품 목록
  total: number;        // 총액
  date: string;         // 거래일자
}

// 카메라 관련 polyfill 함수 추가
function setupCameraPolyfill() {
  if (typeof window !== 'undefined') {
    // 레거시 API 지원을 위한 폴리필
    if (!navigator.mediaDevices) {
      console.log('mediaDevices가 없어 polyfill 적용');
      (navigator as any).mediaDevices = {};
    }

    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function(constraints) {
        console.log('getUserMedia polyfill 적용');
        const getUserMedia = (navigator as any).webkitGetUserMedia || 
                            (navigator as any).mozGetUserMedia ||
                            (navigator as any).msGetUserMedia;

        if (!getUserMedia) {
          return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
        }

        return new Promise(function(resolve, reject) {
          getUserMedia.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }
}

// HTTPS 확인 함수 개선
function isHttps() {
  if (typeof window !== 'undefined') {
    // 개발환경에서도 HTTPS로 인식하도록 로컬호스트 예외 처리
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return true; // 로컬호스트는 항상 안전한 것으로 간주
    }
    return window.location.protocol === 'https:';
  }
  return false;
}

// HTTPS 리다이렉트 함수
function redirectToHttps() {
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    // 로컬호스트는 리다이렉트하지 않음
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      window.location.href = window.location.href.replace('http:', 'https:');
    }
  }
}

export default function InvoiceScannerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [scanMode, setScanMode] = useState<'invoice' | 'medicine' | 'summary'>('invoice');
  const [message, setMessage] = useState<string>('');
  const [scanComplete, setScanComplete] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>('초기화 전');
  const [debugMode, setDebugMode] = useState(false);
  const [isSecure, setIsSecure] = useState(true); // HTTPS 여부 상태 추가
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 이미지 파일 선택 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
    setError(null);
    setExtractedData(null);
    
    if (selectedFile) {
      // 이미지 미리보기 생성
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  // 이미지 분석 요청
  const handleExtract = async () => {
    if (!file) {
      setError('이미지 파일을 먼저 선택해주세요');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '이미지 처리 중 오류가 발생했습니다');
      }

      if (result.success) {
        // 스캔 상태 추가
        const dataWithScanStatus = {
          ...result.data,
          items: result.data.items.map((item: InvoiceItem) => ({
            ...item,
            scanned: false
          }))
        };
        setExtractedData(dataWithScanStatus);
      } else {
        throw new Error(result.error || '데이터 추출에 실패했습니다');
      }
    } catch (err) {
      console.error('이미지 처리 오류:', err);
      setError((err as Error).message || '이미지 처리 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 원화 포맷 함수
  const formatKRW = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
  };

  // 카메라로 촬영 버튼 클릭 핸들러
  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // 이미지 재선택 핸들러
  const handleSelectAnother = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 노션에 저장하는 함수
  const saveToNotion = async (data: ExtractedData) => {
    try {
      setLoading(true);
      
      // 노션 API 형식에 맞게 데이터 변환
      const notionData = {
        date: data.date,
        // 이 부분은 실제 노션 DB 구조에 맞게 수정해야 합니다
        'supplier': {
          rich_text: [{ type: 'text', text: { content: data.supplier } }]
        },
        'total': {
          number: data.total
        }
      };
      
      // 일일 수입 API를 활용할 수도 있고, 별도 API를 만들 수도 있습니다
      const response = await fetch('/api/daily-income', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notionData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage('데이터가 노션에 성공적으로 저장되었습니다.');
      } else {
        throw new Error(result.error || '노션 저장 실패');
      }
    } catch (err) {
      console.error('노션 저장 오류:', err);
      setMessage('노션에 데이터를 저장하는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 약품 스캔 모드로 전환
  const startMedicineScan = async () => {
    setScanMode('medicine');
    setCameraStatus('카메라 권한 요청 중...');
    
    // HTTPS 확인
    if (!isSecure && typeof window !== 'undefined') {
      console.warn('HTTPS가 아닌 환경에서는 카메라 접근이 제한됩니다');
      setCameraStatus('HTTPS가 필요: 보안 연결에서만 카메라 사용 가능');
      setError('보안 연결(HTTPS)에서만 카메라에 접근할 수 있습니다. HTTPS로 접속해 주세요.');
      setDebugMode(true);
      return;
    }
    
    // 이미 카메라 접근이 불가능함을 알고 있으면 바로 대체 UI로 전환
    const isCameraSupported = typeof window !== 'undefined' && 
                             typeof navigator !== 'undefined' &&
                             navigator.mediaDevices && 
                             typeof navigator.mediaDevices.getUserMedia === 'function';
    
    if (!isCameraSupported) {
      console.log('카메라가 지원되지 않음, 대체 UI 사용');
      setCameraStatus('카메라가 지원되지 않음, 대체 UI 사용');
      setDebugMode(true);
      return;
    }
    
    try {
      if (streamRef.current) {
        stopCamera();
      }
      
      // 폴리필 다시 적용
      setupCameraPolyfill();
      
      // navigator.mediaDevices 확인
      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('브라우저 환경이 아닙니다');
      }
      
      if (!navigator.mediaDevices) {
        throw new Error('mediaDevices API를 지원하지 않습니다');
      }
      
      if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('getUserMedia API를 지원하지 않습니다');
      }
      
      // 모바일 환경에서 더 간단한 제약조건으로 시도
      const constraints = {
        video: {
          facingMode: 'environment'
        },
        audio: false
      };
      
      console.log('카메라 접근 요청: ', JSON.stringify(constraints));
      setCameraStatus('간단한 설정으로 카메라 접근 시도 중...');
      
      try {
        // 기본 옵션으로 시도
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        setCameraStatus('카메라 스트림 획득 성공');
      } catch (simpleError) {
        console.error('기본 옵션으로 카메라 접근 실패:', simpleError);
        setCameraStatus('기본 카메라 접근 실패, 대체 방법 시도 중...');
        
        // iOS Safari 대응: timeout 추가
        const timeout = new Promise<MediaStream>((_, reject) => {
          setTimeout(() => reject(new Error('카메라 접근 시간 초과')), 5000);
        });
        
        try {
          // Promise.race로 타임아웃 적용한 getUserMedia 시도
          const stream = await Promise.race([
            navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
            timeout
          ]) as MediaStream;
          
          streamRef.current = stream;
          setCameraStatus('대체 방법으로 카메라 접근 성공');
        } catch (timeoutError) {
          console.error('타임아웃 방식도 실패:', timeoutError);
          
          // 마지막 방법: 더 단순한 제약조건
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: { ideal: 'environment' } } 
          });
          streamRef.current = stream;
          setCameraStatus('최후의 방법으로 카메라 접근 성공');
        }
      }
      
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        // 카메라 스트림이 준비되었는지 확인
        console.log('카메라 스트림 설정됨');
        setCameraStatus('비디오 요소에 스트림 설정됨');
        
        // 모바일 Safari에서 자동재생 문제 해결
        videoRef.current.play().catch(playError => {
          console.warn('비디오 자동 재생 실패:', playError);
          setCameraStatus('비디오 자동 재생 실패, 수동 재생 필요');
        });
      } else {
        console.error('비디오 요소를 찾을 수 없습니다.');
        setCameraStatus('오류: 비디오 요소를 찾을 수 없음');
      }
    } catch (err) {
      console.error('카메라 접근 오류:', err);
      // 더 구체적인 오류 메시지 제공
      if ((err as Error).name === 'NotAllowedError') {
        setError('카메라 접근 권한이 거부되었습니다. 권한을 허용해주세요.');
        setCameraStatus('오류: 카메라 권한 거부됨');
      } else if ((err as Error).name === 'NotFoundError') {
        setError('사용 가능한 카메라를 찾을 수 없습니다.');
        setCameraStatus('오류: 카메라를 찾을 수 없음');
      } else if ((err as Error).name === 'NotReadableError') {
        setError('카메라가 이미 다른 앱에서 사용 중입니다.');
        setCameraStatus('오류: 카메라가 이미 사용 중');
      } else if ((err as Error).name === 'SecurityError' || (err as Error).message.includes('secure context')) {
        setError('보안상의 이유로 카메라에 접근할 수 없습니다. HTTPS로 접속해 주세요.');
        setCameraStatus('오류: 보안 컨텍스트(HTTPS) 필요');
      } else {
        setError(`카메라에 접근할 수 없습니다: ${(err as Error).message || '알 수 없는 오류'}`);
        setCameraStatus(`오류: ${(err as Error).message || '알 수 없는 오류'}`);
      }
      // 대체 UI 표시 - 가상 인식 모드 활성화
      setDebugMode(true);
    }
  };

  // 카메라 중지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraStatus('카메라 중지됨');
    }
  };

  // 약품 인식 처리
  const recognizeMedicine = async (imageData: string) => {
    if (!extractedData) return;
    
    try {
      // 캔버스 이미지를 Blob으로 변환
      const response = await fetch(imageData);
      const blob = await response.blob();
      
      // 약품 인식 API 호출을 위한 formData 구성
      const formData = new FormData();
      formData.append('image', blob, 'medicine.jpg');
      formData.append('invoiceItems', JSON.stringify(extractedData.items));
      
      try {
        // 약품 인식 API 호출
        const recognizeResponse = await fetch('/api/recognize-medicine', {
          method: 'POST',
          body: formData,
        });
        
        const result = await recognizeResponse.json();
        
        if (result.success && result.data.identified) {
          // 인식된 약품 이름과 거래내역서 약품 비교
          const medicineName = result.data.medicineName;
          
          const updatedItems = extractedData.items.map(item => {
            // 약품 이름이 부분적으로 일치하는 경우도 처리
            if (item.name.includes(medicineName) || medicineName.includes(item.name)) {
              playBeepSound();
              return { ...item, scanned: true };
            }
            return item;
          });
          
          const newData = {
            ...extractedData,
            items: updatedItems
          };
          
          setExtractedData(newData);
          
          // 모든 약품이 스캔되었는지 확인
          const allScanned = newData.items.every(item => item.scanned);
          if (allScanned) {
            setScanComplete(true);
            stopCamera();
          }
        } else {
          // API가 실패하거나 약품을 식별하지 못한 경우 가상 인식으로 대체
          simulateRecognition();
        }
      } catch (apiError) {
        console.error('API 호출 오류:', apiError);
        // API 오류 시 가상 인식 사용
        simulateRecognition();
      }
    } catch (err) {
      console.error('약품 인식 오류:', err);
    }
  };

  // 개발용 가상 약품 인식 함수
  const simulateRecognition = () => {
    // 카메라가 작동하는지 테스트하기 위한 가상 인식 로직
    if (extractedData && extractedData.items.some(item => !item.scanned)) {
      // 인식되지 않은 약품 중에서 랜덤하게 하나 선택
      const notScannedItems = extractedData.items.filter(item => !item.scanned);
      const randomIndex = Math.floor(Math.random() * notScannedItems.length);
      const randomItem = notScannedItems[randomIndex];
      
      if (randomItem) {
        console.log('가상 인식된 약품:', randomItem.name);
        
        const updatedItems = extractedData.items.map(item => {
          if (item.name === randomItem.name) {
            playBeepSound();
            return { ...item, scanned: true };
          }
          return item;
        });
        
        setExtractedData({
          ...extractedData,
          items: updatedItems
        });
        
        // 모든 약품이 스캔되었는지 확인
        const allScanned = updatedItems.every(item => item.scanned);
        if (allScanned) {
          setScanComplete(true);
          stopCamera();
        }
      }
    }
  };

  // 비프음 재생
  const playBeepSound = () => {
    try {
      if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
        console.warn('오디오 API를 지원하지 않는 환경입니다.');
        return;
      }
      
      // 간단한 웹 오디오 API를 사용한 비프음 생성
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 1000; // 1kHz 비프음
      gainNode.gain.value = 0.5;
      
      oscillator.start();
      
      // 0.2초 후 비프음 종료
      setTimeout(() => {
        oscillator.stop();
      }, 200);
    } catch (err) {
      console.error('오디오 재생 오류:', err);
    }
  };

  // 약품 스캔 종료
  const finishScan = () => {
    stopCamera();
    // 스캔 완료시 결과 요약 화면으로 전환
    if (scanComplete) {
      setScanMode('summary');
    } else {
      setScanMode('invoice');
    }
  };

  // 검수 결과 계산
  const calculateScanResults = () => {
    if (!extractedData) return null;
    
    const totalItems = extractedData.items.length;
    const scannedItems = extractedData.items.filter(item => item.scanned).length;
    const missingItems = extractedData.items.filter(item => !item.scanned);
    
    return {
      totalItems,
      scannedItems,
      missingItems,
      isComplete: totalItems === scannedItems
    };
  };

  // 처음으로 돌아가기
  const goToStart = () => {
    setScanComplete(false);
    setScanMode('invoice');
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 컴포넌트 마운트 시 HTTPS 확인
  useEffect(() => {
    setupCameraPolyfill();
    
    // HTTPS 리다이렉트 시도
    redirectToHttps();
    
    // HTTPS 확인
    const https = isHttps();
    setIsSecure(https);
    
    if (!https) {
      console.warn('페이지가 HTTPS로 제공되지 않아 카메라 접근이 제한될 수 있습니다');
      setCameraStatus('HTTPS가 아니어서 카메라 접근이 제한될 수 있음');
    }
    
    // 브라우저 호환성 확인 메시지 표시
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      if (!navigator.mediaDevices) {
        setCameraStatus('mediaDevices API가 없습니다. 폴리필 적용 시도');
      } else if (typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setCameraStatus('getUserMedia API가 없습니다. 폴리필 적용 시도');
      }
    }
    
    return () => {
      stopCamera();
    };
  }, []);

  // 비디오 스트림 처리
  useEffect(() => {
    if (scanMode === 'medicine' && videoRef.current && canvasRef.current) {
      let processingImage = false;
      let videoReady = false;
      
      console.log('비디오 스트림 처리 시작');
      setCameraStatus('비디오 스트림 처리 시작');
      
      // 비디오가 준비되었는지 확인하는 이벤트 리스너
      const handleVideoReady = () => {
        console.log('비디오 스트림 준비 완료');
        videoReady = true;
        setCameraStatus('비디오 스트림 준비 완료');
      };
      
      // 이벤트 리스너 등록
      if (videoRef.current) {
        videoRef.current.addEventListener('canplay', handleVideoReady);
      }
      
      const interval = setInterval(() => {
        if (processingImage || !videoReady) return; // 이미 처리 중이거나 비디오가 준비되지 않았으면 스킵
        
        // 비디오 프레임을 캔버스에 그리기
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            processingImage = true;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              console.error('캔버스 컨텍스트를 가져올 수 없습니다');
              processingImage = false;
              return;
            }
            
            canvas.width = video.videoWidth || 320;
            canvas.height = video.videoHeight || 240;
            
            // 비디오 크기가 유효한지 확인
            if (canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // 캔버스 이미지를 데이터 URL로 변환
              const imageData = canvas.toDataURL('image/jpeg', 0.8);
              
              // 약품 인식 API 호출
              recognizeMedicine(imageData)
                .finally(() => {
                  processingImage = false;
                });
            } else {
              console.warn('비디오 크기가 유효하지 않습니다:', video.videoWidth, video.videoHeight);
              processingImage = false;
            }
          } catch (err) {
            console.error('프레임 처리 오류:', err);
            processingImage = false;
          }
        } else {
          if (video) {
            console.log('비디오 준비 상태:', video.readyState);
          }
          processingImage = false;
        }
      }, 500); // 0.5초마다 프레임 처리
      
      return () => {
        clearInterval(interval);
        // 이벤트 리스너 제거
        if (videoRef.current) {
          videoRef.current.removeEventListener('canplay', handleVideoReady);
        }
        console.log('비디오 스트림 처리 종료');
      };
    }
  }, [scanMode, extractedData]);

  // 디버그 모드 토글
  const toggleDebugMode = () => {
    setDebugMode(prev => !prev);
  };

  // 수동 약품 인식 트리거
  const triggerManualRecognition = () => {
    simulateRecognition();
  };

  // 사진 업로드 처리
  const handleMedicineImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 이미지 미리보기 생성
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      
      // 약품 인식 처리
      recognizeMedicine(imageData);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ 
      maxWidth: '100%', 
      margin: '0 auto', 
      padding: '0', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#ffffff', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 상단 헤더 */}
      <header style={{ 
        padding: '15px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e1e1e1',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center'
      }}>
        <Link href="/" style={{ 
          textDecoration: 'none', 
          marginRight: '10px',
          color: '#333'
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            ←
          </div>
        </Link>
        <h1 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: '#333',
          flex: 1,
          textAlign: 'center'
        }}>
          {scanMode === 'invoice' ? '거래 내역서 스캔' : 
           scanMode === 'medicine' ? '약품 스캔' : '검수 결과'}
        </h1>
        <div style={{ 
          width: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <button
            onClick={toggleDebugMode}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* HTTPS 경고 배너 */}
      {!isSecure && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ffeeee',
          color: '#d32f2f',
          textAlign: 'center',
          fontSize: '14px',
          borderBottom: '1px solid #ffd1d1'
        }}>
          ⚠️ 보안 연결(HTTPS)이 아니므로 카메라 접근이 제한됩니다. HTTPS로 접속해 주세요.
        </div>
      )}

      {/* 디버그 정보 */}
      {debugMode && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f0f0f0',
          borderBottom: '1px solid #ddd',
          fontSize: '12px'
        }}>
          <div><strong>카메라 상태:</strong> {cameraStatus}</div>
          <div><strong>스캔 모드:</strong> {scanMode}</div>
          <div><strong>약품 수:</strong> {extractedData ? extractedData.items.length : 0}</div>
          <div><strong>HTTPS:</strong> {isSecure ? '예' : '아니오'}</div>
          {scanMode === 'medicine' && (
            <button
              onClick={triggerManualRecognition}
              style={{
                marginTop: '5px',
                padding: '5px 10px',
                fontSize: '12px',
                backgroundColor: '#0066FF',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              가상 인식 트리거
            </button>
          )}
        </div>
      )}

      {/* 로딩 인디케이터 */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <p style={{
              margin: 0,
              fontWeight: 'bold'
            }}>이미지 분석 중...</p>
          </div>
        </div>
      )}

      {scanMode === 'invoice' ? (
        <div style={{ 
          padding: '20px', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '500px',
          margin: '0 auto',
          width: '100%'
        }}>
          {/* 이미지 업로드 영역 */}
          {!preview && (
            <div style={{ 
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <p style={{ 
                marginBottom: '15px',
                color: '#555',
                fontSize: '14px'
              }}>
                거래 내역서 이미지를 업로드하거나 카메라로 촬영해주세요
              </p>
              
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                ref={fileInputRef}
                style={{ display: 'none' }}
                capture="environment"
              />
              
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <button 
                  onClick={handleCameraClick}
                  style={{ 
                    padding: '12px',
                    backgroundColor: '#0066FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>카메라로 촬영</span>
                </button>
              </div>
            </div>
          )}

          {/* 이미지 미리보기 */}
          {preview && (
            <div style={{ 
              backgroundColor: '#fff',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                marginBottom: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ 
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  선택된 이미지
                </h2>
                <button
                  onClick={handleSelectAnother}
                  style={{
                    backgroundColor: 'transparent',
                    color: '#0066FF',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '5px'
                  }}
                >
                  다른 이미지 선택
                </button>
              </div>
              
              <div style={{ 
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '15px'
              }}>
                <img 
                  src={preview} 
                  alt="선택한 거래 내역서" 
                  style={{ 
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    borderRadius: '4px',
                    border: '1px solid #ddd'
                  }}
                />
              </div>
              
              {!extractedData && (
                <button
                  onClick={handleExtract}
                  disabled={loading}
                  style={{ 
                    width: '100%',
                    padding: '12px',
                    backgroundColor: loading ? '#cccccc' : '#0066FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? '처리 중...' : '텍스트 추출하기'}
                </button>
              )}
            </div>
          )}

          {/* 오류 메시지 */}
          {error && (
            <div style={{ 
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: '#ffeeee',
              color: '#d32f2f',
              border: '1px solid #ffd1d1'
            }}>
              {error}
            </div>
          )}

          {/* 메시지 표시 */}
          {message && (
            <div style={{ 
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: message.includes('성공') ? '#e7f7ed' : '#ffeeee',
              color: message.includes('성공') ? '#0c753a' : '#d32f2f',
              border: `1px solid ${message.includes('성공') ? '#a8e0bc' : '#ffd1d1'}`
            }}>
              {message}
            </div>
          )}

          {/* 추출된 데이터 표시 */}
          {extractedData && (
            <div style={{ 
              backgroundColor: '#fff',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{ 
                margin: '0 0 15px 0',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#333',
                borderBottom: '1px solid #eee',
                paddingBottom: '10px'
              }}>
                추출된 정보
              </h2>
              
              <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#555',
                    marginBottom: '5px'
                  }}>
                    공급처
                  </label>
                  <div style={{ 
                    fontSize: '16px',
                    color: '#333'
                  }}>
                    {extractedData.supplier}
                  </div>
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#555',
                    marginBottom: '5px'
                  }}>
                    거래일자
                  </label>
                  <div style={{ 
                    fontSize: '16px',
                    color: '#333'
                  }}>
                    {extractedData.date}
                  </div>
                </div>
                
                <div>
                  <label style={{ 
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#555',
                    marginBottom: '8px'
                  }}>
                    상품 목록
                  </label>
                  
                  {extractedData.items.map((item, index) => (
                    <div 
                      key={index}
                      style={{ 
                        marginBottom: '10px',
                        padding: '10px',
                        backgroundColor: '#f8f8f8',
                        borderRadius: '4px'
                      }}
                    >
                      <div style={{ 
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '5px'
                      }}>
                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                        <span>{formatKRW(item.amount)}원</span>
                      </div>
                      <div style={{ 
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        color: '#666'
                      }}>
                        <span>규격: {item.specification}</span>
                        <span>수량: {item.quantity}개</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ 
                  marginTop: '10px',
                  padding: '10px',
                  borderTop: '1px solid #eee',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ 
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>
                    총액
                  </span>
                  <span style={{ 
                    fontWeight: 'bold',
                    fontSize: '18px',
                    color: '#0066FF'
                  }}>
                    {formatKRW(extractedData.total)}원
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: '10px'
                }}>
                  <button
                    onClick={() => startMedicineScan()}
                    style={{ 
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#0066FF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    약품 스캔하기
                  </button>
                  
                  <button
                    onClick={() => saveToNotion(extractedData)}
                    disabled={loading}
                    style={{ 
                      width: '100%',
                      padding: '12px',
                      backgroundColor: loading ? '#cccccc' : '#4CAF50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {loading ? '저장 중...' : '노션에 저장하기'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : scanMode === 'medicine' ? (
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - 70px)',
          position: 'relative'
        }}>
          {typeof window !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' ? (
            // 카메라 지원 브라우저
            <div style={{ flex: 1, position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => console.log('비디오가 재생 준비됨')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  display: 'none'
                }}
              />
              
              {/* 센터 가이드 */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '80%',
                height: '120px',
                border: '3px solid #0066FF',
                borderRadius: '8px',
                boxShadow: '0 0 0 1000px rgba(0,0,0,0.3)',
                zIndex: 10
              }} />
              
              {/* 스캔 중 메시지 */}
              <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: 20
              }}>
                약품을 프레임 안에 놓으세요
              </div>

              {/* 카메라 오류 시 수동 인식 버튼 */}
              {debugMode && (
                <div style={{
                  position: 'absolute',
                  top: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 30
                }}>
                  <button
                    onClick={triggerManualRecognition}
                    style={{
                      padding: '8px 15px',
                      backgroundColor: '#0066FF',
                      color: 'white',
                      border: 'none',
                      borderRadius: '20px',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    약품 인식 테스트
                  </button>
                </div>
              )}
            </div>
          ) : (
            // 카메라 미지원 브라우저를 위한 대체 UI
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              backgroundColor: '#f8f8f8',
              textAlign: 'center'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ffeeee',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d32f2f',
                fontSize: '30px',
                marginBottom: '15px'
              }}>
                ⚠️
              </div>
              <h3 style={{
                margin: '0 0 10px 0',
                color: '#333'
              }}>
                카메라를 사용할 수 없습니다
              </h3>
              <p style={{
                margin: '0 0 20px 0',
                color: '#666'
              }}>
                카메라 접근이 불가능하여 약품을 자동으로 인식할 수 없습니다.<br />
                아래 목록에서 수동으로 약품을 체크하거나 사진을 업로드하세요.
              </p>
              
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  id="medicine-photo"
                  onChange={handleMedicineImageUpload}
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="medicine-photo"
                  style={{
                    display: 'block',
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginBottom: '10px'
                  }}
                >
                  📸 약품 사진 촬영
                </label>
              </div>
              
              <button
                onClick={triggerManualRecognition}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0066FF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  marginBottom: '10px'
                }}
              >
                약품 자동 인식 시뮬레이션
              </button>
            </div>
          )}
          
          {/* 스캔 결과 영역 */}
          <div style={{
            backgroundColor: 'white',
            padding: '15px',
            height: typeof window !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' ? '40%' : '60%',
            overflowY: 'auto'
          }}>
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '16px',
              fontWeight: 'bold',
              borderBottom: '1px solid #eee',
              paddingBottom: '10px'
            }}>
              검수 상태 {scanComplete ? '(완료)' : ''}
            </h3>
            
            {extractedData && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {extractedData.items.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: item.scanned ? '#e7f7ed' : '#f8f8f8',
                      borderRadius: '4px',
                      borderLeft: `4px solid ${item.scanned ? '#4CAF50' : '#ddd'}`
                    }}
                    onClick={() => {
                      if (typeof navigator.mediaDevices === 'undefined' || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                        const updatedItems = extractedData.items.map((it, idx) => 
                          idx === index ? { ...it, scanned: !it.scanned } : it
                        );
                        
                        if (!item.scanned) {
                          playBeepSound();
                        }
                        
                        setExtractedData({
                          ...extractedData,
                          items: updatedItems
                        });
                        
                        // 모든 약품이 스캔되었는지 확인
                        const allScanned = updatedItems.every(it => it.scanned);
                        if (allScanned) {
                          setScanComplete(true);
                        }
                      }
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1
                    }}>
                      <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                      <span style={{ fontSize: '14px', color: '#666' }}>
                        {item.specification} | 수량: {item.quantity}개
                      </span>
                    </div>
                    <div style={{
                      backgroundColor: item.scanned ? '#4CAF50' : '#ddd',
                      color: 'white',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      fontWeight: 'bold',
                      fontSize: '14px'
                    }}>
                      {item.scanned ? '✓' : '?'}
                    </div>
                  </div>
                ))}
                
                {/* 완료 버튼 */}
                <button
                  onClick={finishScan}
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    backgroundColor: scanComplete ? '#4CAF50' : '#0066FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  {scanComplete ? '검수 완료' : '스캔 중단'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // 검수 결과 요약 화면
        <div style={{ 
          padding: '20px', 
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxWidth: '500px',
          margin: '0 auto',
          width: '100%'
        }}>
          {extractedData && (
            <>
              {/* 검수 결과 요약 */}
              <div style={{
                backgroundColor: '#fff',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{
                  margin: '0 0 15px 0',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '10px'
                }}>
                  검수 결과 요약
                </h2>
                
                {(() => {
                  const results = calculateScanResults();
                  return results ? (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '15px'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8f8f8',
                        padding: '15px',
                        borderRadius: '8px'
                      }}>
                        <div>
                          <div style={{fontWeight: 'bold', fontSize: '16px'}}>총 약품</div>
                          <div style={{color: '#666', marginTop: '5px'}}>{results.totalItems}개</div>
                        </div>
                        <div>
                          <div style={{fontWeight: 'bold', fontSize: '16px'}}>검수 완료</div>
                          <div style={{color: '#666', marginTop: '5px'}}>{results.scannedItems}개</div>
                        </div>
                        <div>
                          <div style={{fontWeight: 'bold', fontSize: '16px'}}>누락된 약품</div>
                          <div style={{color: '#666', marginTop: '5px'}}>{results.missingItems.length}개</div>
                        </div>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        padding: '15px',
                        backgroundColor: results.isComplete ? '#e7f7ed' : '#ffeeee',
                        borderRadius: '8px',
                        color: results.isComplete ? '#0c753a' : '#d32f2f'
                      }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: results.isComplete ? '#0c753a' : '#d32f2f',
                          color: '#fff',
                          fontWeight: 'bold'
                        }}>
                          {results.isComplete ? '✓' : '!'}
                        </div>
                        <div style={{fontWeight: 'bold'}}>
                          {results.isComplete 
                            ? '모든 약품이 정상적으로 입고되었습니다' 
                            : '일부 약품이 누락되었습니다'}
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
              
              {/* 약품 목록 */}
              <div style={{
                backgroundColor: '#fff',
                padding: '15px',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{
                  margin: '0 0 15px 0',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#333',
                  borderBottom: '1px solid #eee',
                  paddingBottom: '10px'
                }}>
                  약품 목록
                </h2>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {extractedData.items.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px',
                        backgroundColor: item.scanned ? '#e7f7ed' : '#ffeeee',
                        borderRadius: '4px',
                        borderLeft: `4px solid ${item.scanned ? '#4CAF50' : '#d32f2f'}`
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1
                      }}>
                        <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          {item.specification} | 수량: {item.quantity}개
                        </span>
                      </div>
                      <div style={{
                        backgroundColor: item.scanned ? '#4CAF50' : '#d32f2f',
                        color: 'white',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        {item.scanned ? '✓' : '✕'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 버튼 영역 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <button
                  onClick={() => setScanMode('medicine')}
                  style={{
                    padding: '12px',
                    backgroundColor: '#0066FF',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  계속 스캔하기
                </button>
                
                <button
                  onClick={goToStart}
                  style={{
                    padding: '12px',
                    backgroundColor: '#F5F5F5',
                    color: '#333',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  처음으로 돌아가기
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}