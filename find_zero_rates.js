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
    console.log('Finding part-time employees with 0 hourly rate...');

    // 1. Get Part-time Employees
    const { data: employees } = await supabase
        .from('employees')
        .select('id, name')
        .eq('employment_type', 'part_time');

    if (!employees) return;

    const problemIds = [];

    for (const emp of employees) {
        // 2. Check their *current* salary
        const { data: salary } = await supabase
            .from('salaries')
            .select('hourly_rate')
            .eq('employee_id', emp.id)
            .is('effective_to', null)
            .limit(1)
            .single();

        if (salary && (!salary.hourly_rate || salary.hourly_rate === 0)) {
            console.log(`- ${emp.name} (ID: ${emp.id}): Rate is 0`);
            problemIds.push(emp.id);
        }
    }

    if (problemIds.length === 0) {
        console.log('No such employees found.');
    }
}

main();
