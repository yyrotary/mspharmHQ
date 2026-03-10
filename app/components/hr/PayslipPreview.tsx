'use client';

import { useState } from 'react';

// Interfaces
interface PayrollData {
    employee?: {
        name: string;
        position: string;
    };
    employee_name?: string; // Fallback
    pay_period_start: string;
    pay_period_end: string;
    payment_date: string;
    base_salary: number;
    overtime_pay: number;
    night_shift_pay: number;
    holiday_pay: number;
    bonus: number;
    allowances: number; // variablePay.fixed_overtime
    special_allowance: number; // Alternative field name
    meal_allowance: number;
    gross_pay: number;
    national_pension: number;
    health_insurance: number;
    long_term_care: number;
    employment_insurance: number;
    income_tax: number;
    resident_tax: number;
    local_tax?: number; // Alternative field name
    net_pay: number;
    notes?: string;
    salary_type?: string;
    net_target?: number;
    gross_calculated?: number;
    minimum_wage_check?: boolean;
    total_work_days?: number;
    total_work_hours?: number;
    total_overtime_hours?: number;
    total_night_hours?: number;
    meta?: any;
}

interface AttendanceRecord {
    work_date: string;
    check_in_time?: string;
    check_out_time?: string;
    work_hours: number;
    overtime_hours: number;
    night_hours: number;
    status: string;
}

interface PayslipPreviewProps {
    data: PayrollData;
    attendanceRecords?: AttendanceRecord[];
    onClose: () => void;
    onConfirm?: () => void;
    onRevert?: () => void; // Added for 'Revert to Draft' capability
    isConfirming?: boolean;
    mode?: 'preview' | 'view'; // Contextual mode
}

