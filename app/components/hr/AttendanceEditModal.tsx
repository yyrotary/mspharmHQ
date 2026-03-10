'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AttendanceRecord {
    id: string; // empty for new
    employee_id: string;
    work_date: string;
    check_in_time: string; // ISO or just time? Usually full ISO for DB
    check_out_time: string;
    is_holiday: boolean;
    status: string;
    notes?: string;
}

interface AttendanceEditModalProps {
    record: AttendanceRecord | null; // null means 'add new' but usually caller sets defaults
    employeeId: string;
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export default function AttendanceEditModal({
    record,
    employeeId,
    isOpen,
    onClose,
    onSave,
}: AttendanceEditModalProps) {
    const [formData, setFormData] = useState<Partial<AttendanceRecord>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && record) {
            // Parse time from ISO string if needed, or keep as is.
            // Assuming API expects full ISO or handled.
            // Let's assume UI uses DATE and TIME inputs.
            setFormData({
                ...record,
                check_in_time: record.check_in_time ? new Date(record.check_in_time).toTimeString().slice(0, 5) : '',
                check_out_time: record.check_out_time ? new Date(record.check_out_time).toTimeString().slice(0, 5) : '',
            });
        } else if (isOpen) {
            // New record default
            setFormData({
                work_date: new Date().toISOString().split('T')[0],
                check_in_time: '09:00',
                check_out_time: '18:00',
                is_holiday: false,
                status: 'present',
            });
        }
    }, [isOpen, record]);

    const handleSubmit = async () => {
        if (!formData.work_date) {
            toast.error('날짜를 선택해주세요');
            return;
        }

        setSaving(true);
        try {
            // Construct ISO strings
            const date = formData.work_date;
            const inTime = formData.check_in_time ? `${date}T${formData.check_in_time}:00` : null;
            const outTime = formData.check_out_time ? `${date}T${formData.check_out_time}:00` : null;

            const payload = {
                id: record?.id,
                employee_id: employeeId,
                work_date: date,
                check_in_time: inTime,
                check_out_time: outTime,
                is_holiday: formData.is_holiday,
                status: formData.status,
                notes: formData.notes,
                // Assuming backend handles overtime calc based on times
            };

            const response = await fetch('/api/hr/attendance/record', {
                method: 'POST', // UPSERT
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                toast.success('저장되었습니다');
                onSave();
                onClose();
            } else {
                const err = await response.json();
                toast.error(err.error || '저장 실패');
            }
        } catch (error) {
            toast.error('오류가 발생했습니다');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                    <h3 className="font-bold">{record?.id ? '근무 기록 수정' : '새 근무 기록'}</h3>
                    <button onClick={onClose} className="text-white hover:text-gray-200">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                        <input
                            type="date"
                            value={formData.work_date || ''}
                            onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">출근 시간</label>
                            <input
                                type="time"
                                value={formData.check_in_time || ''}
                                onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">퇴근 시간</label>
                            <input
                                type="time"
                                value={formData.check_out_time || ''}
                                onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                                className="w-full px-3 py-2 border rounded-md"
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.is_holiday || false}
                                onChange={(e) => setFormData({ ...formData, is_holiday: e.target.checked })}
                                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                            />
                            <span className="text-sm text-gray-700">휴일 근무</span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={false} // Overtime Auto Check?
                                // Simple toggle for now, usually derived from times
                                readOnly
                                disabled
                                className="rounded text-gray-400 h-4 w-4"
                            />
                            <span className="text-sm text-gray-400">연장 자동계산</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
                        <select
                            value={formData.status || 'present'}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            className="w-full px-3 py-2 border rounded-md"
                        >
                            <option value="present">정상 근무 (출근)</option>
                            <option value="late">지각</option>
                            <option value="early_leave">조퇴</option>
                            <option value="vacation">휴가 (연차)</option>
                            <option value="absent">결근</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={2}
                            className="w-full px-3 py-2 border rounded-md"
                        />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장하기'}
                    </button>
                </div>
            </div>
        </div>
    );
}
