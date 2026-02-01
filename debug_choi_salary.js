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
    const name = '최서현';
    console.log(`Searching for employee: ${name}`);

    // 1. Find Employee
    const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, name, employment_type')
        .eq('name', name);

    if (empError || !employees || employees.length === 0) {
        console.error('Employee not found or error:', empError);
        return;
    }

    const employee = employees[0];
    console.log('Employee found:', JSON.stringify(employee, null, 2));

    // 2. Fetch Salaries
    const { data: salaries, error: salError } = await supabase
        .from('salaries')
        .select('id, employee_id, base_salary, hourly_rate, effective_from, effective_to')
        .eq('employee_id', employee.id)
        .order('effective_from', { ascending: false });

    if (salError) {
        console.error('Error fetching salaries:', salError);
    } else {
        console.log('Salary Records:', JSON.stringify(salaries, null, 2));
    }

    // 3. Fetch Attendance
    const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('work_date, work_hours, status')
        .eq('employee_id', employee.id)
        .order('work_date', { ascending: false })
        .limit(5);

    if (attError) {
        console.error('Error fetching attendance:', attError);
    } else {
        console.log('Recent 5 Attendance Records:', JSON.stringify(attendance, null, 2));
    }
}

main();
