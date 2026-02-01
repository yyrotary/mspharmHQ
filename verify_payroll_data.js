const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim().replace(/"/g, '');
    }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const employee_id = '9f0e89c2-118b-4e01-acbf-0cb790ad909c';

    // 1. Get Employee Info
    const { data: employee } = await supabase
        .from('employees')
        .select('employment_type')
        .eq('id', employee_id)
        .single();
    console.log('Employee:', employee);

    // 2. Get Salary Info
    const { data: salary } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employee_id)
        .order('effective_from', { ascending: false });
    console.log('Salary:', salary);

    // 3. Get Attendance for Jan 2026 (assuming current context)
    const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee_id)
        .gte('work_date', '2026-01-01')
        .lte('work_date', '2026-01-31');

    if (attendance) {
        const totalWorkHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
        console.log('Total Work Hours:', totalWorkHours);
        console.log('Attendance Count:', attendance.length);
    } else {
        console.log('No attendance records found');
    }
}

main();
