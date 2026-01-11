import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 급여 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const status = searchParams.get('status');

    const supabase = getEmployeePurchaseSupabase();

    let query = supabase
      .from('payroll')
      .select('*')
      .order('pay_period_start', { ascending: false });

    // 일반 직원은 본인 것만, 관리자는 전체 또는 특정 직원 조회 가능
    if (['manager', 'owner'].includes(user.role)) {
      // 관리자: employeeId가 있으면 특정 직원만, 없으면 전체
      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }
      // employeeId가 없으면 전체 조회
    } else {
      // 일반 직원: 본인 것만
      query = query.eq('employee_id', user.id);
    }

    // 필터 적용
    if (year) {
      query = query.gte('pay_period_start', `${year}-01-01`);
      query = query.lte('pay_period_end', `${year}-12-31`);
    }

    if (month) {
      const startDate = `${month}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0)
        .toISOString().split('T')[0];
      query = query.gte('pay_period_start', startDate);
      query = query.lte('pay_period_end', endDate);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: payrollData, error } = await query;

    if (error) {
      console.error('Payroll fetch error:', error);
      return NextResponse.json(
        { error: '급여 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // Employee 정보 추가
    if (payrollData && payrollData.length > 0) {
      const employeeIds = [...new Set(payrollData.map(p => p.employee_id))];
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, role, position')
        .in('id', employeeIds);

      const employeeMap = new Map(employees?.map(e => [e.id, e]) || []);
      
      const enrichedData = payrollData.map(payroll => ({
        ...payroll,
        employee: employeeMap.get(payroll.employee_id)
      }));

      return NextResponse.json({
        success: true,
        data: enrichedData
      });
    }

    return NextResponse.json({
      success: true,
      data: payrollData || []
    });

  } catch (error) {
    console.error('Payroll fetch error:', error);
    return NextResponse.json(
      { error: '급여 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
