'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CustomerListHeader from '@/app/components/CustomerListHeader';
import CustomerTable from '@/app/components/CustomerTable';
import Loading from '@/app/components/Loading';
import Link from 'next/link';

// Supabase 고객 타입 정의
interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string;
  google_drive_folder_id?: string;
  consultation_count?: number;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export default function CustomerListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex justify-center items-center"><Loading /></div>}>
      <CustomerListContent />
    </Suspense>
  );
}

function CustomerListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
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
      
      // Supabase API 사용 (customer)
      const endpoint = showTrash 
        ? '/api/customer?includeDeleted=true' 
        : '/api/customer';
      
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
  const handleCustomerSelect = (customer: Customer) => {
    // 선택한 고객의 상담일지 페이지로 이동
    router.push(`/consultation?customerId=${customer.id}&directView=true`);
  };
  
  // 이미지 모아보기 처리
  const handleImageGallery = (customer: Customer) => {
    // 선택한 고객의 이미지 모아보기 페이지로 이동
    router.push(`/consultation-history/image-gallery?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}`);
  };
  
  // 고객 삭제 처리
  const handleCustomerDelete = async (customer: Customer) => {
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
  const handleCustomerRestore = async (customer: Customer) => {
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
  const handleCustomerPermanentDelete = async (customer: Customer) => {
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
      {/* 헤더 */}
      <header 
        style={{ 
          background: 'linear-gradient(to right, #2563eb, #1e40af)', 
          color: 'white', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ color: 'white', textDecoration: 'none' }}>
            ← 홈으로
          </Link>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>고객 목록</h1>
          <div style={{ width: '2.5rem' }}></div>
        </div>
      </header>
      
      {/* 메인 컨텐츠 */}
      <main style={{ flexGrow: 1, padding: '1rem' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af' }}>{showTrash ? '휴지통' : '고객 목록'}</h2>
              
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  style={{ 
                    backgroundColor: showTrash ? '#e5e7eb' : '#2563eb', 
                    color: showTrash ? '#374151' : 'white', 
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem', 
                    borderRadius: '0.5rem', 
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowTrash(false)}
                >
                  고객 목록
                </button>
                <button
                  style={{ 
                    backgroundColor: showTrash ? '#2563eb' : '#e5e7eb', 
                    color: showTrash ? 'white' : '#374151', 
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem', 
                    borderRadius: '0.5rem', 
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowTrash(true)}
                >
                  휴지통
                </button>
              </div>
            </div>
            
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
                <Loading />
              </div>
            ) : (
              <>
                {message && (
                  <div style={{ 
                    marginBottom: '1rem', 
                    padding: '1rem', 
                    backgroundColor: '#fefce8', 
                    color: '#854d0e', 
                    borderRadius: '0.5rem', 
                    borderLeft: '4px solid #facc15' 
                  }}>
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
                  onImageGallery={handleImageGallery}
                  isTrashMode={showTrash}
                />
                
                {showTrash && customers.length > 0 && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      style={{ 
                        backgroundColor: '#ef4444', 
                        color: 'white', 
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem', 
                        borderRadius: '0.5rem', 
                        border: 'none',
                        cursor: 'pointer'
                      }}
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
          </div>
        </div>
      </main>
    </div>
  );
} 