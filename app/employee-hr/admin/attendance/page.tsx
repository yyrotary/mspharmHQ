'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import "react-datepicker/dist/react-datepicker.css";
import DatePicker, { registerLocale } from "react-datepicker";
import { ko } from 'date-fns/locale';
registerLocale('ko', ko);

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
}

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

interface AttendanceFormData {
  employee_id: string;
  work_date: string;
  check_in_hour: string;
  check_in_minute: string;
  check_out_hour: string;
  check_out_minute: string;
  is_holiday: boolean;
  is_overtime: boolean;
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: 'work_date' | 'employee_name', direction: 'asc' | 'desc' }>({ key: 'work_date', direction: 'desc' });

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [formData, setFormData] = useState<AttendanceFormData>({
    employee_id: '',
    work_date: new Date().toISOString().split('T')[0],
    check_in_hour: '09',
    check_in_minute: '00',
    check_out_hour: '18',
    check_out_minute: '00',
    is_holiday: false,
    is_overtime: false,
  });

  // 스캔 기능 상태
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanImage, setScanImage] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<any[]>([]);

  // 일괄 등록 모달 상태
  const [showPeriodModal, setShowPeriodModal] = useState(false);


  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadEmployees();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadAttendance();
    }
  }, [selectedEmployee, selectedMonth, user]);

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

  const loadAttendance = async () => {
    try {
      const url = selectedEmployee === 'all'
        ? `/api/hr/admin/attendance-all?month=${selectedMonth}`
        : `/api/hr/attendance/monthly?employee_id=${selectedEmployee}&month=${selectedMonth}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAttendance(data.data?.attendance || []);
      }
    } catch (error) {
      console.error('Load attendance error:', error);
    }
  };

  const handleAddRecord = () => {
    setModalMode('add');
    setEditingRecord(null);
    setFormData({
      employee_id: selectedEmployee !== 'all' ? selectedEmployee : (employees[0]?.id || ''),
      work_date: new Date().toISOString().split('T')[0],
      check_in_hour: '09',
      check_in_minute: '00',
      check_out_hour: '18',
      check_out_minute: '00',
      is_holiday: false,
      is_overtime: false,
    });
    setShowModal(true);
  };

  const handleEditRecord = (record: AttendanceRecord) => {
    setModalMode('edit');
    setEditingRecord(record);

    const checkInTime = new Date(record.check_in_time);
    const checkOutTime = new Date(record.check_out_time);

    setFormData({
      employee_id: record.employee_id,
      work_date: record.work_date,
      check_in_hour: checkInTime.getHours().toString().padStart(2, '0'),
      check_in_minute: checkInTime.getMinutes().toString().padStart(2, '0'),
      check_out_hour: checkOutTime.getHours().toString().padStart(2, '0'),
      check_out_minute: checkOutTime.getMinutes().toString().padStart(2, '0'),
      is_holiday: record.is_holiday,
      is_overtime: false, // Will be calculated based on work_hours
    });
    setShowModal(true);
  };

  const handleDeleteRecord = async (recordId: string, employeeName: string, workDate: string) => {
    if (!confirm(`${employeeName}님의 ${workDate} 근무 기록을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/hr/attendance/${recordId}/delete`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('근무 기록이 삭제되었습니다');
        loadAttendance();
      } else {
        toast.error('근무 기록 삭제에 실패했습니다');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('근무 기록 삭제 중 오류가 발생했습니다');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`선택한 ${selectedIds.size}개의 근무 기록을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch('/api/hr/attendance/batch', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message);
        setSelectedIds(new Set());
        loadAttendance();
      } else {
        toast.error(result.error || '일괄 삭제 실패');
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast.error('일괄 삭제 중 오류가 발생했습니다.');
    }
  };

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
    if (selectedIds.size === attendance.length && attendance.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(attendance.map(r => r.id)));
    }
  };

  const handleSort = (key: 'work_date' | 'employee_name') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAttendance = [...attendance].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const handleSubmitModal = async () => {
    if (!formData.employee_id || !formData.work_date) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    try {
      // Timezone Fix: KST Offset (+09:00)
      const kstOffset = '+09:00';
      const checkInTime = `${formData.work_date}T${formData.check_in_hour}:${formData.check_in_minute}:00${kstOffset}`;
      const checkOutTime = `${formData.work_date}T${formData.check_out_hour}:${formData.check_out_minute}:00${kstOffset}`;

      const response = await fetch('/api/hr/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: formData.employee_id,
          work_date: formData.work_date,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          is_overtime: formData.is_overtime,
          record_id: editingRecord?.id,
        }),
      });

      if (response.ok) {
        toast.success(modalMode === 'add' ? '근무 기록이 추가되었습니다' : '근무 기록이 수정되었습니다');
        setShowModal(false);
        loadAttendance();
      } else {
        toast.error(modalMode === 'add' ? '근무 기록 추가에 실패했습니다' : '근무 기록 수정에 실패했습니다');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('근무 기록 저장 중 오류가 발생했습니다');
    }
  };

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

  // 직원별 통계 계산
  const calculateStats = () => {
    const stats: Record<string, { totalHours: number; overtime: number; night: number; days: number }> = {};

    attendance.forEach(record => {
      if (!stats[record.employee_id]) {
        stats[record.employee_id] = { totalHours: 0, overtime: 0, night: 0, days: 0 };
      }
      stats[record.employee_id].totalHours += parseFloat(record.work_hours?.toString() || '0');
      stats[record.employee_id].overtime += parseFloat(record.overtime_hours?.toString() || '0');
      stats[record.employee_id].night += parseFloat(record.night_hours?.toString() || '0');
      stats[record.employee_id].days += 1;
    });

    return stats;
  };

  const stats = calculateStats();

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
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">📅 직원 근무 현황</h1>
              <p className="text-sm opacity-90 mt-1">전체 직원의 근무 기록 확인 및 관리</p>
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
        {/* 필터 및 추가 버튼 */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                직원 선택
              </label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">전체 직원</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.position || '직원'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                조회 월
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                &nbsp;
              </label>
              <button
                onClick={handleAddRecord}
                className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors mb-2"
              >
                ➕ 근무 기록 추가
              </button>
              <button
                onClick={() => setShowScanModal(true)}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors mb-2"
              >
                📷 근무 일지 스캔
              </button>
              <button
                onClick={() => setShowPeriodModal(true)}
                className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition-colors"
              >
                🗓️ 일괄 등록 (기간)
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
                >
                  �️ 선택 삭제 ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 통계 요약 */}
        {selectedEmployee !== 'all' && Object.keys(stats).length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-bold mb-4">📊 통계 요약</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">근무 일수</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats[selectedEmployee]?.days || 0}일
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">총 근무</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats[selectedEmployee]?.totalHours.toFixed(1) || 0}h
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">연장근무</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats[selectedEmployee]?.overtime.toFixed(1) || 0}h
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">야간근무</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats[selectedEmployee]?.night.toFixed(1) || 0}h
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 근무 기록 테이블 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={attendance.length > 0 && selectedIds.size === attendance.length}
                      onChange={toggleSelectAll}
                      className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('work_date')}
                  >
                    날짜 {sortConfig.key === 'work_date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                  </th>
                  {selectedEmployee === 'all' && (
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('employee_name')}
                    >
                      직원 {sortConfig.key === 'employee_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시작
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    종료
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    야간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={selectedEmployee === 'all' ? 10 : 9} className="px-6 py-12 text-center text-gray-500">
                      근무 기록이 없습니다
                    </td>
                  </tr>
                ) : (
                  sortedAttendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(record.id)}
                          onChange={() => toggleSelect(record.id)}
                          className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {formatDate(record.work_date)}
                        {record.is_holiday && (
                          <span className="ml-2 text-xs text-blue-600">🏖️</span>
                        )}
                      </td>
                      {selectedEmployee === 'all' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {record.employee_name || '알 수 없음'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_in_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatTime(record.check_out_time)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {record.work_hours?.toFixed(1) || 0}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        {record.overtime_hours?.toFixed(1) || 0}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-purple-600">
                        {record.night_hours?.toFixed(1) || 0}h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(record.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditRecord(record)}
                          className="text-teal-600 hover:text-teal-900 mr-3"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id, record.employee_name, record.work_date)}
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
      </div>

      {/* 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === 'add' ? '➕ 근무 기록 추가' : '✏️ 근무 기록 수정'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* 직원 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  직원 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.employee_id}
                  onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                  disabled={modalMode === 'edit'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                >
                  <option value="">직원 선택</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position || '직원'})
                    </option>
                  ))}
                </select>
              </div>

              {/* 날짜 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  근무 날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.work_date}
                  onChange={(e) => setFormData({ ...formData, work_date: e.target.value })}
                  disabled={modalMode === 'edit'}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-100"
                />
              </div>

              {/* 시작 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  시작 시간 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.check_in_hour}
                    onChange={(e) => setFormData({ ...formData, check_in_hour: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.check_in_minute}
                    onChange={(e) => setFormData({ ...formData, check_in_minute: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
                      <option key={minute} value={minute.toString().padStart(2, '0')}>
                        {minute.toString().padStart(2, '0')}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 종료 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  종료 시간 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.check_out_hour}
                    onChange={(e) => setFormData({ ...formData, check_out_hour: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')}>
                        {i.toString().padStart(2, '0')}시
                      </option>
                    ))}
                  </select>
                  <select
                    value={formData.check_out_minute}
                    onChange={(e) => setFormData({ ...formData, check_out_minute: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(minute => (
                      <option key={minute} value={minute.toString().padStart(2, '0')}>
                        {minute.toString().padStart(2, '0')}분
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 추가 근무 여부 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_overtime"
                  checked={formData.is_overtime}
                  onChange={(e) => setFormData({ ...formData, is_overtime: e.target.checked })}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="is_overtime" className="ml-2 text-sm text-gray-700">
                  추가 근무 (정규직의 경우 체크, 파트타임은 미체크)
                </label>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSubmitModal}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
              >
                {modalMode === 'add' ? '추가' : '수정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 스캔 모달 */}
      {showScanModal && (
        <ScanModal
          onClose={() => setShowScanModal(false)}
          onSave={loadAttendance}
          employees={employees}
        />
      )}

      {/* 기간 일괄 등록 모달 */}
      {showPeriodModal && (
        <PeriodScheduleModal
          onClose={() => setShowPeriodModal(false)}
          onSave={loadAttendance}
          employees={employees}
        />
      )}

    </div>
  );
}