export default function PayslipPreview({
    data,
    attendanceRecords,
    onClose,
    onConfirm,
    onRevert,
    isConfirming = false,
    mode = 'preview'
}: PayslipPreviewProps) {
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: 'KRW',
        }).format(amount || 0);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ko-KR');
    };

    // Normalize field names
    const localTax = data.resident_tax || data.local_tax || 0;
    const fixedOT = data.allowances || data.special_allowance || 0;

    // Display Logic
    const displayMonthlySalary = data.base_salary + fixedOT + (data.meal_allowance || 0);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto print:relative print:bg-white print:block">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8 flex flex-col max-h-[90vh] print:max-w-full print:shadow-none print:max-h-none">

                {/* Header */}
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center rounded-t-lg print:border-b-2 print:border-gray-300">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">📄 급여 명세서</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {data.pay_period_start} ~ {data.pay_period_end}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 print:hidden text-2xl">✕</button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto flex-1 print:p-0 print:overflow-visible">

                    {/* Employee & Date Info */}
                    <div className="flex justify-between items-start mb-8 bg-gray-50 p-4 rounded-lg print:bg-white print:border">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">성명 / 직급</p>
                            <h3 className="text-lg font-bold text-gray-900">
                                {data.employee?.name || data.employee_name}
                                <span className="ml-2 text-sm font-normal text-gray-600">{data.employee?.position}</span>
                            </h3>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-500 mb-1">지급일</p>
                            <p className="text-lg font-bold text-gray-900">{formatDate(data.payment_date)}</p>
                        </div>
                    </div>

                    {/* Alerts */}
                    {data.salary_type === 'net' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 print:hidden">
                            <h3 className="font-semibold text-yellow-900 text-sm">💡 Net 계약 역산 적용됨</h3>
                        </div>
                    )}
                    {data.minimum_wage_check === false && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 print:hidden">
                            <h3 className="font-semibold text-red-900 text-sm">⚠️ 최저임금 미달 주의</h3>
                        </div>
                    )}

                    {/* Main Content Grid */}
                    <div className="grid grid-cols-1 gap-8">

                        {/* 1. Payments Section */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b-2 border-gray-200 flex items-center">
                                💵 지급 내역 <span className="ml-auto text-xs font-normal text-gray-500">(세전)</span>
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center py-1">
                                    <span className="font-medium text-gray-700">월 급여</span>
                                    <span className="font-bold text-gray-900">{formatCurrency(displayMonthlySalary)}</span>
                                </div>
                                <p className="text-xs text-gray-400 text-right -mt-2 mb-2">(기본급 + 식대 + 고정수당 포함)</p>

                                {/* Work Stats Summary */}
                                <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-900 mb-3 grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="block text-xs opacity-70">총 근무일</span>
                                        <span className="font-bold">{data.total_work_days || 0}일</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs opacity-70">총 연장시간 (OT)</span>
                                        <span className="font-bold">{(data.total_overtime_hours || 0) + (data.total_night_hours || 0)}h</span>
                                    </div>
                                </div>

                                {data.overtime_pay > 0 && (
                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 pb-2">
                                        <span className="text-gray-600">연장수당</span>
                                        <div className="text-right">
                                            <span className="block font-medium">{formatCurrency(data.overtime_pay)}</span>
                                            {data.meta && (
                                                <span className="text-xs text-gray-400 block">
                                                    {data.total_overtime_hours?.toFixed(1)}h × {formatCurrency(data.meta.overtime_rate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {data.night_shift_pay > 0 && (
                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 pb-2">
                                        <span className="text-gray-600">야간수당</span>
                                        <div className="text-right">
                                            <span className="block font-medium">{formatCurrency(data.night_shift_pay)}</span>
                                            {data.meta && (
                                                <span className="text-xs text-gray-400 block">
                                                    {data.total_night_hours?.toFixed(1)}h × {formatCurrency(data.meta.night_shift_rate)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {data.holiday_pay > 0 && (
                                    <div className="flex justify-between items-center py-1 border-b border-gray-100 pb-2">
                                        <span className="text-gray-600">휴일수당</span>
                                        <div className="text-right">
                                            <span className="block font-medium">{formatCurrency(data.holiday_pay)}</span>
                                        </div>
                                    </div>
                                )}

                                {data.bonus > 0 && (
                                    <div className="flex justify-between items-center py-1 text-blue-600">
                                        <span>🎁 특별상여금</span>
                                        <span className="font-bold">{formatCurrency(data.bonus)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between pt-3 border-t-2 border-gray-100 font-bold text-lg mt-2">
                                    <span>지급 총액 (세전)</span>
                                    <span className="text-blue-600">{formatCurrency(data.gross_pay)}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Deductions Section */}
                        <div>
                            <h3 className="text-base font-bold text-gray-900 mb-3 pb-2 border-b-2 border-gray-200">
                                ✂️ 공제 내역
                            </h3>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">국민연금</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(data.national_pension)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">건강보험</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(data.health_insurance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">장기요양</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(data.long_term_care)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">고용보험</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(data.employment_insurance)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">소득세</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(data.income_tax)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-600">지방소득세</span>
                                    <span className="font-medium text-gray-800">-{formatCurrency(localTax)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between pt-3 border-t border-gray-100 font-medium text-red-600 mt-3">
                                <span>공제 총액</span>
                                <span>-{formatCurrency(data.gross_pay - data.net_pay)}</span>
                            </div>
                        </div>

                        {/* Net Pay Highlight */}
                        <div className="bg-gray-100 rounded-xl p-5 flex justify-between items-center border border-gray-200">
                            <span className="font-bold text-gray-800 text-lg">실 수령액 (NET)</span>
                            <span className="font-extrabold text-2xl text-green-700">{formatCurrency(data.net_pay)}</span>
                        </div>

                        {/* Collapsible Attendance Table */}
                        {attendanceRecords && attendanceRecords.length > 0 && (
                            <div className="border rounded-md overflow-hidden mt-4 print:mt-8">
                                <button
                                    onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                                    className="w-full px-4 py-3 bg-gray-50 text-left text-sm font-bold text-gray-700 hover:bg-gray-100 flex justify-between items-center border-b"
                                >
                                    <span>📅 상세 근무 내역 (일자별)</span>
                                    <span className="text-xs text-gray-500 bg-white border px-2 py-1 rounded">
                                        {isDetailsOpen ? '접기 ▲' : '펼치기 ▼'}
                                    </span>
                                </button>
                                {isDetailsOpen && (
                                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                                        <table className="min-w-full text-xs text-gray-600">
                                            <thead className="bg-gray-100 sticky top-0 z-10">
                                                <tr>
                                                    <th className="px-3 py-2 text-left bg-gray-100">날짜</th>
                                                    <th className="px-3 py-2 text-center bg-gray-100">시간</th>
                                                    <th className="px-3 py-2 text-center bg-gray-100">근무</th>
                                                    <th className="px-3 py-2 text-center bg-gray-100">연장</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {attendanceRecords.map((rec, i) => (
                                                    <tr key={i} className={`hover:bg-gray-50 ${rec.status !== 'present' ? 'bg-red-50' : ''}`}>
                                                        <td className="px-3 py-2 font-medium">{rec.work_date.slice(5)}</td>
                                                        <td className="px-3 py-2 text-center text-gray-500">
                                                            {rec.check_in_time ? rec.check_in_time.slice(11, 16) : '-'} ~ {rec.check_out_time ? rec.check_out_time.slice(11, 16) : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-center">{rec.work_hours}h</td>
                                                        <td className="px-3 py-2 text-center font-bold text-blue-600">
                                                            {(rec.overtime_hours + (rec.night_hours || 0)) > 0 ? (rec.overtime_hours + (rec.night_hours || 0)).toFixed(1) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {data.notes && (
                            <div className="bg-yellow-50 p-4 rounded-lg text-sm text-yellow-800 mt-2">
                                <span className="font-bold mr-1 block mb-1">📝 메모</span>
                                {data.notes}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end space-x-2 print:hidden">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-md text-sm font-medium"
                    >
                        닫기
                    </button>

                    {/* View Mode Actions */}
                    {mode === 'view' && onRevert && (
                        <button
                            onClick={onRevert}
                            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm font-medium"
                        >
                            ↩️ 임시로 되돌리기
                        </button>
                    )}

                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 text-sm font-medium"
                    >
                        🖨️ 출력
                    </button>

                    {/* Preview Mode Actions */}
                    {mode === 'preview' && onConfirm && (
                        <button
                            onClick={onConfirm}
                            disabled={isConfirming}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-bold shadow-sm disabled:opacity-50"
                        >
                            {isConfirming ? '처리 중...' : '명세서 확정 및 발행'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
