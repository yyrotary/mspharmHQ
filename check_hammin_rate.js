const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function checkHamMinRate() {
    console.log('--- Checking Ham Min Rate ---');

    // 1. Get Employee
    const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .ilike('name', '%함민%')
        .single();

    if (!emp) {
        console.log('Ham Min not found');
        return;
    }

    // 2. Get Salary
    const { data: salary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', emp.id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

    console.log('Overtime Rate:', salary.overtime_rate);
    console.log('Holiday Rate:', salary.holiday_rate);
    console.log('Night Shift Rate:', salary.night_shift_rate);
    console.log('Base Salary:', salary.base_salary);
    console.log('Fixed OT Pay:', salary.fixed_overtime_pay);
}

checkHamMinRate();
