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

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface PurchaseRequest {
  id: string;
  employee_id: string;
  total_amount: number;
  notes?: string;
  image_urls: string[];
  status: 'pending' | 'approved' | 'cancelled';
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  employee: Employee;
  approver?: Employee;
}

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user.role === 'staff') {
          toast.error('접근 권한이 없습니다');
          router.push('/employee-purchase');
          return;
        }
        setUser(data.user);
        await loadRequests();
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const response = await fetch('/api/employee-purchase/requests?admin=true');
      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      toast.error('요청 목록을 불러오는데 실패했습니다');
    }
  };

  const handleApproval = async (requestId: string, action: 'approve' | 'reject') => {
    setActionLoading(requestId);
    try {
      const response = await fetch(`/api/employee-purchase/requests/${requestId}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success(action === 'approve' ? '승인되었습니다' : '거부되었습니다');
        await loadRequests();
      } else {
        const data = await response.json();
        
        // 구체적인 에러 메시지 처리
        if (response.status === 403) {
          if (data.error === 'Cannot approve your own purchase request') {
            toast.error('본인의 요청은 승인할 수 없습니다 (내부 통제)');
          } else if (data.error === 'Cannot reject your own purchase request') {
            toast.error('본인의 요청은 거부할 수 없습니다 (내부 통제)');
          } else if (data.error === 'Insufficient permissions') {
            toast.error('승인 권한이 없습니다');
          } else {
            toast.error(data.error || '권한이 없습니다');
          }
        } else if (response.status === 404) {
          toast.error('요청을 찾을 수 없습니다');
        } else if (response.status === 400) {
          toast.error('이미 처리된 요청입니다');
        } else {
          toast.error(data.error || `처리 실패 (${response.status})`);
        }
      }
    } catch (error) {
      console.error('Approval error:', error);
      toast.error('네트워크 오류가 발생했습니다');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    
    const labels = {
      pending: '승인 대기',
      approved: '승인됨',
      cancelled: '거부됨',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const pendingRequests = requests.filter(req => req.status === 'pending');
  const processedRequests = requests.filter(req => req.status !== 'pending');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">승인 관리</h1>
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
              <span className="font-semibold">{user?.name}</span>님 ({user?.role === 'owner' ? 'master' : 'secretary'})
            </p>
            <p className="text-sm text-gray-500">
              대기 중인 요청: {pendingRequests.length}건
            </p>
          </div>

          {/* 승인 대기 중인 요청 */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">승인 대기 중인 요청</h2>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                승인 대기 중인 요청이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">구매 요청</h3>
                        <p className="text-sm text-gray-600">신청자: {request.employee.name}</p>
                        <p className="text-sm text-gray-600">신청일: {formatDate(request.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatAmount(request.total_amount)}</p>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    
                    {request.notes && (
                      <p className="text-gray-700 mb-3">{request.notes}</p>
                    )}
                    
                    {request.image_urls && request.image_urls.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">첨부 이미지:</p>
                        <div className="flex space-x-2">
                          {request.image_urls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`구매 이미지 ${index + 1}`}
                              className="w-20 h-20 object-cover rounded border cursor-pointer"
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      {request.employee_id === user?.id ? (
                        <div className="text-sm text-gray-500 italic">
                          본인의 요청은 승인/거부할 수 없습니다 (내부 통제)
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApproval(request.id, 'approve')}
                            disabled={actionLoading === request.id}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === request.id ? '처리 중...' : '승인'}
                          </button>
                          <button
                            onClick={() => handleApproval(request.id, 'reject')}
                            disabled={actionLoading === request.id}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {actionLoading === request.id ? '처리 중...' : '거부'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 처리된 요청 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">처리된 요청</h2>
            {processedRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                처리된 요청이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {processedRequests.map((request) => (
                  <div key={request.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">구매 요청</h3>
                        <p className="text-sm text-gray-600">신청자: {request.employee.name}</p>
                        <p className="text-sm text-gray-600">신청일: {formatDate(request.created_at)}</p>
                        {request.approved_at && (
                          <p className="text-sm text-gray-600">
                            처리일: {formatDate(request.approved_at)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{formatAmount(request.total_amount)}</p>
                        {getStatusBadge(request.status)}
                      </div>
                    </div>
                    
                    {request.notes && (
                      <p className="text-gray-700 mb-3">{request.notes}</p>
                    )}
                    
                    {request.image_urls && request.image_urls.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 mb-2">첨부 이미지:</p>
                        <div className="flex space-x-2">
                          {request.image_urls.map((url, index) => (
                            <img
                              key={index}
                              src={url}
                              alt={`구매 이미지 ${index + 1}`}
                              className="w-20 h-20 object-cover rounded border cursor-pointer"
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 