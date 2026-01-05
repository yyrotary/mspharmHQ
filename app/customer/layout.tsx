'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Toaster } from 'react-hot-toast';

interface CustomerSession {
  customerId: string;
  customerCode: string;
  customerName: string;
  loginTime: string;
}

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  
  // 네비게이션을 표시하지 않을 페이지들
  const hideNavigation = pathname === '/customer/login' || 
                         pathname === '/customer/change-pin' ||
                         pathname === '/customer' ||
                         pathname?.includes('/camera');

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (sessionData) {
      setCustomerSession(JSON.parse(sessionData));
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('customer_session');
    setCustomerSession(null);
    router.push('/customer/login');
  };

  // 네비게이션 아이템
  const navItems = [
    { 
      href: '/customer/dashboard', 
      icon: '🏠', 
      label: '홈',
      activeColor: 'text-indigo-600'
    },
    { 
      href: '/customer/food-diary', 
      icon: '🍽️', 
      label: '음식',
      activeColor: 'text-green-600'
    },
    { 
      href: '/customer/health-report', 
      icon: '📊', 
      label: '건강리포트',
      activeColor: 'text-blue-600'
    },
    { 
      href: '/customer/consultations', 
      icon: '💬', 
      label: '상담',
      activeColor: 'text-purple-600'
    },
    { 
      href: '/customer/profile', 
      icon: '👤', 
      label: '내정보',
      activeColor: 'text-gray-600'
    },
  ];

  const isActive = (href: string) => {
    if (href === '/customer/dashboard') {
      return pathname === '/customer/dashboard';
    }
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <Toaster position="top-center" />
      
      {/* 메인 콘텐츠 */}
      <main className={`max-w-md mx-auto ${!hideNavigation ? 'pb-24' : ''}`}>
        {children}
      </main>

      {/* 하단 네비게이션 */}
      {!hideNavigation && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-md mx-auto">
            <div className="flex justify-around items-center h-16">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex flex-col items-center justify-center w-full h-full transition-all ${
                      active 
                        ? `${item.activeColor} scale-105` 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    <span className={`text-xl ${active ? 'transform -translate-y-0.5' : ''}`}>
                      {item.icon}
                    </span>
                    <span className={`text-[10px] mt-0.5 font-medium ${active ? 'font-bold' : ''}`}>
                      {item.label}
                    </span>
                    {active && (
                      <div className={`absolute bottom-1 w-1 h-1 rounded-full ${item.activeColor.replace('text-', 'bg-')}`} />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          
          {/* 중앙 플로팅 버튼 (카메라) */}
          <Link
            href="/customer/food-diary/camera"
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            <span className="text-2xl">📷</span>
          </Link>
        </nav>
      )}
    </div>
  );
}
