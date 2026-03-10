const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    // Get Ham Min
    const { data: emp } = await supabase
        .from('employees')
        .select('id, name, employment_type')
        .ilike('name', '%함민%')
        .single();

    console.log('Ham Min:', emp);

    // Get attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31')
        .order('work_date');

    console.log('\nJan 2026 Attendance:');
    attendance?.forEach(a => {
        console.log(`${a.work_date}: work=${a.work_hours}h, ot=${a.overtime_hours}h, night=${a.night_hours}h, holiday=${a.is_holiday}`);
    });

    const totalWork = attendance?.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0) || 0;
    const totalOT = attendance?.reduce((sum, a) => sum + (parseFloat(a.overtime_hours) || 0), 0) || 0;

    console.log(`\nTotals: work=${totalWork}h, ot=${totalOT}h`);
    console.log(`\nInterpretation for Regular Employee:`);
    console.log(`  - work_hours field = OVERTIME (추가근무)`);
    console.log(`  - Should use work_hours AS overtime, not as regular hours`);
}

main();
