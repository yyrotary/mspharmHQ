'use client';

import Link from 'next/link';

export default function CustomerListHeader() {
  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-xl font-bold text-blue-600">
          MS Pharm 고객 관리
        </Link>
        
        <nav className="flex space-x-4">
          <Link href="/" className="px-3 py-2 rounded hover:bg-gray-100">
            홈
          </Link>
          <Link href="/customer-list" className="px-3 py-2 bg-blue-100 text-blue-600 rounded">
            고객 목록
          </Link>
          <Link href="/consultation" className="px-3 py-2 rounded hover:bg-gray-100">
            상담일지
          </Link>
          <Link href="/customer-recognition" className="px-3 py-2 rounded hover:bg-gray-100">
            고객 인식
          </Link>
        </nav>
      </div>
    </header>
  );
} 