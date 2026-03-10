import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 급여 이력 조회 및 추가
export async function GET(
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
        const supabase = getEmployeePurchaseSupabase();

        const { data: salaries, error } = await supabase
            .from('salaries')
            .select('*')
            .eq('employee_id', id)
            .order('effective_from', { ascending: false });

        if (error) {
            console.error('Error fetching salary history:', error);
            return NextResponse.json({ error: 'Failed to fetch salary history' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            salaries: salaries || []
        });

    } catch (error) {
        console.error('Get salary history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
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
            base_salary,
            hourly_rate,
            fixed_overtime_pay,
            overtime_rate,
            night_shift_rate,
            holiday_rate,
            effective_from,
        } = body;

        if (!effective_from) {
            return NextResponse.json({ error: 'Effective date is required' }, { status: 400 });
        }

        const supabase = getEmployeePurchaseSupabase();

        // 1. Check for duplicate start date
        const { data: existing } = await supabase
            .from('salaries')
            .select('id')
            .eq('employee_id', id)
            .eq('effective_from', effective_from)
            .single();

        if (existing) {
            // If exists, use PUT/PATCH logic (or just fail for now and ask user to edit)
            // For simplicity in "Add", we fail. User should edit existing instead.
            return NextResponse.json({ error: 'A record with this start date already exists. Please edit it instead.' }, { status: 400 });
        }

        // 2. Prepare new record data
        const newRecord: any = {
            employee_id: id,
            effective_from,
            effective_to: null, // Initial, will calc below
            base_salary: parseFloat(base_salary) || 0,
            hourly_rate: parseFloat(hourly_rate) || 0,
            fixed_overtime_pay: parseFloat(fixed_overtime_pay) || 0,
            overtime_rate: parseFloat(overtime_rate) || 1.5,
            night_shift_rate: parseFloat(night_shift_rate) || 1.5,
            holiday_rate: parseFloat(holiday_rate) || 2.0,
            // Default allowances copy? For now use defaults/0
            meal_allowance: 200000,
        };

        // 3. Find immediate next record (Chronologically AFTER this one)
        const { data: nextRecords } = await supabase
            .from('salaries')
            .select('effective_from')
            .eq('employee_id', id)
            .gt('effective_from', effective_from)
            .order('effective_from', { ascending: true })
            .limit(1);

        if (nextRecords && nextRecords.length > 0) {
            // If there is a next record, this new record must end before it starts
            const nextStart = new Date(nextRecords[0].effective_from);
            nextStart.setDate(nextStart.getDate() - 1);
            newRecord.effective_to = nextStart.toISOString().split('T')[0];
        } else {
            // No next record -> Open ended?
            // Wait, if we are inserting into the PAST, the "Next" record is the one that was previously "Current" or "Past".
            // Example:
            // A: 2026-01-01 ~ NULL
            // Insert B: 2025-01-01.
            // Next is A. B ends 2025-12-31.
            // Correct.
        }

        // 4. Find immediate previous record (Chronologically BEFORE this one)
        const { data: prevRecords } = await supabase
            .from('salaries')
            .select('id, effective_to')
            .eq('employee_id', id)
            .lt('effective_from', effective_from)
            .order('effective_from', { ascending: false })
            .limit(1);

        // 5. Insert new record
        const { error: insertError } = await supabase
            .from('salaries')
            .insert(newRecord);

        if (insertError) {
            console.error('Insert salary error:', insertError);
            return NextResponse.json({ error: 'Failed to create salary record' }, { status: 500 });
        }

        // 6. Update previous record's effective_to if needed
        if (prevRecords && prevRecords.length > 0) {
            const prev = prevRecords[0];
            const newStart = new Date(effective_from);
            newStart.setDate(newStart.getDate() - 1);
            const newPrevEnd = newStart.toISOString().split('T')[0];

            // Only update if it needs to be cut short (or extended? usually cut short)
            // If prev.effective_to is NULL or > newPrevEnd, update it.
            if (!prev.effective_to || prev.effective_to > newPrevEnd) {
                await supabase
                    .from('salaries')
                    .update({ effective_to: newPrevEnd })
                    .eq('id', prev.id);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Salary record added successfully'
        });

    } catch (error) {
        console.error('Create salary history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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
        const { searchParams } = new URL(request.url);
        const salaryId = searchParams.get('salaryId');
        const reset = searchParams.get('reset');

        const supabase = getEmployeePurchaseSupabase();

        // 1. Reset All History
        if (reset === 'true') {
            const { error } = await supabase
                .from('salaries')
                .delete()
                .eq('employee_id', id);

            if (error) {
                console.error('Reset history error:', error);
                return NextResponse.json({ error: 'Failed to reset history' }, { status: 500 });
            }

            // Also reset employee base_salary/hourly_rate to 0 to reflect "No Contract"?
            // Or keep last known?
            // User likely wants to clear only history tables. But salaries is the source of truth.
            // If we delete all salaries, the employee has NO salary.
            // We should update employee table to clear cached columns too? 
            // Actually GET /employees reads from salaries. So it will return null/0.

            return NextResponse.json({ success: true, message: 'History reset successfully' });
        }

        // 2. Delete Single Record
        if (salaryId) {
            // Get the record to be deleted
            const { data: targetRecord } = await supabase
                .from('salaries')
                .select('*')
                .eq('id', salaryId)
                .eq('employee_id', id) // Safety check
                .single();

            if (!targetRecord) {
                return NextResponse.json({ error: 'Record not found' }, { status: 404 });
            }

            // Find previous record (to extend it)
            const { data: prevRecord } = await supabase
                .from('salaries')
                .select('id')
                .eq('employee_id', id)
                .lt('effective_from', targetRecord.effective_from)
                .order('effective_from', { ascending: false })
                .limit(1)
                .single();

            // Delete the target record
            const { error: deleteError } = await supabase
                .from('salaries')
                .delete()
                .eq('id', salaryId);

            if (deleteError) {
                return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
            }

            // Heal the timeline: Extend previous record to cover the gap
            // Prev record's allow `effective_to` should become `targetRecord.effective_to`
            if (prevRecord) {
                await supabase
                    .from('salaries')
                    .update({ effective_to: targetRecord.effective_to })
                    .eq('id', prevRecord.id);
            }

            return NextResponse.json({ success: true, message: 'Record deleted successfully' });
        }

        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    } catch (error) {
        console.error('Delete salary history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
