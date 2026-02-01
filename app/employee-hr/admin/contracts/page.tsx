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

interface Employee {
    id: string;
    name: string;
    position: string;
    start_date: string;
    contract_status?: 'pending' | 'active' | 'expired';
}

export default function ContractManagementPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const response = await fetch('/api/employee-purchase/auth/me');
            if (response.ok) {
                const data = await response.json();
                if (!['owner', 'manager'].includes(data.user.role)) {
                    toast.error('관리자만 접근할 수 있습니다');
                    router.push('/employee-purchase');
                    return;
                }
                setUser(data.user);
                loadEmployees();
            } else {
                router.push('/employee-purchase/login');
            }
        } catch (error) {
            router.push('/employee-purchase/login');
        } finally {
            // setLoading(false); // loadEmployees에서 처리
        }
    };

    const loadEmployees = async () => {
        try {
            const response = await fetch('/api/employee-purchase/employees');
            if (response.ok) {
                const data = await response.json();
                // 실제 데이터에는 contract_status가 없을 수 있으므로 임의로 매핑하거나 null 처리
                setEmployees(data.employees || []);
            }
        } catch (error) {
            console.error('Load employees error:', error);
            toast.error('직원 목록을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status?: string) => {
        // 임시 상태 로직. 실제 DB 연동 필요.
        // 현재는 모두 '미작성' 또는 '확인 필요'로 표시될 수 있음.
        if (status === 'active') {
            return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">계약 중</span>;
        } else if (status === 'expired') {
            return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">만료됨</span>;
        } else {
            return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">미작성</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-rose-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 상단 헤더 */}
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 text-white p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold">📝 근로 계약 관리</h1>
                            <p className="text-sm opacity-90 mt-1">직원별 근로 계약서 작성 및 관리 현황</p>
                        </div>
                        <Link
                            href="/employee-hr/admin/dashboard"
                            className="px-4 py-2 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 text-sm font-medium"
                        >
                            ← 대시보드
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">계약 현황</h2>
                        {/* <button className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm hover:bg-rose-700">
                    + 신규 계약 작성
                </button> */}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직책</th>
                                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입사일</th> */}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">계약 상태</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">관리</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {employees.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 mr-3">
                                                    {emp.name[0]}
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {emp.position || '-'}
                                        </td>
                                        {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {emp.start_date || '-'}
                      </td> */}
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getStatusBadge(emp.contract_status)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-rose-600 hover:text-rose-900 mr-3">
                                                작성
                                            </button>
                                            <button className="text-gray-400 hover:text-gray-600 cursor-not-allowed">
                                                보기
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {employees.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            등록된 직원이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
