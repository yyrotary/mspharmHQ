'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

interface PurchaseRequest {
  id: string;
  total_amount: number;
  image_urls: string[];
  notes?: string;
  status: 'pending' | 'approved_by_manager' | 'approved_by_owner' | 'completed' | 'rejected';
  created_at: string;
  rejection_reason?: string;
  employee?: {
    id: string;
    name: string;
    role: string;
  };
}

const statusLabels = {
  pending: '승인 대기',
  approved_by_manager: 'secretary 승인',
  approved_by_owner: 'master 승인',
  completed: '완료',
  rejected: '거절됨',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved_by_manager: 'bg-blue-100 text-blue-800',
  approved_by_owner: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

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
      setAuthLoading(false);
    }
  };

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/employee-purchase/requests');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      } else {
        toast.error('구매 내역을 불러오는데 실패했습니다');
      }
    } catch (error) {
      toast.error('구매 내역을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              구매 내역
            </h1>
            <div className="flex items-center space-x-4">
              <Link
                href="/employee-purchase/new"
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                새 구매 신청
              </Link>
              <Link
                href="/employee-purchase"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                대시보드로
              </Link>
            </div>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              {user?.name}님의 구매 내역 ({requests.length}건)
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">📋</div>
              <p className="text-gray-500 mb-4">아직 구매 신청 내역이 없습니다</p>
              <Link
                href="/employee-purchase/new"
                className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
              >
                첫 구매 신청하기
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[request.status]}`}>
                        {statusLabels[request.status]}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(request.created_at)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        ₩{formatAmount(request.total_amount)}
                      </div>
                      {user?.role !== 'staff' && request.employee && (
                        <div className="text-sm text-gray-500">
                          신청자: {request.employee.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {request.notes && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600">{request.notes}</p>
                    </div>
                  )}

                  {request.status === 'rejected' && request.rejection_reason && (
                    <div className="mb-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-800">
                        <strong>거절 사유:</strong> {request.rejection_reason}
                      </p>
                    </div>
                  )}

                  {request.image_urls && request.image_urls.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {request.image_urls.map((url, index) => (
                        <img
                          key={index}
                          src={url}
                          alt={`구매 물품 ${index + 1}`}
                          className="w-full h-20 object-cover rounded border cursor-pointer hover:opacity-80"
                          onClick={() => window.open(url, '_blank')}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 