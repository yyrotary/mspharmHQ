'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface NavigationProps {
  customerName?: string;
  onLogout?: () => void;
}

export default function Navigation({ customerName, onLogout }: NavigationProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/customer/dashboard') {
      return pathname === '/customer/dashboard';
    }
    return pathname?.startsWith(path);
  };

  const navItems = [
    {
      href: '/customer/dashboard',
      icon: '🏠',
      label: '홈',
      active: isActive('/customer/dashboard')
    },
    {
      href: '/customer/food-diary',
      icon: '🍽️',
      label: '음식기록',
      active: isActive('/customer/food-diary')
    },
    {
      href: '/customer/lifestyle',
      icon: '📝',
      label: '생활기록',
      active: isActive('/customer/lifestyle')
    }
  ];

  return (
    <>
      {/* 상단 헤더 */}
      <header className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link 
                href="/customer/dashboard"
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">명</span>
                </div>
                <span className="font-medium text-gray-900">명성약국</span>
              </Link>
            </div>
            
            {customerName && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{customerName}님</span>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    로그아웃
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 하단 네비게이션 바 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="grid grid-cols-3 h-16">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                item.active
                  ? 'text-indigo-600 bg-indigo-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
