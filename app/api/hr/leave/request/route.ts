import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 휴가 신청
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { leave_type_id, start_date, end_date, total_days, reason } = body;

    if (!leave_type_id || !start_date || !end_date || !total_days) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();
    const currentYear = new Date(start_date).getFullYear();

    // 1. 휴가 종류 확인
    const { data: leaveType, error: leaveTypeError } = await supabase
      .from('leave_types')
      .select('*')
      .eq('id', leave_type_id)
      .single();

    if (leaveTypeError || !leaveType) {
      return NextResponse.json(
        { error: '휴가 종류를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 2. 휴가 잔여 일수 확인
    const { data: balance, error: balanceError } = await supabase
      .from('leave_balance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('leave_type_id', leave_type_id)
      .eq('year', currentYear)
      .single();

    if (balanceError && balanceError.code !== 'PGRST116') {
      console.error('Leave balance error:', balanceError);
      return NextResponse.json(
        { error: '휴가 잔여 일수 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    // 잔여 일수 체크 (무제한이 아닌 경우)
    if (balance && leaveType.max_days_per_year) {
      const remainingDays = parseFloat(balance.remaining_days);
      if (remainingDays < total_days) {
        return NextResponse.json(
          { error: `휴가 잔여 일수가 부족합니다 (잔여: ${remainingDays}일)` },
          { status: 400 }
        );
      }
    }

    // 3. 날짜 중복 확인
    const { data: overlapping, error: overlapError } = await supabase
      .from('leave_requests')
      .select('id')
      .eq('employee_id', user.id)
      .neq('status', 'rejected')
      .neq('status', 'cancelled')
      .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

    if (overlapError) {
      console.error('Overlap check error:', overlapError);
    }

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: '해당 기간에 이미 휴가 신청이 있습니다' },
        { status: 400 }
      );
    }

    // 4. 휴가 신청 생성
    const { data: leaveRequest, error: requestError } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: user.id,
        leave_type_id,
        start_date,
        end_date,
        total_days,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (requestError) {
      console.error('Leave request error:', requestError);
      return NextResponse.json(
        { error: '휴가 신청에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '휴가 신청이 완료되었습니다',
      data: leaveRequest
    });

  } catch (error) {
    console.error('Leave request error:', error);
    return NextResponse.json(
      { error: '휴가 신청 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 휴가 신청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employee_id');
    const status = searchParams.get('status');

    const supabase = getEmployeePurchaseSupabase();

    // 관리자는 전체 조회, 일반 직원은 본인 것만
    const targetEmployeeId = ['manager', 'owner'].includes(user.role) && employeeId 
      ? employeeId 
      : user.id;

    let query = supabase
      .from('leave_requests')
      .select(`
        *,
        employee:employees(id, name, role, position),
        leave_type:leave_types(id, name, code, is_paid),
        approver:approved_by(id, name)
      `)
      .order('requested_at', { ascending: false });

    if (!['manager', 'owner'].includes(user.role)) {
      query = query.eq('employee_id', targetEmployeeId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Leave requests fetch error:', error);
      return NextResponse.json(
        { error: '휴가 신청 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Leave requests fetch error:', error);
    return NextResponse.json(
      { error: '휴가 신청 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
