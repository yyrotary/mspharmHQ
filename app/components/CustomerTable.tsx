'use client';

import { useState } from 'react';

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

interface CustomerTableProps {
  customers: Customer[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string) => void;
  onCustomerSelect: (customer: Customer) => void;
  onCustomerDelete?: (customer: Customer) => void;
  onImageGallery?: (customer: Customer) => void;
  isTrashMode?: boolean;
}

export default function CustomerTable({
  customers,
  sortField,
  sortDirection,
  onSortChange,
  onCustomerSelect,
  onCustomerDelete,
  onImageGallery,
  isTrashMode = false
}: CustomerTableProps) {
  const [search, setSearch] = useState('');
  
  // 검색 필터링된 고객 목록
  const filteredCustomers = customers.filter(customer => {
    const searchLower = search.toLowerCase();
    
    return (
      customer.name?.toLowerCase().includes(searchLower) ||
      customer.phone?.toLowerCase().includes(searchLower) ||
      customer.address?.toLowerCase().includes(searchLower) ||
      customer.special_notes?.toLowerCase().includes(searchLower) ||
      customer.customer_code?.toLowerCase().includes(searchLower)
    );
  });
  
  // 정렬된 고객 목록
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let valueA, valueB;
    
    if (sortField === '고객번호') {
      valueA = a.customer_code || '';
      valueB = b.customer_code || '';
    } else if (sortField === '고객명') {
      valueA = a.name || '';
      valueB = b.name || '';
    } else if (sortField === '전화번호') {
      valueA = a.phone || '';
      valueB = b.phone || '';
    } else if (sortField === '특이사항') {
      valueA = a.special_notes || '';
      valueB = b.special_notes || '';
    } else if (sortField === '상담수') {
      valueA = a.consultation_count || 0;
      valueB = b.consultation_count || 0;
    } else {
      valueA = '';
      valueB = '';
    }
    
    // 정렬 방향에 따라 비교
    const compareResult = typeof valueA === 'number' && typeof valueB === 'number'
      ? valueA - valueB
      : String(valueA).localeCompare(String(valueB));
    
    return sortDirection === 'asc' ? compareResult : -compareResult;
  });
  
  // 정렬 헤더 렌더링을 위한 함수
  const renderSortHeader = (label: string, field: string) => {
    return (
      <th
        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-50"
        onClick={() => onSortChange(field)}
      >
        <div className="flex items-center space-x-1">
          <span>{label}</span>
          {sortField === field && (
            <span>
              {sortDirection === 'asc' ? '▲' : '▼'}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-4">
        <input
          type="text"
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="고객명, 전화번호, 주소, 특이사항 등으로 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {renderSortHeader('고객번호', '고객번호')}
              {renderSortHeader('고객명', '고객명')}
              {renderSortHeader('전화번호', '전화번호')}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                성별
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                생년월일/추정나이
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                주소
              </th>
              {renderSortHeader('특이사항', '특이사항')}
              {renderSortHeader('상담수', '상담수')}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                관리
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCustomers.map((customer) => {
              return (
                <tr 
                  key={customer.id}
                  className="hover:bg-blue-50"
                >
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.customer_code}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.name}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.phone}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.gender}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.birth_date} {customer.estimated_age && `(${customer.estimated_age}세)`}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.address}
                  </td>
                  <td 
                    className="px-6 py-4 text-sm text-gray-500 cursor-pointer max-w-xs"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    <div className="truncate">
                      {customer.special_notes || '-'}
                    </div>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {customer.consultation_count || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {onImageGallery && (
                        <button
                          onClick={() => onImageGallery(customer)}
                          className="text-green-600 hover:text-green-900 px-2 py-1 rounded text-xs"
                          title="이미지 모아보기"
                        >
                          📷
                        </button>
                      )}
                      {onCustomerDelete && (
                        <button
                          onClick={() => onCustomerDelete(customer)}
                          className="text-red-600 hover:text-red-900 px-2 py-1 rounded text-xs"
                        >
                          {isTrashMode ? '완전삭제' : '삭제'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {sortedCustomers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {search ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
        </div>
      )}
    </div>
  );
} 