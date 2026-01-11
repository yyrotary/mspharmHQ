import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 연차 자동 부여
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 연차 부여 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '연차 부여 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { employee_id, year } = body;

    if (!employee_id || !year) {
      return NextResponse.json(
        { error: 'employee_id와 year가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 1. 직원 정보 조회 (입사일)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('hire_date')
      .eq('id', employee_id)
      .single();

    if (empError || !employee || !employee.hire_date) {
      return NextResponse.json(
        { error: '직원 정보를 찾을 수 없거나 입사일이 설정되지 않았습니다' },
        { status: 404 }
      );
    }

    // 2. 근속년수 계산
    const hireDate = new Date(employee.hire_date);
    const endOfYear = new Date(`${year}-12-31`);
    const yearsOfService = Math.floor(
      (endOfYear.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    );

    // 3. 연차 일수 계산 (근로기준법)
    let annualDays = 0;
    if (yearsOfService < 1) {
      // 1년 미만: 월 1일 (최대 11일)
      const monthsWorked = Math.floor(
        (endOfYear.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      );
      annualDays = Math.min(11, monthsWorked);
    } else {
      // 1년 이상: 15일 + 매 2년마다 1일 (최대 25일)
      annualDays = Math.min(25, 15 + Math.floor((yearsOfService - 1) / 2));
    }

    // 4. 연차 leave_type_id 조회
    const { data: leaveType, error: typeError } = await supabase
      .from('leave_types')
      .select('id')
      .eq('code', 'ANNUAL')
      .single();

    if (typeError || !leaveType) {
      return NextResponse.json(
        { error: '연차 휴가 타입을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 5. leave_balance에 삽입 또는 업데이트
    const { data, error } = await supabase
      .from('leave_balance')
      .upsert({
        employee_id,
        leave_type_id: leaveType.id,
        year: parseInt(year),
        total_days: annualDays,
        used_days: 0,
      }, {
        onConflict: 'employee_id,leave_type_id,year',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Leave grant error:', error);
      return NextResponse.json(
        { error: '연차 부여에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${annualDays}일의 연차가 부여되었습니다`,
      data: {
        ...data,
        years_of_service: yearsOfService,
      }
    });

  } catch (error) {
    console.error('Leave grant error:', error);
    return NextResponse.json(
      { error: '연차 부여 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
