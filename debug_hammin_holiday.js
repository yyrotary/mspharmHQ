const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function checkHamMinData() {
    console.log('--- Checking Ham Min Data ---');

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
    console.log(`Employee: ${emp.name} (${emp.id})`);

    // 2. Get Salary
    const { data: salary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', emp.id)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

    console.log('Salary Record:', salary);

    // 3. Get Jan 2026 Attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', emp.id)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    console.log(`Attendance Records: ${attendance.length}`);
    const holidayRecords = attendance.filter(a => a.is_holiday);
    console.log(`Holiday Records: ${holidayRecords.length}`);
    holidayRecords.forEach(a => {
        console.log(`- ${a.work_date}: work=${a.work_hours}, ot=${a.overtime_hours}, holiday=${a.is_holiday}`);
    });

    // 4. Simulate Calculation Logic
    console.log('\n--- Simulation ---');
    const rateValue = salary.holiday_rate;
    const cleanRate = typeof rateValue === 'string' ? rateValue.replace(/,/g, '') : rateValue;
    const rate = parseFloat(cleanRate) || 0;

    console.log(`Holiday Rate (Raw): ${rateValue}`);
    console.log(`Holiday Rate (Parsed): ${rate}`);

    let holidayPay = 0;
    const hourlyRate = salary.hourly_rate || (salary.base_salary / 209);

    const holidayHours = holidayRecords.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
    console.log(`Total Holiday Work Hours: ${holidayHours}`);

    if (rate > 50) {
        console.log(`Logic: Rate > 50 -> Fixed Amount (${rate}) * Hours (${holidayHours})`);
        holidayPay = holidayHours * rate;
    } else {
        console.log(`Logic: Rate <= 50 -> Multiplier (${rate}) * Hourly (${hourlyRate}) * Hours (${holidayHours})`);
        holidayPay = holidayHours * hourlyRate * rate;
    }

    console.log(`Calculated Holiday Pay: ${holidayPay.toLocaleString()}`);
}

checkHamMinData();
