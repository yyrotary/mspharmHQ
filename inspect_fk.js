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
    console.log('Inspecting foreign key...');

    // Try to insert a dummy salary for the employee to see exact error or success
    const employeeId = '3ba0ba22-19e4-45e0-832f-7634863e7c72';

    // First verify employee exists
    const { data: emp, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .single();

    console.log('Employee Check:', emp, empError);

    if (!emp) return;

    // Try insert
    const { error: insertError } = await supabase
        .from('salaries')
        .insert({
            employee_id: employeeId,
            base_salary: 0,
            hourly_rate: 123,
            effective_from: '2099-01-01'
        });

    console.log('Insert Result:', insertError);
}

main();