// 스캔 모달 컴포넌트
function ScanModal({ onClose, onSave, employees }: { onClose: () => void, onSave: () => void, employees: Employee[] }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scannedData, setScannedData] = useState<any[]>([]);
  const [step, setStep] = useState<'select_employee' | 'upload' | 'review'>('select_employee');
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>('');

  const handleEmployeeSelect = (empId: string) => {
    setTargetEmployeeId(empId);
    setStep('upload');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAnalyze = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('image', selectedImage);
    if (targetEmployeeId) {
      formData.append('employee_id', targetEmployeeId);
    }

    try {
      const response = await fetch('/api/hr/attendance/analyze', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || 'Analysis failed');
      }

      setScannedData(result.data.map((item: any, index: number) => ({ ...item, id: index })));
      setStep('review');
    } catch (error) {
      console.error(error);
      toast.error('이미지 분석 실패: ' + (error as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateItem = (index: number, field: string, value: string) => {
    const updated = [...scannedData];
    updated[index] = { ...updated[index], [field]: value };
    setScannedData(updated);
  };

  const handleSaveAll = async () => {
    try {
      // 순차적으로 저장 (Promise.all도 가능하지만 에러 핸들링을 위해)
      let successCount = 0;
      for (const item of scannedData) {
        if (!item.employee_id) continue;

        const checkInTime = `${item.work_date}T${item.check_in_time}:00`;
        const checkOutTime = `${item.work_date}T${item.check_out_time}:00`;

        const response = await fetch('/api/hr/attendance/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employee_id: item.employee_id,
            work_date: item.work_date,
            check_in_time: checkInTime,
            check_out_time: checkOutTime,
            is_holiday: false, // 기본값
            notes: 'AI 스캔 자동 입력'
          }),
        });

        if (response.ok) successCount++;
      }

      toast.success(`${successCount}건의 근무 기록이 저장되었습니다.`);
      onSave();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('저장 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">📷 근무 일지 스캔</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-6">
          {step === 'select_employee' && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">어떤 직원의 근무 일지인가요?</h3>
                <p className="text-sm text-gray-500">직원을 선택하면 AI 인식 정확도가 높아집니다.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {employees.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => handleEmployeeSelect(emp.id)}
                    className="p-4 border rounded-lg hover:bg-violet-50 hover:border-violet-500 transition-all text-left group"
                  >
                    <div className="font-bold text-gray-900 group-hover:text-violet-700">{emp.name}</div>
                    <div className="text-sm text-gray-500">{emp.position || '직원'}</div>
                  </button>
                ))}
                <button
                  onClick={() => handleEmployeeSelect('')}
                  className="p-4 border border-dashed rounded-lg hover:bg-gray-50 text-gray-500 text-center flex items-center justify-center"
                >
                  <span>선택 안함 (자동 인식)</span>
                </button>
              </div>
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-teal-500 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="log-image-upload"
                  capture="environment" // 모바일 카메라 연동
                />
                <label htmlFor="log-image-upload" className="cursor-pointer flex flex-col items-center">
                  <span className="text-4xl mb-4">📸</span>
                  <span className="text-lg font-medium text-gray-700">
                    사진을 찍거나 업로드하세요
                  </span>
                  <span className="text-sm text-gray-500 mt-2">
                    수기로 작성된 근무 일지를 자동으로 인식합니다
                  </span>
                </label>
              </div>

              {previewUrl && (
                <div className="mt-4">
                  <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow" />
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedImage || isAnalyzing}
                  className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-bold disabled:bg-gray-400 flex items-center"
                >
                  {isAnalyzing ? '분석 중...' : '분석 시작 ✨'}
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">직원 (AI 인식)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">매칭된 직원</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">출근</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">퇴근</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {scannedData.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={item.work_date || ''}
                            onChange={(e) => handleUpdateItem(idx, 'work_date', e.target.value)}
                            className="w-full border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {item.employee_name}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={item.employee_id || ''}
                            onChange={(e) => handleUpdateItem(idx, 'employee_id', e.target.value)}
                            className={`w-full border rounded px-2 py-1 ${!item.employee_id ? 'border-red-500 bg-red-50' : ''}`}
                          >
                            <option value="">선택 필요</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="time"
                            value={item.check_in_time || ''}
                            onChange={(e) => handleUpdateItem(idx, 'check_in_time', e.target.value)}
                            className="w-full border rounded px-2 py-1"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="time"
                            value={item.check_out_time || ''}
                            onChange={(e) => handleUpdateItem(idx, 'check_out_time', e.target.value)}
                            className="w-full border rounded px-2 py-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center border-t pt-4">
                <button
                  onClick={() => setStep('upload')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← 다시 찍기
                </button>
                <button
                  onClick={handleSaveAll}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                >
                  모두 저장하기 💾
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// 기간 일괄 등록 모달 컴포넌트
// 기간 일괄 등록 모달 컴포넌트
function PeriodScheduleModal({ onClose, onSave, employees }: { onClose: () => void, onSave: () => void, employees: Employee[] }) {
  const [mode, setMode] = useState<'period' | 'specific'>('period');
  const [step, setStep] = useState<'settings' | 'preview'>('settings');
  const [employeeId, setEmployeeId] = useState('');

  // Period Mode State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // 기본: 월,수,금

  // Specific Mode State
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Common State
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const weekDays = [
    { id: 0, label: '일' },
    { id: 1, label: '월' },
    { id: 2, label: '화' },
    { id: 3, label: '수' },
    { id: 4, label: '목' },
    { id: 5, label: '금' },
    { id: 6, label: '토' },
  ];

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  // Helper: Date to YYYY-MM-DD (Local)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleGeneratePreview = () => {
    if (!employeeId || !checkInTime || !checkOutTime) {
      toast.error('직원 및 시간 정보를 입력해주세요.');
      return;
    }

    let datesToProcess: Date[] = [];

    if (mode === 'period') {
      if (!startDate || !endDate) {
        toast.error('기간을 설정해주세요.');
        return;
      }
      // Parse YYYY-MM-DD to Local Date
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (selectedDays.includes(d.getDay())) {
          datesToProcess.push(new Date(d));
        }
      }
    } else {
      if (selectedDates.length === 0) {
        toast.error('날짜를 선택해주세요.');
        return;
      }
      datesToProcess = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());
    }

    if (datesToProcess.length === 0) {
      toast.error('선택한 조건에 해당하는 날짜가 없습니다.');
      return;
    }

    const list = datesToProcess.map(d => {
      // Use formatLocalDate to avoid UTC shift
      const dateStr = formatLocalDate(d);

      // Timezone Fix: Explicit KST Offset (+09:00)
      const kstOffset = '+09:00';
      const checkInFull = `${dateStr}T${checkInTime}:00${kstOffset}`;
      const checkOutFull = `${dateStr}T${checkOutTime}:00${kstOffset}`;

      return {
        employee_id: employeeId,
        work_date: dateStr,
        check_in_time: checkInFull,
        check_out_time: checkOutFull,
        displayDate: dateStr,
        displayDay: weekDays.find(w => w.id === d.getDay())?.label
      };
    });

    setPreviewData(list);
    setStep('preview');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/hr/attendance/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: previewData }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '저장 실패');
      }

      toast.success(result.message);
      onSave();
      onClose();

    } catch (error) {
      console.error(error);
      toast.error('일괄 저장 중 오류가 발생했습니다: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">🗓️ 근무 일정 일괄 등록</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {step === 'settings' ? (
            <>
              {/* Mode Toggle */}
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setMode('period')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'period' ? 'bg-white shadow text-violet-700' : 'text-gray-500'
                    }`}
                >
                  기간 반복 (Period)
                </button>
                <button
                  onClick={() => setMode('specific')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mode === 'specific' ? 'bg-white shadow text-violet-700' : 'text-gray-500'
                    }`}
                >
                  날짜 선택 (Calendar)
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">직원 선택</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {mode === 'period' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">시작일</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">종료일</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">반복 요일</label>
                    <div className="flex gap-2">
                      {weekDays.map(day => (
                        <button
                          key={day.id}
                          onClick={() => toggleDay(day.id)}
                          className={`w-10 h-10 rounded-full font-bold transition-colors ${selectedDays.includes(day.id)
                            ? 'bg-violet-600 text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">날짜 선택 (다중 선택 가능)</label>
                  <div className="border border-gray-300 rounded-lg p-4 flex justify-center">
                    <DatePicker
                      selected={undefined}
                      onChange={(date: Date | null) => {
                        if (date) {
                          const dDate = date;
                          const existing = selectedDates.find(d => d.toDateString() === dDate.toDateString());
                          if (existing) {
                            setSelectedDates(selectedDates.filter(d => d.toDateString() !== dDate.toDateString()));
                          } else {
                            setSelectedDates([...selectedDates, dDate]);
                          }
                        }
                      }}
                      highlightDates={selectedDates}
                      inline
                      locale="ko"
                      shouldCloseOnSelect={false}
                    />
                  </div>
                  <div className="mt-2 text-sm text-gray-500 text-right">
                    {selectedDates.length}일 선택됨
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">출근 시간</label>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">퇴근 시간</label>
                  <input
                    type="time"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleGeneratePreview}
                  className="px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-bold"
                >
                  미리보기 생성 →
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">생성될 근무 기록: 총 {previewData.length}건</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {previewData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm">
                      <span className="font-medium text-gray-700">{item.displayDate} ({item.displayDay})</span>
                      <span className="text-gray-500">
                        {item.check_in_time.split('T')[1].substring(0, 5)} - {item.check_out_time.split('T')[1].substring(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <button
                  onClick={() => setStep('settings')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  ← 설정 수정
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:bg-gray-400"
                >
                  {isSaving ? '저장 중...' : '일괄 등록 실행 💾'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
