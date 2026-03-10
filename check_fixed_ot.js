const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    const employeeId = '63cb4cb2-c154-4198-af32-0023792880f5';
    const { data: salary } = await supabase.from('salaries').select('*').eq('employee_id', employeeId).limit(1);
    console.log('Ham Min Fixed OT:', salary && salary.length > 0 ? salary[0].fixed_overtime_pay : 'No Salary');
}

main();
