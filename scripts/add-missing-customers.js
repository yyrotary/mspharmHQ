const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addMissingCustomers() {
  console.log('➕ 누락된 고객 추가 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. 분석 결과 로드
    console.log('📥 분석 결과 로드 중...');
    const analysisPath = join(process.cwd(), 'migration_data', 'missing_customers_analysis.json');
    const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'));
    
    console.log(`📊 추가할 고객 수: ${analysis.records_to_add.length}개`);

    if (analysis.records_to_add.length === 0) {
      console.log('✅ 추가할 고객이 없습니다.');
      return;
    }

    // 2. 현재 Supabase 상태 확인
    console.log('\n📋 현재 Supabase 상태 확인...');
    const { data: currentCustomers, error: selectError } = await supabase
      .from('customers')
      .select('customer_code, name')
      .order('customer_code');

    if (selectError) {
      console.error('❌ Supabase 고객 조회 실패:', selectError);
      return;
    }

    console.log(`📋 현재 Supabase 고객 수: ${currentCustomers?.length || 0}개`);

    // 3. 새 고객 코드 중복 확인
    const existingCodes = new Set(currentCustomers?.map(c => c.customer_code) || []);
    
    for (const record of analysis.records_to_add) {
      if (existingCodes.has(record.new_customer_code)) {
        console.error(`❌ 고객 코드 ${record.new_customer_code}가 이미 존재합니다!`);
        return;
      }
    }

    // 4. 누락된 고객들 추가
    console.log('\n➕ 누락된 고객들 추가 중...');
    console.log('-' .repeat(80));

    let addedCount = 0;
    let failedCount = 0;

    for (const record of analysis.records_to_add) {
      console.log(`\n처리 중: ${record.original_code} → ${record.new_customer_code}`);
      console.log(`고객명: ${record.name}`);
      console.log(`전화번호: ${record.phone || 'N/A'}`);
      console.log(`성별: ${record.gender || 'N/A'}`);

      const customerData = {
        customer_code: record.new_customer_code,
        name: record.name,
        phone: record.phone || null,
        address: record.address || null,
        birth_date: record.birth_date || null,
        gender: record.gender || null,
        estimated_age: record.estimated_age || null,
        special_notes: record.special_notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('customers')
        .insert([customerData]);

      if (insertError) {
        console.error(`❌ ${record.new_customer_code} 추가 실패:`, insertError);
        failedCount++;
      } else {
        console.log(`✅ ${record.new_customer_code}: ${record.name} 추가 완료`);
        addedCount++;
      }
    }

    // 5. 결과 확인
    console.log('\n📊 추가 결과');
    console.log('-' .repeat(80));
    console.log(`✅ 성공: ${addedCount}개`);
    console.log(`❌ 실패: ${failedCount}개`);

    // 6. 최종 Supabase 상태 확인
    console.log('\n📋 최종 Supabase 상태 확인...');
    const { data: finalCustomers, error: finalError } = await supabase
      .from('customers')
      .select('customer_code, name')
      .order('customer_code');

    if (finalError) {
      console.error('❌ 최종 상태 확인 실패:', finalError);
      return;
    }

    console.log(`📋 최종 Supabase 고객 수: ${finalCustomers?.length || 0}개`);
    console.log(`📊 예상 고객 수: ${analysis.active_records}개`);
    console.log(`✅ 수량 일치: ${(finalCustomers?.length || 0) === analysis.active_records ? '예' : '아니오'}`);

    // 7. 추가된 고객 확인
    if (addedCount > 0) {
      console.log('\n📋 추가된 고객 확인:');
      console.log('-' .repeat(80));
      
      for (const record of analysis.records_to_add) {
        const addedCustomer = finalCustomers?.find(c => c.customer_code === record.new_customer_code);
        if (addedCustomer) {
          console.log(`✅ ${record.new_customer_code}: ${addedCustomer.name} (원래: ${record.original_code})`);
        } else {
          console.log(`❌ ${record.new_customer_code}: 추가 확인 실패`);
        }
      }
    }

    // 8. 최종 결과
    console.log('\n🎉 누락된 고객 추가 완료!');
    console.log('=' .repeat(80));
    
    if (addedCount === analysis.records_to_add.length && 
        (finalCustomers?.length || 0) === analysis.active_records) {
      console.log('✅ 모든 Notion 레코드가 성공적으로 마이그레이션되었습니다!');
      console.log(`📊 총 고객 수: ${finalCustomers?.length || 0}개`);
      console.log('🔧 다음 단계: 최종 검증 스크립트 실행');
    } else {
      console.log('⚠️ 일부 문제가 있을 수 있습니다. 재검증이 필요합니다.');
    }

  } catch (error) {
    console.error('💥 누락된 고객 추가 실패:', error);
  }
}

// 실행
if (require.main === module) {
  addMissingCustomers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 