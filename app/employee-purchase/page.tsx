'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAutoLogout } from '@/app/lib/employee-purchase/useAutoLogout';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

export default function EmployeePurchaseDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 자동 로그아웃 훅 사용
  const { resetTimer } = useAutoLogout({
    timeoutMinutes: 5,
    enabled: !!user // 사용자가 로그인된 경우에만 활성화
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/employee-purchase/auth/logout', { method: 'POST' });
      toast.success('로그아웃되었습니다');
      router.push('/employee-purchase/login');
    } catch (error) {
      toast.error('로그아웃 실패');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              MSP Family 임직원가 구매
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                로그아웃
              </button>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              안녕하세요, <span className="font-semibold">{user?.name}</span>님
            </p>
            <p className="text-sm text-gray-500">
              권한: {user?.role === 'owner' ? 'master' : user?.role === 'manager' ? 'secretary' : 'family'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {user?.role !== 'owner' && (
              <Link
                href="/employee-purchase/new"
                className="block p-6 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors border border-purple-200"
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">🛒</div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-900">새 구매 신청</h3>
                    <p className="text-purple-700 mt-2">물품 구매를 신청합니다</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role !== 'owner' && (
              <Link
                href="/employee-purchase/requests"
                className="block p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">📋</div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">내 구매 내역</h3>
                    <p className="text-blue-700 mt-2">구매 신청 내역을 확인합니다</p>
                  </div>
                </div>
              </Link>
            )}

            {['manager', 'owner'].includes(user?.role || '') && (
              <Link
                href="/employee-purchase/admin"
                className="block p-6 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">✅</div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-900">승인 관리</h3>
                    <p className="text-green-700 mt-2">대기 중인 구매 요청을 관리합니다</p>
                  </div>
                </div>
              </Link>
            )}

            {user?.role === 'owner' && (
              <Link
                href="/employee-purchase/reports"
                className="block p-6 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors border border-yellow-200"
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">📊</div>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-900">통계 및 리포트</h3>
                    <p className="text-yellow-700 mt-2">전체 구매 현황을 확인합니다</p>
                  </div>
                </div>
              </Link>
            )}

            {/* 직원 관리 - 오너만 접근 가능 */}
            {user?.role === 'owner' && (
              <Link
                href="/employee-purchase/manage-employees"
                className="block p-6 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200"
              >
                <div className="flex items-center">
                  <div className="text-3xl mr-4">👥</div>
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-900">Family 관리</h3>
                    <p className="text-indigo-700 mt-2">Family 추가, 삭제, 권한 변경</p>
                  </div>
                </div>
              </Link>
            )}

            {/* 비밀번호 변경 - 모든 사용자 접근 가능 */}
            <Link
              href="/employee-purchase/change-password"
              className="block p-6 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors border border-orange-200"
            >
              <div className="flex items-center">
                <div className="text-3xl mr-4">🔐</div>
                <div>
                  <h3 className="text-lg font-semibold text-orange-900">비밀번호 변경</h3>
                  <p className="text-orange-700 mt-2">4자리 숫자 비밀번호를 변경합니다</p>
                </div>
              </div>
            </Link>
          </div>

          {/* 관리자 전용 - HR 관리 시스템 */}
          {['manager', 'owner'].includes(user?.role || '') && (
            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ HR 관리 시스템 (관리자)</h2>
              <Link
                href="/employee-hr/admin/dashboard"
                className="block p-8 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl hover:shadow-lg transition-all border-2 border-indigo-200"
              >
                <div className="flex items-center">
                  <div className="text-6xl mr-6">💼</div>
                  <div>
                    <h3 className="text-2xl font-bold text-indigo-900 mb-2">HR 관리 대시보드</h3>
                    <p className="text-indigo-700 text-lg">직원 근무 확인 · 월급 계산 · 명세서 발행 · 세무사 보고</p>
                    <div className="flex gap-4 mt-3">
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium">
                        📅 근무 현황
                      </span>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                        🧮 급여 계산
                      </span>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                        📄 명세서 발행
                      </span>
                      <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                        📊 세무사 보고
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* HR 시스템 섹션 */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">💼 근무 관리</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 근무 캘린더 */}
              <Link
                href="/employee-hr/work-calendar"
                className="block p-8 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl hover:shadow-lg transition-all border border-teal-200"
              >
                <div className="flex items-center">
                  <div className="text-5xl mr-4">📅</div>
                  <div>
                    <h3 className="text-xl font-bold text-teal-900">근무 기록</h3>
                    <p className="text-teal-700 mt-2">근무 시간 입력 및 관리</p>
                    <p className="text-sm text-teal-600 mt-1">예상 급여 실시간 확인</p>
                  </div>
                </div>
              </Link>

              {/* 급여 명세 */}
              <Link
                href="/employee-hr/payroll"
                className="block p-8 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl hover:shadow-lg transition-all border border-purple-200"
              >
                <div className="flex items-center">
                  <div className="text-5xl mr-4">💰</div>
                  <div>
                    <h3 className="text-xl font-bold text-purple-900">급여 명세서</h3>
                    <p className="text-purple-700 mt-2">월별 급여 내역 조회</p>
                    <p className="text-sm text-purple-600 mt-1">지급·공제 내역 확인</p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-800 mb-2">사용 안내</h3>
            <div className="text-xs text-blue-600 space-y-1">
              <div>• 물품 구매 시 반드시 사진을 첨부해주세요</div>
              <div>• 정확한 금액을 입력해주세요</div>
              <div>• 승인 완료 후 물품을 수령하세요</div>
              {user?.role !== 'staff' && (
                <div>• secretary는 Family 요청을 승인할 수 있습니다</div>
              )}
              {user?.role === 'owner' && (
                <div>• master는 모든 요청을 승인하고 통계를 확인할 수 있습니다</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 