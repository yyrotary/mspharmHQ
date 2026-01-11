import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 직원 정보 수정
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const {
      name,
      role,
      email,
      phone,
      position,
      employment_type,
      hire_date,
      is_active,
      resignation_date,
      base_salary,
      hourly_rate,
      fixed_overtime_pay,
    } = body;

    const supabase = getEmployeePurchaseSupabase();

    // employees 테이블 업데이트
    const employeeUpdates: any = {};
    if (name !== undefined) employeeUpdates.name = name;
    if (role !== undefined) employeeUpdates.role = role;
    if (email !== undefined) employeeUpdates.email = email;
    if (phone !== undefined) employeeUpdates.phone = phone;
    if (position !== undefined) employeeUpdates.position = position;
    if (employment_type !== undefined) employeeUpdates.employment_type = employment_type;
    if (hire_date !== undefined) employeeUpdates.hire_date = hire_date || null;
    if (is_active !== undefined) employeeUpdates.is_active = is_active;
    if (resignation_date !== undefined) employeeUpdates.resignation_date = resignation_date || null;

    // 업데이트할 내용이 있으면 업데이트 실행
    if (Object.keys(employeeUpdates).length > 0) {
      employeeUpdates.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('employees')
        .update(employeeUpdates)
        .eq('id', id);

      if (updateError) {
        console.error('Employee update error:', updateError);
        return NextResponse.json(
          { error: '직원 정보 업데이트 실패' },
          { status: 500 }
        );
      }
    }

    // 급여 정보 업데이트 (base_salary, hourly_rate, fixed_overtime_pay 중 하나라도 있으면)
    if (base_salary !== undefined || hourly_rate !== undefined || fixed_overtime_pay !== undefined) {
      // 다음달 1일을 계산 (급여 인상은 다음달부터 적용)
      const today = new Date();
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthFirstDay = nextMonth.toISOString().split('T')[0];
      
      // 이번달 마지막날
      const thisMonthLastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

      // 현재 유효한 급여 정보 조회
      const { data: currentSalaries } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', id)
        .is('effective_to', null)
        .single();

      // 새 급여 정보 준비 (기존 값 유지)
      const salaryData: any = {
        employee_id: id,
        effective_from: nextMonthFirstDay,
        effective_to: null,
        // 기존 값들 유지
        meal_allowance: currentSalaries?.meal_allowance || 200000,
        car_allowance: currentSalaries?.car_allowance || 0,
        childcare_allowance: currentSalaries?.childcare_allowance || 0,
        overtime_rate: currentSalaries?.overtime_rate || 1.5,
        night_shift_rate: currentSalaries?.night_shift_rate || 1.5,
        holiday_rate: currentSalaries?.holiday_rate || 2.0,
        fixed_overtime_hours: currentSalaries?.fixed_overtime_hours || 0,
        base_salary: currentSalaries?.base_salary || 0,
        hourly_rate: currentSalaries?.hourly_rate || 0,
        fixed_overtime_pay: currentSalaries?.fixed_overtime_pay || 0,
      };

      // 새로 입력된 값으로 업데이트
      // 파트타임 여부 확인
      const isPartTime = employment_type === 'part_time';
      
      if (base_salary !== undefined) {
        const baseSalaryValue = parseFloat(base_salary) || 0;
        salaryData.base_salary = baseSalaryValue;
        // 파트타임이 아닌 경우에만 기본급에서 시급 자동 계산
        if (!isPartTime && baseSalaryValue > 0) {
          salaryData.hourly_rate = baseSalaryValue / 209;
        }
      } else if (hourly_rate !== undefined) {
        const hourlyRateValue = parseFloat(hourly_rate) || 0;
        salaryData.hourly_rate = hourlyRateValue;
        // 파트타임이 아닌 경우에만 시급에서 기본급 자동 계산
        if (!isPartTime && hourlyRateValue > 0) {
          salaryData.base_salary = hourlyRateValue * 209;
        } else if (isPartTime) {
          // 파트타임인 경우 기본급은 0
          salaryData.base_salary = 0;
        }
      }

      if (fixed_overtime_pay !== undefined) {
        salaryData.fixed_overtime_pay = parseFloat(fixed_overtime_pay) || 0;
      }

      // 다음달부터 시작하는 미래의 급여 레코드가 이미 있는지 확인
      const { data: futureSalary } = await supabase
        .from('salaries')
        .select('id')
        .eq('employee_id', id)
        .eq('effective_from', nextMonthFirstDay)
        .is('effective_to', null)
        .single();

      if (futureSalary) {
        // 다음달부터 시작하는 레코드가 이미 있으면 업데이트 (같은 날 여러 번 수정한 경우)
        const { error: updateError } = await supabase
          .from('salaries')
          .update(salaryData)
          .eq('id', futureSalary.id);

        if (updateError) {
          console.error('Future salary update error:', updateError);
          console.warn('급여 정보 업데이트 실패, 직원 정보는 업데이트됨');
        }
      } else {
        // 다음달부터 시작하는 레코드가 없으면 새로 생성
        // 현재 유효한 레코드의 effective_to를 이번달 마지막날로 설정
        if (currentSalaries) {
          await supabase
            .from('salaries')
            .update({ effective_to: thisMonthLastDay })
            .eq('employee_id', id)
            .is('effective_to', null);
        }

        const { error: insertError } = await supabase
          .from('salaries')
          .insert(salaryData);

        if (insertError) {
          console.error('Salary insert error:', insertError);
          console.warn('급여 정보 저장 실패, 직원 정보는 업데이트됨');
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '직원 정보가 성공적으로 업데이트되었습니다',
    });

  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 직원 삭제
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'owner') {
      return NextResponse.json({ error: 'Owner access required' }, { status: 403 });
    }

    const { id } = await context.params;

    // 자기 자신 삭제 방지
    if (id === user.id) {
      return NextResponse.json(
        { error: '자기 자신은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 구매 요청 내역 확인
    const { data: requests, error: checkError } = await supabase
      .from('purchase_requests')
      .select('id')
      .eq('employee_id', id)
      .limit(1);

    if (checkError) {
      console.error('Check requests error:', checkError);
      return NextResponse.json(
        { error: '삭제 가능 여부 확인 실패' },
        { status: 500 }
      );
    }

    if (requests && requests.length > 0) {
      return NextResponse.json(
        { error: '구매 요청 내역이 있는 직원은 삭제할 수 없습니다. 퇴사 처리를 이용해주세요.' },
        { status: 400 }
      );
    }

    // 직원 삭제 (CASCADE로 관련 데이터 자동 삭제)
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Employee delete error:', deleteError);
      return NextResponse.json(
        { error: '직원 삭제에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '직원이 성공적으로 삭제되었습니다',
    });

  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
