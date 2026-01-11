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
  });

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

  const handleSubmitModal = async () => {
    if (!formData.employee_id || !formData.work_date) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    try {
      const checkInTime = `${formData.work_date}T${formData.check_in_hour}:${formData.check_in_minute}:00`;
      const checkOutTime = `${formData.work_date}T${formData.check_out_hour}:${formData.check_out_minute}:00`;

      const response = await fetch('/api/hr/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: formData.employee_id,
          work_date: formData.work_date,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          is_holiday: formData.is_holiday,
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
                className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
              >
                ➕ 근무 기록 추가
              </button>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    날짜
                  </th>
                  {selectedEmployee === 'all' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      직원
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출근
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    퇴근
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
                    <td colSpan={selectedEmployee === 'all' ? 9 : 8} className="px-6 py-12 text-center text-gray-500">
                      근무 기록이 없습니다
                    </td>
                  </tr>
                ) : (
                  attendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
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
                  <option value="">선택하세요</option>
                  {employees.map(emp => (
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

              {/* 출근 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  출근 시간 <span className="text-red-500">*</span>
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

              {/* 퇴근 시간 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  퇴근 시간 <span className="text-red-500">*</span>
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

              {/* 휴일 여부 */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_holiday"
                  checked={formData.is_holiday}
                  onChange={(e) => setFormData({ ...formData, is_holiday: e.target.checked })}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <label htmlFor="is_holiday" className="ml-2 text-sm text-gray-700">
                  휴일 근무 (수당 2배)
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
    </div>
  );
}
