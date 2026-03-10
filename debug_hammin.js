const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    const employeeId = '63cb4cb7-9da5-4201-9541-61c07980f579'; // Ham Min from previous step

    // 1. Get Salary
    const { data: salary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false })
        .limit(1);

    console.log('--- Salary Info ---');
    console.log(salary);

    // 2. Get Attendance for Jan 2026
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    console.log('--- Attendance Info (Summary) ---');
    let totalHours = 0;
    let otHours = 0;
    let holidayHours = 0;

    attendance.forEach(a => {
        const work = parseFloat(a.work_hours) || 0;
        const ot = parseFloat(a.overtime_hours) || 0;
        const holiday = a.is_holiday ? work : 0;

        totalHours += work;
        otHours += ot;
        holidayHours += holiday;

        if (ot > 0 || a.is_holiday) {
            console.log(`[${a.work_date}] Work: ${work}, OT: ${ot}, Holiday: ${a.is_holiday}`);
        }
    });

    console.log(`Total Work: ${totalHours}, OT: ${otHours}, Holiday: ${holidayHours}`);
}

main();
