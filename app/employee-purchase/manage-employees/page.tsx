'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAutoLogout } from '@/app/lib/employee-purchase/useAutoLogout';
import NetToGrossCalculator from '@/app/components/NetToGrossCalculator';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

interface Employee {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
  created_at: string;
  updated_at: string;
  email?: string;
  phone?: string;
  position?: string;
  hire_date?: string;
  employment_type?: string;
  base_salary?: number;
  hourly_rate?: number;
  fixed_overtime_pay?: number;
  is_active?: boolean;
  resignation_date?: string;
}

export default function ManageEmployeesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showCalculator, setShowCalculator] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resigned'>('active');
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: 'staff' as 'staff' | 'manager' | 'owner',
    password: '',
    // HR 정보
    email: '',
    phone: '',
    position: '스태프',
    department: '약국',
    employment_type: 'full_time',
    hire_date: new Date().toISOString().split('T')[0],
    birth_date: '',
    base_salary: '',
    hourly_rate: '',
    fixed_overtime_pay: '',
  });

  // 자동 로그아웃 훅 사용
  const { resetTimer } = useAutoLogout({
    timeoutMinutes: 5,
    enabled: !!user
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user.role !== 'owner') {
          toast.error('오너만 접근할 수 있습니다');
          router.push('/employee-purchase');
          return;
        }
        setUser(data.user);
        await fetchEmployees();
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employee-purchase/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data.employees);
      } else {
        toast.error('직원 목록을 불러오는데 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newEmployee.name.trim()) {
      toast.error('이름을 입력해주세요');
      return;
    }

    if (!/^\d{4}$/.test(newEmployee.password)) {
      toast.error('비밀번호는 4자리 숫자여야 합니다');
      return;
    }

    setSubmitting(true);

    try {
      // 1. 직원 생성
      const employeeData: any = {
        name: newEmployee.name,
        role: newEmployee.role,
        password: newEmployee.password,
      };

      // HR 정보 추가 (값이 있는 경우만)
      if (newEmployee.email) employeeData.email = newEmployee.email;
      if (newEmployee.phone) employeeData.phone = newEmployee.phone;
      if (newEmployee.position) employeeData.position = newEmployee.position;
      if (newEmployee.department) employeeData.department = newEmployee.department;
      if (newEmployee.employment_type) employeeData.employment_type = newEmployee.employment_type;
      if (newEmployee.hire_date) employeeData.hire_date = newEmployee.hire_date;
      if (newEmployee.birth_date) employeeData.birth_date = newEmployee.birth_date;

      const response = await fetch('/api/employee-purchase/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(employeeData),
      });

      const data = await response.json();

      if (response.ok) {
        // 2. 급여 정보가 있으면 급여 설정
        const employeeId = data.employee?.id;
        if (employeeId && (newEmployee.base_salary || newEmployee.hourly_rate || newEmployee.fixed_overtime_pay)) {
          await fetch('/api/hr/salary/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employeeId,
              base_salary: newEmployee.base_salary ? parseFloat(newEmployee.base_salary) : null,
              hourly_rate: newEmployee.hourly_rate ? parseFloat(newEmployee.hourly_rate) : null,
              fixed_overtime_pay: newEmployee.fixed_overtime_pay ? parseFloat(newEmployee.fixed_overtime_pay) : null,
              effective_from: newEmployee.hire_date || new Date().toISOString().split('T')[0],
            }),
          });
        }

        // 3. 연차 자동 부여
        if (employeeId && newEmployee.hire_date) {
          const currentYear = new Date().getFullYear();
          await fetch('/api/hr/leave/grant-annual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              employee_id: employeeId,
              year: currentYear,
            }),
          });
        }

        toast.success(data.message + ' (HR 정보 포함)');
        setNewEmployee({
          name: '',
          role: 'staff',
          password: '',
          email: '',
          phone: '',
          position: '스태프',
          department: '약국',
          employment_type: 'full_time',
          hire_date: new Date().toISOString().split('T')[0],
          birth_date: '',
          base_salary: '',
          hourly_rate: '',
          fixed_overtime_pay: '',
        });
        setShowAddForm(false);
        setShowAdvanced(false);
        await fetchEmployees();
      } else {
        toast.error(data.error || '직원 추가에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowEditModal(true);
  };

  const handleUpdateEmployee = async (updates: any) => {
    if (!editingEmployee) return;

    try {
      const response = await fetch(`/api/employee-purchase/employees/${editingEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setShowEditModal(false);
        setEditingEmployee(null);
        await fetchEmployees();
      } else {
        toast.error(data.error || '정보 수정에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    }
  };

  const handleResign = async (employeeId: string, employeeName: string) => {
    if (!confirm(`${employeeName} 직원을 퇴사 처리하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employee-purchase/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          is_active: false,
          resignation_date: new Date().toISOString().split('T')[0]
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`${employeeName} 직원이 퇴사 처리되었습니다`);
        await fetchEmployees();
      } else {
        toast.error(data.error || '퇴사 처리에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    }
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!confirm(`정말로 ${employeeName} 직원을 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employee-purchase/employees/${employeeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchEmployees();
      } else {
        toast.error(data.error || '직원 삭제에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    }
  };

  const handleChangeRole = async (employeeId: string, newRole: string, employeeName: string) => {
    if (!confirm(`${employeeName} 직원의 권한을 ${newRole}로 변경하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/employee-purchase/employees/${employeeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        await fetchEmployees();
      } else {
        toast.error(data.error || '권한 변경에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'owner': return 'master';
      case 'manager': return 'secretary';
      case 'staff': return 'family';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'staff': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">MSP Family 관리</h1>
            <div className="flex items-center space-x-4">
              <Link
                href="/employee-purchase"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                대시보드로
              </Link>
            </div>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              <span className="font-semibold">{user?.name}</span>님 (master)
            </p>
            <p className="text-sm text-gray-500">
              MSP Family 추가, 삭제, 권한 변경이 가능합니다
            </p>
          </div>

          {/* 직원 추가 버튼 & 계산기 */}
          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {showAddForm ? '취소' : '새 Family 추가'}
            </button>
            <button
              onClick={() => setShowCalculator(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              🧮 세후→세전 계산기
            </button>
          </div>

          {/* 상태 필터 */}
          <div className="mb-4 flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">상태 필터:</span>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✓ 재직 ({employees.filter(e => e.is_active !== false).length})
            </button>
            <button
              onClick={() => setStatusFilter('resigned')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'resigned'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              ✕ 퇴사 ({employees.filter(e => e.is_active === false).length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              전체 ({employees.length})
            </button>
          </div>

          {/* 직원 추가 폼 */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 mb-4">새 Family 추가</h3>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                {/* 기본 정보 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">기본 정보</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        이름 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Family 이름"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        권한 <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={newEmployee.role}
                        onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                      >
                        <option value="staff">family</option>
                        <option value="manager">secretary</option>
                        <option value="owner">master</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        초기 비밀번호 (4자리) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={newEmployee.password}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 4 && /^\d*$/.test(value)) {
                            setNewEmployee({ ...newEmployee, password: value });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-xl tracking-widest"
                        placeholder="1234"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* HR 정보 (선택사항) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showAdvanced ? '▼' : '▶'} HR 정보 추가 (선택사항)
                  </button>
                </div>

                {showAdvanced && (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">연락처 정보</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            이메일
                          </label>
                          <input
                            type="email"
                            value={newEmployee.email}
                            onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="example@pharmacy.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            전화번호
                          </label>
                          <input
                            type="tel"
                            value={newEmployee.phone}
                            onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="010-0000-0000"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">근무 정보</h4>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            직책
                          </label>
                          <select
                            value={newEmployee.position}
                            onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="대표">대표</option>
                            <option value="과장">과장</option>
                            <option value="대리">대리</option>
                            <option value="스태프">스태프</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            부서
                          </label>
                          <input
                            type="text"
                            value={newEmployee.department}
                            onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            고용 형태
                          </label>
                          <select
                            value={newEmployee.employment_type}
                            onChange={(e) => setNewEmployee({ ...newEmployee, employment_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          >
                            <option value="full_time">정규직</option>
                            <option value="part_time">파트타임</option>
                            <option value="contract">계약직</option>
                            <option value="intern">인턴</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            입사일
                          </label>
                          <input
                            type="date"
                            value={newEmployee.hire_date}
                            onChange={(e) => setNewEmployee({ ...newEmployee, hire_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">급여 정보</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            기본급 (월급)
                          </label>
                          <input
                            type="number"
                            value={newEmployee.base_salary}
                            onChange={(e) => setNewEmployee({ ...newEmployee, base_salary: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="2500000"
                          />
                          <p className="text-xs text-gray-500 mt-1">정규직의 경우 입력</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            시급
                          </label>
                          <input
                            type="number"
                            value={newEmployee.hourly_rate}
                            onChange={(e) => setNewEmployee({ ...newEmployee, hourly_rate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="12000"
                          />
                          <p className="text-xs text-gray-500 mt-1">정직원 초과시 시급 또는 파트타임 기본 시급</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            고정 OT 수당 (월)
                          </label>
                          <input
                            type="number"
                            value={newEmployee.fixed_overtime_pay}
                            onChange={(e) => setNewEmployee({ ...newEmployee, fixed_overtime_pay: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            placeholder="500000"
                          />
                          <p className="text-xs text-gray-500 mt-1">포괄임금제 고정 OT</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            생년월일
                          </label>
                          <input
                            type="date"
                            value={newEmployee.birth_date}
                            onChange={(e) => setNewEmployee({ ...newEmployee, birth_date: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setShowAdvanced(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {submitting ? '추가 중...' : 'Family 추가'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 직원 목록 */}
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {statusFilter === 'active' && '재직 중인 Family'}
                {statusFilter === 'resigned' && '퇴사한 Family'}
                {statusFilter === 'all' && '전체 Family'}
                {' '}({employees.filter(e => {
                  if (statusFilter === 'active') return e.is_active !== false;
                  if (statusFilter === 'resigned') return e.is_active === false;
                  return true;
                }).length}명)
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {employees.filter(e => {
                if (statusFilter === 'active') return e.is_active !== false;
                if (statusFilter === 'resigned') return e.is_active === false;
                return true;
              }).map((employee) => (
                <li key={employee.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {employee.name.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center flex-wrap gap-2">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.role)}`}>
                            {getRoleDisplayName(employee.role)}
                          </span>
                          {employee.position && (
                            <span className="text-xs text-gray-500">
                              ({employee.position})
                            </span>
                          )}
                          {employee.is_active === false ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              ✕ 퇴사
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ 재직
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 space-x-2">
                          {employee.hire_date && (
                            <span>입사: {new Date(employee.hire_date).toLocaleDateString()}</span>
                          )}
                          {!employee.hire_date && (
                            <span>가입: {new Date(employee.created_at).toLocaleDateString()}</span>
                          )}
                          {employee.resignation_date && (
                            <span className="text-red-600 font-medium">
                              • 퇴사: {new Date(employee.resignation_date).toLocaleDateString()}
                            </span>
                          )}
                          {employee.email && (
                            <span>• {employee.email}</span>
                          )}
                          {employee.phone && (
                            <span>• {employee.phone}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1 space-x-3">
                          {employee.base_salary && (
                            <span>기본급: {employee.base_salary.toLocaleString()}원</span>
                          )}
                          {employee.hourly_rate && (
                            <span>시급: {employee.hourly_rate.toLocaleString()}원</span>
                          )}
                          {employee.fixed_overtime_pay && (
                            <span>고정OT: {employee.fixed_overtime_pay.toLocaleString()}원</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* 편집 버튼 */}
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        편집
                      </button>
                      {/* 퇴사 처리 */}
                      {employee.id !== user?.id && (
                        <button
                          onClick={() => handleResign(employee.id, employee.name)}
                          className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                        >
                          퇴사
                        </button>
                      )}
                      {/* 삭제 버튼 */}
                      {employee.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteEmployee(employee.id, employee.name)}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">주의사항</h3>
            <div className="text-xs text-yellow-600 space-y-1">
              <div>• 자기 자신은 삭제할 수 없습니다</div>
              <div>• 구매 요청 내역이 있는 Family는 삭제할 수 없습니다</div>
              <div>• 퇴사 처리 시 계정은 유지되지만 비활성화됩니다</div>
              <div>• 삭제는 영구적이며 되돌릴 수 없습니다</div>
            </div>
          </div>
        </div>
      </div>

      {/* 편집 모달 */}
      {showEditModal && editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setShowEditModal(false);
            setEditingEmployee(null);
          }}
          onUpdate={handleUpdateEmployee}
        />
      )}

      {/* Net-to-Gross 계산기 */}
      {showCalculator && (
        <NetToGrossCalculator
          onClose={() => setShowCalculator(false)}
        />
      )}
    </div>
  );
}

// 편집 모달 컴포넌트
function EditEmployeeModal({ 
  employee, 
  onClose, 
  onUpdate 
}: { 
  employee: Employee; 
  onClose: () => void; 
  onUpdate: (updates: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: employee.name || '',
    role: employee.role || 'staff',
    email: employee.email || '',
    phone: employee.phone || '',
    position: employee.position || '',
    employment_type: employee.employment_type || 'full_time',
    hire_date: employee.hire_date || '',
    base_salary: '',
    hourly_rate: '',
    fixed_overtime_pay: '',
    is_active: employee.is_active !== false,
    resignation_date: employee.resignation_date || '',
  });
  const [showCalculator, setShowCalculator] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updates: any = {};
    if (formData.name !== employee.name) updates.name = formData.name;
    if (formData.role !== employee.role) updates.role = formData.role;
    if (formData.email !== employee.email) updates.email = formData.email;
    if (formData.phone !== employee.phone) updates.phone = formData.phone;
    if (formData.position !== employee.position) updates.position = formData.position;
    if (formData.employment_type !== employee.employment_type) updates.employment_type = formData.employment_type;
    if (formData.hire_date !== employee.hire_date) updates.hire_date = formData.hire_date || null;
    
    // 재직 상태
    if (formData.is_active !== (employee.is_active !== false)) updates.is_active = formData.is_active;
    if (formData.resignation_date !== employee.resignation_date) updates.resignation_date = formData.resignation_date || null;
    
    // 급여 정보 (변경 시)
    if (formData.base_salary) updates.base_salary = formData.base_salary;
    if (formData.hourly_rate) updates.hourly_rate = formData.hourly_rate;
    if (formData.fixed_overtime_pay) updates.fixed_overtime_pay = formData.fixed_overtime_pay;

    onUpdate(updates);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {employee.name} 정보 수정
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">기본 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    권한
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="staff">family</option>
                    <option value="manager">secretary</option>
                    <option value="owner">master</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">연락처</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="example@pharmacy.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    전화번호
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>
            </div>

            {/* 근무 정보 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">근무 정보</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    직책
                  </label>
                  <select
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택</option>
                    <option value="대표">대표</option>
                    <option value="과장">과장</option>
                    <option value="대리">대리</option>
                    <option value="스태프">스태프</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    고용 형태
                  </label>
                  <select
                    value={formData.employment_type}
                    onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full_time">정규직</option>
                    <option value="part_time">파트타임</option>
                    <option value="contract">계약직</option>
                    <option value="intern">인턴</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    입사일
                  </label>
                  <input
                    type="date"
                    value={formData.hire_date}
                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* 재직 상태 */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">📋 재직 상태</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    상태
                  </label>
                  <select
                    value={formData.is_active ? 'active' : 'resigned'}
                    onChange={(e) => {
                      const isActive = e.target.value === 'active';
                      setFormData({ 
                        ...formData, 
                        is_active: isActive,
                        resignation_date: isActive ? '' : (formData.resignation_date || new Date().toISOString().split('T')[0])
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">✓ 재직 중</option>
                    <option value="resigned">✕ 퇴사</option>
                  </select>
                </div>
                {!formData.is_active && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      퇴사일
                    </label>
                    <input
                      type="date"
                      value={formData.resignation_date}
                      onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 급여 정보 */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  💰 급여 정보 변경 (선택사항)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCalculator(true)}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🧮 세후→세전 계산기
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                값을 입력하면 오늘부터 새로운 급여가 적용됩니다
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    기본급 (월급)
                  </label>
                  <input
                    type="number"
                    value={formData.base_salary}
                    onChange={(e) => setFormData({ ...formData, base_salary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder={employee.base_salary ? employee.base_salary.toString() : "2500000"}
                  />
                  <p className="text-xs text-gray-500 mt-1">정규직 월급</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시급
                  </label>
                  <input
                    type="number"
                    value={formData.hourly_rate}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="12000"
                  />
                  <p className="text-xs text-gray-500 mt-1">정직원 초과시 시급 또는 파트타임 기본 시급</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    고정 OT 수당
                  </label>
                  <input
                    type="number"
                    value={formData.fixed_overtime_pay}
                    onChange={(e) => setFormData({ ...formData, fixed_overtime_pay: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="500000"
                  />
                  <p className="text-xs text-gray-500 mt-1">포괄임금제 OT</p>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                저장
              </button>
            </div>
          </form>
        </div>

        {/* 계산기 모달 */}
        {showCalculator && (
          <NetToGrossCalculator
            onClose={() => setShowCalculator(false)}
            onApply={(grossPay) => {
              setFormData({ ...formData, base_salary: grossPay.toString() });
              toast.success(`기본급이 ${grossPay.toLocaleString()}원으로 설정되었습니다`);
            }}
          />
        )}
      </div>
    </div>
  );
} 