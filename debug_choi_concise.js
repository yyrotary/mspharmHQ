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

    const { data: employees } = await supabase.from('employees').select('id, name').eq('name', name).single();
    if (!employees) { console.log('No employee found'); return; }

    console.log(`Employee: ${employees.name}`);
    console.log(`FULL_ID: >>>${employees.id}<<<`);

    const { data: salaries } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employees.id)
        .order('effective_from', { ascending: false });

    console.log('--- Salary Records ---');
    console.log('ID | From | To | Base | Hourly');
    salaries.forEach(s => {
        console.log(`${s.id.substring(0, 6)}... | ${s.effective_from} | ${s.effective_to || 'NULL      '} | ${s.base_salary} | ${s.hourly_rate}`);
    });
}

main();
