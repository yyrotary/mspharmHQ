const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function testCalc() {
    // Get Ham Min  
    const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .ilike('name', '%함민%')
        .single();

    const { data: salary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', emp.id)
        .single();

    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    console.log('Employee:', emp.name, '- Type:', emp.employment_type);
    console.log('Salary: Base=', salary.base_salary, ', FixedOT=', salary.fixed_overtime_pay);
    console.log('OT Rate:', salary.overtime_rate, ', Holiday Rate:', salary.holiday_rate);

    const isFullTime = emp.employment_type === 'full_time';

    let totalOT = 0;
    let holidayHours = 0;

    if (isFullTime) {
        // For regular employees: work_hours IS overtime
        totalOT = attendance.reduce((sum, a) => {
            return sum + (parseFloat(a.work_hours) || 0) + (parseFloat(a.overtime_hours) || 0);
        }, 0);

        holidayHours = attendance
            .filter(a => a.is_holiday)
            .reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    }

    console.log('\nCalculated:');
    console.log('  Total OT Hours:', totalOT);
    console.log('  Holiday Hours:', holidayHours);

    const hourlyRate = salary.hourly_rate || (salary.base_salary / 209);
    const otRate = parseFloat(salary.overtime_rate) || 1.5;
    const holidayRate = parseFloat(salary.holiday_rate) || 2.0;

    // Calculate OT pay
    const calculatedOT = (otRate > 50) ? (totalOT * otRate) : (totalOT * hourlyRate * otRate);
    const fixedOT = parseFloat(salary.fixed_overtime_pay) || 0;
    const actualOT = Math.max(0, calculatedOT - fixedOT);

    // Calculate holiday pay
    const holidayPay = (holidayRate > 50) ? (holidayHours * holidayRate) : (holidayHours * hourlyRate * holidayRate);

    console.log('\nPay Breakdown:');
    console.log('  Raw Base Salary:', salary.base_salary.toLocaleString());
    console.log('  - Fixed OT:', fixedOT.toLocaleString());
    console.log('  = Display Base:', (salary.base_salary - fixedOT).toLocaleString());
    console.log('');
    console.log('  Calculated OT:', calculatedOT.toLocaleString());
    console.log('  - Fixed Portion:', fixedOT.toLocaleString());
    console.log('  = Actual OT Pay:', actualOT.toLocaleString());
    console.log('');
    console.log('  Holiday Pay:', holidayPay.toLocaleString());
    console.log('');
    console.log('  🎯 Expected Gross Pay:', (salary.base_salary + actualOT + holidayPay).toLocaleString());
}

testCalc();
