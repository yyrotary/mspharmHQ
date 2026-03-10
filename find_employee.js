const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://qpuagbmgtebcetzvbrfq.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo'
);

async function main() {
    const { data: employees, error } = await supabase
        .from('employees')
        .select('id, name')
        .ilike('name', '%함민%');

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Found Raw:', JSON.stringify(employees, null, 2));
    if (employees.length > 0) {
        const id = employees[0].id;
        console.log('Exact ID Length:', id.length);
        console.log('Exact ID:', `"${id}"`);
    }
}

main();
