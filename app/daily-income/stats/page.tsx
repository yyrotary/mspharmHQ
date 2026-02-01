'use client';

import { useState, useEffect } from 'react';
import { format, addMonths, subMonths, parseISO, startOfWeek, endOfWeek, getMonth, getYear, startOfMonth, endOfMonth, addYears, subYears } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMasterAuth } from '../../lib/master-auth';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';

// Format numbers as KRW
const formatKRW = (value: number) => {
    return new Intl.NumberFormat('ko-KR').format(value);
};

const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Data types
interface DailyData {
    date: string;
    income: number;
    expense: number;
    net: number;
    pos: number;
    diff: number;
}

interface MonthlyStats {
    dailyData: DailyData[];
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

export default function IncomeChartsPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('daily');
    const [currentDate, setCurrentDate] = useState(new Date()); // Controls Month (Daily View) or Year (Weekly/Monthly View)
    const [rawData, setRawData] = useState<DailyData[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [remainingTime, setRemainingTime] = useState(0);

    const router = useRouter();
    const { isAuthenticated, logout, getRemainingTime, setLogoutCallback } = useMasterAuth();

    useEffect(() => {
        // Auth Check
        if (!isAuthenticated()) {
            router.push('/master-login');
            return;
        }

        // Logout Callback
        setLogoutCallback(() => {
            router.push('/master-login');
        });

        // Timer
        const timer = setInterval(() => {
            const remaining = getRemainingTime();
            setRemainingTime(remaining);

            if (remaining <= 0) {
                logout();
                router.push('/master-login');
            }
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Fetch Data Logic
    const fetchData = async () => {
        try {
            setLoading(true);
            setMessage('');

            let url = '';

            // For Daily view, we still fetch by month to keep it light
            if (viewMode === 'daily') {
                const yearMonth = format(currentDate, 'yyyy-MM');
                url = `/api/daily-income/monthly?mode=month&yearMonth=${yearMonth}`;
            } else {
                // For Weekly/Monthly, we fetch all data to ensure we can aggregate properly across years
                // Ideally this should be filtered by Year in backend, but 'all' mode exists
                url = `/api/daily-income/monthly?mode=all`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                setRawData(result.stats.dailyData || []);
            } else {
                setMessage(`Data Fetch Failed: ${result.error}`);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            setMessage('Failed to load chart data.');
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when dependencies change
    useEffect(() => {
        if (isAuthenticated()) {
            fetchData();
        }
    }, [viewMode, currentDate]); // Re-fetch on mode or date change

    // Aggregation Logic
    useEffect(() => {
        if (!rawData || rawData.length === 0) {
            setChartData([]);
            return;
        }

        let processedData = [];

        if (viewMode === 'daily') {
            // Daily View: Just map raw data
            // Filter by selected month if we fetched 'all' (though we fetch by month for efficiency usually)
            // But if we switched from Monthly -> Daily, we might have 'all' data.
            // Let's enforce filtering by current selected month just in case.
            const targetMonth = format(currentDate, 'yyyy-MM');

            processedData = rawData
                .filter(item => item.date.startsWith(targetMonth))
                .map(item => ({
                    ...item,
                    shortDate: item.date.substring(8) + '일', // "DD일"
                    fullDate: item.date
                }));

        } else if (viewMode === 'weekly') {
            // Weekly View: Group by Week Number of Year
            // Filter by selected Year
            const targetYear = getYear(currentDate);

            const weeklyMap = new Map();

            rawData.forEach(item => {
                const itemDate = parseISO(item.date);
                if (getYear(itemDate) !== targetYear) return;

                // Configure week starting on Sunday or Monday? Standard ISO week starts Monday. 
                // Let's use simplified "Week N" logic or Date Range.
                // startOfWeek defaults to Sunday. set { weekStartsOn: 1 } for Monday.
                const weekStart = startOfWeek(itemDate, { weekStartsOn: 1 });
                const weekKey = format(weekStart, 'yyyy-MM-dd'); // Identify week by start date

                if (!weeklyMap.has(weekKey)) {
                    weeklyMap.set(weekKey, {
                        date: weekKey,
                        income: 0, expense: 0, net: 0, pos: 0, diff: 0, count: 0
                    });
                }

                const weekStats = weeklyMap.get(weekKey);
                weekStats.income += item.income;
                weekStats.expense += item.expense;
                weekStats.net += item.net;
                weekStats.pos += item.pos;
                weekStats.diff += item.diff; // Summing diffs? Or calculating diff of sums? 
                // Summing diffs is safer if daily diffs capture specific adjustments.
                weekStats.count += 1;
            });

            processedData = Array.from(weeklyMap.values())
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(item => ({
                    ...item,
                    shortDate: format(parseISO(item.date), 'M/d') + ' 주', // "M/d 주"
                    fullDate: `${item.date} ~`
                }));

        } else if (viewMode === 'monthly') {
            // Monthly View: Group by Month
            // Filter by selected Year (or show all years? User just asked for "Monthly". Usually per year is better chart-wise, or multiple years line.)
            // Let's show selected Year's months.
            const targetYear = getYear(currentDate);

            const monthlyMap = new Map();

            // Initialize all 12 months for the year to have continuous X-axis
            for (let i = 0; i < 12; i++) {
                const monthKey = `${targetYear}-${String(i + 1).padStart(2, '0')}`;
                monthlyMap.set(monthKey, {
                    date: monthKey,
                    income: 0, expense: 0, net: 0, pos: 0, diff: 0, count: 0
                });
            }

            rawData.forEach(item => {
                const itemYear = getYear(parseISO(item.date));
                if (itemYear !== targetYear) return;

                const monthKey = item.date.substring(0, 7); // YYYY-MM

                if (monthlyMap.has(monthKey)) {
                    const monthStats = monthlyMap.get(monthKey);
                    monthStats.income += item.income;
                    monthStats.expense += item.expense;
                    monthStats.net += item.net;
                    monthStats.pos += item.pos;
                    monthStats.diff += item.diff;
                    monthStats.count += 1;
                }
            });

            processedData = Array.from(monthlyMap.values())
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(item => ({
                    ...item,
                    shortDate: item.date.substring(5) + '월', // "MM월"
                    fullDate: item.date
                }));
        }

        setChartData(processedData);

    }, [rawData, viewMode, currentDate]);

    // Navigation Handlers
    const handlePrev = () => {
        if (viewMode === 'daily') {
            setCurrentDate(subMonths(currentDate, 1));
        } else {
            // Weekly/Monthly: Move by Year
            setCurrentDate(subYears(currentDate, 1));
        }
    };

    const handleNext = () => {
        if (viewMode === 'daily') {
            setCurrentDate(addMonths(currentDate, 1));
        } else {
            // Weekly/Monthly: Move by Year
            setCurrentDate(addYears(currentDate, 1));
        }
    };

    const periodLabel = () => {
        if (viewMode === 'daily') return format(currentDate, 'yyyy-MM');
        return format(currentDate, 'yyyy년');
    };

    const formatShortDate = (dateStr: string) => {
        // Handle potentially different date formats in tooltips
        return dateStr;
    };

    // Logout Helper
    const handleLogout = () => {
        logout();
        router.push('/master-login');
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem', fontFamily: 'sans-serif' }}>
            {/* Header */}
            <div style={{
                backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af', margin: 0 }}>
                        수입/지출 차트
                    </h1>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        backgroundColor: remainingTime < 60000 ? '#fee2e2' : '#f0f9ff',
                        color: remainingTime < 60000 ? '#b91c1c' : '#1e40af',
                        padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 'bold'
                    }}>
                        ⏱️ {formatTime(remainingTime)}
                    </div>

                    <Link href="/daily-income/monthly" style={{
                        backgroundColor: '#8b5cf6', color: 'white', textDecoration: 'none', borderRadius: '0.375rem',
                        padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 'bold'
                    }}>
                        통계 표 보기
                    </Link>

                    <button onClick={handleLogout} style={{
                        backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '0.375rem',
                        padding: '0.5rem 1rem', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 'bold'
                    }}>
                        로그아웃
                    </button>
                </div>
            </div>

            {/* View Mode & Date Control */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>

                {/* View Mode Toggle */}
                <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '0.375rem', overflow: 'hidden' }}>
                    <button
                        onClick={() => setViewMode('daily')}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: viewMode === 'daily' ? '#3b82f6' : 'white', color: viewMode === 'daily' ? 'white' : 'black', border: 'none' }}
                    >일별</button>
                    <button
                        onClick={() => setViewMode('weekly')}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: viewMode === 'weekly' ? '#3b82f6' : 'white', color: viewMode === 'weekly' ? 'white' : 'black', border: 'none', borderLeft: '1px solid #e5e7eb' }}
                    >주별</button>
                    <button
                        onClick={() => setViewMode('monthly')}
                        style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: viewMode === 'monthly' ? '#3b82f6' : 'white', color: viewMode === 'monthly' ? 'white' : 'black', border: 'none', borderLeft: '1px solid #e5e7eb' }}
                    >월별</button>
                </div>

                {/* Period Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={handlePrev} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#e0e7ff', border: 'none', borderRadius: '0.375rem' }}>◀</button>
                    <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{periodLabel()}</span>
                    <button onClick={handleNext} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#e0e7ff', border: 'none', borderRadius: '0.375rem' }}>▶</button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading charts...</div>
            ) : message ? (
                <div style={{ color: 'red', textAlign: 'center' }}>{message}</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>

                    {/* Chart 1: Income vs Expense vs Net */}
                    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#1e40af' }}>수입 / 지출 / 정산 비교 ({viewMode === 'daily' ? '일별' : viewMode === 'weekly' ? '주별' : '월별'})</h3>
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="shortDate" label={{ value: viewMode === 'daily' ? '일' : viewMode === 'weekly' ? '주' : '월', position: 'insideBottomRight', offset: -5 }} />
                                    <YAxis tickFormatter={(value) => `${value / 10000}만`} />
                                    <Tooltip formatter={(value: number) => formatKRW(value)} />
                                    <Legend />
                                    <Bar dataKey="income" name="일반 매출" fill="#3b82f6" barSize={20} />
                                    <Bar dataKey="expense" name="차감(비용)" fill="#ef4444" barSize={20} />
                                    <Line type="monotone" dataKey="net" name="정산 합계" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Chart 2: Net vs POS vs Diff */}
                    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '1rem', color: '#4c1d95' }}>정산 합계 vs POS 매출 비교 ({viewMode === 'daily' ? '일별' : viewMode === 'weekly' ? '주별' : '월별'})</h3>
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="shortDate" />
                                    <YAxis domain={['auto', 'auto']} tickFormatter={(value) => `${value / 10000}만`} />
                                    <Tooltip formatter={(value: number) => formatKRW(value)} />
                                    <Legend />
                                    <Line type="monotone" dataKey="net" name="정산 합계" stroke="#10b981" strokeWidth={2} />
                                    <Line type="monotone" dataKey="pos" name="POS 매출" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="5 5" />
                                    <Line type="monotone" dataKey="diff" name="차이 (과부족)" stroke="#f59e0b" strokeWidth={2} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
