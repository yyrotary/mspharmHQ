const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findMissingCustomers() {
  console.log('🔍 누락된 고객 찾기...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 고객 데이터 로드
    console.log('📥 Notion 고객 데이터 로드 중...');
    const notionCustomersPath = join(process.cwd(), 'migration_data', 'notion_customers.json');
    const notionCustomers = JSON.parse(readFileSync(notionCustomersPath, 'utf-8'));
    console.log(`📊 Notion 고객 수: ${notionCustomers.length}개`);

    // 2. Supabase 고객 데이터 조회
    console.log('📋 Supabase 고객 데이터 조회 중...');
    const { data: supabaseCustomers, error } = await supabase
      .from('customers')
      .select('customer_code, name')
      .order('customer_code');

    if (error) {
      console.error('❌ Supabase 고객 데이터 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 고객 수: ${supabaseCustomers?.length || 0}개`);

    // 3. Notion 고객 코드 목록
    const notionCodes = new Set(notionCustomers.map(c => c.customer_code));
    const supabaseCodes = new Set(supabaseCustomers?.map(c => c.customer_code) || []);

    console.log('\n📋 Notion 고객 코드 목록:');
    console.log('-' .repeat(80));
    const sortedNotionCodes = Array.from(notionCodes).sort();
    console.log(sortedNotionCodes.join(', '));

    console.log('\n📋 Supabase 고객 코드 목록:');
    console.log('-' .repeat(80));
    const sortedSupabaseCodes = Array.from(supabaseCodes).sort();
    console.log(sortedSupabaseCodes.join(', '));

    // 4. 누락된 고객 찾기
    console.log('\n❌ Notion에 있지만 Supabase에 없는 고객:');
    console.log('-' .repeat(80));
    const missingInSupabase = [];
    for (const code of sortedNotionCodes) {
      if (!supabaseCodes.has(code)) {
        const customer = notionCustomers.find(c => c.customer_code === code);
        missingInSupabase.push(customer);
        console.log(`${code}: ${customer?.name || 'N/A'}`);
      }
    }

    // 5. 추가된 고객 찾기
    console.log('\n➕ Supabase에 있지만 Notion에 없는 고객:');
    console.log('-' .repeat(80));
    const extraInSupabase = [];
    for (const code of sortedSupabaseCodes) {
      if (!notionCodes.has(code)) {
        const customer = supabaseCustomers?.find(c => c.customer_code === code);
        extraInSupabase.push(customer);
        console.log(`${code}: ${customer?.name || 'N/A'}`);
      }
    }

    // 6. 중복 확인
    console.log('\n🔍 중복 확인:');
    console.log('-' .repeat(80));
    
    // Notion 중복 확인
    const notionCodeCounts = {};
    notionCustomers.forEach(c => {
      notionCodeCounts[c.customer_code] = (notionCodeCounts[c.customer_code] || 0) + 1;
    });
    
    console.log('Notion 중복:');
    for (const [code, count] of Object.entries(notionCodeCounts)) {
      if (count > 1) {
        console.log(`  ${code}: ${count}개`);
      }
    }

    // Supabase 중복 확인
    const supabaseCodeCounts = {};
    supabaseCustomers?.forEach(c => {
      supabaseCodeCounts[c.customer_code] = (supabaseCodeCounts[c.customer_code] || 0) + 1;
    });
    
    console.log('Supabase 중복:');
    for (const [code, count] of Object.entries(supabaseCodeCounts)) {
      if (count > 1) {
        console.log(`  ${code}: ${count}개`);
      }
    }

    // 7. 요약
    console.log('\n📊 요약:');
    console.log('=' .repeat(80));
    console.log(`Notion 고유 고객 수: ${notionCodes.size}개`);
    console.log(`Supabase 고유 고객 수: ${supabaseCodes.size}개`);
    console.log(`누락된 고객: ${missingInSupabase.length}개`);
    console.log(`추가된 고객: ${extraInSupabase.length}개`);

    if (missingInSupabase.length > 0) {
      console.log('\n🔧 누락된 고객 상세 정보:');
      console.log('-' .repeat(80));
      missingInSupabase.forEach(customer => {
        console.log(`${customer.customer_code}: ${customer.name}`);
        console.log(`  전화: ${customer.phone || 'N/A'}`);
        console.log(`  성별: ${customer.gender || 'N/A'}`);
        console.log(`  나이: ${customer.estimated_age || 'N/A'}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('💥 누락된 고객 찾기 실패:', error);
  }
}

// 실행
if (require.main === module) {
  findMissingCustomers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 