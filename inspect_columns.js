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
    // We can't query information_schema easily with js client unless we use rpc or raw query if enabled.
    // Instead, insert a dummy record and see which columns fail? No.
    // We will just try to select * limit 1 and print keys.
    const { data, error } = await supabase.from('salaries').select('*').limit(1);
    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found, cannot infer columns.');
        console.log('Error:', error);
    }
}

main();
