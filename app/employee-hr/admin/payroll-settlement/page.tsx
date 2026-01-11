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
  salary_type?: string;
  base_salary?: number;
  hourly_rate?: number;
  fixed_overtime_pay?: number;
  payroll_status?: 'none' | 'draft' | 'confirmed' | 'approved';
}

interface AttendanceSummary {
  work_days: number;
  work_hours: number;
  overtime_hours: number;
  night_hours: number;
  holiday_hours: number;
}

interface PayrollCalculation {
  employee_id: string;
  base_salary: number;
  overtime_pay: number;
  night_shift_pay: number;
  holiday_pay: number;
  weekly_holiday_pay?: number;
  bonus: number;
  special_allowance: number;
  meal_allowance: number;
  gross_pay: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  income_tax: number;
  local_tax: number;
  net_pay: number;
  salary_type?: string;
  net_target?: number;
  gross_calculated?: number;
  minimum_wage_check?: boolean;
  minimum_wage_month?: number;
  total_work_hours?: number;
}

export default function PayrollSettlementPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Step 1: 근태 확정
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false);
  
  // Step 2: 변동급 입력
  const [variablePay, setVariablePay] = useState({
    fixed_overtime: '',  // 고정OT (special_allowance로 전송)
    bonus: '',           // 특별상여금
    notes: '',
  });
  
  // Step 3: 계산 결과
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadEmployees();
    }
  }, [user]);

  useEffect(() => {
    if (selectedEmployee) {
      // 초기화 (loadAttendance에서 기존 급여가 있으면 다시 설정됨)
      setCurrentStep(1);
      setAttendanceConfirmed(false);
      setVariablePay({ fixed_overtime: '', bonus: '', notes: '' });
      setCalculation(null);
      
      // 근태 및 기존 급여 조회
      loadAttendance();
    }
  }, [selectedEmployee, selectedMonth]);

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
        if (data.employees.length > 0) {
          setSelectedEmployee(data.employees[0]);
        }
      }
    } catch (error) {
      console.error('Load employees error:', error);
    }
  };

  const loadAttendance = async () => {
    if (!selectedEmployee) return;

    try {
      // 근태 조회
      const attendanceResponse = await fetch(
        `/api/hr/attendance/monthly?employee_id=${selectedEmployee.id}&month=${selectedMonth}`
      );
      
      if (attendanceResponse.ok) {
        const data = await attendanceResponse.json();
        const records = data.data?.attendance || [];
        
        const summary: AttendanceSummary = {
          work_days: records.length,
          work_hours: records.reduce((sum: number, r: any) => sum + (parseFloat(r.work_hours) || 0), 0),
          overtime_hours: records.reduce((sum: number, r: any) => sum + (parseFloat(r.overtime_hours) || 0), 0),
          night_hours: records.reduce((sum: number, r: any) => sum + (parseFloat(r.night_hours) || 0), 0),
          holiday_hours: records
            .filter((r: any) => r.is_holiday)
            .reduce((sum: number, r: any) => sum + (parseFloat(r.work_hours) || 0), 0),
        };
        
        setAttendance(summary);
      }

      // 기존 급여 조회
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0)
        .toISOString().split('T')[0];

      const payrollResponse = await fetch(
        `/api/payroll-2026/get?employee_id=${selectedEmployee.id}&pay_period_start=${startDate}&pay_period_end=${endDate}`
      );

      if (payrollResponse.ok) {
        const payrollData = await payrollResponse.json();
        if (payrollData.exists && payrollData.data) {
          const existingPayroll = payrollData.data;
          
          // 직원 상태 업데이트
          setEmployees(prev => prev.map(emp => 
            emp.id === selectedEmployee.id 
              ? { ...emp, payroll_status: existingPayroll.status }
              : emp
          ));

          // 기존 데이터로 변동급 설정
          setVariablePay({
            fixed_overtime: existingPayroll.allowances?.toString() || '',  // 고정OT
            bonus: existingPayroll.bonus?.toString() || '',                 // 특별상여금
            notes: existingPayroll.notes || '',
          });

          // 기존 계산 결과 설정
          setCalculation({
            employee_id: existingPayroll.employee_id,
            base_salary: existingPayroll.base_salary || 0,
            overtime_pay: existingPayroll.overtime_pay || 0,
            night_shift_pay: existingPayroll.night_shift_pay || 0,
            holiday_pay: existingPayroll.holiday_pay || 0,
            bonus: existingPayroll.bonus || 0,
            special_allowance: existingPayroll.allowances || 0, // allowances = 고정OT
            meal_allowance: existingPayroll.meal_allowance || 0,
            gross_pay: existingPayroll.gross_pay || 0,
            national_pension: existingPayroll.national_pension || 0,
            health_insurance: existingPayroll.health_insurance || 0,
            long_term_care: existingPayroll.long_term_care || 0,
            employment_insurance: existingPayroll.employment_insurance || 0,
            income_tax: existingPayroll.income_tax || 0,
            local_tax: existingPayroll.resident_tax || 0,
            net_pay: existingPayroll.net_pay || 0,
            salary_type: existingPayroll.salary_type,
            net_target: existingPayroll.net_target,
            gross_calculated: existingPayroll.gross_calculated,
            minimum_wage_check: existingPayroll.minimum_wage_check,
            minimum_wage_month: existingPayroll.minimum_wage_month,
            total_work_hours: existingPayroll.total_work_hours,
          });

          // 이미 급여가 계산되어 있으므로 Step 3로 이동
          setCurrentStep(3);
          setAttendanceConfirmed(true);
          
          toast(`기존 급여 데이터를 불러왔습니다 (${existingPayroll.status === 'approved' ? '확정됨' : '임시저장'})`, {
            icon: 'ℹ️',
          });
        } else {
          // 급여 데이터 없음 - 초기화 및 직원의 고정OT 기본값 설정
          setEmployees(prev => prev.map(emp => 
            emp.id === selectedEmployee.id 
              ? { ...emp, payroll_status: 'none' }
              : emp
          ));
          
          // 직원의 고정OT를 기본값으로 설정
          setVariablePay({
            fixed_overtime: selectedEmployee.fixed_overtime_pay?.toString() || '',
            bonus: '',
            notes: '',
          });
        }
      }
    } catch (error) {
      console.error('Load attendance error:', error);
    }
  };

  const handleCalculate = async () => {
    if (!selectedEmployee) return;

    setCalculating(true);
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0)
        .toISOString().split('T')[0];

      console.log('재계산 요청:', {
        employee: selectedEmployee.name,
        bonus: variablePay.bonus,
        fixed_overtime: variablePay.fixed_overtime
      });

      const response = await fetch('/api/payroll-2026/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          pay_period_start: startDate,
          pay_period_end: endDate,
          payment_date: endDate,
          bonus: parseFloat(variablePay.bonus) || 0,              // 특별상여금
          special_allowance: parseFloat(variablePay.fixed_overtime) || 0,  // 고정OT
          status: 'draft', // 재계산 시 항상 임시 저장
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('재계산 결과:', data.data);
        
        // API 응답 필드명 매핑 (resident_tax -> local_tax, allowances -> special_allowance)
        const calculationResult = {
          ...data.data,
          local_tax: data.data.resident_tax || data.data.local_tax || 0,
          special_allowance: data.data.allowances || data.data.special_allowance || 0,
        };
        
        setCalculation(calculationResult);
        
        // 직원 상태를 draft로 업데이트
        setEmployees(prev => prev.map(emp => 
          emp.id === selectedEmployee.id 
            ? { ...emp, payroll_status: 'draft' }
            : emp
        ));
        
        toast.success('급여 계산이 완료되었습니다');
      } else {
        const errorData = await response.json();
        console.error('계산 실패:', errorData);
        toast.error('급여 계산에 실패했습니다');
      }
    } catch (error) {
      console.error('Calculate error:', error);
      toast.error('급여 계산 중 오류가 발생했습니다');
    } finally {
      setCalculating(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedEmployee || !calculation) return;

    if (!confirm(`${selectedEmployee.name}님의 급여를 확정하고 명세서를 발행하시겠습니까?`)) {
      return;
    }

    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0)
        .toISOString().split('T')[0];

      // payroll-2026/calculate API를 사용하여 status='approved'로 업데이트
      const response = await fetch('/api/payroll-2026/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          pay_period_start: startDate,
          pay_period_end: endDate,
          payment_date: endDate,
          bonus: parseFloat(variablePay.bonus) || 0,              // 특별상여금
          special_allowance: parseFloat(variablePay.fixed_overtime) || 0,  // 고정OT
          status: 'approved',
          notes: variablePay.notes,
        }),
      });

      if (response.ok) {
        toast.success('급여가 확정되고 명세서가 발행되었습니다');
        
        // 직원 상태 업데이트
        setEmployees(prev => prev.map(emp => 
          emp.id === selectedEmployee.id 
            ? { ...emp, payroll_status: 'approved' }
            : emp
        ));
        
        // 다음 직원으로 이동
        const currentIndex = employees.findIndex(e => e.id === selectedEmployee.id);
        if (currentIndex < employees.length - 1) {
          setSelectedEmployee(employees[currentIndex + 1]);
        }
      } else {
        toast.error('급여 확정에 실패했습니다');
      }
    } catch (error) {
      console.error('Finalize error:', error);
      toast.error('급여 확정 중 오류가 발생했습니다');
    }
  };

  const handleRevertToDraft = async () => {
    if (!selectedEmployee || !calculation) return;

    if (!confirm(`${selectedEmployee.name}님의 확정된 급여를 임시 상태로 되돌리시겠습니까?\n(명세서 발행이 취소됩니다)`)) {
      return;
    }

    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${selectedMonth}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0)
        .toISOString().split('T')[0];

      // status를 'draft'로 변경
      const response = await fetch('/api/payroll-2026/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selectedEmployee.id,
          pay_period_start: startDate,
          pay_period_end: endDate,
          payment_date: endDate,
          bonus: parseFloat(variablePay.bonus) || 0,
          special_allowance: parseFloat(variablePay.fixed_overtime) || 0,
          status: 'draft',
          notes: variablePay.notes,
        }),
      });

      if (response.ok) {
        toast.success('급여가 임시 상태로 되돌려졌습니다');
        
        // 직원 상태 업데이트
        setEmployees(prev => prev.map(emp => 
          emp.id === selectedEmployee.id 
            ? { ...emp, payroll_status: 'draft' }
            : emp
        ));
        
        // Step 2로 이동 (수정 가능하도록)
        setCurrentStep(2);
      } else {
        toast.error('임시 상태로 되돌리기에 실패했습니다');
      }
    } catch (error) {
      console.error('Revert error:', error);
      toast.error('임시 상태로 되돌리는 중 오류가 발생했습니다');
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">💼 월 급여 정산 및 확정</h1>
              <p className="text-sm opacity-90 mt-1">단계별 정산 프로세스</p>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-4 py-2 rounded-lg text-gray-900 font-medium"
              />
              <Link 
                href="/employee-hr/admin/dashboard"
                className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
              >
                ← 대시보드
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-12 gap-6">
          {/* 좌측: 직원 리스트 */}
          <div className="col-span-3">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="font-bold text-gray-900">직원 명단</h2>
                <p className="text-xs text-gray-600 mt-1">{employees.length}명</p>
              </div>
              <div className="divide-y max-h-[calc(100vh-300px)] overflow-y-auto">
                {employees.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedEmployee?.id === employee.id ? 'bg-purple-50 border-l-4 border-purple-600' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{employee.name}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {employee.position || '직원'}
                          {employee.employment_type === 'part_time' && ' · 시급제'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-1">
                        {employee.payroll_status === 'approved' && (
                          <>
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                              ✓ 확정
                            </span>
                            <a
                              href={`/employee-hr/admin/payroll-issue`}
                              target="_blank"
                              className="text-xs text-blue-600 hover:text-blue-800 underline"
                            >
                              📄 명세서
                            </a>
                          </>
                        )}
                        {employee.payroll_status === 'draft' && (
                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                            임시
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 우측: 상세 정산 */}
          <div className="col-span-9">
            {selectedEmployee ? (
              <div className="space-y-6">
                {/* 진행 단계 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    {[1, 2, 3, 4].map((step) => (
                      <div key={step} className="flex items-center">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold ${
                          currentStep >= step ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
                        }`}>
                          {step}
                        </div>
                        {step < 4 && (
                          <div className={`w-20 h-1 mx-2 ${
                            currentStep > step ? 'bg-purple-600' : 'bg-gray-200'
                          }`}></div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-gray-600">근태 확정</span>
                    <span className="text-xs text-gray-600">변동급 입력</span>
                    <span className="text-xs text-gray-600">자동 계산</span>
                    <span className="text-xs text-gray-600">확정 발송</span>
                  </div>
                </div>

                {/* Step 1: 근태 확정 */}
                {currentStep === 1 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-bold">📅 Step 1: 근태 확정</h2>
                        <p className="text-sm text-gray-600 mt-1">
                          시스템이 집계한 {selectedEmployee.name}님의 근무 내역을 확인하세요
                        </p>
                      </div>
                      {selectedEmployee.payroll_status === 'approved' && (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          ✓ 이미 확정된 급여 (수정 가능)
                        </span>
                      )}
                      {selectedEmployee.payroll_status === 'draft' && (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                          임시 저장된 급여
                        </span>
                      )}
                    </div>

                    {attendance && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div className="bg-blue-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">근무 일수</p>
                          <p className="text-2xl font-bold text-blue-600">{attendance.work_days}일</p>
                        </div>
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">총 근무시간</p>
                          <p className="text-2xl font-bold text-green-600">{attendance.work_hours.toFixed(1)}h</p>
                        </div>
                        <div className="bg-orange-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">연장근무</p>
                          <p className="text-2xl font-bold text-orange-600">{attendance.overtime_hours.toFixed(1)}h</p>
                        </div>
                        <div className="bg-purple-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">야간근무</p>
                          <p className="text-2xl font-bold text-purple-600">{attendance.night_hours.toFixed(1)}h</p>
                        </div>
                        <div className="bg-pink-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600 mb-1">휴일근무</p>
                          <p className="text-2xl font-bold text-pink-600">{attendance.holiday_hours.toFixed(1)}h</p>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setAttendanceConfirmed(true);
                          setCurrentStep(2);
                        }}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                      >
                        근태 확정 → 다음 단계
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: 변동급 입력 */}
                {currentStep === 2 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">💰 Step 2: 변동급 입력</h2>
                    <p className="text-sm text-gray-600 mb-6">
                      이번 달 지급할 고정OT 또는 특별상여금이 있다면 입력하세요 (선택사항)
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          🕐 고정OT (원)
                          {selectedEmployee?.fixed_overtime_pay && (
                            <span className="ml-2 text-xs text-blue-600">
                              (기본값: {formatCurrency(selectedEmployee.fixed_overtime_pay)})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          value={variablePay.fixed_overtime}
                          onChange={(e) => setVariablePay({ ...variablePay, fixed_overtime: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          포괄임금제 고정 연장수당 (멤버 관리에서 설정된 값이 자동으로 입력됩니다)
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          🎁 특별상여금 (원)
                        </label>
                        <input
                          type="number"
                          value={variablePay.bonus}
                          onChange={(e) => setVariablePay({ ...variablePay, bonus: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">명절상여, 성과급 등</p>
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        메모 (선택)
                      </label>
                      <textarea
                        value={variablePay.notes}
                        onChange={(e) => setVariablePay({ ...variablePay, notes: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        rows={3}
                        placeholder="특이사항이 있다면 입력하세요"
                      />
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                      >
                        ← 이전
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                      >
                        다음 → 자동 계산
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: 자동 계산 */}
                {currentStep === 3 && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-bold">🧮 Step 3: 자동 계산</h2>
                      {selectedEmployee?.payroll_status === 'approved' && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                          ✓ 이미 확정된 급여
                        </span>
                      )}
                    </div>
                    
                    {!calculation ? (
                      <div>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                          <div className="flex items-start">
                            <span className="text-2xl mr-3">ℹ️</span>
                            <div>
                              <h3 className="text-sm font-medium text-blue-800 mb-2">계약 타입별 계산 방식</h3>
                              <div className="text-sm text-blue-700 space-y-1">
                                {selectedEmployee.salary_type === 'net' && (
                                  <div>✅ <strong>Net 계약</strong>: 세후 {formatCurrency(selectedEmployee.base_salary || 0)} 고정 → 2026년 요율 역산으로 세전 자동 산출</div>
                                )}
                                {selectedEmployee.employment_type === 'part_time' && (
                                  <div>✅ <strong>시급제</strong>: 근무시간 × 시급({formatCurrency(selectedEmployee.hourly_rate || 0)}) + 4대보험 자동 공제</div>
                                )}
                                {!selectedEmployee.salary_type && selectedEmployee.employment_type !== 'part_time' && (
                                  <div>✅ <strong>월급제</strong>: 기본급 + 각종 수당 + 4대보험/세금 자동 계산</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between">
                          <button
                            onClick={() => setCurrentStep(2)}
                            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                          >
                            ← 이전
                          </button>
                          <button
                            onClick={handleCalculate}
                            disabled={calculating}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50"
                          >
                            {calculating ? '계산 중...' : '💰 급여 자동 계산'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* 계산 결과 표시 */}
                        <div className="space-y-6 mb-6">
                          {/* 최저임금 경고 */}
                          {calculation.minimum_wage_check === false && (
                            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                              <h3 className="font-semibold text-red-900 mb-2 flex items-center">
                                <span className="text-2xl mr-2">⚠️</span>
                                최저임금 미달 경고
                              </h3>
                              <div className="text-sm text-red-800 space-y-1">
                                <div>• 2026년 최저 월급: <strong>{formatCurrency(calculation.minimum_wage_month || 2156880)}</strong></div>
                                <div>• 근무 시간: <strong>{(calculation.total_work_hours || 0).toFixed(1)}h</strong></div>
                                <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-900">
                                  <strong>주의:</strong> 현재 급여가 2026년 최저임금에 미달합니다. 급여 조정이 필요합니다.
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Net 계약 표시 */}
                          {calculation.salary_type === 'net' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                              <h3 className="font-semibold text-yellow-900 mb-2">💡 Net 계약 역산 결과</h3>
                              <div className="text-sm text-yellow-800 space-y-1">
                                <div>• 목표 실수령액 (Net): <strong>{formatCurrency(calculation.net_target || 0)}</strong></div>
                                <div>• 역산된 세전금액 (Gross): <strong>{formatCurrency(calculation.gross_calculated || 0)}</strong></div>
                                <div className="text-xs mt-2 text-yellow-700">2026년 4대보험 및 소득세율 적용</div>
                              </div>
                            </div>
                          )}

                          {/* 지급 내역 */}
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-3">💵 지급 내역</h3>
                            <div className="bg-green-50 rounded-lg p-4 space-y-2">
                              <div className="flex justify-between">
                                <span>
                                  기본급
                                  {selectedEmployee.employment_type === 'part_time' && calculation.total_work_hours > 0 && (
                                    <span className="text-xs text-gray-600 ml-1">
                                      ({calculation.total_work_hours.toFixed(1)}h × {formatCurrency(selectedEmployee.hourly_rate || 0)})
                                    </span>
                                  )}
                                </span>
                                <span className="font-semibold">{formatCurrency(calculation.base_salary)}</span>
                              </div>
                              {calculation.overtime_pay > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>연장수당</span>
                                  <span>{formatCurrency(calculation.overtime_pay)}</span>
                                </div>
                              )}
                              {calculation.night_shift_pay > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>야간수당</span>
                                  <span>{formatCurrency(calculation.night_shift_pay)}</span>
                                </div>
                              )}
                              {calculation.holiday_pay > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>휴일수당</span>
                                  <span>{formatCurrency(calculation.holiday_pay)}</span>
                                </div>
                              )}
                              {calculation.weekly_holiday_pay && calculation.weekly_holiday_pay > 0 && (
                                <div className="flex justify-between text-sm text-blue-600">
                                  <span>🎉 주휴 수당</span>
                                  <span>{formatCurrency(calculation.weekly_holiday_pay)}</span>
                                </div>
                              )}
                              {calculation.special_allowance > 0 && (
                                <div className="flex justify-between text-sm text-orange-600">
                                  <span>🕐 고정OT</span>
                                  <span>{formatCurrency(calculation.special_allowance)}</span>
                                </div>
                              )}
                              {calculation.bonus > 0 && (
                                <div className="flex justify-between text-sm text-blue-600">
                                  <span>🎁 특별상여금</span>
                                  <span>{formatCurrency(calculation.bonus)}</span>
                                </div>
                              )}
                              <div className="flex justify-between pt-2 border-t border-green-200 font-bold text-lg">
                                <span>총 지급액</span>
                                <span>{formatCurrency(calculation.gross_pay)}</span>
                              </div>
                            </div>
                          </div>

                          {/* 공제 내역 */}
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-3">📋 공제 내역</h3>
                            <div className="bg-red-50 rounded-lg p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>국민연금</span>
                                <span className="text-red-600">-{formatCurrency(calculation.national_pension)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>건강보험</span>
                                <span className="text-red-600">-{formatCurrency(calculation.health_insurance)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>장기요양</span>
                                <span className="text-red-600">-{formatCurrency(calculation.long_term_care)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>고용보험</span>
                                <span className="text-red-600">-{formatCurrency(calculation.employment_insurance)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>소득세</span>
                                <span className="text-red-600">-{formatCurrency(calculation.income_tax)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>지방소득세</span>
                                <span className="text-red-600">-{formatCurrency(calculation.local_tax)}</span>
                              </div>
                              <div className="flex justify-between pt-2 border-t border-red-200 font-bold">
                                <span>총 공제액</span>
                                <span className="text-red-600">
                                  -{formatCurrency(calculation.gross_pay - calculation.net_pay)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 실수령액 */}
                          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
                            <div className="flex justify-between items-center">
                              <span className="text-xl font-bold text-gray-900">실수령액</span>
                              <span className="text-3xl font-bold text-purple-600">
                                {formatCurrency(calculation.net_pay)}
                              </span>
                            </div>
                          </div>
                        </div>

                          <div className="flex justify-between">
                            <div className="space-x-3">
                              <button
                                onClick={() => {
                                  setCalculation(null);
                                  setCurrentStep(2);
                                }}
                                className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                              >
                                ← 변동급 수정
                              </button>
                              <button
                                onClick={handleCalculate}
                                disabled={calculating}
                                className="px-6 py-3 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium transition-colors disabled:opacity-50"
                              >
                                {calculating ? '계산 중...' : '🔄 재계산'}
                              </button>
                              {selectedEmployee?.payroll_status === 'approved' && (
                                <button
                                  onClick={handleRevertToDraft}
                                  className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 font-medium transition-colors"
                                >
                                  ⚠️ 임시로 되돌리기
                                </button>
                              )}
                            </div>
                            <button
                              onClick={() => setCurrentStep(4)}
                              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors"
                            >
                              {selectedEmployee?.payroll_status === 'approved' ? '확인 완료 → 재확정' : '확인 완료 → 최종 확정'}
                            </button>
                          </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: 확정 및 발송 */}
                {currentStep === 4 && calculation && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="text-xl font-bold mb-4">✅ Step 4: 급여 확정 및 명세서 발송</h2>
                    
                    <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
                      <h3 className="font-semibold text-green-900 mb-2">최종 확인</h3>
                      <div className="text-sm text-green-800 space-y-1">
                        <div>• 직원: <strong>{selectedEmployee.name}</strong></div>
                        <div>• 기간: <strong>{selectedMonth}</strong></div>
                        <div>• 실수령액: <strong>{formatCurrency(calculation.net_pay)}</strong></div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <h3 className="font-semibold text-blue-900 mb-2">ℹ️ 안내사항</h3>
                      <div className="text-sm text-blue-800 space-y-1">
                        {selectedEmployee?.payroll_status === 'approved' ? (
                          <>
                            <div>• 현재 <strong>확정된 급여</strong>입니다</div>
                            <div>• 수정이 필요한 경우 <strong>"⚠️ 임시로 되돌리기"</strong> 버튼을 클릭하세요</div>
                            <div>• 임시로 되돌린 후 수정하고 다시 확정할 수 있습니다</div>
                          </>
                        ) : (
                          <>
                            <div>• 급여 명세서가 자동으로 생성됩니다</div>
                            <div>• 직원은 즉시 명세서를 확인할 수 있습니다</div>
                            <div>• 확정 후에도 수정이 필요한 경우 임시로 되돌려 수정할 수 있습니다</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => setCurrentStep(3)}
                          className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                        >
                          ← 이전
                        </button>
                        {selectedEmployee?.payroll_status === 'approved' && (
                          <button
                            onClick={handleRevertToDraft}
                            className="px-6 py-3 border-2 border-orange-500 text-orange-600 rounded-lg hover:bg-orange-50 font-medium transition-colors"
                          >
                            ⚠️ 임시로 되돌리기
                          </button>
                        )}
                      </div>
                      <button
                        onClick={handleFinalize}
                        className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-bold text-lg transition-all shadow-lg"
                      >
                        {selectedEmployee?.payroll_status === 'approved' ? '🔄 재확정' : '🎯 급여 확정 및 명세서 발송'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">👈</div>
                <p className="text-gray-600">좌측에서 직원을 선택해주세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
