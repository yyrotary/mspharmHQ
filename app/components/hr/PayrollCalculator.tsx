'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import PayslipPreview from './PayslipPreview';

interface PayrollCalculatorProps {
    employeeId: string;
    employee?: { name: string; position: string };
    month: string;
    onAttendanceRequest: () => void;
    onSuccess: () => void;
}

interface PayrollCalculation {
    employee_id: string;
    base_salary: number;
    overtime_pay: number;
    night_shift_pay: number;
    holiday_pay: number;
    bonus: number;
    special_allowance: number; // variablePay.fixed_overtime
    meal_allowance: number;
    gross_pay: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    income_tax: number;
    resident_tax: number;
    net_pay: number; // 실수령액
    salary_type?: string;
    net_target?: number;
    gross_calculated?: number;
    minimum_wage_check?: boolean;
    minimum_wage_month?: number;
    total_work_days?: number;
    total_work_hours?: number;
    total_overtime_hours?: number;
    total_night_hours?: number;
    meta?: any;
    // Extra checks
    employee?: {
        name: string;
        position: string;
    };
    pay_period_start: string;
    pay_period_end: string;
    payment_date: string;
    notes?: string;
    status: string;
}

export default function PayrollCalculator({
    employeeId,
    employee,
    attendanceRecords,
    month,
    onAttendanceRequest,
    onSuccess,
}: PayrollCalculatorProps) {
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [confirming, setConfirming] = useState(false);

    // Input State
    const [variablePay, setVariablePay] = useState({
        fixed_overtime: '',
        bonus: '',
        notes: '',
    });

    // Results State
    const [calculation, setCalculation] = useState<PayrollCalculation | null>(null);
    const [payrollStatus, setPayrollStatus] = useState<string>('none'); // none, draft, approved

    // Preview Modal State
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (employeeId && month) {
            loadExistingPayroll();
        }
    }, [employeeId, month]);

    const loadExistingPayroll = async () => {
        setLoading(true);
        setCalculation(null);
        setVariablePay({ fixed_overtime: '', bonus: '', notes: '' });

        try {
            const [year, monthStr] = month.split('-');
            const startDate = `${month}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthStr), 0).toISOString().split('T')[0];

            const response = await fetch(
                `/api/payroll-2026/get?employee_id=${employeeId}&pay_period_start=${startDate}&pay_period_end=${endDate}`
            );

            if (response.ok) {
                const result = await response.json();
                if (result.exists && result.data) {
                    const data = result.data;
                    setPayrollStatus(data.status);

                    setVariablePay({
                        fixed_overtime: (data.allowances || 0).toString(),
                        bonus: (data.bonus || 0).toString(),
                        notes: data.notes || '',
                    });

                    // Map to PayrollCalculation
                    setCalculation({
                        ...data,
                        special_allowance: data.allowances,
                        local_tax: data.resident_tax,
                        employee: employee || { name: data.employee_name || '직원', position: '직원' }
                    });
                } else {
                    setPayrollStatus('none');
                }
            }
        } catch (error) {
            console.error('Load payroll error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCalculate = async () => {
        setCalculating(true);
        try {
            const [year, monthStr] = month.split('-');
            const startDate = `${month}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthStr), 0).toISOString().split('T')[0];

            const response = await fetch('/api/payroll-2026/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employeeId,
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
                const data = await response.json();
                const result = data.data;

                setCalculation({
                    ...result,
                    employee: employee || { name: result.employee_name || '직원', position: '직원' },
                    special_allowance: result.allowances,
                    notes: variablePay.notes,
                });
                setPayrollStatus('draft'); // Calculated means draft available
                toast.success('계산 완료 (미리보기로 확인하세요)');
            } else {
                toast.error('계산 실패');
            }
        } catch (error) {
            console.error(error);
            toast.error('계산 중 오류 발생');
        } finally {
            setCalculating(false);
        }
    };

    const handleConfirm = async () => {
        if (!calculation) return;
        setConfirming(true);

        try {
            const [year, monthStr] = month.split('-');
            const startDate = `${month}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthStr), 0).toISOString().split('T')[0];

            const response = await fetch('/api/payroll-2026/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employeeId,
                    pay_period_start: startDate,
                    pay_period_end: endDate,
                    payment_date: endDate,
                    bonus: parseFloat(variablePay.bonus) || 0,
                    special_allowance: parseFloat(variablePay.fixed_overtime) || 0,
                    status: 'approved', // FINAL
                    notes: variablePay.notes,
                }),
            });

            if (response.ok) {
                toast.success('급여가 확정되었습니다');
                setPayrollStatus('approved');
                setShowPreview(false);
                onSuccess();
            } else {
                toast.error('확정 실패');
            }
        } catch (error) {
            toast.error('확정 중 오류 발생');
        } finally {
            setConfirming(false);
        }
    };

    const handleRevert = async () => {
        if (!confirm('확정된 급여를 임시 저장 상태로 되돌리시겠습니까?\n(발행된 명세서는 취소됩니다)')) return;

        setLoading(true); // Revert processing
        try {
            const [year, monthStr] = month.split('-');
            const startDate = `${month}-01`;
            const endDate = new Date(parseInt(year), parseInt(monthStr), 0).toISOString().split('T')[0];

            const response = await fetch('/api/payroll-2026/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: employeeId,
                    pay_period_start: startDate,
                    pay_period_end: endDate,
                    status: 'draft', // Update status back to draft
                    bonus: parseFloat(variablePay.bonus) || 0,
                    special_allowance: parseFloat(variablePay.fixed_overtime) || 0,
                    notes: variablePay.notes,
                }),
            });

            if (response.ok) {
                toast.success('임시 저장 상태로 변경되었습니다');
                setPayrollStatus('draft');
            } else {
                toast.error('변경 실패');
            }
        } catch (error) {
            toast.error('오류 발생');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
        }).format(amount || 0);
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;

    return (
        <div className="space-y-6">
            {/* 1. Variable Pay Input */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                    1️⃣ 변동급 입력
                    <span className="text-xs font-normal text-gray-500 ml-2">(선택사항)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">고정OT / 수당 (원)</label>
                        <input
                            type="number"
                            value={variablePay.fixed_overtime}
                            onChange={(e) => setVariablePay({ ...variablePay, fixed_overtime: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="0"
                            disabled={payrollStatus === 'approved'}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">특별상여금 (원)</label>
                        <input
                            type="number"
                            value={variablePay.bonus}
                            onChange={(e) => setVariablePay({ ...variablePay, bonus: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="0"
                            disabled={payrollStatus === 'approved'}
                        />
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                    <textarea
                        value={variablePay.notes}
                        onChange={(e) => setVariablePay({ ...variablePay, notes: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                        rows={2}
                        placeholder="특이사항 입력"
                        disabled={payrollStatus === 'approved'}
                    />
                </div>
            </div>

            {/* 2. Actions */}
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-gray-800 mb-1">2️⃣ 급여 계산</h3>
                    <p className="text-sm text-gray-500">
                        근태 데이터와 위 입력값을 합산하여 계산합니다.
                    </p>
                </div>
                <div className="space-x-3">
                    <button
                        onClick={onAttendanceRequest}
                        className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        📅 근태 확인/수정
                    </button>
                    <button
                        onClick={handleCalculate}
                        disabled={calculating || payrollStatus === 'approved'}
                        className="px-6 py-2 bg-purple-600 text-white font-bold rounded-md hover:bg-purple-700 disabled:opacity-50"
                    >
                        {calculating ? '계산 중...' : '💰 계산 실행'}
                    </button>
                </div>
            </div>

            {/* 3. Result Summary */}
            {calculation && (
                <div className="bg-purple-50 rounded-lg p-6 border border-purple-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-purple-900 text-lg">📊 계산 결과 (요약)</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${payrollStatus === 'approved' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
                            }`}>
                            {payrollStatus === 'approved' ? '확정됨' : '임시 저장됨'}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white p-3 rounded shadow-sm">
                            <p className="text-xs text-gray-500">지급총액 (Gross)</p>
                            <p className="font-bold text-gray-800">{formatCurrency(calculation.gross_pay)}</p>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm">
                            <p className="text-xs text-gray-500">공제총액</p>
                            <p className="font-bold text-red-600">-{formatCurrency(calculation.gross_pay - calculation.net_pay)}</p>
                        </div>
                        <div className="bg-white p-3 rounded shadow-sm border-l-4 border-green-500">
                            <p className="text-xs text-gray-500">실수령액 (Net)</p>
                            <p className="font-bold text-green-600 text-lg">{formatCurrency(calculation.net_pay)}</p>
                        </div>
                        {calculation.minimum_wage_check === false && (
                            <div className="bg-red-50 p-3 rounded shadow-sm border border-red-200 text-red-800 text-xs flex items-center">
                                ⚠️ 최저임금 미달
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2">
                        {payrollStatus === 'approved' ? (
                            <>
                                <button
                                    onClick={handleRevert}
                                    className="px-6 py-3 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200"
                                >
                                    ↩️ 임시 상태로 되돌리기 (수정)
                                </button>
                                <button
                                    onClick={() => setShowPreview(true)}
                                    className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                                >
                                    🖨️ 명세서 보기/출력
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => setShowPreview(true)}
                                className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 shadow-md transform transition hover:-translate-y-1"
                            >
                                📄 명세서 확인 및 확정
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreview && calculation && (
                <PayslipPreview
                    data={calculation}
                    attendanceRecords={attendanceRecords}
                    onClose={() => setShowPreview(false)}
                    onConfirm={handleConfirm}
                    isConfirming={confirming}
                />
            )}
        </div>
    );
}
