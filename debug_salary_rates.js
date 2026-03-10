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
    // Fetch salaries for the employee Jeong Ha-na (from previous turn)
    const employeeId = '429e129b-b814-4eeb-a0ff-fda7545cb98c';

    const { data, error } = await supabase
        .from('salaries')
        .select('*')
        .eq('employee_id', employeeId)
        .order('effective_from', { ascending: false });

    if (error) {
        console.error('Error:', error);
    } else {
        // console.log('Salaries:', JSON.stringify(data, null, 2));
        data.forEach(s => {
            console.log(`ID: ${s.id}`);
            console.log(`Effective: ${s.effective_from} ~ ${s.effective_to}`);
            console.log(`Base: ${s.base_salary}, Hourly: ${s.hourly_rate}`);
            console.log(`Overtime Rate: ${s.overtime_rate} (${typeof s.overtime_rate})`);
            console.log(`Night Rate: ${s.night_shift_rate} (${typeof s.night_shift_rate})`);
            console.log(`Holiday Rate: ${s.holiday_rate} (${typeof s.holiday_rate})`);
            console.log('---');
        });
    }
}

main();
