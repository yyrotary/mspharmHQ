const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function testEmployee(namePattern) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing Employee: ${namePattern}`);
    console.log('='.repeat(60));

    const { data: employees } = await supabase
        .from('employees')
        .select('id, name, position, employment_type')
        .ilike('name', `%${namePattern}%`)
        .limit(1);

    if (!employees || employees.length === 0) {
        console.log('❌ Employee not found');
        return;
    }

    const employee = employees[0];
    console.log(`✓ Found: ${employee.name} (${employee.position})`);
    console.log(`  ID: ${employee.id}`);
    console.log(`  Type: ${employee.employment_type}`);

    // Get salary
    const { data: salaries } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employee.id)
        .lte('effective_from', '2026-01-31')
        .or(`effective_to.is.null,effective_to.gte.2026-01-01`)
        .order('effective_from', { ascending: false })
        .limit(1);

    if (!salaries || salaries.length === 0) {
        console.log('❌ No salary record for Jan 2026');
        return;
    }

    const salary = salaries[0];
    console.log(`\n📊 Salary Config:`);
    console.log(`  Base Salary (Total): ${salary.base_salary?.toLocaleString() || 0}`);
    console.log(`  Fixed OT: ${salary.fixed_overtime_pay?.toLocaleString() || 0}`);
    console.log(`  Hourly Rate: ${salary.hourly_rate?.toLocaleString() || 0}`);
    console.log(`  OT Rate: ${salary.overtime_rate}`);
    console.log(`  Holiday Rate: ${salary.holiday_rate}`);
    console.log(`  Effective: ${salary.effective_from} ~ ${salary.effective_to || 'present'}`);

    // Get Jan attendance
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    let totalWork = 0, weekdayWork = 0, holidayWork = 0, ot = 0, night = 0;
    attendance?.forEach(a => {
        const hours = parseFloat(a.work_hours) || 0;
        totalWork += hours;
        if (a.is_holiday) {
            holidayWork += hours;
        } else {
            weekdayWork += hours;
        }
        ot += (parseFloat(a.overtime_hours) || 0);
        night += (parseFloat(a.night_hours) || 0);
    });

    console.log(`\n📅 Jan 2026 Attendance:`);
    console.log(`  Total Work: ${totalWork}h`);
    console.log(`  Weekday: ${weekdayWork}h`);
    console.log(`  Holiday: ${holidayWork}h`);
    console.log(`  Overtime: ${ot}h`);
    console.log(`  Night: ${night}h`);
    console.log(`  Records: ${attendance?.length || 0}`);

    // Calculate expected pay
    const hourlyRate = salary.hourly_rate || (salary.base_salary / 209);
    const fixedOT = salary.fixed_overtime_pay || 0;

    // OT calculation
    const otRate = parseFloat(salary.overtime_rate) || 1.5;
    const calculatedOT = (otRate > 50) ? (ot * otRate) : (ot * hourlyRate * otRate);
    const actualOT = Math.max(0, calculatedOT - fixedOT);

    // Holiday calculation
    const holidayRateVal = parseFloat(salary.holiday_rate) || 2.0;
    const holidayPay = (holidayRateVal > 50) ? (holidayWork * holidayRateVal) : (holidayWork * hourlyRate * holidayRateVal);

    // Night calculation
    const nightRateVal = parseFloat(salary.night_shift_rate) || 1.5;
    const nightPay = (nightRateVal > 50) ? (night * nightRateVal) : (night * hourlyRate * nightRateVal);

    const expectedGross = salary.base_salary + actualOT + holidayPay + nightPay;

    console.log(`\n💰 Expected Calculation:`);
    console.log(`  Raw Base Salary: ${salary.base_salary.toLocaleString()}`);
    console.log(`  - Fixed OT (included): ${fixedOT.toLocaleString()}`);
    console.log(`  = Pure Base: ${(salary.base_salary - fixedOT).toLocaleString()}`);
    console.log(`  `);
    console.log(`  Calculated OT: ${calculatedOT.toLocaleString()}`);
    console.log(`  - Fixed Portion: ${fixedOT.toLocaleString()}`);
    console.log(`  = Actual OT Pay: ${actualOT.toLocaleString()}`);
    console.log(`  `);
    console.log(`  Holiday Pay: ${holidayPay.toLocaleString()}`);
    console.log(`  Night Pay: ${nightPay.toLocaleString()}`);
    console.log(`  `);
    console.log(`  🎯 EXPECTED GROSS: ${expectedGross.toLocaleString()}`);
}

async function main() {
    await testEmployee('정하나');
    await testEmployee('함민');
}

main();
