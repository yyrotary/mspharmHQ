import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
    try {
        const user = await verifyEmployeeAuth(request);
        if (!user || !['owner', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { records } = await request.json();

        if (!records || !Array.isArray(records) || records.length === 0) {
            return NextResponse.json({ error: '유효한 데이터가 없습니다.' }, { status: 400 });
        }

        const supabase = getEmployeePurchaseSupabase();
        const results = { success: 0, failed: 0, errors: [] as string[] };

        for (const record of records) {
            try {
                const { employee_id, work_date, check_in_time, check_out_time, notes } = record;

                if (!employee_id || !work_date || !check_in_time || !check_out_time) {
                    throw new Error(`필수 정보 누락 (${work_date})`);
                }

                // 시간 계산
                const checkIn = new Date(check_in_time);
                const checkOut = new Date(check_out_time);

                if (checkOut <= checkIn) {
                    throw new Error(`퇴근 시간이 출근 시간보다 빠를 수 없습니다 (${work_date})`);
                }

                const workHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                const roundedWorkHours = Math.round(workHours * 100) / 100;
                const overtimeHours = workHours > 8 ? Math.round((workHours - 8) * 100) / 100 : 0;
                const nightHours = calculateNightHours(checkIn, checkOut);

                const recordDate = new Date(work_date);
                const isHoliday = recordDate.getDay() === 0 || recordDate.getDay() === 6;

                // Upsert (Insert or Update) based on employee_id and work_date constraint
                // Note: Supabase upsert requires a unique constraint on the conflict columns.
                // Assuming there is a unique key on (employee_id, work_date). 
                // If not, we explicitly check existing like the single record route.
                // To be safe and consistent with single record logic, let's check first.

                const { data: existing } = await supabase
                    .from('attendance')
                    .select('id')
                    .eq('employee_id', employee_id)
                    .eq('work_date', work_date)
                    .single();

                let error;
                if (existing) {
                    const { error: updateError } = await supabase
                        .from('attendance')
                        .update({
                            check_in_time,
                            check_out_time,
                            work_hours: roundedWorkHours,
                            overtime_hours: overtimeHours,
                            night_hours: nightHours,
                            is_holiday: isHoliday,
                            notes: notes || '일괄 등록',
                            status: 'present',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', existing.id);
                    error = updateError;
                } else {
                    const { error: insertError } = await supabase
                        .from('attendance')
                        .insert({
                            employee_id,
                            work_date,
                            check_in_time,
                            check_out_time,
                            work_hours: roundedWorkHours,
                            overtime_hours: overtimeHours,
                            night_hours: nightHours,
                            is_holiday: isHoliday,
                            notes: notes || '일괄 등록',
                            status: 'present',
                            location: '본점',
                        });
                    error = insertError;
                }

                if (error) throw error;
                results.success++;

            } catch (err) {
                console.error('Batch processing error item:', record, err);
                results.failed++;
                results.errors.push((err as Error).message);
            }
        }

        return NextResponse.json({
            success: true,
            message: `${results.success}건 성공, ${results.failed}건 실패`,
            details: results
        });

    } catch (error) {
        console.error('Batch API error:', error);
        return NextResponse.json({ error: '일괄 처리 중 오류 발생' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const user = await verifyEmployeeAuth(request);
        if (!user || !['owner', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { ids } = await request.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: '삭제할 항목을 선택해주세요.' }, { status: 400 });
        }

        const supabase = getEmployeePurchaseSupabase();

        const { error } = await supabase
            .from('attendance')
            .delete()
            .in('id', ids);

        if (error) throw error;

        return NextResponse.json({
            success: true,
            message: `${ids.length}건의 근무 기록이 삭제되었습니다.`
        });

    } catch (error) {
        console.error('Batch delete error:', error);
        return NextResponse.json({ error: '일괄 삭제 중 오류가 발생했습니다.' }, { status: 500 });
    }
}

// 야간근무 시간 계산 helper (reused)
function calculateNightHours(checkIn: Date, checkOut: Date): number {
    let nightHours = 0;
    const current = new Date(checkIn);

    while (current < checkOut) {
        const hour = current.getHours();
        if (hour >= 22 || hour < 6) {
            const nextHour = new Date(current);
            nextHour.setHours(current.getHours() + 1);

            if (nextHour > checkOut) {
                const minutes = (checkOut.getTime() - current.getTime()) / (1000 * 60);
                nightHours += minutes / 60;
            } else {
                nightHours += 1;
            }
        }
        current.setHours(current.getHours() + 1);
    }

    return Math.round(nightHours * 100) / 100;
}
