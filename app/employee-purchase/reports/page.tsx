'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

interface Statistics {
  totalRequests: number;
  totalAmount: number;
  pendingRequests: number;
  approvedRequests: number;
  cancelledRequests: number;
  monthlyStats: {
    month: string;
    requests: number;
    amount: number;
  }[];
  employeeStats: {
    employeeName: string;
    requests: number;
    amount: number;
  }[];
}

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user.role !== 'owner') {
          toast.error('접근 권한이 없습니다. master만 접근 가능합니다.');
          router.push('/employee-purchase');
          return;
        }
        setUser(data.user);
        await loadStatistics();
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(`/api/employee-purchase/statistics?period=${selectedPeriod}`);
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Statistics API error:', errorData);
        toast.error(`통계 데이터를 불러오는데 실패했습니다: ${errorData.error || 'Unknown error'}`);
        
        // 기본값 설정
        setStatistics({
          totalRequests: 0,
          totalAmount: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          cancelledRequests: 0,
          monthlyStats: [],
          employeeStats: [],
        });
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('네트워크 오류가 발생했습니다');
      
      // 기본값 설정
      setStatistics({
        totalRequests: 0,
        totalAmount: 0,
        pendingRequests: 0,
        approvedRequests: 0,
        cancelledRequests: 0,
        monthlyStats: [],
        employeeStats: [],
      });
    }
  };

  useEffect(() => {
    if (user) {
      loadStatistics();
    }
  }, [selectedPeriod]);

  const formatAmount = (amount: number) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">통계 및 리포트</h1>
            <div className="flex items-center space-x-4">
              <Link
                href="/employee-purchase"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                대시보드로
              </Link>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              <span className="font-semibold">{user?.name}</span>님 (master)
            </p>
            <p className="text-sm text-gray-500">
              전체 구매 요청 현황을 확인할 수 있습니다.
            </p>
          </div>

          {/* 기간 선택 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              조회 기간
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="all">전체 기간</option>
              <option value="thisMonth">이번 달</option>
              <option value="lastMonth">지난 달</option>
              <option value="last3Months">최근 3개월</option>
              <option value="thisYear">올해</option>
            </select>
          </div>

          {statistics ? (
            <>
              {/* 전체 통계 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="text-sm font-medium text-blue-800">총 요청 수</h3>
                  <p className="text-2xl font-bold text-blue-900">{statistics.totalRequests}건</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h3 className="text-sm font-medium text-green-800">총 금액</h3>
                  <p className="text-2xl font-bold text-green-900">{formatAmount(statistics.totalAmount)}</p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h3 className="text-sm font-medium text-yellow-800">승인 대기</h3>
                  <p className="text-2xl font-bold text-yellow-900">{statistics.pendingRequests}건</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                  <h3 className="text-sm font-medium text-emerald-800">승인 완료</h3>
                  <p className="text-2xl font-bold text-emerald-900">{statistics.approvedRequests}건</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <h3 className="text-sm font-medium text-red-800">거부/취소</h3>
                  <p className="text-2xl font-bold text-red-900">{statistics.cancelledRequests}건</p>
                </div>
              </div>

              {/* 월별 통계 */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 현황</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  {statistics.monthlyStats.length > 0 ? (
                    <div className="space-y-3">
                      {statistics.monthlyStats.map((stat, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded border">
                          <span className="font-medium text-gray-900">{stat.month}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{stat.requests}건</div>
                            <div className="font-semibold text-gray-900">{formatAmount(stat.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      해당 기간에 데이터가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 직원별 통계 */}
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Family별 현황</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  {statistics.employeeStats.length > 0 ? (
                    <div className="space-y-3">
                      {statistics.employeeStats.map((stat, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-white rounded border">
                          <span className="font-medium text-gray-900">{stat.employeeName}</span>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">{stat.requests}건</div>
                            <div className="font-semibold text-gray-900">{formatAmount(stat.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      해당 기간에 데이터가 없습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* 승인률 */}
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <h3 className="text-sm font-medium text-purple-800 mb-2">승인률</h3>
                <div className="flex items-center">
                  <div className="flex-1 bg-purple-200 rounded-full h-4 mr-4">
                    <div 
                      className="bg-purple-600 h-4 rounded-full" 
                      style={{ 
                        width: `${statistics.totalRequests > 0 ? (statistics.approvedRequests / statistics.totalRequests) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                  <span className="text-purple-900 font-semibold">
                    {statistics.totalRequests > 0 ? Math.round((statistics.approvedRequests / statistics.totalRequests) * 100) : 0}%
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              통계 데이터를 불러오는 중...
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 