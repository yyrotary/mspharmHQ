const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    // 1. Find by Name first to ensure ID is correct
    const { data: searchEmp, error: searchErr } = await supabase
        .from('employees')
        .select('id, name')
        .ilike('name', '%함민%')
        .limit(1);

    if (!searchEmp || searchEmp.length === 0) {
        console.log('Ham Min NOT FOUND via search!');
        return;
    }

    const employeeId = searchEmp[0].id;
    console.log(`Found Ham Min: ${employeeId}`);

    // 0. Connection Check
    const { data: anyEmp, error: anyErr } = await supabase.from('employees').select('id, name').limit(1);
    console.log('Connection Test (Any Emp):', anyEmp ? anyEmp.length : 'Fail', anyErr);

    // 1. Employment Type
    const { data: emp, error: empErr } = await supabase.from('employees').select('*').eq('id', employeeId);
    console.log('Employee Query Err:', empErr);
    console.log('Employee:', emp);

    // 2. All Salaries (concise)
    const { data: salaries } = await supabase.from('salaries').select('*').eq('employee_id', employeeId);
    console.log('--- Salaries ---');
    salaries.forEach(s => {
        console.log(`Effect: ${s.effective_from}~${s.effective_to}`);
        console.log(`Base: ${s.base_salary}, FixedOT: ${s.fixed_overtime_pay}`);
        console.log(`Rates -> Hourly:${s.hourly_rate}, OT:${s.overtime_rate}, Holiday:${s.holiday_rate}`);
    });

    // 3. Jan 2026 Attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    console.log('--- Jan 2026 Stats ---');
    let total = 0, ot = 0, holiday = 0;
    attendance.forEach(a => {
        total += (parseFloat(a.work_hours) || 0);
        ot += (parseFloat(a.overtime_hours) || 0);
        if (a.is_holiday) holiday += (parseFloat(a.work_hours) || 0);
    });
    console.log(`Total Work: ${total}`);
    console.log(`OT Hours: ${ot}`);
    console.log(`Holiday Hours: ${holiday}`);
    console.log(`Record Count: ${attendance.length}`);
}

main();
