'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAutoLogout } from '@/app/lib/employee-purchase/useAutoLogout';

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
}

export default function ManageEmployeesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    role: 'staff' as 'staff' | 'manager' | 'owner',
    password: '',
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
      const response = await fetch('/api/employee-purchase/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEmployee),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setNewEmployee({ name: '', role: 'staff', password: '' });
        setShowAddForm(false);
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

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    if (!confirm(`정말로 ${employeeName} 직원을 삭제하시겠습니까?`)) {
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

          {/* 직원 추가 버튼 */}
          <div className="mb-6">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {showAddForm ? '취소' : '새 Family 추가'}
            </button>
          </div>

          {/* 직원 추가 폼 */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 mb-4">새 Family 추가</h3>
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름
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
                      권한
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
                      초기 비밀번호 (4자리)
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
                <div className="flex justify-end">
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
                전체 Family 목록 ({employees.length}명)
              </h3>
            </div>
            <ul className="divide-y divide-gray-200">
              {employees.map((employee) => (
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
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(employee.role)}`}>
                            {getRoleDisplayName(employee.role)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          가입일: {new Date(employee.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* 권한 변경 */}
                      <select
                        value={employee.role}
                        onChange={(e) => handleChangeRole(employee.id, e.target.value, employee.name)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                        disabled={employee.id === user?.id}
                      >
                        <option value="staff">family</option>
                        <option value="manager">secretary</option>
                        <option value="owner">master</option>
                      </select>
                      {/* 삭제 버튼 */}
                      {employee.id !== user?.id && (
                        <button
                          onClick={() => handleDeleteEmployee(employee.id, employee.name)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
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
              <div>• 권한 변경은 즉시 적용됩니다</div>
              <div>• 새 Family의 초기 비밀번호는 4자리 숫자로 설정해주세요</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 