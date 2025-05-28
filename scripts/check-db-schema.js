const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkDatabaseSchema() {
  try {
    console.log('Checking database schema...\n');

    // purchase_requests 테이블 스키마 확인
    const { data, error } = await supabase
      .from('purchase_requests')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error fetching purchase_requests schema:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('purchase_requests table columns:');
      Object.keys(data[0]).forEach(column => {
        console.log(`  - ${column}: ${typeof data[0][column]}`);
      });
    } else {
      console.log('No data in purchase_requests table to check schema');
    }

    console.log('\n--- Testing API query ---');
    
    // API에서 사용하는 쿼리와 동일하게 테스트
    const { data: testData, error: testError } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        employee:employees!employee_id(id, name, role),
        approved_by_manager:employees!approved_by_manager_id(id, name),
        approved_by_owner:employees!approved_by_owner_id(id, name)
      `)
      .order('created_at', { ascending: false })
      .range(0, 9);

    if (testError) {
      console.error('Error with API query:', testError);
    } else {
      console.log(`API query successful. Found ${testData?.length || 0} records.`);
      if (testData && testData.length > 0) {
        console.log('Sample record structure:');
        console.log(JSON.stringify(testData[0], null, 2));
      }
    }

  } catch (error) {
    console.error('Schema check failed:', error);
  }
}

checkDatabaseSchema(); 