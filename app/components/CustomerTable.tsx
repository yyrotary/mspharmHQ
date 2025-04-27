'use client';

import { useState } from 'react';
import { NotionCustomer, CUSTOMER_SCHEMA, getNotionPropertyValue } from '@/app/lib/notion-schema';

interface CustomerTableProps {
  customers: NotionCustomer[];
  sortField: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string) => void;
  onCustomerSelect: (customer: NotionCustomer) => void;
  onCustomerDelete?: (customer: NotionCustomer) => void;
  isTrashMode?: boolean;
}

export default function CustomerTable({
  customers,
  sortField,
  sortDirection,
  onSortChange,
  onCustomerSelect,
  onCustomerDelete,
  isTrashMode = false
}: CustomerTableProps) {
  const [search, setSearch] = useState('');
  
  // 검색 필터링된 고객 목록
  const filteredCustomers = customers.filter(customer => {
    const name = getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type) || '';
    const phone = getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type) || '';
    const address = getNotionPropertyValue(customer.properties.주소, CUSTOMER_SCHEMA.주소.type) || '';
    const specialNote = getNotionPropertyValue(customer.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type) || '';
    const id = getNotionPropertyValue(customer.properties.id, 'title') || '';
    
    const searchLower = search.toLowerCase();
    
    return (
      String(name).toLowerCase().includes(searchLower) ||
      String(phone).toLowerCase().includes(searchLower) ||
      String(address).toLowerCase().includes(searchLower) ||
      String(specialNote).toLowerCase().includes(searchLower) ||
      String(id).toLowerCase().includes(searchLower)
    );
  });
  
  // 정렬된 고객 목록
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let valueA, valueB;
    
    if (sortField === '고객번호') {
      valueA = getNotionPropertyValue(a.properties.id, 'title') || '';
      valueB = getNotionPropertyValue(b.properties.id, 'title') || '';
    } else if (sortField === '고객명') {
      valueA = getNotionPropertyValue(a.properties.고객명, CUSTOMER_SCHEMA.고객명.type) || '';
      valueB = getNotionPropertyValue(b.properties.고객명, CUSTOMER_SCHEMA.고객명.type) || '';
    } else if (sortField === '전화번호') {
      valueA = getNotionPropertyValue(a.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type) || '';
      valueB = getNotionPropertyValue(b.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type) || '';
    } else if (sortField === '특이사항') {
      valueA = getNotionPropertyValue(a.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type) || '';
      valueB = getNotionPropertyValue(b.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type) || '';
    } else if (sortField === '상담수') {
      valueA = a.properties.상담수?.formula?.number || 0;
      valueB = b.properties.상담수?.formula?.number || 0;
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
              // 각 속성값 추출
              const id = getNotionPropertyValue(customer.properties.id, 'title') || '';
              const name = getNotionPropertyValue(customer.properties.고객명, CUSTOMER_SCHEMA.고객명.type) || '';
              const phone = getNotionPropertyValue(customer.properties.전화번호, CUSTOMER_SCHEMA.전화번호.type) || '';
              const gender = getNotionPropertyValue(customer.properties.성별, CUSTOMER_SCHEMA.성별.type) || '';
              const birth = getNotionPropertyValue(customer.properties.생년월일, CUSTOMER_SCHEMA.생년월일.type) || '';
              const estimatedAge = getNotionPropertyValue(customer.properties.추정나이, CUSTOMER_SCHEMA.추정나이.type) || '';
              const address = getNotionPropertyValue(customer.properties.주소, CUSTOMER_SCHEMA.주소.type) || '';
              const specialNote = getNotionPropertyValue(customer.properties.특이사항, CUSTOMER_SCHEMA.특이사항.type) || '';
              const consultCount = customer.properties.상담수?.formula?.number || 0;
              
              return (
                <tr 
                  key={customer.id}
                  className="hover:bg-blue-50"
                >
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {id}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {name}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {phone}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {gender}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {birth} {estimatedAge && `(${estimatedAge}세)`}
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {address}
                  </td>
                  <td 
                    className="px-6 py-4 text-sm text-gray-500 cursor-pointer max-w-xs"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    <div className="truncate">
                      {specialNote || '-'}
                    </div>
                  </td>
                  <td 
                    className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                    onClick={() => onCustomerSelect(customer)}
                  >
                    {consultCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {onCustomerDelete && (
                      <button
                        className={isTrashMode ? "text-green-600 hover:text-green-900 ml-2" : "text-red-600 hover:text-red-900 ml-2"}
                        onClick={(e) => {
                          e.stopPropagation();
                          
                          const message = isTrashMode
                            ? `${name} 고객을 복원하시겠습니까?`
                            : `${name} 고객을 휴지통으로 이동하시겠습니까?`;
                            
                          if (window.confirm(message)) {
                            onCustomerDelete(customer);
                          }
                        }}
                      >
                        {isTrashMode ? '복원' : '삭제'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {sortedCustomers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">
                  {search ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 