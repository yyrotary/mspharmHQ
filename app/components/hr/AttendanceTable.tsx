'use client';

import { useState } from 'react';

interface AttendanceRecord {
    id: string;
    employee_id: string;
    employee_name: string;
    work_date: string;
    check_in_time: string;
    check_out_time: string;
    work_hours: number;
    overtime_hours: number;
    night_hours: number;
    is_holiday: boolean;
    status: string;
}

interface AttendanceTableProps {
    records: AttendanceRecord[];
    loading: boolean;
    onEdit: (record: AttendanceRecord) => void;
    onDelete: (id: string, name: string, date: string) => void;
    onDeleteSelected: (ids: string[]) => void;
    showEmployeeColumn?: boolean;
}

export default function AttendanceTable({
    records,
    loading,
    onEdit,
    onDelete,
    onDeleteSelected,
    showEmployeeColumn = false,
}: AttendanceTableProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sortConfig, setSortConfig] = useState<{ key: keyof AttendanceRecord; direction: 'asc' | 'desc' }>({
        key: 'work_date',
        direction: 'desc',
    });

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === records.length && records.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(records.map(r => r.id)));
        }
    };

    const handleSort = (key: keyof AttendanceRecord) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedRecords = [...records].sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            weekday: 'short',
        });
    };

    const formatTime = (timeStr: string) => {
        if (!timeStr) return '-';
        return new Date(timeStr).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            present: { bg: 'bg-green-100', text: 'text-green-800', label: '출근' },
            late: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '지각' },
            absent: { bg: 'bg-red-100', text: 'text-red-800', label: '결근' },
            vacation: { bg: 'bg-blue-100', text: 'text-blue-800', label: '휴가' },
        };
        const badge = badges[status] || badges.present;
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                {badge.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            {/* Batch Actions */}
            {selectedIds.size > 0 && (
                <div className="p-2 bg-purple-50 flex justify-between items-center px-4">
                    <span className="text-sm font-medium text-purple-900">{selectedIds.size}개 선택됨</span>
                    <button
                        onClick={() => {
                            onDeleteSelected(Array.from(selectedIds));
                            setSelectedIds(new Set());
                        }}
                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                        선택 삭제
                    </button>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <input
                                    type="checkbox"
                                    checked={records.length > 0 && selectedIds.size === records.length}
                                    onChange={toggleSelectAll}
                                    className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                                />
                            </th>
                            <th
                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                onClick={() => handleSort('work_date')}
                            >
                                날짜 {sortConfig.key === 'work_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            {showEmployeeColumn && (
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => handleSort('employee_name')}
                                >
                                    직원
                                </th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                시간
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                근무
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                연장/야간
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                상태
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                관리
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={showEmployeeColumn ? 8 : 7} className="px-6 py-12 text-center text-gray-500">
                                    근무 기록이 없습니다
                                </td>
                            </tr>
                        ) : (
                            sortedRecords.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(record.id)}
                                            onChange={() => toggleSelect(record.id)}
                                            className="rounded text-purple-600 focus:ring-purple-500 h-4 w-4"
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        {formatDate(record.work_date)}
                                        {record.is_holiday && <span className="ml-2 text-xs text-blue-600">🏖️</span>}
                                    </td>
                                    {showEmployeeColumn && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {record.employee_name}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                        {formatTime(record.check_in_time)} - {formatTime(record.check_out_time)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                                        {record.work_hours?.toFixed(1)}h
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {record.overtime_hours > 0 && (
                                            <span className="text-orange-600 mr-2">연장 {record.overtime_hours.toFixed(1)}h</span>
                                        )}
                                        {record.night_hours > 0 && (
                                            <span className="text-purple-600">야간 {record.night_hours.toFixed(1)}h</span>
                                        )}
                                        {record.overtime_hours === 0 && record.night_hours === 0 && '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        {getStatusBadge(record.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => onEdit(record)}
                                            className="text-teal-600 hover:text-teal-900 mr-3"
                                        >
                                            수정
                                        </button>
                                        <button
                                            onClick={() => onDelete(record.id, record.employee_name, record.work_date)}
                                            className="text-red-600 hover:text-red-900"
                                        >
                                            삭제
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
