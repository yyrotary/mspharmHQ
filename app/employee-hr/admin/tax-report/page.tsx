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

interface TaxReport {
  month: string;
  employees: Array<{
    name: string;
    resident_number: string;
    gross_pay: number;
    non_taxable: number;
    taxable: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    income_tax: number;
    local_tax: number;
  }>;
  totals: {
    gross_pay: number;
    non_taxable: number;
    taxable: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    income_tax: number;
    local_tax: number;
  };
}

export default function TaxReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [report, setReport] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // 세무사 이메일 설정
  const [accountantEmail, setAccountantEmail] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadSettings();
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

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/hr/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setAccountantEmail(data.settings?.accountant_email || '');
      }
    } catch (error) {
      console.error('Load settings error:', error);
    }
  };

  const saveAccountantEmail = async () => {
    if (!accountantEmail) {
      toast.error('이메일 주소를 입력해주세요');
      return;
    }

    setSavingEmail(true);
    try {
      const response = await fetch('/api/hr/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountant_email: accountantEmail }),
      });

      if (response.ok) {
        toast.success('세무사 이메일이 저장되었습니다');
        setEditingEmail(false);
      } else {
        const error = await response.json();
        toast.error(error.error || '저장 실패');
      }
    } catch (error) {
      console.error('Save email error:', error);
      toast.error('저장 중 오류가 발생했습니다');
    } finally {
      setSavingEmail(false);
    }
  };

  const generateReport = async () => {
    if (!selectedMonth) {
      toast.error('월을 선택해주세요');
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch('/api/hr/admin/tax-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth }),
      });

      if (response.ok) {
        const data = await response.json();
        setReport(data.report);
        
        if (data.report.employees.length === 0) {
          toast('확정된 급여가 없습니다', { icon: 'ℹ️' });
        } else {
          toast.success(`급여대장이 생성되었습니다 (${data.report.employees.length}명)`);
        }
      } else {
        toast.error('급여대장 생성 실패');
      }
    } catch (error) {
      console.error('Generate report error:', error);
      toast.error('급여대장 생성 중 오류가 발생했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const exportToExcel = () => {
    if (!report) return;

    // CSV 형식으로 변환
    let csv = '이름,주민등록번호,총지급액,비과세,과세,국민연금,건강보험,장기요양,고용보험,소득세,지방소득세\n';
    
    report.employees.forEach(emp => {
      csv += `${emp.name},${emp.resident_number},${emp.gross_pay},${emp.non_taxable},${emp.taxable},`;
      csv += `${emp.national_pension},${emp.health_insurance},${emp.long_term_care},${emp.employment_insurance},`;
      csv += `${emp.income_tax},${emp.local_tax}\n`;
    });

    csv += `\n합계,,${report.totals.gross_pay},${report.totals.non_taxable},${report.totals.taxable},`;
    csv += `${report.totals.national_pension},${report.totals.health_insurance},${report.totals.long_term_care},`;
    csv += `${report.totals.employment_insurance},${report.totals.income_tax},${report.totals.local_tax}\n`;

    // 다운로드
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `급여대장_${selectedMonth}.csv`;
    link.click();
    
    toast.success('급여대장이 다운로드되었습니다');
  };

  const sendToAccountant = async () => {
    if (!report) {
      toast.error('먼저 급여대장을 생성해주세요');
      return;
    }

    if (!accountantEmail) {
      toast.error('세무사 이메일을 먼저 설정해주세요');
      setEditingEmail(true);
      return;
    }

    if (!confirm(`세무사 (${accountantEmail})에게 급여대장을 전송하시겠습니까?\n\n대상: ${report.employees.length}명\n총 지급액: ${formatCurrency(report.totals.gross_pay)}원`)) {
      return;
    }

    const sendingToast = toast('이메일 전송 중...', { icon: '📧' });

    try {
      const response = await fetch('/api/hr/admin/send-tax-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          month: selectedMonth,
          report: report,
          recipient: accountantEmail
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.dismiss(sendingToast);
        if (result.simulation) {
          toast('개발 모드: 이메일 전송이 시뮬레이션되었습니다\n실제 배포시 환경변수를 설정해주세요', { 
            icon: '⚠️',
            duration: 5000 
          });
        } else {
          toast.success(`세무사에게 이메일이 전송되었습니다\n받는 사람: ${accountantEmail}`);
        }
      } else {
        toast.dismiss(sendingToast);
        toast.error(result.error || '전송 실패');
      }
    } catch (error) {
      console.error('Send report error:', error);
      toast.dismiss(sendingToast);
      toast.error('전송 중 오류가 발생했습니다');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
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
      <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">📊 세무사 보고</h1>
              <p className="text-sm opacity-90 mt-1">확정된 급여대장 생성 및 전송</p>
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
        {/* 세무사 이메일 설정 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">📧 세무사 이메일 설정</h2>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                세무사 이메일 주소
              </label>
              {editingEmail ? (
                <input
                  type="email"
                  value={accountantEmail}
                  onChange={(e) => setAccountantEmail(e.target.value)}
                  placeholder="accountant@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  {accountantEmail || '(설정되지 않음)'}
                </div>
              )}
            </div>
            {editingEmail ? (
              <>
                <button
                  onClick={saveAccountantEmail}
                  disabled={savingEmail}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {savingEmail ? '저장 중...' : '✓ 저장'}
                </button>
                <button
                  onClick={() => {
                    setEditingEmail(false);
                    loadSettings();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  취소
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingEmail(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                ✎ 수정
              </button>
            )}
          </div>
        </div>

        {/* 급여대장 생성 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-bold mb-4">⚙️ 급여대장 생성</h2>
          
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <div className="flex items-start">
              <span className="text-2xl mr-3">ℹ️</span>
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">확정된 급여만 포함됩니다</p>
                <p>• 선택한 월의 <strong>status='approved'</strong> 급여만 급여대장에 포함됩니다</p>
                <p>• 임시 저장(draft) 상태의 급여는 포함되지 않습니다</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정산 월
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={generateReport}
                disabled={generating}
                className="w-full px-6 py-2 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-lg hover:from-orange-700 hover:to-amber-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generating ? '생성 중...' : '📊 급여대장 생성'}
              </button>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={exportToExcel}
                disabled={!report || report.employees.length === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                📥 Excel 다운로드
              </button>
              <button
                onClick={sendToAccountant}
                disabled={!report || report.employees.length === 0 || !accountantEmail}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                📧 세무사 전송
              </button>
            </div>
          </div>
        </div>

        {/* 급여대장 미리보기 */}
        {report ? (
          report.employees.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-900 text-lg font-medium mb-2">확정된 급여가 없습니다</p>
              <p className="text-sm text-gray-600 mb-4">
                {new Date(selectedMonth).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}에 확정된 급여가 없습니다
              </p>
              <Link
                href="/employee-hr/admin/payroll-settlement"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                급여 정산하러 가기 →
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">📋 {new Date(selectedMonth).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 급여대장</h2>
                  <p className="text-sm text-gray-600 mt-1">확정된 급여: {report.employees.length}명</p>
                </div>
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  ✓ 확정 완료
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">총지급액</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">비과세</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">과세</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">국민연금</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">건강보험</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">장기요양</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">고용보험</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">소득세</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">지방소득세</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.employees.map((emp, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.gross_pay)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.non_taxable)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.taxable)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.national_pension)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.health_insurance)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.long_term_care)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.employment_insurance)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.income_tax)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(emp.local_tax)}</td>
                      </tr>
                    ))}
                    <tr className="bg-blue-50 font-bold">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">합계</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-blue-600">{formatCurrency(report.totals.gross_pay)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.non_taxable)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.taxable)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.national_pension)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.health_insurance)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.long_term_care)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.employment_insurance)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.income_tax)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">{formatCurrency(report.totals.local_tax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-gray-600 text-lg mb-2">월을 선택하고 생성 버튼을 눌러주세요</p>
            <p className="text-sm text-gray-500">확정된 급여만 세무사에게 보낼 급여대장에 포함됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
