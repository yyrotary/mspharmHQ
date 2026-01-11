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

interface Payroll {
  id: string;
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
}

export default function PayrollPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
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
        await loadPayrolls();
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
      const response = await fetch('/api/hr/payroll');
      if (response.ok) {
        const data = await response.json();
        setPayrolls(data.data || []);
      }
    } catch (error) {
      console.error('Load payrolls error:', error);
      toast.error('급여 명세를 불러오는데 실패했습니다');
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

  const getPeriodLabel = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
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
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 print:hidden">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">📄 내 급여 명세서</h1>
              <p className="text-sm opacity-90 mt-1">월별 급여 내역을 확인하세요</p>
            </div>
            <Link 
              href="/employee-purchase"
              className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
            >
              ← 메인
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-8">
        {!selectedPayroll ? (
          /* 명세서 목록 */
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6 print:hidden">
              <h2 className="text-lg font-bold text-gray-900 mb-4">💼 {user?.name}님의 급여 명세서</h2>
              <p className="text-sm text-gray-600 mb-4">
                확정된 명세서만 표시됩니다. 총 {payrolls.filter(p => p.status === 'approved').length}건
              </p>
            </div>

            <div className="space-y-4 print:hidden">
              {payrolls.filter(p => p.status === 'approved').length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                  <div className="text-6xl mb-4">📭</div>
                  <p className="text-lg font-medium text-gray-900">아직 발행된 급여 명세서가 없습니다</p>
                  <p className="text-sm text-gray-600 mt-2">관리자가 급여를 확정하면 여기서 확인할 수 있습니다</p>
                </div>
              ) : (
                payrolls
                  .filter(p => p.status === 'approved')
                  .map((payroll) => (
                    <div
                      key={payroll.id}
                      onClick={() => setSelectedPayroll(payroll)}
                      className="bg-white rounded-lg shadow hover:shadow-lg transition-all cursor-pointer p-6"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <span className="text-2xl">📅</span>
                            <h3 className="text-xl font-bold text-gray-900">
                              {getPeriodLabel(payroll.pay_period_start, payroll.pay_period_end)}
                            </h3>
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              ✓ 확정
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">지급일</p>
                              <p className="font-medium text-gray-900">{formatDate(payroll.payment_date)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">총 지급액</p>
                              <p className="font-medium text-blue-600">{formatCurrency(payroll.gross_pay)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-1">실수령액</p>
                          <p className="text-3xl font-bold text-green-600">{formatCurrency(payroll.net_pay)}</p>
                          <button className="mt-3 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors">
                            상세보기 →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        ) : (
          /* 명세서 상세 */
          <div className="bg-white rounded-lg shadow-lg print:shadow-none">
            {/* 헤더 */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-lg print:bg-white print:text-gray-900 print:border-b-2 print:border-gray-300">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">급여 명세서</h2>
                  <p className="text-sm opacity-90 mt-1">
                    {getPeriodLabel(selectedPayroll.pay_period_start, selectedPayroll.pay_period_end)}
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
                    onClick={() => setSelectedPayroll(null)}
                    className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
                  >
                    ← 목록
                  </button>
                </div>
              </div>
            </div>

            {/* 본문 */}
            <div className="p-8">
              {/* 기본 정보 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">성명</p>
                    <p className="text-lg font-bold text-gray-900">{user?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">지급일</p>
                    <p className="text-lg font-medium text-gray-900">
                      {formatDate(selectedPayroll.payment_date)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-600">급여 기간</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(selectedPayroll.pay_period_start)} ~ {formatDate(selectedPayroll.pay_period_end)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Net 계약 표시 */}
              {selectedPayroll.salary_type === 'net' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 print:border-2">
                  <h3 className="font-semibold text-yellow-900 mb-2">💡 Net 계약</h3>
                  <div className="text-sm text-yellow-800 space-y-1">
                    <div>• 목표 실수령액: <strong>{formatCurrency(selectedPayroll.net_target || 0)}</strong></div>
                    <div>• 역산된 세전금액: <strong>{formatCurrency(selectedPayroll.gross_calculated || 0)}</strong></div>
                  </div>
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
                    <span>국민연금 (4.5%)</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.national_pension)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>건강보험 (3.545%)</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.health_insurance)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>장기요양 (12.95%)</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.long_term_care)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>고용보험 (0.9%)</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.employment_insurance)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>소득세</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayroll.income_tax)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-sm">
                    <span>지방소득세 (소득세의 10%)</span>
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
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">실수령액</span>
                  <span className="text-4xl font-bold text-green-600">
                    {formatCurrency(selectedPayroll.net_pay)}
                  </span>
                </div>
              </div>

              {/* 안내사항 */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 print:border-2">
                <p className="text-xs text-blue-800">
                  ※ 본 급여 명세서는 근로기준법에 따라 발행되었습니다.
                </p>
                <p className="text-xs text-blue-800 mt-1">
                  ※ 문의사항이 있으시면 관리자에게 연락해주세요.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
