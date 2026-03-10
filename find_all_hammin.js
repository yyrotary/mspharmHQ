const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    // Find all employees with Ham Min name
    const { data: employees } = await supabase
        .from('employees')
        .select('id, name, position')
        .ilike('name', '%함민%');

    console.log('All Ham Min employees:', JSON.stringify(employees, null, 2));

    // Check salary record with effective_from = 2026-01-01
    const { data: salaries } = await supabase
        .from('salaries')
        .select('employee_id, effective_from, base_salary, hourly_rate, overtime_rate, holiday_rate')
        .eq('effective_from', '2026-01-01');

    console.log('\nAll salaries starting 2026-01-01:', JSON.stringify(salaries, null, 2));
}

main();
