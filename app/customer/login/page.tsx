'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone: string;
}

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [pin, setPin] = useState('');
  const [candidates, setCandidates] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);

  // 이름으로 고객 검색
  const searchCustomers = async () => {
    if (!customerName.trim()) {
      toast.error('고객명을 입력해주세요');
      return;
    }

    console.log('🔍 고객 검색 시작:', customerName.trim());
    setSearchLoading(true);
    
    try {
      const response = await fetch('/api/customer/auth/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: customerName.trim() }),
      });

      const data = await response.json();
      console.log('📊 검색 응답:', { status: response.status, data });

      if (response.ok) {
        if (!data.customers || !Array.isArray(data.customers)) {
          console.error('❌ 잘못된 응답 형식:', data);
          toast.error('서버 응답 형식이 올바르지 않습니다');
          return;
        }

        if (data.customers.length === 1) {
          // 한 명만 있으면 바로 선택
          console.log('👤 고객 1명 발견 - 자동 선택');
          setSelectedCustomer(data.customers[0]);
          setShowCandidates(false);
          toast.success('고객을 찾았습니다. PIN을 입력해주세요.');
        } else if (data.customers.length > 1) {
          // 여러 명이면 선택 목록 표시
          console.log(`👥 고객 ${data.customers.length}명 발견 - 선택 목록 표시`);
          setCandidates(data.customers);
          setShowCandidates(true);
          toast.success(`${data.customers.length}명의 고객을 찾았습니다. 선택해주세요.`);
        } else {
          console.warn('⚠️ 고객 목록이 비어있음');
          toast.error('검색 결과가 없습니다');
        }
      } else {
        // 검색 실패 시 기존 방식으로 fallback
        console.warn('⚠️ 검색 실패 - fallback 표시');
        toast.error(data.error || '고객 검색 실패');
        toast.info('아래에서 기존 방식으로 로그인해보세요');
        setCandidates([]);
        setShowCandidates(false);
      }
    } catch (error) {
      console.error('❌ 검색 요청 오류:', error);
      toast.error('고객 검색 중 오류가 발생했습니다');
      setCandidates([]);
      setShowCandidates(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // 기존 방식 로그인 (이름 + PIN)
  const handleLegacyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerName.trim()) {
      toast.error('고객명을 입력해주세요');
      return;
    }

    if (pin.length !== 6) {
      toast.error('6자리 PIN을 입력해주세요');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/customer/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: customerName.trim(), pin }),
      });

      const data = await response.json();

      if (response.ok) {
        // 초기 PIN 사용 시 PIN 변경 페이지로 이동
        if (data.requiresPinChange) {
          toast.success(`${data.customer.name}님, 보안을 위해 PIN을 변경해주세요`);
          router.push(`/customer/change-pin?name=${encodeURIComponent(data.customer.name)}`);
          return;
        }

        toast.success(`${data.customer.name}님, 환영합니다!`);
        
        // 로컬 스토리지에 고객 정보 저장
        localStorage.setItem('customer_session', JSON.stringify({
          customerId: data.customer.id,
          customerCode: data.customer.customer_code,
          customerName: data.customer.name,
          loginTime: new Date().toISOString()
        }));
        
        router.push('/customer/dashboard');
      } else {
        toast.error(data.error || '로그인 실패');
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 고객 선택
  const selectCustomer = (customer: Customer) => {
    console.log('👤 고객 선택:', { name: customer.name, code: customer.customer_code, id: customer.id });
    setSelectedCustomer(customer);
    setShowCandidates(false);
    setPin('');
    toast.success(`${customer.name}님(#${customer.customer_code})이 선택되었습니다. PIN을 입력해주세요.`);
  };

  // 로그인 처리
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomer) {
      toast.error('먼저 고객을 검색하고 선택해주세요');
      return;
    }

    if (pin.length !== 6) {
      toast.error('6자리 PIN을 입력해주세요');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/customer/auth/login-with-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: selectedCustomer.id, pin }),
      });

      const data = await response.json();

      if (response.ok) {
        // 초기 PIN 사용 시 PIN 변경 페이지로 이동
        if (data.requiresPinChange) {
          toast.success(`${data.customer.name}님, 보안을 위해 PIN을 변경해주세요`);
          router.push(`/customer/change-pin?name=${encodeURIComponent(data.customer.name)}`);
          return;
        }

        toast.success(`${data.customer.name}님, 환영합니다!`);
        
        // 로컬 스토리지에 고객 정보 저장
        localStorage.setItem('customer_session', JSON.stringify({
          customerId: data.customer.id,
          customerCode: data.customer.customer_code,
          customerName: data.customer.name,
          loginTime: new Date().toISOString()
        }));
        
        router.push('/customer/dashboard');
      } else {
        toast.error(data.error || '로그인 실패');
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  // 처음부터 다시 시작
  const resetSearch = () => {
    setCustomerName('');
    setPin('');
    setCandidates([]);
    setSelectedCustomer(null);
    setShowCandidates(false);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자만 입력 허용하고 6자리로 제한
    if (value.length <= 6 && /^\d*$/.test(value)) {
      setPin(value);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* 로고 및 제목 */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white text-2xl font-bold">명</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">명성약국</h1>
        <p className="text-gray-600">고객 전용 서비스</p>
      </div>

      {/* 로그인 폼 */}
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6">
        {/* 1단계: 이름 검색 */}
        {!selectedCustomer && (
          <div className="space-y-4">
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-2">
                고객명
              </label>
              <div className="flex space-x-2">
                <input
                  id="customerName"
                  type="text"
                  className="flex-1 px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="홍길동"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={searchLoading}
                  autoComplete="name"
                />
                <button
                  type="button"
                  onClick={searchCustomers}
                  disabled={searchLoading || !customerName.trim()}
                  className="px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    '🔍'
                  )}
                </button>
              </div>
            </div>

            {/* 고객 선택 목록 */}
            {showCandidates && candidates.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">고객을 선택해주세요 ({candidates.length}명)</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {candidates.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className="w-full p-3 text-left border border-gray-200 rounded-md hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-500">#{customer.customer_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{customer.phone}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 기존 방식 로그인 옵션 */}
            {!showCandidates && customerName.trim() && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">검색이 안 되시나요? 기존 방식으로 로그인해보세요</p>
                <form onSubmit={handleLegacyLogin} className="space-y-3">
                  <div>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="PIN 6자리 입력"
                      value={pin}
                      onChange={handlePinChange}
                      className="w-full px-3 py-2 text-center text-lg tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || pin.length !== 6}
                    className="w-full bg-gray-600 text-white py-2 px-4 rounded-md font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    {loading ? '로그인 중...' : '기존 방식으로 로그인'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* 2단계: PIN 입력 */}
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-indigo-900">👤 {selectedCustomer.name}</p>
                  <p className="text-sm text-indigo-700">#{selectedCustomer.customer_code}</p>
                </div>
                <button
                  type="button"
                  onClick={resetSearch}
                  className="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                  다시 선택
                </button>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                  PIN 코드
                </label>
                <input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  className="w-full px-3 py-4 text-center text-2xl tracking-widest border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="● ● ● ● ● ●"
                  value={pin}
                  onChange={handlePinChange}
                  autoComplete="off"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2">
                  초기 PIN: 000000 (첫 로그인 후 변경)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || pin.length !== 6}
                className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          </div>
        )}

        {/* 도움말 */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            {selectedCustomer 
              ? "PIN 코드를 모르시나요?"
              : "고객명을 정확히 입력해주세요"
            }
            <br />
            문의사항은 약사에게 연락하세요.
          </p>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>© 2024 명성약국. All rights reserved.</p>
      </div>
    </div>
  );
}
