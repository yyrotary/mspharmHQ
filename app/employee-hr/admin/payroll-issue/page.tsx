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

interface Employee {
  id: string;
  name: string;
  role: string;
  position: string;
}

interface Payroll {
  id: string;
  employee_id: string;
  employee: Employee;
  pay_period_start: string;
  pay_period_end: string;
  payment_date: string;
  base_salary: number;
  overtime_pay: number;
  night_shift_pay: number;
  holiday_pay: number;
  bonus: number;
  allowances: number;
  meal_allowance: number;
  gross_pay: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  income_tax: number;
  resident_tax: number;
  net_pay: number;
  status: string;
  notes: string;
  salary_type?: string;
  net_target?: number;
  gross_calculated?: number;
  minimum_wage_check?: boolean;
}

export default function PayrollIssuePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadPayrolls();
    }
  }, [selectedMonth, user]);

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
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const loadPayrolls = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const response = await fetch(`/api/hr/payroll?month=${selectedMonth}`);
      if (response.ok) {
        const data = await response.json();
        setPayrolls(data.data || []);
      }
    } catch (error) {
      console.error('Load payrolls error:', error);
      toast.error('급여 명세서를 불러오는데 실패했습니다');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount || 0);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '임시' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: '✓ 확정' },
      paid: { bg: 'bg-blue-100', text: 'text-blue-800', label: '지급완료' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: '취소' },
    };
    const badge = badges[status] || badges.draft;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const viewDetail = (payroll: Payroll) => {
    setSelectedPayroll(payroll);
    setShowDetailModal(true);
  };

  const printPayslip = () => {
    window.print();
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
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">📄 급여 명세서 관리</h1>
              <p className="text-sm opacity-90 mt-1">확정된 급여 명세서 조회 및 출력</p>
            </div>
            <Link 
              href="/employee-hr/admin/dashboard"
              className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
            >
              ← 대시보드
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 print:hidden">
        {/* 필터 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                조회 월
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">
                총 {payrolls.length}건 (확정: {payrolls.filter(p => p.status === 'approved').length}건)
              </p>
              <p className="text-lg font-bold text-gray-900">
                실지급액 합계: {formatCurrency(payrolls.reduce((sum, p) => sum + (p.net_pay || 0), 0))}
              </p>
            </div>
          </div>
        </div>

        {/* 급여 명세서 리스트 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    직원명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    직급
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    기간
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    총 지급액
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    실지급액
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-6xl mb-4">📭</div>
                      <p className="text-lg font-medium">급여 명세서가 없습니다</p>
                      <p className="text-sm mt-2">급여 정산을 먼저 진행해주세요</p>
                    </td>
                  </tr>
                ) : (
                  payrolls.map((payroll) => (
                    <tr key={payroll.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {payroll.employee?.name || '알 수 없음'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {payroll.employee?.position || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(payroll.pay_period_start)} ~ {formatDate(payroll.pay_period_end)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                        {formatCurrency(payroll.gross_pay)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-base text-right font-bold text-green-600">
                        {formatCurrency(payroll.net_pay)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {getStatusBadge(payroll.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => viewDetail(payroll)}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                          📄 상세보기
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 명세서 상세 모달 */}
      {showDetailModal && selectedPayroll && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:relative print:bg-white print:block">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto print:max-w-full print:shadow-none print:max-h-none">
            {/* 모달 헤더 */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white p-6 rounded-t-lg print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-300">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">급여 명세서</h2>
                  <p className="text-sm opacity-90 mt-1">
                    {new Date(selectedPayroll.pay_period_start).getFullYear()}년{' '}
                    {new Date(selectedPayroll.pay_period_start).getMonth() + 1}월
                  </p>
                </div>
                <div className="flex space-x-2 print:hidden">
                  <button
                    onClick={printPayslip}
                    className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
                  >
                    🖨️ 출력
                  </button>
                  <button
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
                  >
                    ✕ 닫기
                  </button>
                </div>
              </div>
            </div>

            {/* 명세서 본문 */}
            <div className="p-8">
              {/* 직원 정보 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">성명</p>
                    <p className="text-lg font-bold text-gray-900">{selectedPayroll.employee?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">직급</p>
                    <p className="text-lg font-medium text-gray-900">{selectedPayroll.employee?.position || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">급여 기간</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(selectedPayroll.pay_period_start)} ~ {formatDate(selectedPayroll.pay_period_end)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">지급일</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(selectedPayroll.payment_date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Net 계약 표시 */}
              {selectedPayroll.salary_type === 'net' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-yellow-900 mb-2">💡 Net 계약 역산</h3>
                  <div className="text-sm text-yellow-800 space-y-1">
                    <div>• 목표 실수령액: <strong>{formatCurrency(selectedPayroll.net_target || 0)}</strong></div>
                    <div>• 역산된 세전금액: <strong>{formatCurrency(selectedPayroll.gross_calculated || 0)}</strong></div>
                  </div>
                </div>
              )}

              {/* 최저임금 경고 */}
              {selectedPayroll.minimum_wage_check === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-red-900 mb-2">⚠️ 최저임금 미달</h3>
                  <p className="text-sm text-red-800">급여 조정이 필요합니다.</p>
                </div>
              )}

              {/* 지급 내역 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300">
                  💵 지급 내역
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2">
                    <span className="font-medium">기본급</span>
                    <span className="font-semibold">{formatCurrency(selectedPayroll.base_salary)}</span>
                  </div>
                  {selectedPayroll.overtime_pay > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span>연장수당</span>
                      <span>{formatCurrency(selectedPayroll.overtime_pay)}</span>
                    </div>
                  )}
                  {selectedPayroll.night_shift_pay > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span>야간수당</span>
                      <span>{formatCurrency(selectedPayroll.night_shift_pay)}</span>
                    </div>
                  )}
                  {selectedPayroll.holiday_pay > 0 && (
                    <div className="flex justify-between py-2 text-sm">
                      <span>휴일수당</span>
                      <span>{formatCurrency(selectedPayroll.holiday_pay)}</span>
                    </div>
                  )}
                  {selectedPayroll.allowances > 0 && (
                    <div className="flex justify-between py-2 text-sm text-orange-600">
                      <span>🕐 고정OT</span>
                      <span>{formatCurrency(selectedPayroll.allowances)}</span>
                    </div>
                  )}
                  {selectedPayroll.bonus > 0 && (
                    <div className="flex justify-between py-2 text-sm text-blue-600">
                      <span>🎁 특별상여금</span>
                      <span>{formatCurrency(selectedPayroll.bonus)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 text-sm text-gray-600">
                    <span>식대 (비과세)</span>
                    <span>{formatCurrency(selectedPayroll.meal_allowance)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-300 font-bold text-lg">
                    <span>총 지급액</span>
                    <span className="text-blue-600">{formatCurrency(selectedPayroll.gross_pay)}</span>
                  </div>
                </div>
              </div>

              {/* 공제 내역 */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-300">
                  📋 공제 내역
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 text-sm">
                    <span>국민연금</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.national_pension)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>건강보험</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.health_insurance)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>장기요양</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.long_term_care)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>고용보험</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.employment_insurance)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>소득세</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.income_tax)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>지방소득세</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.resident_tax)}</span>
                  </div>
                  <div className="flex justify-between py-3 border-t-2 border-gray-300 font-bold">
                    <span>총 공제액</span>
                    <span className="text-red-600">
                      -{formatCurrency(selectedPayroll.gross_pay - selectedPayroll.net_pay)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 실수령액 */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">실수령액</span>
                  <span className="text-3xl font-bold text-green-600">
                    {formatCurrency(selectedPayroll.net_pay)}
                  </span>
                </div>
              </div>

              {/* 메모 */}
              {selectedPayroll.notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">메모</p>
                  <p className="text-sm text-gray-900">{selectedPayroll.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
