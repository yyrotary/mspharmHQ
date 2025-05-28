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

async function checkPurchaseRequests() {
  try {
    console.log('Checking purchase requests in database...\n');

    // 모든 구매 요청 조회
    const { data: requests, error } = await supabase
      .from('purchase_requests')
      .select(`
        *,
        employee:employees!employee_id(id, name, role)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchase requests:', error);
      return;
    }

    console.log(`Total purchase requests found: ${requests.length}\n`);

    if (requests.length === 0) {
      console.log('No purchase requests found in database.');
      return;
    }

    requests.forEach((request, index) => {
      console.log(`${index + 1}. Request ID: ${request.id}`);
      console.log(`   Employee: ${request.employee?.name} (${request.employee?.role})`);
      console.log(`   Amount: ₩${request.total_amount.toLocaleString()}`);
      console.log(`   Status: ${request.status}`);
      console.log(`   Created: ${new Date(request.created_at).toLocaleString()}`);
      console.log(`   Images: ${request.image_urls?.length || 0} files`);
      if (request.notes) {
        console.log(`   Notes: ${request.notes}`);
      }
      console.log('');
    });

    // 직원별 요청 수 확인
    console.log('\n--- Employee Summary ---');
    const employeeSummary = {};
    requests.forEach(request => {
      const employeeName = request.employee?.name || 'Unknown';
      if (!employeeSummary[employeeName]) {
        employeeSummary[employeeName] = 0;
      }
      employeeSummary[employeeName]++;
    });

    Object.entries(employeeSummary).forEach(([name, count]) => {
      console.log(`${name}: ${count} requests`);
    });

  } catch (error) {
    console.error('Check failed:', error);
  }
}

checkPurchaseRequests(); 