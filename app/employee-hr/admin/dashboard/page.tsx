'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: string;
}

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  monthlyLaborCost: number;
  pendingPayrolls: number;
  thisMonthAttendance: {
    totalHours: number;
    overtimeHours: number;
    nightHours: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (!['owner', 'manager'].includes(data.user.role)) {
          toast.error('관리자만 접근할 수 있습니다');
          router.push('/employee-purchase');
          return;
        }
        setUser(data.user);
        await loadDashboardStats();
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardStats = async () => {
    try {
      const response = await fetch('/api/hr/admin/dashboard-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const currentMonth = new Date().toLocaleDateString('ko-KR', { 
    year: 'numeric', 
    month: 'long' 
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm opacity-90">관리자 | {user?.name}님</p>
              <h1 className="text-3xl font-bold mt-1">💼 HR 관리 시스템</h1>
            </div>
            <Link 
              href="/employee-purchase"
              className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
            >
              메인으로
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 직원 수</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.totalEmployees || 0}명
                </p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">재직 중</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {stats?.activeEmployees || 0}명
                </p>
              </div>
              <div className="text-4xl">✅</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{currentMonth}</p>
                <p className="text-2xl font-bold text-purple-600 mt-2">
                  {formatCurrency(stats?.monthlyLaborCost || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">예상 인건비</p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">처리 대기</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {stats?.pendingPayrolls || 0}건
                </p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>
        </div>

        {/* 이번 달 근무 현황 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">📊 {currentMonth} 근무 현황</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">총 근무 시간</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.thisMonthAttendance.totalHours.toFixed(1) || 0}h
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">연장근무</p>
              <p className="text-2xl font-bold text-orange-600">
                {stats?.thisMonthAttendance.overtimeHours.toFixed(1) || 0}h
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">야간근무</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats?.thisMonthAttendance.nightHours.toFixed(1) || 0}h
              </p>
            </div>
          </div>
        </div>

        {/* 관리 메뉴 */}
        <div>
          <h2 className="text-xl font-bold mb-4">⚙️ 관리 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 직원 근무 현황 */}
            <Link
              href="/employee-hr/admin/attendance"
              className="block bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 hover:shadow-lg transition-all border border-teal-200"
            >
              <div className="text-4xl mb-3">📅</div>
              <h3 className="text-lg font-bold text-teal-900 mb-2">직원 근무 현황</h3>
              <p className="text-sm text-teal-700">전체 직원의 근무 기록 확인</p>
            </Link>

            {/* 월 급여 정산 (신규 - 메인) */}
            <Link
              href="/employee-hr/admin/payroll-settlement"
              className="block bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6 hover:shadow-lg transition-all border-2 border-purple-300"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="text-4xl">💼</div>
                <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full font-bold">NEW</span>
              </div>
              <h3 className="text-lg font-bold text-purple-900 mb-2">월 급여 정산</h3>
              <p className="text-sm text-purple-700">단계별 정산 및 확정</p>
              <div className="mt-2 text-xs text-purple-600">
                근태→변동급→자동계산→확정
              </div>
            </Link>

            {/* 급여 일괄 계산 */}
            <Link
              href="/employee-hr/admin/payroll-calculate"
              className="block bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 hover:shadow-lg transition-all border border-blue-200"
            >
              <div className="text-4xl mb-3">🧮</div>
              <h3 className="text-lg font-bold text-blue-900 mb-2">급여 일괄 계산</h3>
              <p className="text-sm text-blue-700">전체 직원 한번에 계산</p>
            </Link>

            {/* 급여 명세서 발행 */}
            <Link
              href="/employee-hr/admin/payroll-issue"
              className="block bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 hover:shadow-lg transition-all border border-green-200"
            >
              <div className="text-4xl mb-3">📄</div>
              <h3 className="text-lg font-bold text-green-900 mb-2">명세서 발행</h3>
              <p className="text-sm text-green-700">급여 명세서 생성 및 관리</p>
            </Link>

            {/* 세무사 보고 */}
            <Link
              href="/employee-hr/admin/tax-report"
              className="block bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 hover:shadow-lg transition-all border border-orange-200"
            >
              <div className="text-4xl mb-3">📊</div>
              <h3 className="text-lg font-bold text-orange-900 mb-2">세무사 보고</h3>
              <p className="text-sm text-orange-700">급여대장 생성 및 전송</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
