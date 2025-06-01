const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCustomerMigration() {
  console.log('🔧 고객 데이터 마이그레이션 수정 시작...');
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
      .select('*')
      .order('customer_code');

    if (error) {
      console.error('❌ Supabase 고객 데이터 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 고객 수: ${supabaseCustomers?.length || 0}개`);

    // 3. Supabase 고객들을 customer_code로 매핑
    const supabaseCustomerMap = new Map();
    supabaseCustomers?.forEach(customer => {
      supabaseCustomerMap.set(customer.customer_code, customer);
    });

    // 4. 누락된 고객 찾기 및 추가
    console.log('\n🔍 누락된 고객 찾기 및 추가...');
    console.log('-' .repeat(80));

    const missingCustomers = [];
    const existingCustomers = [];

    for (const notionCustomer of notionCustomers) {
      if (!supabaseCustomerMap.has(notionCustomer.customer_code)) {
        missingCustomers.push(notionCustomer);
      } else {
        existingCustomers.push(notionCustomer);
      }
    }

    console.log(`❌ 누락된 고객: ${missingCustomers.length}개`);
    console.log(`✅ 기존 고객: ${existingCustomers.length}개`);

    // 5. 누락된 고객 추가
    if (missingCustomers.length > 0) {
      console.log('\n➕ 누락된 고객 추가 중...');
      console.log('-' .repeat(80));

      for (const customer of missingCustomers) {
        const customerData = {
          customer_code: customer.customer_code,
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          birth_date: customer.birth_date,
          gender: customer.gender,
          estimated_age: customer.estimated_age,
          special_notes: customer.special_notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('customers')
          .insert([customerData]);

        if (insertError) {
          console.error(`❌ ${customer.customer_code} 추가 실패:`, insertError);
        } else {
          console.log(`✅ ${customer.customer_code}: ${customer.name} 추가 완료`);
        }
      }
    }

    // 6. 기존 고객 정보 업데이트
    console.log('\n🔄 기존 고객 정보 업데이트 중...');
    console.log('-' .repeat(80));

    let updateCount = 0;
    let skipCount = 0;

    for (const notionCustomer of existingCustomers) {
      const supabaseCustomer = supabaseCustomerMap.get(notionCustomer.customer_code);
      
      // 업데이트가 필요한지 확인
      const needsUpdate = 
        notionCustomer.name !== supabaseCustomer.name ||
        notionCustomer.phone !== supabaseCustomer.phone ||
        notionCustomer.gender !== supabaseCustomer.gender ||
        notionCustomer.address !== supabaseCustomer.address ||
        notionCustomer.birth_date !== supabaseCustomer.birth_date ||
        notionCustomer.estimated_age !== supabaseCustomer.estimated_age ||
        notionCustomer.special_notes !== supabaseCustomer.special_notes;

      if (needsUpdate) {
        const updateData = {
          name: notionCustomer.name,
          phone: notionCustomer.phone,
          address: notionCustomer.address,
          birth_date: notionCustomer.birth_date,
          gender: notionCustomer.gender,
          estimated_age: notionCustomer.estimated_age,
          special_notes: notionCustomer.special_notes,
          updated_at: new Date().toISOString()
        };

        const { error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('customer_code', notionCustomer.customer_code);

        if (updateError) {
          console.error(`❌ ${notionCustomer.customer_code} 업데이트 실패:`, updateError);
        } else {
          console.log(`🔄 ${notionCustomer.customer_code}: ${notionCustomer.name} 업데이트 완료`);
          updateCount++;
        }
      } else {
        skipCount++;
      }
    }

    console.log(`\n📊 업데이트 결과: ${updateCount}개 업데이트, ${skipCount}개 스킵`);

    // 7. 최종 검증
    console.log('\n🔍 최종 검증...');
    console.log('-' .repeat(80));

    const { data: finalCustomers, error: finalError } = await supabase
      .from('customers')
      .select('*')
      .order('customer_code');

    if (finalError) {
      console.error('❌ 최종 검증 실패:', finalError);
      return;
    }

    console.log(`📊 최종 Supabase 고객 수: ${finalCustomers?.length || 0}개`);
    console.log(`📊 Notion 고객 수: ${notionCustomers.length}개`);
    console.log(`✅ 수량 일치: ${(finalCustomers?.length || 0) === notionCustomers.length ? '예' : '아니오'}`);

    // 8. 샘플 검증
    if (finalCustomers && finalCustomers.length > 0) {
      console.log('\n📋 업데이트된 고객 데이터 샘플:');
      console.log('-' .repeat(80));
      
      const sampleCustomer = finalCustomers.find(c => c.customer_code === '00072') || finalCustomers[0];
      console.log(`고객코드: ${sampleCustomer.customer_code}`);
      console.log(`이름: ${sampleCustomer.name}`);
      console.log(`전화번호: ${sampleCustomer.phone || 'N/A'}`);
      console.log(`주소: ${sampleCustomer.address || 'N/A'}`);
      console.log(`생년월일: ${sampleCustomer.birth_date || 'N/A'}`);
      console.log(`성별: ${sampleCustomer.gender || 'N/A'}`);
      console.log(`추정나이: ${sampleCustomer.estimated_age || 'N/A'}`);
      console.log(`특이사항: ${sampleCustomer.special_notes || 'N/A'}`);
    }

    // 9. 최종 결과
    console.log('\n🎉 고객 데이터 마이그레이션 수정 완료!');
    console.log('=' .repeat(80));
    console.log(`➕ 추가된 고객: ${missingCustomers.length}개`);
    console.log(`🔄 업데이트된 고객: ${updateCount}개`);
    console.log(`📊 총 고객 수: ${finalCustomers?.length || 0}개`);
    
    if ((finalCustomers?.length || 0) === notionCustomers.length) {
      console.log('✅ 고객 데이터 마이그레이션 100% 완료!');
    } else {
      console.log('⚠️ 일부 문제가 남아있을 수 있습니다. 재검증이 필요합니다.');
    }

  } catch (error) {
    console.error('💥 고객 마이그레이션 수정 실패:', error);
  }
}

// 실행
if (require.main === module) {
  fixCustomerMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 