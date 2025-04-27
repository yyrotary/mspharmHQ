'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CustomerListHeader from '@/app/components/CustomerListHeader';
import CustomerTable from '@/app/components/CustomerTable';
import { NotionCustomer } from '@/app/lib/notion-schema';
import Loading from '@/app/components/Loading';

export default function CustomerListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<NotionCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sortField, setSortField] = useState<string>('고객번호');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showTrash, setShowTrash] = useState(false);

  // 고객 목록 조회
  useEffect(() => {
    fetchCustomers();
  }, [showTrash]);
  
  // 고객 목록 조회 함수
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setMessage(showTrash ? '휴지통 내역을 불러오는 중입니다...' : '고객 목록을 불러오는 중입니다...');
      
      // API 엔드포인트 설정
      const endpoint = showTrash 
        ? '/api/customer/trash' 
        : '/api/customer/list';
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(showTrash ? '휴지통 조회에 실패했습니다.' : '고객 목록 조회에 실패했습니다.');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setCustomers(data.customers);
        setMessage(showTrash 
          ? `휴지통에 ${data.customers.length}명의 고객 정보가 있습니다.` 
          : `${data.customers.length}명의 고객 정보를 불러왔습니다.`);
      } else {
        setMessage(showTrash 
          ? '휴지통 내역을 불러오는 중 오류가 발생했습니다.' 
          : '고객 정보를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error(showTrash ? '휴지통 조회 오류:' : '고객 목록 조회 오류:', error);
      setMessage(showTrash 
        ? '휴지통 내역 조회 중 오류가 발생했습니다.' 
        : '고객 목록 조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 정렬 필드 변경 처리
  const handleSortChange = (field: string) => {
    if (sortField === field) {
      // 같은 필드를 클릭한 경우 정렬 방향만 전환
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 다른 필드를 클릭한 경우 필드 변경 및 오름차순 기본 설정
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // 고객 선택 처리
  const handleCustomerSelect = (customer: NotionCustomer) => {
    // 선택한 고객의 상담일지 페이지로 이동
    router.push(`/consultation?customerId=${customer.id}&directView=true`);
  };
  
  // 고객 삭제 처리
  const handleCustomerDelete = async (customer: NotionCustomer) => {
    try {
      setLoading(true);
      setMessage('고객을 휴지통으로 이동 중입니다...');
      
      const response = await fetch('/api/customer/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('고객이 휴지통으로 이동되었습니다.');
        // 고객 목록 새로고침
        await fetchCustomers();
      } else {
        setMessage(`고객 삭제 중 오류: ${data.error}`);
      }
    } catch (error) {
      console.error('고객 삭제 오류:', error);
      setMessage('고객 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 고객 복원 처리
  const handleCustomerRestore = async (customer: NotionCustomer) => {
    try {
      setLoading(true);
      setMessage('고객을 복원 중입니다...');
      
      const response = await fetch('/api/customer/delete', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('고객이 복원되었습니다.');
        // 고객 목록 새로고침
        await fetchCustomers();
      } else {
        setMessage(`고객 복원 중 오류: ${data.error}`);
      }
    } catch (error) {
      console.error('고객 복원 오류:', error);
      setMessage('고객 복원 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };
  
  // 고객 완전 삭제 처리
  const handleCustomerPermanentDelete = async (customer: NotionCustomer) => {
    try {
      if (!window.confirm('이 작업은 되돌릴 수 없습니다. 고객 정보를 완전히 삭제하시겠습니까?')) {
        return;
      }
      
      setLoading(true);
      setMessage('고객을 완전히 삭제 중입니다...');
      
      const response = await fetch(`/api/customer/delete?customerId=${customer.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage('고객이 완전히 삭제되었습니다.');
        // 고객 목록 새로고침
        await fetchCustomers();
      } else {
        setMessage(`고객 완전 삭제 중 오류: ${data.error}`);
      }
    } catch (error) {
      console.error('고객 완전 삭제 오류:', error);
      setMessage('고객 완전 삭제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <CustomerListHeader />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{showTrash ? '휴지통' : '고객 목록'}</h1>
          
          <div className="space-x-4">
            <button
              className={`px-4 py-2 rounded ${showTrash ? 'bg-gray-200 hover:bg-gray-300' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
              onClick={() => setShowTrash(false)}
            >
              고객 목록
            </button>
            <button
              className={`px-4 py-2 rounded ${showTrash ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
              onClick={() => setShowTrash(true)}
            >
              휴지통
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center mt-10">
            <Loading />
          </div>
        ) : (
          <>
            {message && (
              <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded-lg">
                {message}
              </div>
            )}
            
            <CustomerTable 
              customers={customers} 
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
              onCustomerSelect={handleCustomerSelect}
              onCustomerDelete={showTrash ? handleCustomerRestore : handleCustomerDelete}
              isTrashMode={showTrash}
            />
            
            {showTrash && customers.length > 0 && (
              <div className="mt-6 flex justify-end">
                <button
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                  onClick={() => {
                    if (window.confirm('휴지통의 모든 고객을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                      // 첫 번째 고객만 선택해서 삭제
                      if (customers.length > 0) {
                        handleCustomerPermanentDelete(customers[0]);
                      }
                    }
                  }}
                >
                  휴지통 비우기
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
} 