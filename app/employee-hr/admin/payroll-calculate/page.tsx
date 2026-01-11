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
  position: string;
  employment_type: string;
  base_salary: number;
  hourly_rate: number;
}

interface PayrollCalculation {
  employee_id: string;
  employee_name: string;
  base_salary: number;
  overtime_pay: number;
  night_shift_pay: number;
  holiday_pay: number;
  meal_allowance: number;
  gross_pay: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  income_tax: number;
  local_tax: number;
  net_pay: number;
  work_days: number;
  work_hours: number;
  overtime_hours: number;
  night_hours: number;
}

export default function PayrollCalculatePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadEmployees();
    }
  }, [user]);

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

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employee-purchase/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Load employees error:', error);
    }
  };

  const calculateAllPayrolls = async () => {
    if (!selectedMonth) {
      toast.error('월을 선택해주세요');
      return;
    }

    setCalculating(true);
    const results: PayrollCalculation[] = [];

    try {
      for (const employee of employees) {
        const [year, month] = selectedMonth.split('-');
        const startDate = `${selectedMonth}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0)
          .toISOString().split('T')[0];

        const response = await fetch('/api/payroll-2026/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: employee.id,
            pay_period_start: startDate,
            pay_period_end: endDate,
            payment_date: endDate,
            salary_type: employee.base_salary > 0 ? 'monthly' : 'hourly',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const payrollData = data.data;
          results.push({
            employee_id: employee.id,
            employee_name: employee.name,
            base_salary: payrollData.base_salary || 0,
            overtime_pay: payrollData.overtime_pay || 0,
            night_shift_pay: payrollData.night_shift_pay || 0,
            holiday_pay: payrollData.holiday_pay || 0,
            meal_allowance: payrollData.meal_allowance || 0,
            gross_pay: payrollData.gross_pay || 0,
            national_pension: payrollData.national_pension || 0,
            health_insurance: payrollData.health_insurance || 0,
            long_term_care: payrollData.long_term_care || 0,
            employment_insurance: payrollData.employment_insurance || 0,
            income_tax: payrollData.income_tax || 0,
            local_tax: payrollData.resident_tax || 0,
            net_pay: payrollData.net_pay || 0,
            work_days: payrollData.total_work_days || 0,
            work_hours: payrollData.total_work_hours || 0,
            overtime_hours: payrollData.total_overtime_hours || 0,
            night_hours: payrollData.total_night_hours || 0,
          });
        }
      }

      setCalculations(results);
      toast.success('급여 계산이 완료되었습니다');
    } catch (error) {
      console.error('Calculate payroll error:', error);
      toast.error('급여 계산 중 오류가 발생했습니다');
    } finally {
      setCalculating(false);
    }
  };

  const issuePayroll = async (calculation: PayrollCalculation) => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0)
        .toISOString().split('T')[0];

      const response = await fetch('/api/hr/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: calculation.employee_id,
          pay_period_start: startDate,
          pay_period_end: endDate,
          payment_date: endDate,
          base_salary: calculation.base_salary,
          overtime_pay: calculation.overtime_pay,
          night_shift_pay: calculation.night_shift_pay,
          holiday_pay: calculation.holiday_pay,
          meal_allowance: calculation.meal_allowance || 200000,
          bonus: 0,
          gross_pay: calculation.gross_pay,
          national_pension: calculation.national_pension,
          health_insurance: calculation.health_insurance,
          long_term_care: calculation.long_term_care,
          employment_insurance: calculation.employment_insurance,
          income_tax: calculation.income_tax,
          local_tax: calculation.local_tax,
          net_pay: calculation.net_pay,
          status: 'pending',
        }),
      });

      if (response.ok) {
        toast.success(`${calculation.employee_name}님의 급여 명세서가 생성되었습니다`);
      } else {
        const data = await response.json();
        toast.error(data.error || '급여 명세서 생성 실패');
      }
    } catch (error) {
      console.error('Issue payroll error:', error);
      toast.error('급여 명세서 생성 중 오류가 발생했습니다');
    }
  };

  const issueAllPayrolls = async () => {
    for (const calc of calculations) {
      await issuePayroll(calc);
      await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 지연
    }
    toast.success('모든 급여 명세서가 생성되었습니다');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const totalGrossPay = calculations.reduce((sum, c) => sum + c.gross_pay, 0);
  const totalNetPay = calculations.reduce((sum, c) => sum + c.net_pay, 0);
  const totalDeductions = totalGrossPay - totalNetPay;

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
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">🧮 월급 계산</h1>
              <p className="text-sm opacity-90 mt-1">급여 자동 계산 및 정산</p>
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

      <div className="max-w-7xl mx-auto p-6">
        {/* 계산 설정 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">⚙️ 급여 계산 설정</h2>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-2xl">ℹ️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">자동 계산 내용</h3>
                <div className="mt-2 text-sm text-blue-700 space-y-1">
                  <div>✅ <strong>계약 내용</strong>: 각 직원의 기본급, 시급, 수당 배율</div>
                  <div>✅ <strong>근무 현황</strong>: 해당 월의 출근, 연장근무, 야간근무, 휴일근무</div>
                  <div>✅ <strong>자동 계산</strong>: 4대보험, 소득세, 지방소득세, 실수령액</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정산 월 선택
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                선택한 월의 근무 기록과 계약 내용을 바탕으로 계산합니다
              </p>
            </div>
            <div className="flex items-end">
              <button
                onClick={calculateAllPayrolls}
                disabled={calculating}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {calculating ? (
                  <>
                    <svg className="inline animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    계산 중... ({employees.length}명)
                  </>
                ) : (
                  `💰 전체 급여 계산 (${employees.length}명)`
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 계산 결과 요약 */}
        {calculations.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">📊 계산 결과 요약</h2>
              <button
                onClick={issueAllPayrolls}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
              >
                일괄 명세서 발행
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">총 지급액</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalGrossPay)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">총 공제액</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(totalDeductions)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">총 실지급액</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalNetPay)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 개별 계산 결과 */}
        {calculations.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      직원명
                      <div className="text-[10px] font-normal text-gray-400 mt-1">계약정보</div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      근무현황
                      <div className="text-[10px] font-normal text-gray-400 mt-1">일수/시간</div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      기본급
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      수당
                      <div className="text-[10px] font-normal text-gray-400 mt-1">연장+야간+휴일</div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      총 지급액
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      공제액
                      <div className="text-[10px] font-normal text-gray-400 mt-1">4대보험+세금</div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      실지급액
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculations.map((calc) => {
                    const allowances = calc.overtime_pay + calc.night_shift_pay + calc.holiday_pay + (calc.meal_allowance || 0);
                    const deductions = calc.gross_pay - calc.net_pay;
                    const employee = employees.find(e => e.id === calc.employee_id);
                    
                    return (
                      <tr key={calc.employee_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{calc.employee_name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {employee?.employment_type === 'part_time' ? '시급제' : '월급제'}
                            {employee?.position && ` · ${employee.position}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="font-medium">{calc.work_days || 0}일 근무</div>
                          <div className="text-xs text-gray-500">
                            총 {(calc.work_hours || 0).toFixed(1)}h
                            {calc.overtime_hours > 0 && ` | 연장 ${calc.overtime_hours.toFixed(1)}h`}
                            {calc.night_hours > 0 && ` | 야간 ${calc.night_hours.toFixed(1)}h`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          <div className="font-medium">{formatCurrency(calc.base_salary || 0)}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right">
                          <div className="font-medium">{formatCurrency(allowances)}</div>
                          {(calc.overtime_pay > 0 || calc.night_shift_pay > 0 || calc.holiday_pay > 0) && (
                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                              {calc.overtime_pay > 0 && <div>연장: {formatCurrency(calc.overtime_pay)}</div>}
                              {calc.night_shift_pay > 0 && <div>야간: {formatCurrency(calc.night_shift_pay)}</div>}
                              {calc.holiday_pay > 0 && <div>휴일: {formatCurrency(calc.holiday_pay)}</div>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-blue-600">
                          {formatCurrency(calc.gross_pay || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-red-600">
                          -{formatCurrency(deductions)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-base font-bold text-right text-green-600">
                          {formatCurrency(calc.net_pay || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => issuePayroll(calc)}
                            className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
                          >
                            발행
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {calculations.length === 0 && !calculating && (
          <div className="bg-white rounded-lg shadow p-12">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🧮</div>
              <p className="text-gray-600 text-lg mb-2">월을 선택하고 계산 버튼을 눌러주세요</p>
              <p className="text-sm text-gray-500">전체 직원의 급여가 자동으로 계산됩니다</p>
            </div>

            <div className="border-t pt-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4">💡 계산 프로세스</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-3xl mb-2">📋</div>
                  <h4 className="font-semibold text-blue-900 mb-2">1. 계약 내용 조회</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• 기본급 / 시급</li>
                    <li>• 수당 배율 (1.5x, 2x)</li>
                    <li>• 비과세 항목</li>
                  </ul>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-3xl mb-2">📅</div>
                  <h4 className="font-semibold text-green-900 mb-2">2. 근무 현황 집계</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• 총 근무일수 / 시간</li>
                    <li>• 연장근무 시간</li>
                    <li>• 야간 / 휴일 근무</li>
                  </ul>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-3xl mb-2">💰</div>
                  <h4 className="font-semibold text-purple-900 mb-2">3. 자동 계산</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• 각종 수당 합산</li>
                    <li>• 4대보험 공제</li>
                    <li>• 소득세 + 지방소득세</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
