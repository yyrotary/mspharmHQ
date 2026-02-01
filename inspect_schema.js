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
    // Use a hacky way to infer types by selecting one row and checking JS types, 
    // or use RPC if available. 
    // But wait, Supabase JS client doesn't give types easily without introspection query.
    // I'll insert a dummy record with a float value to see if it errors, or just fetch one.

    const { data: salaries, error } = await supabase
        .from('salaries')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching salaries:', error);
    } else {
        console.log('Salaries columns keys:', Object.keys(salaries[0] || {}));
        console.log('Sample record:', salaries[0]);
        // Try to infer from value
        if (salaries[0]) {
            console.log('overtime_rate type:', typeof salaries[0].overtime_rate);
            console.log('overtime_rate value:', salaries[0].overtime_rate);
        }
    }
}

main();
