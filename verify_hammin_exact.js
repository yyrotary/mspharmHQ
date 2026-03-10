const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    // Use the exact ID from the screenshot
    const employeeId = '63cb4cb2-c153-4198-bf32-0023792880f5';

    console.log('Checking Employee ID from screenshot:', employeeId);

    // Get employee info
    const { data: emp } = await supabase.from('employees').select('*').eq('id', employeeId).single();
    console.log('Employee:', emp?.name);

    // Get salary info
    const { data: salary } = await supabase.from('salaries').select('*').eq('employee_id', employeeId).single();
    console.log('Salary Record:');
    console.log(`  Effective: ${salary?.effective_from} ~ ${salary?.effective_to}`);
    console.log(`  Base: ${salary?.base_salary}, Fixed OT: ${salary?.fixed_overtime_pay}`);
    console.log(`  Hourly: ${salary?.hourly_rate}, OT Rate: ${salary?.overtime_rate}, Holiday Rate: ${salary?.holiday_rate}`);

    // Get Jan attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    let totalWork = 0, ot = 0, holiday = 0;
    attendance?.forEach(a => {
        totalWork += (parseFloat(a.work_hours) || 0);
        ot += (parseFloat(a.overtime_hours) || 0);
        if (a.is_holiday) holiday += (parseFloat(a.work_hours) || 0);
    });

    console.log('Jan 2026 Attendance:');
    console.log(`  Total Work: ${totalWork}h, OT: ${ot}h, Holiday: ${holiday}h`);
}

main();
