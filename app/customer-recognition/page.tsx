'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// 고객 데이터 인터페이스
interface Customer {
  id: string;
  properties: {
    이름: any;
    전화번호: any;
    성별: any;
    생년월일: any;
    주소: any;
    특이사항: any;
  };
}

export default function CustomerRecognitionPage() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
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

  // 컴포넌트 마운트/언마운트 시 카메라 처리
  useEffect(() => {
    startCamera();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 카메라 시작 함수
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('카메라 시작 오류:', err);
      setMessage('카메라를 시작할 수 없습니다. 카메라 접근 권한을 확인해주세요.');
    }
  };

  // 카메라 전환 함수 (전면/후면)
  const switchCamera = async () => {
    if (stream) {
      // 현재 스트림 정지
      stream.getTracks().forEach(track => track.stop());
      
      try {
        // 현재 사용 중인 카메라 종류 확인
        const currentFacingMode = stream.getVideoTracks()[0].getSettings().facingMode;
        const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        
        // 새 스트림 시작
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacingMode }
        });
        
        setStream(newStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        console.error('카메라 전환 오류:', err);
        setMessage('카메라를 전환할 수 없습니다.');
      }
    }
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
      
      // Gemini API로 이미지 분석
      const formData = new FormData();
      formData.append('image', blob);
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || '이미지 분석 중 오류가 발생했습니다.');
      }
      
      // 분석 결과로 고객 검색
      // 예: Gemini API가 성별과 연령대를 분석했다면 이를 기반으로 노션 DB 검색
      const gender = result.data.gender || '';
      
      // 노션 DB에서 고객 검색
      const customerResponse = await fetch(`/api/customer${gender ? `?gender=${gender}` : ''}`);
      const customerResult = await customerResponse.json();
      
      if (customerResult.success && customerResult.customers.length > 0) {
        setCustomers(customerResult.customers);
        setMessage(`${customerResult.customers.length}명의 고객이 검색되었습니다.`);
      } else {
        setMessage('일치하는 고객을 찾을 수 없습니다. 새 고객을 등록하시겠습니까?');
        setShowForm(true);
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
          address: newCustomer.address
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        setMessage('새 고객이 등록되었습니다.');
        setShowForm(false);
        setNewCustomer({
          name: '',
          phone: '',
          gender: '',
          birth: '',
          address: '',
        });
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

  // 노션 데이터 표시 포맷팅 함수
  const getPropertyValue = (property: any, type: string) => {
    if (!property) return '';
    
    switch (type) {
      case 'rich_text':
        return property.rich_text?.[0]?.text?.content || '';
      case 'phone_number':
        return property.phone_number || '';
      case 'select':
        return property.select?.name || '';
      case 'date':
        return property.date?.start || '';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 헤더 */}
      <header className="header border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-blue-600">
            ← 홈으로
          </Link>
          <h1 className="text-xl font-bold">고객 인식</h1>
          <div className="w-10"></div> {/* 레이아웃 균형을 위한 빈 공간 */}
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-grow p-4">
        <div className="max-w-md mx-auto">
          {/* 카메라 뷰파인더 */}
          <div className="relative mb-4 bg-black rounded-lg overflow-hidden">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              className="w-full h-64 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* 오버레이 안내선 */}
            <div className="absolute inset-0 border-2 border-white border-opacity-50 pointer-events-none"></div>
          </div>
          
          {/* 컨트롤 버튼 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={switchCamera}
              className="flex-1 bg-gray-200 text-black p-3 rounded-lg"
              disabled={loading}
            >
              카메라 전환
            </button>
            <button
              onClick={captureAndSearch}
              className="flex-1 bg-blue-600 text-white p-3 rounded-lg"
              disabled={loading}
            >
              {loading ? '검색 중...' : '고객 검색'}
            </button>
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
                  <div key={customer.id} className="p-4 border-b">
                    <h3 className="font-bold text-lg">
                      {getPropertyValue(customer.properties.이름, 'rich_text')}
                    </h3>
                    <p className="text-gray-600">
                      전화번호: {getPropertyValue(customer.properties.전화번호, 'phone_number')}
                    </p>
                    <p className="text-gray-600">
                      성별: {getPropertyValue(customer.properties.성별, 'select')}
                    </p>
                    <p className="text-gray-600">
                      생년월일: {getPropertyValue(customer.properties.생년월일, 'date')}
                    </p>
                    <p className="text-gray-600">
                      주소: {getPropertyValue(customer.properties.주소, 'rich_text')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* 새 고객 등록 폼 */}
          {showForm && (
            <div className="bg-white rounded-lg shadow p-4 mb-4">
              <h2 className="text-lg font-bold mb-2">새 고객 등록</h2>
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