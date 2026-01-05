'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function ChangePinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name') || '';
  
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 입력 검증
    if (currentPin.length !== 6) {
      toast.error('현재 PIN을 6자리로 입력해주세요');
      return;
    }

    if (newPin.length !== 6) {
      toast.error('새 PIN을 6자리로 입력해주세요');
      return;
    }

    if (newPin !== confirmPin) {
      toast.error('새 PIN과 확인 PIN이 일치하지 않습니다');
      return;
    }

    if (currentPin === newPin) {
      toast.error('새 PIN은 현재 PIN과 달라야 합니다');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/customer/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerName, 
          currentPin, 
          newPin 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('PIN이 성공적으로 변경되었습니다!');
        
        // 새로운 PIN으로 세션 업데이트
        localStorage.setItem('customer_session', JSON.stringify({
          customerId: data.customer.id,
          customerCode: data.customer.customer_code,
          customerName: data.customer.name,
          loginTime: new Date().toISOString()
        }));
        
        // 대시보드로 이동
        router.push('/customer/dashboard');
      } else {
        toast.error(data.error || 'PIN 변경에 실패했습니다');
      }
    } catch (error) {
      toast.error('PIN 변경 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleCurrentPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setCurrentPin(value);
    }
  };

  const handleNewPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setNewPin(value);
    }
  };

  const handleConfirmPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setConfirmPin(value);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      {/* 헤더 */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">🔐</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">PIN 변경</h1>
        <p className="text-gray-600">
          안녕하세요, <strong>{customerName}</strong>님
        </p>
        <p className="text-sm text-orange-600 mt-2">
          보안을 위해 초기 PIN(000000)을 변경해주세요
        </p>
      </div>

      {/* PIN 변경 폼 */}
      <div className="w-full max-w-sm mx-auto bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 현재 PIN */}
          <div>
            <label htmlFor="currentPin" className="block text-sm font-medium text-gray-700 mb-2">
              현재 PIN
            </label>
            <input
              id="currentPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              className="w-full px-3 py-4 text-center text-2xl tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="● ● ● ● ● ●"
              value={currentPin}
              onChange={handleCurrentPinChange}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              초기 PIN은 000000입니다
            </p>
          </div>

          {/* 새 PIN */}
          <div>
            <label htmlFor="newPin" className="block text-sm font-medium text-gray-700 mb-2">
              새 PIN
            </label>
            <input
              id="newPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              className="w-full px-3 py-4 text-center text-2xl tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="● ● ● ● ● ●"
              value={newPin}
              onChange={handleNewPinChange}
              autoComplete="off"
            />
          </div>

          {/* PIN 확인 */}
          <div>
            <label htmlFor="confirmPin" className="block text-sm font-medium text-gray-700 mb-2">
              새 PIN 확인
            </label>
            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              className="w-full px-3 py-4 text-center text-2xl tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="● ● ● ● ● ●"
              value={confirmPin}
              onChange={handleConfirmPinChange}
              autoComplete="off"
            />
            {newPin && confirmPin && newPin !== confirmPin && (
              <p className="text-xs text-red-500 mt-1">
                PIN이 일치하지 않습니다
              </p>
            )}
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading || currentPin.length !== 6 || newPin.length !== 6 || newPin !== confirmPin}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'PIN 변경 중...' : 'PIN 변경'}
          </button>
        </form>

        {/* 도움말 */}
        <div className="mt-6 text-center">
          <h3 className="text-sm font-medium text-gray-900 mb-2">PIN 변경 안내</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 새 PIN은 6자리 숫자로 입력해주세요</li>
            <li>• 생일, 전화번호 등 추측하기 쉬운 번호는 피해주세요</li>
            <li>• PIN은 개인정보 보호를 위해 안전하게 관리해주세요</li>
          </ul>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>명성약국 고객 서비스</p>
      </div>
    </div>
  );
}

export default function ChangePinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <ChangePinContent />
    </Suspense>
  );
}
