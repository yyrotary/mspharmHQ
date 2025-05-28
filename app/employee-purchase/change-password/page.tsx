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

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // 숫자만 입력 허용하고 4자리로 제한
    if (value.length <= 4 && /^\d*$/.test(value)) {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검증
    if (!formData.currentPassword) {
      toast.error('현재 비밀번호를 입력해주세요');
      return;
    }

    if (formData.currentPassword.length !== 4) {
      toast.error('현재 비밀번호는 4자리 숫자여야 합니다');
      return;
    }

    if (!formData.newPassword) {
      toast.error('새 비밀번호를 입력해주세요');
      return;
    }

    if (formData.newPassword.length !== 4) {
      toast.error('새 비밀번호는 4자리 숫자여야 합니다');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('새 비밀번호와 확인 비밀번호가 일치하지 않습니다');
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      toast.error('새 비밀번호는 현재 비밀번호와 달라야 합니다');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/employee-purchase/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('비밀번호가 성공적으로 변경되었습니다');
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        // 3초 후 대시보드로 이동
        setTimeout(() => {
          router.push('/employee-purchase');
        }, 3000);
      } else {
        toast.error(data.error || '비밀번호 변경에 실패했습니다');
      }
    } catch (error) {
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
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
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">비밀번호 변경</h1>
            <Link
              href="/employee-purchase"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              대시보드로
            </Link>
          </div>

          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600">
              <span className="font-semibold">{user?.name}</span>님
            </p>
            <p className="text-sm text-gray-500">
              권한: {user?.role === 'owner' ? 'master' : user?.role === 'manager' ? 'secretary' : 'family'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                현재 비밀번호 (4자리 숫자)
              </label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder="현재 4자리 비밀번호"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-2xl tracking-widest"
                maxLength={4}
                pattern="\d{4}"
                required
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호 (4자리 숫자)
              </label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="새로운 4자리 비밀번호"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-2xl tracking-widest"
                maxLength={4}
                pattern="\d{4}"
                required
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                새 비밀번호 확인
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="새 비밀번호 다시 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-2xl tracking-widest"
                maxLength={4}
                pattern="\d{4}"
                required
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">비밀번호 변경 안내</h3>
              <div className="text-xs text-blue-600 space-y-1">
                <div>• 비밀번호는 반드시 4자리 숫자여야 합니다</div>
                <div>• 현재 비밀번호와 다른 번호를 설정해주세요</div>
                <div>• 변경 후 다시 로그인할 필요는 없습니다</div>
                <div>• 보안을 위해 정기적으로 비밀번호를 변경해주세요</div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '변경 중...' : '비밀번호 변경'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 