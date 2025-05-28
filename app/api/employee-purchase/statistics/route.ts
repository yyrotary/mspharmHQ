import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // owner만 통계 조회 가능
    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all';

    const supabase = getEmployeePurchaseSupabase();

    // 전체 통계 조회
    const { data: totalStats, error: totalError } = await supabase
      .from('purchase_requests')
      .select('status, total_amount, request_date')
      .gte('request_date', period === 'all' ? '1900-01-01' : getDateFilter(period));

    if (totalError) {
      console.error('Error fetching total stats:', totalError);
      return NextResponse.json({ 
        error: 'Failed to fetch statistics',
        details: totalError.message 
      }, { status: 500 });
    }

    // 통계 계산
    const totalRequests = totalStats?.length || 0;
    const totalAmount = totalStats?.reduce((sum, req) => sum + (req.total_amount || 0), 0) || 0;
    const pendingRequests = totalStats?.filter(req => req.status === 'pending').length || 0;
    const approvedRequests = totalStats?.filter(req => req.status === 'approved').length || 0;
    const cancelledRequests = totalStats?.filter(req => req.status === 'cancelled').length || 0;

    // 월별 데이터 그룹화
    const monthlyStats = groupByMonth(totalStats || []);

    // 직원별 통계를 위해 별도 조회
    const { data: employeeStats, error: employeeError } = await getEmployeeStats(supabase, period);

    if (employeeError) {
      console.error('Error fetching employee stats:', employeeError);
      // 직원별 통계 실패해도 전체 통계는 반환
    }

    return NextResponse.json({
      totalRequests,
      totalAmount,
      pendingRequests,
      approvedRequests,
      cancelledRequests,
      monthlyStats,
      employeeStats: employeeStats || [],
    });

  } catch (error) {
    console.error('Statistics error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getEmployeeStats(supabase: any, period: string) {
  try {
    // 먼저 구매 요청 데이터 조회
    const { data: requests, error: requestsError } = await supabase
      .from('purchase_requests')
      .select('employee_id, total_amount')
      .gte('request_date', period === 'all' ? '1900-01-01' : getDateFilter(period));

    if (requestsError) {
      throw requestsError;
    }

    // 직원 정보 조회
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, name');

    if (employeesError) {
      throw employeesError;
    }

    // 직원별 통계 계산
    const employeeMap = new Map(employees.map((emp: any) => [emp.id, emp.name]));
    const statsMap = new Map<string, { requests: number; amount: number }>();

    requests?.forEach((req: any) => {
      const employeeName = employeeMap.get(req.employee_id) || '알 수 없음';
      const current = statsMap.get(employeeName) || { requests: 0, amount: 0 };
      current.requests += 1;
      current.amount += req.total_amount || 0;
      statsMap.set(employeeName, current);
    });

    return {
      data: Array.from(statsMap.entries()).map(([employeeName, stats]) => ({
        employeeName,
        requests: stats.requests,
        amount: stats.amount,
      })).sort((a, b) => b.amount - a.amount),
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error: error
    };
  }
}

function getDateFilter(period: string): string {
  const now = new Date();
  
  switch (period) {
    case 'thisMonth':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'lastMonth':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    case 'last3Months':
      return new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();
    case 'thisYear':
      return new Date(now.getFullYear(), 0, 1).toISOString();
    default:
      return '1900-01-01';
  }
}

function groupByMonth(data: any[]): { month: string; requests: number; amount: number }[] {
  const grouped = data.reduce((acc, item) => {
    const date = new Date(item.request_date);
    const monthKey = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = { requests: 0, amount: 0 };
    }
    
    acc[monthKey].requests += 1;
    acc[monthKey].amount += (item.total_amount || 0);
    
    return acc;
  }, {} as Record<string, { requests: number; amount: number }>);

  return Object.entries(grouped)
    .map(([month, stats]) => ({
      month,
      requests: stats.requests,
      amount: stats.amount,
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12); // 최근 12개월만
} 