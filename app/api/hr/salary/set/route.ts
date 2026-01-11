import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 급여 정보 설정
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 관리자만 급여 설정 가능
    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '급여 설정 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      employee_id,
      base_salary,
      hourly_rate,
      effective_from,
      overtime_rate,
      night_shift_rate,
      holiday_rate,
      fixed_overtime_pay,
      meal_allowance,
      car_allowance,
      childcare_allowance,
    } = body;

    if (!employee_id) {
      return NextResponse.json(
        { error: 'employee_id가 필요합니다' },
        { status: 400 }
      );
    }

    if (!base_salary && !hourly_rate) {
      return NextResponse.json(
        { error: '기본급 또는 시급 중 하나는 필수입니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 기존 급여 정보의 effective_to 업데이트
    const today = effective_from || new Date().toISOString().split('T')[0];
    
    await supabase
      .from('salaries')
      .update({ effective_to: today })
      .eq('employee_id', employee_id)
      .is('effective_to', null);

    // 새 급여 정보 생성
    const salaryData: any = {
      employee_id,
      base_salary: base_salary || 0,
      hourly_rate: hourly_rate || null,
      effective_from: today,
      overtime_rate: overtime_rate || 1.5,
      night_shift_rate: night_shift_rate || 1.5,
      holiday_rate: holiday_rate || 2.0,
      meal_allowance: meal_allowance || 200000, // 기본 식대
      car_allowance: car_allowance || 0,
      childcare_allowance: childcare_allowance || 0,
      fixed_overtime_hours: 0,
      fixed_overtime_pay: fixed_overtime_pay || 0,
    };

    const { data, error } = await supabase
      .from('salaries')
      .insert(salaryData)
      .select()
      .single();

    if (error) {
      console.error('Salary set error:', error);
      return NextResponse.json(
        { error: '급여 설정에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '급여 정보가 설정되었습니다',
      data
    });

  } catch (error) {
    console.error('Salary set error:', error);
    return NextResponse.json(
      { error: '급여 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
