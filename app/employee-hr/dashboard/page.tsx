'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: string;
  position?: string;
}

interface TodayAttendance {
  isCheckedIn: boolean;
  isCheckedOut: boolean;
  isWorking: boolean;
  currentWorkHours: number;
  attendance: any;
}

interface LeaveBalance {
  balances: {
    [key: string]: {
      leave_type: string;
      total_days: number;
      used_days: number;
      remaining_days: number;
    };
  };
}

export default function EmployeeHRDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<TodayAttendance | null>(null);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        await Promise.all([
          loadTodayAttendance(),
          loadLeaveBalance(),
        ]);
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const loadTodayAttendance = async () => {
    try {
      const response = await fetch('/api/hr/attendance/today');
      if (response.ok) {
        const data = await response.json();
        setTodayAttendance(data.data);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const loadLeaveBalance = async () => {
    try {
      const response = await fetch('/api/hr/leave/balance');
      if (response.ok) {
        const data = await response.json();
        setLeaveBalance(data.data);
      }
    } catch (error) {
      console.error('Error loading leave balance:', error);
    }
  };

  const handleQuickCheckIn = async () => {
    try {
      const response = await fetch('/api/hr/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('출근 체크가 완료되었습니다');
        await loadTodayAttendance();
      } else {
        const data = await response.json();
        toast.error(data.error || '출근 체크에 실패했습니다');
      }
    } catch (error) {
      toast.error('출근 체크 중 오류가 발생했습니다');
    }
  };

  const handleQuickCheckOut = async () => {
    try {
      const response = await fetch('/api/hr/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success('퇴근 체크가 완료되었습니다');
        await loadTodayAttendance();
      } else {
        const data = await response.json();
        toast.error(data.error || '퇴근 체크에 실패했습니다');
      }
    } catch (error) {
      toast.error('퇴근 체크 중 오류가 발생했습니다');
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
        {/* 헤더 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">HR 대시보드</h1>
              <p className="text-gray-600 mt-1">
                {user?.name}님 ({user?.position || user?.role})
              </p>
            </div>
            <Link
              href="/employee-purchase"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              메인으로
            </Link>
          </div>
        </div>

        {/* 빠른 출퇴근 체크 */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 shadow rounded-lg p-6 mb-6 text-white">
          <h2 className="text-xl font-semibold mb-4">오늘의 근무</h2>
          
          {todayAttendance && todayAttendance.isWorking && (
            <div className="mb-4 p-4 bg-white/20 rounded-lg">
              <p className="text-sm mb-1">현재 근무 시간</p>
              <p className="text-3xl font-bold">{todayAttendance.currentWorkHours.toFixed(1)} 시간</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleQuickCheckIn}
              disabled={todayAttendance?.isCheckedIn}
              className={`py-4 rounded-lg font-semibold ${
                todayAttendance?.isCheckedIn
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-gray-100'
              }`}
            >
              {todayAttendance?.isCheckedIn ? '✓ 출근완료' : '출근 체크'}
            </button>
            <button
              onClick={handleQuickCheckOut}
              disabled={!todayAttendance?.isCheckedIn || todayAttendance?.isCheckedOut}
              className={`py-4 rounded-lg font-semibold ${
                !todayAttendance?.isCheckedIn || todayAttendance?.isCheckedOut
                  ? 'bg-white/20 cursor-not-allowed'
                  : 'bg-white text-purple-600 hover:bg-gray-100'
              }`}
            >
              {todayAttendance?.isCheckedOut ? '✓ 퇴근완료' : '퇴근 체크'}
            </button>
          </div>

          {todayAttendance?.attendance && (
            <div className="mt-4 text-sm">
              <p>출근 시간: {new Date(todayAttendance.attendance.check_in_time).toLocaleTimeString('ko-KR')}</p>
              {todayAttendance.attendance.check_out_time && (
                <p>퇴근 시간: {new Date(todayAttendance.attendance.check_out_time).toLocaleTimeString('ko-KR')}</p>
              )}
            </div>
          )}
        </div>

        {/* 휴가 현황 */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">휴가 잔여</h2>
          
          {leaveBalance && Object.keys(leaveBalance.balances).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(leaveBalance.balances).map(([code, balance]) => (
                <div key={code} className="p-4 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">{balance.leave_type}</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {balance.remaining_days}일
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    총 {balance.total_days}일 / 사용 {balance.used_days}일
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">휴가 정보가 없습니다</p>
          )}

          <Link
            href="/employee-hr/leave"
            className="mt-4 inline-block text-sm text-purple-600 hover:text-purple-700"
          >
            휴가 신청하기 →
          </Link>
        </div>

        {/* 메뉴 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/employee-hr/attendance" className="block">
            <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-purple-600 text-3xl mb-3">📅</div>
              <h3 className="font-semibold text-gray-900">근태 관리</h3>
              <p className="text-sm text-gray-600 mt-1">출퇴근 기록 조회</p>
            </div>
          </Link>

          <Link href="/employee-hr/leave" className="block">
            <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-green-600 text-3xl mb-3">🏖️</div>
              <h3 className="font-semibold text-gray-900">휴가 관리</h3>
              <p className="text-sm text-gray-600 mt-1">휴가 신청 및 조회</p>
            </div>
          </Link>

          <Link href="/employee-hr/payroll" className="block">
            <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="text-blue-600 text-3xl mb-3">💰</div>
              <h3 className="font-semibold text-gray-900">급여 명세서</h3>
              <p className="text-sm text-gray-600 mt-1">급여 내역 조회</p>
            </div>
          </Link>

          {['manager', 'owner'].includes(user?.role || '') && (
            <Link href="/hr-admin/dashboard" className="block">
              <div className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow border-2 border-purple-200">
                <div className="text-purple-600 text-3xl mb-3">⚙️</div>
                <h3 className="font-semibold text-gray-900">관리자 페이지</h3>
                <p className="text-sm text-gray-600 mt-1">HR 관리 기능</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
