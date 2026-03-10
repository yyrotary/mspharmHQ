const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    // Find Jeong Hana
    const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .ilike('name', '%정하나%');

    console.log('Found Jeong Hana:', employees);

    if (!employees || employees.length === 0) return;

    const employeeId = employees[0].id;

    // Check salary records
    const { data: salaries } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });

    console.log('\nSalary Records:', salaries?.length || 0);
    if (salaries && salaries.length > 0) {
        salaries.forEach(s => {
            console.log(`  ${s.effective_from}~${s.effective_to}: Base=${s.base_salary}, FixedOT=${s.fixed_overtime_pay}, Hourly=${s.hourly_rate}`);
        });
    }

    // Check Jan attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    console.log('\nJan 2026 Attendance:', attendance?.length || 0, 'records');
}

main();
