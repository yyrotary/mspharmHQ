'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AttendanceTable from '@/app/components/hr/AttendanceTable';
import PayrollCalculator from '@/app/components/hr/PayrollCalculator';
import AttendanceEditModal from '@/app/components/hr/AttendanceEditModal';
import EmployeeProfileEdit from '@/app/components/hr/EmployeeProfileEdit';

// --- Interfaces ---
interface User {
    id: string;
    name: string;
    role: string;
}

interface Employee {
    id: string;
    name: string;
    position: string;
    employment_type: string;
}

interface AttendanceRecord {
    id: string;
    employee_id: string;
    employee_name: string;
    work_date: string;
    check_in_time: string;
    check_out_time: string;
    work_hours: number;
    overtime_hours: number;
    night_hours: number;
    is_holiday: boolean;
    status: string;
}

export default function UnifiedManagerPage() {
    const router = useRouter();

    // Auth & Data State
    const [user, setUser] = useState<User | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loadingEmployees, setLoadingEmployees] = useState(true);

    // Selection State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [activeTab, setActiveTab] = useState<'attendance' | 'payroll' | 'info'>('attendance');

    // Attendance Data State
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);

    // Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

    // --- 1. Auth & Initial Load ---
    useEffect(() => {
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
            }
        };
        checkAuth();
    }, []);

    const loadEmployees = async () => {
        try {
            const response = await fetch('/api/employee-purchase/employees');
            if (response.ok) {
                const data = await response.json();
                setEmployees(data.employees || []);
                if (data.employees.length > 0) {
                    setSelectedEmployeeId(data.employees[0].id);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingEmployees(false);
        }
    };

    // --- 2. Load Attendance When Selection Changes ---
    useEffect(() => {
        if (selectedEmployeeId && selectedMonth) {
            loadAttendance();
        }
    }, [selectedEmployeeId, selectedMonth]);

    const loadAttendance = async () => {
        setLoadingAttendance(true);
        try {
            const response = await fetch(`/api/hr/attendance/monthly?employee_id=${selectedEmployeeId}&month=${selectedMonth}`);
            if (response.ok) {
                const data = await response.json();
                setAttendance(data.data?.attendance || []);
            }
        } catch (error) {
            console.error(error);
            toast.error('근무 기록을 불러오지 못했습니다');
        } finally {
            setLoadingAttendance(false);
        }
    };

    // --- 3. Handlers ---
    const handleEditAttendance = (record: AttendanceRecord) => {
        setEditingRecord(record); // If empty record passed, it's 'New'
        setIsEditModalOpen(true);
    };

    const handleAddAttendance = () => {
        setEditingRecord(null);
        setIsEditModalOpen(true);
    }

    // Helper to find selected employee object
    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 shadow-md">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">💼</span>
                        <div>
                            <h1 className="text-xl font-bold">HR 통합 관리자</h1>
                            <p className="text-xs opacity-70">Unified Human Resources Manager</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Link href="/employee-hr/admin/dashboard" className="text-sm opacity-80 hover:opacity-100">
                            ← 대시보드
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full p-4 grid grid-cols-12 gap-6">
                {/* Left Sidebar: Employee List */}
                <aside className="col-span-12 md:col-span-3 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-100px)]">
                    <div className="p-4 border-b bg-gray-50">
                        <h2 className="font-bold text-gray-700">👥 직원 목록</h2>
                        <input
                            type="text"
                            placeholder="검색..."
                            className="mt-2 w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {loadingEmployees ? (
                            <div className="p-4 text-center">Loading...</div>
                        ) : (
                            <ul className="divide-y">
                                {employees.map(emp => (
                                    <li key={emp.id}>
                                        <button
                                            onClick={() => setSelectedEmployeeId(emp.id)}
                                            className={`w-full text-left p-4 hover:bg-slate-50 transition-colors flex justify-between items-center ${selectedEmployeeId === emp.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                                }`}
                                        >
                                            <div>
                                                <p className="font-medium text-gray-900">{emp.name}</p>
                                                <p className="text-xs text-gray-500">{emp.position}</p>
                                            </div>
                                            {selectedEmployeeId === emp.id && <span className="text-blue-500">👉</span>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </aside>

                {/* Right Content: Tabs & Workspace */}
                <section className="col-span-12 md:col-span-9 flex flex-col h-[calc(100vh-100px)]">
                    {/* Toolbar */}
                    <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex justify-between items-center">
                        <div className="flex items-center space-x-4">
                            <h2 className="text-lg font-bold">
                                {selectedEmployee?.name || '직원 선택'}
                                <span className="text-sm font-normal text-gray-500 ml-2">
                                    {selectedEmployee?.position} / {selectedEmployee?.employment_type === 'part_time' ? '시급제' : '월급제'}
                                </span>
                            </h2>
                        </div>
                        <div>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="px-3 py-2 border rounded-md font-bold text-gray-700"
                            />
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white rounded-t-xl shadow-sm border-b">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('attendance')}
                                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'attendance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                📅 근태 관리
                            </button>
                            <button
                                onClick={() => setActiveTab('payroll')}
                                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'payroll' ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                💰 급여 정산
                            </button>
                            <button
                                onClick={() => setActiveTab('info')}
                                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'info' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                👤 정보 수정
                            </button>
                        </div>
                    </div>

                    {/* Workspace Area */}
                    <div className="bg-white rounded-b-xl shadow-sm flex-1 p-6 overflow-y-auto">
                        {activeTab === 'attendance' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-700">월간 근무 기록</h3>
                                    <div className="space-x-2">
                                        <button
                                            onClick={handleAddAttendance}
                                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                                        >
                                            + 기록 추가
                                        </button>
                                        <button className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700">
                                            📷 스캔
                                        </button>
                                    </div>
                                </div>
                                <AttendanceTable
                                    records={attendance}
                                    loading={loadingAttendance}
                                    onEdit={handleEditAttendance}
                                    onDelete={() => { }}
                                    onDeleteSelected={() => { }}
                                />
                                <AttendanceEditModal
                                    isOpen={isEditModalOpen}
                                    onClose={() => setIsEditModalOpen(false)}
                                    // Hack: Convert UI record to EditModal props or reuse types
                                    record={editingRecord as any}
                                    employeeId={selectedEmployeeId}
                                    onSave={() => loadAttendance()}
                                />
                            </div>
                        )}

                        {activeTab === 'payroll' && selectedEmployeeId && (
                            <PayrollCalculator
                                employeeId={selectedEmployeeId}
                                employee={selectedEmployee} // Pass employee info
                                attendanceRecords={attendance} // Pass attendance records for preview
                                month={selectedMonth}
                                onAttendanceRequest={() => setActiveTab('attendance')}
                                onSuccess={() => {
                                    // Refresh logic if needed
                                }}
                            />
                        )}

                        {activeTab === 'info' && selectedEmployeeId && (
                            <EmployeeProfileEdit employeeId={selectedEmployeeId} />
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
