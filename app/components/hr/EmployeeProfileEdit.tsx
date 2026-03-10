'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface EmployeeProfileEditProps {
    employeeId: string;
}

export default function EmployeeProfileEdit({ employeeId }: EmployeeProfileEditProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        base_salary: '',
        hourly_rate: '',
        contract_date: '',
        salary_type: 'gross', // gross or net
    });

    useEffect(() => {
        if (employeeId) loadProfile();
    }, [employeeId]);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/employee-purchase/employees/${employeeId}`);
            if (response.ok) {
                const data = await response.json();
                const emp = data.employee;
                setFormData({
                    base_salary: emp.base_salary || '',
                    hourly_rate: emp.hourly_rate || '',
                    contract_date: emp.start_date || '', // Assuming start_date is contract date
                    salary_type: emp.salary_type || 'gross',
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/employee-purchase/employees/${employeeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_salary: formData.base_salary ? parseFloat(formData.base_salary) : null,
                    hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
                    start_date: formData.contract_date,
                    salary_type: formData.salary_type,
                    // Partial update supported? Assuming yes or we need to send all.
                    // Re-using the prompt implies we just need a quick edit.
                })
            });

            if (response.ok) {
                toast.success('저장되었습니다');
            } else {
                toast.error('저장 실패');
            }
        } catch (e) {
            toast.error('오류 발생');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !formData.base_salary) return <div>Loading...</div>;

    return (
        <div className="bg-white rounded-lg p-6 max-w-2xl border border-gray-200 shadow-sm">
            <h3 className="font-bold text-lg mb-4 text-gray-800">👤 기본 급여 및 계약 정보 수정</h3>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">계약 형태</label>
                        <select
                            value={formData.salary_type}
                            onChange={(e) => setFormData({ ...formData, salary_type: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            <option value="gross">Gross (세전 계약)</option>
                            <option value="net">Net (세후 계약)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">입사일 (계약시작일)</label>
                        <input
                            type="date"
                            value={formData.contract_date}
                            onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">월 기본급 (포괄임금)</label>
                        <input
                            type="number"
                            value={formData.base_salary}
                            onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="월급제인 경우 입력"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">시급 (파트타임)</label>
                        <input
                            type="number"
                            value={formData.hourly_rate}
                            onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="시급제인 경우 입력"
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                        {loading ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
