'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import PayslipPreview from '@/app/components/hr/PayslipPreview';

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
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadPayrolls();
    }
  }, [selectedMonth, user]);

  // checkAuth and loadPayrolls ... (keep same)
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
    // ... keep existing badge logic
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

  const handleRevert = async () => {
    if (!selectedPayroll) return;
    if (!confirm('확정된 급여를 임시 저장 상태로 되돌리시겠습니까?')) return;

    setReverting(true);
    try {
      const response = await fetch('/api/payroll-2026/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedPayroll.employee_id,
          pay_period_start: selectedPayroll.pay_period_start,
          pay_period_end: selectedPayroll.pay_period_end,
          status: 'draft',
          // Needs to resend numeric fields to avoid nulling them if backend isn't smart
          // Ideally backend handles partial update, but our calculate API is full rewrite usually.
          // We should pass the existing values back.
          bonus: selectedPayroll.bonus,
          special_allowance: selectedPayroll.allowances,
          notes: selectedPayroll.notes
        }),
      });

      if (response.ok) {
        toast.success('임시 저장 상태로 변경되었습니다');
        setShowDetailModal(false);
        loadPayrolls(); // Refresh list
      } else {
        toast.error('변경 실패');
      }
    } catch (e) {
      toast.error('오류 발생');
    } finally {
      setReverting(false);
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

      {/* 명세서 상세 모달 via Shared Component */}
      {showDetailModal && selectedPayroll && (
        <PayslipPreview
          data={{
            ...selectedPayroll,
            employee_name: selectedPayroll.employee.name, // Mapping fallback
            special_allowance: selectedPayroll.allowances // Mapping fallback
          }}
          mode="view"
          onClose={() => setShowDetailModal(false)}
          onRevert={handleRevert}
        // Note: We are NOT passing attendanceRecords here yet because
        // this page's list API doesn't load them.
        // If user wants them here, we'd need to fetch them on modal open.
        // For now, let's keep it consistent in design, even if table is empty.
        />
      )}
    </div>
  );
}
