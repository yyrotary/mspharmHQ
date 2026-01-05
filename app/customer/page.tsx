'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CustomerHomePage() {
  const router = useRouter();

  useEffect(() => {
    // 세션 확인
    const sessionData = localStorage.getItem('customer_session');
    if (sessionData) {
      // 이미 로그인된 경우 대시보드로 이동
      router.push('/customer/dashboard');
    } else {
      // 로그인되지 않은 경우 로그인 페이지로 이동
      router.push('/customer/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}
