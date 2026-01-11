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

interface DayRecord {
  date: string;
  attendance: any;
  hasRecord: boolean;
  status: string;
}

export default function WorkCalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendar, setCalendar] = useState<DayRecord[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [formData, setFormData] = useState({
    startHour: '09',
    startMinute: '00',
    endHour: '18',
    endMinute: '00',
    notes: '',
  });
  const [expectedPay, setExpectedPay] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      setLoading(false); // 인증 완료 후 초기 로딩 종료
      loadMonthlyData();
    }
  }, [user, currentMonth]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    }
  };

  const loadMonthlyData = async () => {
    // 로컬 날짜 기준으로 년-월 생성
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;
    
    try {
      // 근태 기록 조회
      const response = await fetch(`/api/hr/attendance/monthly?month=${monthStr}`);
      if (response.ok) {
        const data = await response.json();
        buildCalendar(data.data.attendance || []);
        calculateExpectedPay(data.data.attendance || []);
      } else {
        // 에러 시에도 빈 캘린더 표시
        buildCalendar([]);
        calculateExpectedPay([]);
      }
    } catch (error) {
      console.error('Load monthly data error:', error);
      // 에러 시에도 빈 캘린더 표시
      buildCalendar([]);
      calculateExpectedPay([]);
    }
  };

  const buildCalendar = (attendance: any[]) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    
    const days: DayRecord[] = [];
    const attendanceMap = new Map(
      attendance.map(a => [a.work_date, a])
    );

    for (let d = 1; d <= lastDay.getDate(); d++) {
      // 로컬 날짜 문자열 생성 (YYYY-MM-DD)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = attendanceMap.get(dateStr);
      
      days.push({
        date: dateStr,
        attendance: record,
        hasRecord: !!record,
        status: record?.status || 'none',
      });
    }

    setCalendar(days);
  };

  const calculateExpectedPay = (attendance: any[]) => {
    // 간단한 예상 급여 계산 (실제로는 API로 가져와야 함)
    const totalHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    const overtimeHours = attendance.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0);
    
    // 임시 시급 (실제로는 사용자의 급여 정보에서 가져와야 함)
    const hourlyRate = 15000;
    const estimated = (totalHours * hourlyRate) + (overtimeHours * hourlyRate * 0.5);
    
    setExpectedPay(Math.round(estimated));
  };

  const handleAddWork = (dateStr: string, existingRecord?: any) => {
    setSelectedDate(dateStr);
    
    if (existingRecord) {
      // 기존 기록이 있으면 해당 정보로 폼 채우기
      const checkIn = new Date(existingRecord.check_in_time);
      const checkOut = new Date(existingRecord.check_out_time);
      
      setFormData({
        startHour: checkIn.getHours().toString().padStart(2, '0'),
        startMinute: checkIn.getMinutes().toString().padStart(2, '0'),
        endHour: checkOut.getHours().toString().padStart(2, '0'),
        endMinute: checkOut.getMinutes().toString().padStart(2, '0'),
        notes: existingRecord.notes || '',
      });
    } else {
      // 새 기록이면 현재 시간으로 설정
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      
      // 종료시간은 1시간 뒤로 설정
      const endTime = new Date(now.getTime() + 60 * 60 * 1000);
      const endHour = endTime.getHours().toString().padStart(2, '0');
      const endMinute = endTime.getMinutes().toString().padStart(2, '0');
      
      setFormData({
        startHour: currentHour,
        startMinute: currentMinute,
        endHour: endHour,
        endMinute: endMinute,
        notes: '',
      });
    }
    
    setShowAddModal(true);
  };

  // 시작 시간 변경 시 종료 시간 자동 설정
  const handleStartTimeChange = (type: 'hour' | 'minute', value: string) => {
    const newFormData = { ...formData };
    
    if (type === 'hour') {
      newFormData.startHour = value;
    } else {
      newFormData.startMinute = value;
    }
    
    // 시작 시간으로부터 1시간 뒤를 계산
    const startHour = parseInt(type === 'hour' ? value : formData.startHour);
    const startMinute = parseInt(type === 'minute' ? value : formData.startMinute);
    
    const startTime = new Date();
    startTime.setHours(startHour, startMinute, 0, 0);
    
    // 1시간 더하기
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    
    newFormData.endHour = endTime.getHours().toString().padStart(2, '0');
    newFormData.endMinute = endTime.getMinutes().toString().padStart(2, '0');
    
    setFormData(newFormData);
  };

  const handleSubmitWork = async () => {
    if (!selectedDate) return;

    try {
      // 선택한 날짜를 년, 월, 일로 파싱 (YYYY-MM-DD)
      const [year, month, day] = selectedDate.split('-').map(Number);
      
      // 로컬 시간으로 Date 객체 생성
      const checkInDate = new Date(year, month - 1, day, parseInt(formData.startHour), parseInt(formData.startMinute), 0, 0);
      const checkOutDate = new Date(year, month - 1, day, parseInt(formData.endHour), parseInt(formData.endMinute), 0, 0);
      
      // 종료 시간이 시작 시간보다 이르면 다음 날로 처리
      if (checkOutDate <= checkInDate) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }

      // ISO 8601 형식으로 변환
      const checkInTime = checkInDate.toISOString();
      const checkOutTime = checkOutDate.toISOString();

      // 새로운 통합 API 사용
      const response = await fetch('/api/hr/attendance/record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          notes: formData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '근무 기록 저장 실패');
      }

      toast.success(data.message || '근무 기록이 저장되었습니다');
      setShowAddModal(false);
      setFormData({
        startHour: '09',
        startMinute: '00',
        endHour: '18',
        endMinute: '00',
        notes: '',
      });
      loadMonthlyData();

    } catch (error: any) {
      console.error('Submit work error:', error);
      toast.error(error.message || '근무 기록 저장에 실패했습니다');
    }
  };

  const getDayClassName = (record: DayRecord) => {
    const baseClass = 'min-h-[80px] p-2 border border-gray-200 relative cursor-pointer';
    
    if (!record.hasRecord) {
      return `${baseClass} hover:bg-gray-50`;
    }

    switch (record.status) {
      case 'present':
        return `${baseClass} bg-green-50 hover:bg-green-100`;
      case 'vacation':
        return `${baseClass} bg-blue-50`;
      case 'absent':
        return `${baseClass} bg-red-50`;
      default:
        return baseClass;
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

  const monthStr = currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 상단 예상 수령액 */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm opacity-90">{user?.name}님의 근무 기록</p>
              <h1 className="text-xl font-bold mt-1">이번 달 예상 수령액</h1>
            </div>
            <Link 
              href="/employee-purchase"
              className="px-3 py-1 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm"
            >
              홈으로
            </Link>
          </div>
          <p className="text-4xl font-bold">{formatCurrency(expectedPay)}</p>
          <p className="text-xs mt-2 opacity-90">연장/야간근무 자동 계산 포함</p>
        </div>
      </div>

      {/* 월 선택 */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            ← 이전 달
          </button>
          <h2 className="text-lg font-semibold">{monthStr}</h2>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="p-2 hover:bg-gray-100 rounded"
          >
            다음 달 →
          </button>
        </div>
      </div>

      {/* 캘린더 */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 bg-gray-100">
            {['일', '월', '화', '수', '목', '금', '토'].map(day => (
              <div key={day} className="p-3 text-center font-semibold text-gray-700">
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {/* 첫 주 시작 전 빈 칸 */}
            {calendar.length > 0 && (() => {
              const firstDate = new Date(calendar[0].date);
              const dayOfWeek = firstDate.getDay();
              return Array.from({ length: dayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] p-2 border border-gray-200 bg-gray-50"></div>
              ));
            })()}

            {/* 실제 날짜들 */}
            {calendar.map((record) => {
              const date = new Date(record.date);

              return (
                <div
                  key={record.date}
                  className={getDayClassName(record)}
                  onClick={() => handleAddWork(record.date, record.attendance)}
                >
                  <div className="text-sm font-semibold mb-1">
                    {date.getDate()}
                  </div>
                  
                  {record.hasRecord && record.attendance && (
                    <div className="text-xs space-y-1">
                      <div className="font-medium text-green-700">
                        {record.attendance.work_hours?.toFixed(1)}시간
                      </div>
                      {record.attendance.overtime_hours > 0 && (
                        <div className="text-orange-600">
                          연장 {record.attendance.overtime_hours.toFixed(1)}h
                        </div>
                      )}
                      {record.attendance.night_hours > 0 && (
                        <div className="text-purple-600">
                          야간 {record.attendance.night_hours.toFixed(1)}h
                        </div>
                      )}
                      {record.attendance.is_holiday && (
                        <div className="text-blue-600 font-semibold">
                          휴일근무
                        </div>
                      )}
                      <div className="text-gray-500 text-[10px] mt-1">
                        클릭하여 수정
                      </div>
                    </div>
                  )}

                  {!record.hasRecord && (
                    <div className="absolute bottom-2 right-2">
                      <button className="text-2xl text-gray-400 hover:text-purple-600">
                        +
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 범례 */}
        <div className="mt-4 flex space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-50 border border-green-200 mr-2"></div>
            <span>출근</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-50 border border-blue-200 mr-2"></div>
            <span>휴가</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-50 border border-red-200 mr-2"></div>
            <span>결근</span>
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex justify-around">
          <Link href="/employee-hr/work-calendar" className="text-center text-purple-600">
            <div className="text-2xl mb-1">📅</div>
            <div className="text-xs font-semibold">근무 기록</div>
          </Link>
          <Link href="/employee-hr/payroll" className="text-center">
            <div className="text-2xl mb-1">💰</div>
            <div className="text-xs">급여 명세</div>
          </Link>
        </div>
      </div>

      {/* 근무 입력 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold">
                  {calendar.find(r => r.date === selectedDate)?.hasRecord ? '근무 기록 수정' : '근무 기록하기'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedDate && new Date(selectedDate).toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    weekday: 'short'
                  })}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* 시작 시간 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  시작 시간
                  <span className="ml-2 text-xs text-gray-500">(종료 시간은 1시간 뒤로 자동 설정됩니다)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <select
                    value={formData.startHour}
                    onChange={(e) => handleStartTimeChange('hour', e.target.value)}
                    className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return <option key={hour} value={hour}>{hour}시</option>;
                    })}
                  </select>
                  <span className="text-xl font-bold">:</span>
                  <select
                    value={formData.startMinute}
                    onChange={(e) => handleStartTimeChange('minute', e.target.value)}
                    className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {['00', '15', '30', '45'].map(min => (
                      <option key={min} value={min}>{min}분</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 종료 시간 선택 */}
              <div>
                <label className="block text-sm font-medium mb-2">종료 시간</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={formData.endHour}
                    onChange={(e) => setFormData({ ...formData, endHour: e.target.value })}
                    className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return <option key={hour} value={hour}>{hour}시</option>;
                    })}
                  </select>
                  <span className="text-xl font-bold">:</span>
                  <select
                    value={formData.endMinute}
                    onChange={(e) => setFormData({ ...formData, endMinute: e.target.value })}
                    className="flex-1 px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {['00', '15', '30', '45'].map(min => (
                      <option key={min} value={min}>{min}분</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  💡 연장근무와 야간근무는 자동으로 계산됩니다
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">메모 (선택)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                  placeholder="특이사항이 있다면 입력해주세요"
                />
              </div>

              <div className="flex space-x-2 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmitWork}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium transition-all"
                >
                  {calendar.find(r => r.date === selectedDate)?.hasRecord ? '수정하기' : '저장하기'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
