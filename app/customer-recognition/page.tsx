'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { CUSTOMER_SCHEMA, getNotionPropertyValue, NotionCustomer } from '@/app/lib/notion-schema';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';

export default function CustomerRecognitionPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceCanvasRef = useRef<HTMLCanvasElement>(null); // 얼굴 인식 오버레이용 캔버스
  const [scanning, setScanning] = useState(false);
  const [customers, setCustomers] = useState<NotionCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    gender: '',
    birth: '',
    address: '',
  });
  const [message, setMessage] = useState('');
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceDetector, setFaceDetector] = useState<any>(null);
  const detectionInterval = useRef<number | null>(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [cameraMode, setCameraMode] = useState<'user' | 'environment'>('environment');

  // 컴포넌트 마운트/언마운트 시 카메라 처리
  useEffect(() => {
    // 사용자 상호작용 후 얼굴 감지 모델을 로드하는 함수
    async function loadFaceDetector() {
      try {
        setModelLoading(true);
        setMessage('얼굴 인식 모델을 로드 중입니다...');
        
        // TensorFlow.js 로딩 전에 콘솔 메시지
        console.log('TensorFlow.js 로딩 시작...');
        
        // TensorFlow.js 초기화
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('TensorFlow.js 백엔드 초기화됨:', tf.getBackend());
        
        console.log('BlazeFace 모델 로딩 시작...');
        const model = await blazeface.load();
        console.log('BlazeFace 모델 로드 완료');
        
        setFaceDetector(model);
        setModelLoading(false);
        setMessage('');
      } catch (err) {
        console.error('얼굴 감지 모델 로드 실패:', err);
        setModelLoading(false);
        setMessage('얼굴 인식 모델을 로드할 수 없습니다. 페이지를 새로고침해 주세요.');
      }
    }
    
    // 카메라 권한 요청 후 모델 로드
    const initializeApp = async () => {
      try {
        setMessage('카메라 권한 요청 중...');
        
        // 먼저 권한 확인 및 열거
        let deviceInfo = null;
        try {
          // 카메라 정보 열거 시도
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          
          if (videoDevices.length > 0) {
            console.log('카메라 장치 발견됨:', videoDevices.length);
            deviceInfo = videoDevices;
          } else {
            console.warn('영상 입력 장치를 찾을 수 없음');
          }
        } catch (enumErr) {
          console.warn('장치 열거 실패 (권한 필요):', enumErr);
        }
        
        // 권한에 관계없이 모델 로드
        await loadFaceDetector();
        
        // 모델 로드 후 카메라 시작
        try {
          await startCamera();
        } catch (cameraErr) {
          console.error('카메라 시작 초기 실패:', cameraErr);
          setMessage('카메라 시작 실패. 브라우저 설정에서 카메라 권한을 확인해주세요.');
        }
      } catch (err) {
        console.error('앱 초기화 오류:', err);
        setMessage(`앱 초기화 중 오류가 발생했습니다: ${(err as Error).message}`);
      }
    };
    
    // 즉시 초기화 (지연 제거)
    initializeApp();
    
    return () => {
      // 스트림 정리
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      // 얼굴 감지 인터벌 정리
      if (detectionInterval.current) {
        window.clearInterval(detectionInterval.current);
      }
    };
  }, []);
  
  // 비디오 요소에 이벤트 리스너 추가
  useEffect(() => {
    const videoElement = videoRef.current;
    
    if (videoElement) {
      const handleCanPlay = () => {
        console.log('비디오 재생 가능 이벤트 발생');
        videoElement.play().catch(err => {
          console.error('비디오 자동 재생 실패:', err);
        });
        
        // 비디오 크기 기반으로 캔버스 크기 설정
        if (faceCanvasRef.current && videoElement.videoWidth && videoElement.videoHeight) {
          faceCanvasRef.current.width = videoElement.videoWidth;
          faceCanvasRef.current.height = videoElement.videoHeight;
          console.log(`canplay 이벤트에서 캔버스 크기 설정: ${faceCanvasRef.current.width}x${faceCanvasRef.current.height}`);
        }
        
        // 얼굴 감지 시작
        startFaceDetection();
      };
      
      const handleLoadedData = () => {
        console.log('비디오 데이터 로드됨');
        
        // 비디오 크기 기반으로 캔버스 크기 설정
        if (faceCanvasRef.current && videoElement.videoWidth && videoElement.videoHeight) {
          faceCanvasRef.current.width = videoElement.videoWidth;
          faceCanvasRef.current.height = videoElement.videoHeight;
          console.log(`loadeddata 이벤트에서 캔버스 크기 설정: ${faceCanvasRef.current.width}x${faceCanvasRef.current.height}`);
        }
        
        startFaceDetection();
      };
      
      const handleResize = () => {
        console.log('비디오 크기 변경됨');
        if (faceCanvasRef.current && videoElement.videoWidth && videoElement.videoHeight) {
          faceCanvasRef.current.width = videoElement.videoWidth;
          faceCanvasRef.current.height = videoElement.videoHeight;
          console.log(`resize 이벤트에서 캔버스 크기 설정: ${faceCanvasRef.current.width}x${faceCanvasRef.current.height}`);
        }
      };
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('페이지가 보이게 됨, 얼굴 감지 재시작');
          startFaceDetection();
        } else {
          console.log('페이지가 숨겨짐, 얼굴 감지 일시 중지');
          if (detectionInterval.current) {
            window.clearInterval(detectionInterval.current);
            detectionInterval.current = null;
          }
        }
      };
      
      const handleError = (event: Event) => {
        const videoError = (event.target as HTMLVideoElement).error;
        console.error('비디오 요소 오류:', videoError?.code, videoError?.message);
        setMessage(`카메라 오류: ${videoError?.message || '알 수 없는 오류'}`);
      };
      
      // 이벤트 리스너 등록
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('loadeddata', handleLoadedData);
      videoElement.addEventListener('resize', handleResize);
      videoElement.addEventListener('error', handleError);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // 정리 함수
      return () => {
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('resize', handleResize);
        videoElement.removeEventListener('error', handleError);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [videoRef.current, stream]); // stream 의존성 추가

  // 카메라 모드 변경 시 카메라 재시작
  useEffect(() => {
    console.log('카메라 모드가 변경됨:', cameraMode);
    // 이전 face detection 인터벌 정리
    if (detectionInterval.current) {
      window.clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    startCamera();
  }, [cameraMode]);

  // 얼굴 감지 시작 함수
  const startFaceDetection = () => {
    // 이미 실행 중인 경우 중지
    if (detectionInterval.current) {
      window.clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    
    // 비디오와 감지기 준비 확인
    if (!videoRef.current || !faceDetector) {
      console.warn('얼굴 감지 시작 불가: 비디오나 감지기가 준비되지 않음', {
        videoReady: !!videoRef.current, 
        detectorReady: !!faceDetector
      });
      return;
    }
    
    // 캔버스 준비 확인
    if (!faceCanvasRef.current) {
      console.error('얼굴 감지용 캔버스가 준비되지 않음');
      return;
    }
    
    console.log('얼굴 감지 시작됨');
    
    // 캔버스 초기 설정
    const canvas = faceCanvasRef.current;
    const video = videoRef.current;
    
    // 비디오 크기가 있는 경우 캔버스 크기를 맞춤
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      console.log(`캔버스 크기 설정: ${canvas.width}x${canvas.height}`);
    } else {
      console.warn('비디오 크기가 없어 기본값 사용');
      canvas.width = 640;
      canvas.height = 480;
    }
    
    // 얼굴 감지 인터벌 시작 (기존 150ms에서 100ms로 단축)
    detectionInterval.current = window.setInterval(() => {
      detectFaces();
    }, 100);
  };

  // 얼굴 감지 함수
  const detectFaces = async () => {
    if (!videoRef.current || !faceCanvasRef.current || !stream || !faceDetector) return;
    
    const video = videoRef.current;
    const canvas = faceCanvasRef.current;
    
    // 비디오가 준비되고 모델이 로드되었을 때만 감지 수행
    if (video.readyState < 2) {
      return; // 비디오가 아직 준비되지 않음
    }
    
    try {
      // 비디오 크기가 0인 경우 건너뜀
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn('비디오 크기가 유효하지 않음, 감지 건너뜀');
        return;
      }
      
      // 캔버스 크기 확인 및 조정
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log(`캔버스 크기 재조정: ${canvas.width}x${canvas.height}`);
      }
      
      // 얼굴 감지 수행
      const predictions = await faceDetector.estimateFaces(
        video, 
        false // 랜드마크(눈, 코, 입 등의 위치) 반환 안함
      ).catch((err: Error) => {
        console.error('BlazeFace 감지 오류:', err);
        return []; // 오류 시 빈 배열 반환
      });
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // 캔버스 지우기
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 로그 출력 (디버깅용)
      if (predictions && predictions.length > 0) {
        console.log(`${predictions.length}개의 얼굴 감지됨`);
        setFaceDetected(true);
        
        // 모든 감지된 얼굴에 대해 표시
        for (let i = 0; i < predictions.length; i++) {
          const face = predictions[i];
          
          // 좌표 유효성 검사
          if (isNaN(face.topLeft[0]) || 
              isNaN(face.topLeft[1]) || 
              isNaN(face.bottomRight[0]) || 
              isNaN(face.bottomRight[1])) {
            console.error('얼굴 감지 좌표가 유효하지 않습니다:', face);
            continue;
          }
          
          const x = face.topLeft[0];
          const y = face.topLeft[1];
          const width = face.bottomRight[0] - x;
          const height = face.bottomRight[1] - y;
          
          // 유효한 크기인지 확인
          if (width <= 0 || height <= 0 || 
              width > canvas.width * 2 || 
              height > canvas.height * 2) {
            console.error('얼굴 영역 크기가 유효하지 않습니다:', width, height);
            continue;
          }
          
          try {
            // 빨간색 사각형 그리기 (더 잘 보이도록)
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);
            
            // 사각형 위에 텍스트 추가
            ctx.fillStyle = 'rgba(255, 0, 0, 1)';
            ctx.font = '16px Arial';
            ctx.fillText('얼굴 감지됨', x, y > 20 ? y - 5 : y + height + 20);
            
            // 모바일에서 더 잘 보이도록 코너 마커 추가
            const cornerSize = Math.max(width, height) / 8;
            ctx.strokeStyle = 'rgba(255, 255, 0, 1)'; // 노란색
            ctx.lineWidth = 4;
            
            // 좌상단 코너
            ctx.beginPath();
            ctx.moveTo(x, y + cornerSize);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerSize, y);
            ctx.stroke();
            
            // 우상단 코너
            ctx.beginPath();
            ctx.moveTo(x + width - cornerSize, y);
            ctx.lineTo(x + width, y);
            ctx.lineTo(x + width, y + cornerSize);
            ctx.stroke();
            
            // 좌하단 코너
            ctx.beginPath();
            ctx.moveTo(x, y + height - cornerSize);
            ctx.lineTo(x, y + height);
            ctx.lineTo(x + cornerSize, y + height);
            ctx.stroke();
            
            // 우하단 코너
            ctx.beginPath();
            ctx.moveTo(x + width - cornerSize, y + height);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x + width, y + height - cornerSize);
            ctx.stroke();
          } catch (drawErr) {
            console.error('캔버스 그리기 오류:', drawErr);
          }
        }
      } else {
        // 얼굴이 감지되지 않았을 때
        setFaceDetected(false);
        // 모바일에서 얼굴 감지 상태를 볼 수 있도록 화면에 표시
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(10, 10, 140, 30);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.font = '16px Arial';
        ctx.fillText('얼굴 감지되지 않음', 15, 30);
      }
    } catch (err) {
      console.error('얼굴 감지 프로세스 오류:', err);
      setFaceDetected(false);
    }
  };

  // 카메라 시작 함수
  const startCamera = async () => {
    try {
      // 이전 스트림 중지 및 메모리 정리
      if (stream) {
        console.log('기존 스트림 정리 중...');
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('기존 트랙 중지됨:', track.kind, track.label);
        });
        setStream(null);
      }
      
      // 브라우저에서 카메라 API 지원 여부 확인
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('이 브라우저는 카메라 접근을 지원하지 않습니다.');
      }

      console.log('카메라 장치 열거 시작...');
      
      try {
        // 가장 기본적인 제약 조건부터 시도
        const basicConstraints = {
          video: true,
          audio: false
        };
        
        console.log('기본 제약조건으로 카메라 접근 시도:', JSON.stringify(basicConstraints));
        
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
          console.log('기본 제약조건으로 카메라 접근 성공!');
          
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            return; // 성공했으면 종료
          }
        } catch (basicErr) {
          console.warn('기본 제약조건으로 카메라 접근 실패, 다른 방법 시도:', basicErr);
        }
        
        // facingMode 제약 조건 시도
        const facingConstraints = {
          video: { facingMode: cameraMode },
          audio: false
        };
        
        console.log('facingMode로 카메라 접근 시도:', JSON.stringify(facingConstraints));
        
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia(facingConstraints);
          console.log('facingMode로 카메라 접근 성공!');
          
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.style.transform = cameraMode === 'user' ? 'scaleX(-1)' : 'none';
            return; // 성공했으면 종료
          }
        } catch (facingErr) {
          console.warn('facingMode로 카메라 접근 실패, 기기 열거 시도:', facingErr);
        }
        
        // 기기 열거로 시도
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          throw new Error('카메라를 찾을 수 없습니다.');
        }
        
        console.log('사용 가능한 비디오 장치:', videoDevices.map(d => `${d.label || '알 수 없음'} (${d.deviceId.substring(0, 8)}...)`));
        
        // 마지막 방법으로 모든 카메라 하나씩 시도
        let successful = false;
        
        for (const device of videoDevices) {
          if (successful) break;
          
          try {
            const deviceConstraints = {
              video: { deviceId: { exact: device.deviceId } },
              audio: false
            };
            
            console.log(`deviceId로 카메라 접근 시도 (${device.label || '알 수 없음'}):`);
            
            const mediaStream = await navigator.mediaDevices.getUserMedia(deviceConstraints);
            console.log(`${device.label || '알 수 없음'} 카메라 접근 성공!`);
            
            setStream(mediaStream);
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
              videoRef.current.style.transform = device.label?.toLowerCase().includes('front') ? 'scaleX(-1)' : 'none';
              successful = true;
            }
          } catch (deviceErr) {
            console.warn(`${device.label || '알 수 없음'} 카메라 접근 실패:`, deviceErr);
          }
        }
        
        if (!successful) {
          throw new Error('모든 카메라 접근 방법이 실패했습니다.');
        }
        
      } catch (err) {
        console.error('카메라 접근 최종 오류:', err);
        setMessage(`카메라를 시작할 수 없습니다: ${(err as Error).message}`);
        setFaceDetected(false); // 카메라 접근 실패 시 얼굴 감지 상태 초기화
      }
    } catch (err) {
      console.error('카메라 초기화 중 오류 발생:', err);
      setMessage('카메라를 초기화할 수 없습니다. 페이지를 새로고침하거나 다른 브라우저에서 시도해 주세요.');
      setFaceDetected(false); // 오류 발생 시 얼굴 감지 상태 초기화
    }
  };

  // 카메라 전환 함수 (전면/후면)
  const switchCamera = () => {
    // 현재 모드를 반대로 설정
    setCameraMode(prev => {
      console.log('카메라 모드 전환:', prev, '->', (prev === 'environment' ? 'user' : 'environment'));
      return prev === 'environment' ? 'user' : 'environment';
    });
    
    // 기존 얼굴 감지 인터벌 및 스트림 정리
    if (detectionInterval.current) {
      window.clearInterval(detectionInterval.current);
      detectionInterval.current = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    
    // 0.5초 후에 카메라 재시작
    setTimeout(() => {
      startCamera();
    }, 500);
  };

  // 사진 촬영 및 고객 검색
  const captureAndSearch = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      setLoading(true);
      setMessage('');
      setCustomers([]);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // 비디오의 현재 프레임을 캔버스에 그림
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // 캔버스의 이미지를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else setMessage('이미지 변환 실패');
        }, 'image/jpeg');
      });
      
      if (!blob) {
        throw new Error('이미지를 캡처할 수 없습니다.');
      }
      
      // 얼굴 임베딩 생성 API 호출
      const formData = new FormData();
      formData.append('image', blob);
      
      setMessage('얼굴 인식 중...');
      const embeddingResponse = await fetch('/api/face-embedding', {
        method: 'POST',
        body: formData
      });
      
      const embeddingResult = await embeddingResponse.json();
      console.log('얼굴 임베딩 결과:', embeddingResult);
      
      // 오류 메시지가 있지만 기본 데이터가 생성된 경우
      if (embeddingResult.note) {
        console.log('참고:', embeddingResult.note);
      }
      
      // 결과가 없거나 오류가 있는 경우
      if (!embeddingResponse.ok) {
        throw new Error(embeddingResult.error || '얼굴 인식 중 오류가 발생했습니다.');
      }
      
      // 얼굴 감지 여부 확인
      if (embeddingResult.data && !embeddingResult.data.faceDetected) {
        setMessage('얼굴이 감지되지 않았습니다. 다시 시도해 주세요.');
        setLoading(false);
        return;
      }
      
      // 임베딩 데이터 확인
      if (!embeddingResult.data || !embeddingResult.data.embedding) {
        throw new Error('얼굴 특징 데이터를 추출할 수 없습니다.');
      }
      
      setMessage('고객 매칭 중...');
      // 얼굴 임베딩 데이터로 고객 검색
      const customerResponse = await fetch('/api/customer', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          faceEmbedding: embeddingResult.data.embedding
        })
      });
      
      const customerResult = await customerResponse.json();
      
      if (customerResult.success && customerResult.customers && customerResult.customers.length > 0) {
        // 유사도 확인 (첫 번째 결과의 유사도)
        const similarity = customerResult.similarities && customerResult.similarities[0] 
          ? customerResult.similarities[0] 
          : 0;
        
        // 항상 고객 목록은 표시
        setCustomers(customerResult.customers);
        
        // 유사도가 80% 이상인 경우에만 매칭된 고객으로 처리
        if (similarity > 0.8) {
          setMessage(`${customerResult.customers.length}명의 고객이 인식되었습니다. (유사도: ${Math.round(similarity * 100)}%)`);
        } else {
          // 유사도가 80% 이하인 경우 신규 고객으로 간주하되, 유사한 고객 정보도 함께 표시
          setMessage(`유사한 고객이 있으나 유사도가 낮습니다(${Math.round(similarity * 100)}%). 같은 고객이면 선택하고, 아니면 새 고객을 등록하세요.`);
          setShowForm(true);
          
          // 새 고객 등록 시 임베딩 데이터 저장을 위해 임시 저장
          window.localStorage.setItem('tempFaceEmbedding', JSON.stringify(embeddingResult.data.embedding));
        }
      } else {
        // 얼굴 임베딩으로 찾지 못했을 때 성별 기반 대체 검색
        const gender = embeddingResult.data.gender || '';
        setMessage('성별 기반 검색 중...');
        const fallbackResponse = await fetch(`/api/customer${gender ? `?gender=${gender}` : ''}`);
        const fallbackResult = await fallbackResponse.json();
        
        if (fallbackResult.success && fallbackResult.customers.length > 0) {
          setCustomers(fallbackResult.customers);
          setMessage(`얼굴 인식에 실패했지만, ${fallbackResult.customers.length}명의 유사한 고객을 찾았습니다.`);
        } else {
          setMessage('일치하는 고객을 찾을 수 없습니다. 새 고객을 등록하시겠습니까?');
          setShowForm(true);
          
          // 새 고객 등록 시 임베딩 데이터 저장을 위해 임시 저장
          window.localStorage.setItem('tempFaceEmbedding', JSON.stringify(embeddingResult.data.embedding));
        }
      }
    } catch (err) {
      console.error('고객 검색 오류:', err);
      setMessage((err as Error).message || '고객 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 새 고객 정보 저장
  const saveNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCustomer.name) {
      setMessage('이름은 필수 입력 항목입니다.');
      return;
    }
    
    try {
      setLoading(true);
      
      // 임시 저장된 얼굴 임베딩 데이터 가져오기
      const faceEmbedding = window.localStorage.getItem('tempFaceEmbedding');
      
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
          faceEmbedding: faceEmbedding
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // 임시 저장 데이터 삭제
        window.localStorage.removeItem('tempFaceEmbedding');
        
        setMessage('새 고객이 등록되었습니다.');
        setShowForm(false);
        setNewCustomer({
          name: '',
          phone: '',
          gender: '',
          birth: '',
          address: '',
        });
        
        // 저장 성공 후 해당 고객 정보 조회
        if (result.customer && result.customer.name) {
          try {
            // 등록된 고객 정보 조회
            const searchResponse = await fetch(`/api/customer?name=${encodeURIComponent(result.customer.name)}`);
            const searchResult = await searchResponse.json();
            
            if (searchResponse.ok && searchResult.success && searchResult.customers.length > 0) {
              // 조회된 고객 정보로 customers 배열 업데이트
              setCustomers(searchResult.customers);
            } else {
              // API에서 반환한 제한된 고객 정보만 있는 경우
              console.log('등록된 고객 정보로 직접 설정:', result.customer);
              
              // 임시 NotionCustomer 객체를 생성하여 설정
              const tempCustomer = {
                id: result.customer.id,
                properties: {
                  고객명: { 
                    type: 'rich_text', 
                    rich_text: [{ plain_text: result.customer.name }] 
                  },
                  // 다른 필드들은 빈 값으로 설정
                  전화번호: { type: 'phone_number', phone_number: '' },
                  성별: { type: 'select', select: null },
                  생년월일: { type: 'date', date: null },
                  주소: { type: 'rich_text', rich_text: [] }
                }
              };
              
              setCustomers([tempCustomer as any]);
            }
          } catch (error) {
            console.error('고객 조회 오류:', error);
            // 조회 오류 시 메시지는 변경하지 않고 유지
          }
        }
      } else {
        throw new Error(result.error || '고객 정보 저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('고객 저장 오류:', err);
      setMessage((err as Error).message || '고객 정보 저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* 헤더 - 고정 위치 */}
      <header className="fixed top-0 left-0 right-0 bg-white z-50 border-b border-gray-200 p-4">
        <div className="flex justify-between items-center max-w-md mx-auto">
          <Link href="/" className="text-blue-600">
            ← 홈으로
          </Link>
          <h1 className="text-xl font-bold">고객 인식</h1>
          <div className="w-10"></div> {/* 레이아웃 균형을 위한 빈 공간 */}
        </div>
      </header>

      {/* 컨트롤 버튼 - 고정 위치 */}
      <div className="fixed top-16 left-0 right-0 z-50 px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex gap-2 max-w-md mx-auto">
          <button
            onClick={switchCamera}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-black py-3 px-4 rounded-full text-lg font-semibold transition-all cursor-pointer"
            disabled={loading || modelLoading}
            type="button"
          >
            카메라 전환
          </button>
          <button
            onClick={captureAndSearch}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-full text-lg font-semibold transition-all cursor-pointer"
            disabled={loading || modelLoading}
            type="button"
          >
            {loading ? '검색 중...' : '고객 검색'}
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 - 헤더 높이만큼 아래에서 시작 */}
      <main className="flex-grow pt-32 pb-4 overflow-y-auto">
        <div className="max-w-md mx-auto">
          {/* 카메라 뷰파인더 */}
          <div className="relative mb-4 bg-black rounded-lg overflow-hidden h-80" style={{ pointerEvents: 'none' }}>
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              className="w-full h-full object-cover"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, pointerEvents: 'none' }}
            />
            <canvas ref={canvasRef} className="hidden" />
            <canvas 
              ref={faceCanvasRef} 
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none' }}
            />
            
            {/* 얼굴 인식 상태 표시 (큰 표시) */}
            <div className={`absolute top-2 left-2 px-3 py-2 rounded-full text-sm font-bold z-20 ${faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
              {faceDetected ? '얼굴 감지됨' : '얼굴 감지되지 않음'}
            </div>
            
            {/* 모델 로딩 상태 표시 */}
            {modelLoading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
                <div className="bg-white p-4 rounded-lg text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500 border-r-2 border-b-2 border-gray-200 mb-2"></div>
                  <p>얼굴 인식 모델 로딩 중...</p>
                </div>
              </div>
            )}
          </div>
          
          {/* 메시지 표시 */}
          {message && (
            <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
              {message}
            </div>
          )}
          
          {/* 검색 결과 목록 */}
          {customers.length > 0 && (
            <div className="mb-4">
              <h2 className="text-lg font-bold mb-2">검색 결과</h2>
              <div className="bg-white rounded-lg shadow">
                {customers.map((customer) => (
                  <div 
                    key={customer.id} 
                    className="p-4 border-b cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      // 해당 고객 선택 시 신규 등록 폼 닫기
                      setShowForm(false);
                      setMessage(`${getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type)} 고객을 선택했습니다.`);
                    }}
                  >
                    <h3 className="font-bold text-lg">
                      {getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type)}
                    </h3>
                    <p className="text-gray-600">
                      전화번호: {getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type)}
                    </p>
                    <p className="text-gray-600">
                      성별: {getNotionPropertyValue(customer.properties.성별, CUSTOMER_SCHEMA.성별.type)}
                    </p>
                    <p className="text-gray-600">
                      생년월일: {getNotionPropertyValue(customer.properties.생년월일, CUSTOMER_SCHEMA.생년월일.type)}
                    </p>
                    <p className="text-gray-600">
                      주소: {getNotionPropertyValue(customer.properties.주소, CUSTOMER_SCHEMA.주소.type)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 새 고객 등록 폼 */}
          {showForm && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-lg font-bold mb-2">
                {customers.length > 0 ? '다른 고객으로 등록' : '새 고객 등록'}
              </h2>
              <form onSubmit={saveNewCustomer}>
                <div className="mb-3">
                  <label className="block mb-1">이름 *</label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block mb-1">성별</label>
                  <select
                    value={newCustomer.gender}
                    onChange={(e) => setNewCustomer({...newCustomer, gender: e.target.value})}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">선택하세요</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </div>
                
                <div className="mb-3">
                  <label className="block mb-1">생년월일</label>
                  <input
                    type="date"
                    value={newCustomer.birth}
                    onChange={(e) => setNewCustomer({...newCustomer, birth: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div className="mb-3">
                  <label className="block mb-1">주소</label>
                  <input
                    type="text"
                    value={newCustomer.address}
                    onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 bg-gray-200 text-black p-3 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 text-white p-3 rounded-lg"
                    disabled={loading}
                  >
                    {loading ? '저장 중...' : '저장하기'}
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