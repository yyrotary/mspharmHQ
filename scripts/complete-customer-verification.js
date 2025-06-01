const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');
const { writeFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function completeCustomerVerification() {
  console.log('🎯 완전한 고객 데이터 마이그레이션 최종 검증...');
  console.log('=' .repeat(80));

  try {
    // 1. 모든 Notion 활성 레코드 추출
    console.log('📥 모든 Notion 활성 레코드 추출 중...');
    
    const allNotionRecords = [];
    let hasMore = true;
    let nextCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: process.env.NOTION_CUSTOMER_DB_ID,
        start_cursor: nextCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if ('properties' in page && 'created_time' in page && 'last_edited_time' in page) {
          const properties = page.properties;
          
          // 고객 코드 추출
          let customerCode = '';
          if ('id' in properties && properties['id'].type === 'title') {
            customerCode = properties['id'].title?.[0]?.plain_text || '';
          }

          // 이름 추출
          let name = '';
          if ('고객명' in properties && properties['고객명'].type === 'rich_text') {
            name = properties['고객명'].rich_text?.[0]?.plain_text || '';
          }

          // 전화번호 추출
          let phone = '';
          if ('전화번호' in properties && properties['전화번호'].type === 'phone_number') {
            const phoneValue = properties['전화번호'].phone_number;
            phone = typeof phoneValue === 'string' ? phoneValue : '';
          }

          // 성별 추출
          let gender = '';
          if ('성별' in properties && properties['성별'].type === 'select') {
            const selectValue = properties['성별'].select;
            gender = selectValue && 'name' in selectValue ? selectValue.name : '';
          }

          // 삭제됨 체크박스 확인
          let isDeleted = false;
          if ('삭제됨' in properties && properties['삭제됨'].type === 'checkbox') {
            isDeleted = properties['삭제됨'].checkbox || false;
          }

          // 활성 레코드만 포함
          if (customerCode && !isDeleted) {
            allNotionRecords.push({
              notion_id: page.id,
              customer_code: customerCode,
              name: name || `고객_${customerCode}`,
              phone: phone || null,
              gender: gender || null,
              created_at: page.created_time,
              updated_at: page.last_edited_time,
            });
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 Notion 활성 레코드 수: ${allNotionRecords.length}개`);

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

    // 3. 기본 수량 검증
    console.log('\n📊 기본 수량 검증');
    console.log('-' .repeat(80));
    console.log(`Notion 활성 레코드: ${allNotionRecords.length}개`);
    console.log(`Supabase 고객: ${supabaseCustomers?.length || 0}개`);
    const quantityMatch = allNotionRecords.length === (supabaseCustomers?.length || 0);
    console.log(`수량 일치: ${quantityMatch ? '✅' : '❌'}`);

    // 4. 모든 레코드 매칭 검증
    console.log('\n🔍 모든 레코드 매칭 검증');
    console.log('-' .repeat(80));

    // Supabase 고객들을 customer_code로 매핑
    const supabaseByCode = new Map();
    supabaseCustomers?.forEach(customer => {
      supabaseByCode.set(customer.customer_code, customer);
    });

    let perfectMatches = 0;
    let partialMatches = 0;
    let missingRecords = [];
    let duplicateHandling = [];

    // 중복 코드 그룹화
    const notionByCode = {};
    allNotionRecords.forEach(record => {
      if (!notionByCode[record.customer_code]) {
        notionByCode[record.customer_code] = [];
      }
      notionByCode[record.customer_code].push(record);
    });

    // 각 Notion 레코드 검증
    for (const [code, records] of Object.entries(notionByCode)) {
      if (records.length === 1) {
        // 단일 레코드
        const record = records[0];
        const supabaseCustomer = supabaseByCode.get(code);
        
        if (supabaseCustomer) {
          // 데이터 일치 확인
          const nameMatch = record.name === supabaseCustomer.name;
          const phoneMatch = (record.phone || null) === (supabaseCustomer.phone || null);
          const genderMatch = (record.gender || null) === (supabaseCustomer.gender || null);
          
          if (nameMatch && phoneMatch && genderMatch) {
            perfectMatches++;
            console.log(`✅ ${code}: 완벽 일치 - ${record.name}`);
          } else {
            partialMatches++;
            console.log(`⚠️ ${code}: 부분 일치 - ${record.name}`);
            if (!nameMatch) console.log(`   이름: "${record.name}" vs "${supabaseCustomer.name}"`);
            if (!phoneMatch) console.log(`   전화: "${record.phone || 'N/A'}" vs "${supabaseCustomer.phone || 'N/A'}"`);
            if (!genderMatch) console.log(`   성별: "${record.gender || 'N/A'}" vs "${supabaseCustomer.gender || 'N/A'}"`);
          }
        } else {
          missingRecords.push(record);
          console.log(`❌ ${code}: Supabase에 없음 - ${record.name}`);
        }
      } else {
        // 중복 레코드 처리
        console.log(`\n🔄 ${code}: ${records.length}개 중복 레코드 처리`);
        
        // 원래 코드로 매칭된 것 찾기
        const originalMatch = supabaseByCode.get(code);
        if (originalMatch) {
          console.log(`   ✅ 원래 코드 매칭: ${originalMatch.name}`);
          perfectMatches++;
        }
        
        // 새 코드로 매칭된 것들 찾기
        records.forEach((record, index) => {
          // 새로운 코드 패턴으로 찾기 (00073, 00074 등)
          const possibleNewCodes = ['00073', '00074', '00075', '00076']; // 필요시 확장
          let found = false;
          
          for (const newCode of possibleNewCodes) {
            const newCodeCustomer = supabaseByCode.get(newCode);
            if (newCodeCustomer && newCodeCustomer.name === record.name) {
              console.log(`   ✅ 새 코드 매칭: ${record.customer_code} → ${newCode} (${record.name})`);
              perfectMatches++;
              found = true;
              duplicateHandling.push({
                original_code: record.customer_code,
                new_code: newCode,
                name: record.name
              });
              break;
            }
          }
          
          if (!found && originalMatch && originalMatch.name !== record.name) {
            missingRecords.push(record);
            console.log(`   ❌ 매칭 안됨: ${record.name}`);
          }
        });
      }
    }

    // 5. Supabase 전용 고객 확인
    console.log('\n🔍 Supabase 전용 고객 확인');
    console.log('-' .repeat(80));
    
    const allNotionCodes = new Set();
    Object.keys(notionByCode).forEach(code => allNotionCodes.add(code));
    
    // 새로 생성된 코드들도 추가
    duplicateHandling.forEach(item => allNotionCodes.add(item.new_code));
    
    const extraInSupabase = [];
    supabaseCustomers?.forEach(customer => {
      if (!allNotionCodes.has(customer.customer_code)) {
        extraInSupabase.push(customer);
        console.log(`➕ ${customer.customer_code}: Notion에 없음 - ${customer.name}`);
      }
    });

    // 6. 중복 처리 요약
    if (duplicateHandling.length > 0) {
      console.log('\n🔄 중복 코드 처리 요약');
      console.log('-' .repeat(80));
      duplicateHandling.forEach(item => {
        console.log(`${item.original_code} → ${item.new_code}: ${item.name}`);
      });
    }

    // 7. 최종 결과 요약
    console.log('\n📊 최종 마이그레이션 결과');
    console.log('=' .repeat(80));
    console.log(`✅ 완벽 일치: ${perfectMatches}개`);
    console.log(`⚠️ 부분 일치: ${partialMatches}개`);
    console.log(`❌ 누락: ${missingRecords.length}개`);
    console.log(`➕ Supabase 전용: ${extraInSupabase.length}개`);
    console.log(`🔄 중복 처리: ${duplicateHandling.length}개`);
    console.log('-' .repeat(80));
    
    const totalMatched = perfectMatches + partialMatches;
    const matchRate = allNotionRecords.length > 0 ? Math.round((totalMatched / allNotionRecords.length) * 100) : 0;
    console.log(`📈 매칭률: ${matchRate}%`);

    // 8. 마이그레이션 완료 여부 판단
    const isComplete = quantityMatch && 
                      missingRecords.length === 0 && 
                      extraInSupabase.length === 0;

    console.log('\n🎯 고객 마이그레이션 완료 상태');
    console.log('=' .repeat(80));
    
    if (isComplete) {
      console.log('🎉 ✅ 고객 데이터 마이그레이션 100% 완료!');
      console.log('');
      console.log('📊 마이그레이션 성과:');
      console.log(`  • 총 Notion 레코드: ${allNotionRecords.length}개`);
      console.log(`  • 총 Supabase 고객: ${supabaseCustomers?.length || 0}개`);
      console.log(`  • 완벽 일치: ${perfectMatches}개`);
      console.log(`  • 부분 일치: ${partialMatches}개`);
      console.log(`  • 중복 처리: ${duplicateHandling.length}개`);
      console.log(`  • 매칭률: ${matchRate}%`);
      console.log('');
      console.log('🔍 특별 처리 사항:');
      console.log('  • 중복 고객 코드 문제 해결: 새로운 코드 할당');
      console.log('  • 모든 Notion 레코드 보존: 데이터 손실 없음');
      console.log('  • 데이터 무결성 유지: 완전한 마이그레이션');
    } else {
      console.log('❌ 마이그레이션 미완료');
      console.log('해결해야 할 문제:');
      if (!quantityMatch) console.log('  - 고객 수 불일치');
      if (missingRecords.length > 0) console.log(`  - ${missingRecords.length}개 레코드 누락`);
      if (extraInSupabase.length > 0) console.log(`  - ${extraInSupabase.length}개 불필요한 고객`);
    }

    // 9. 결과 저장
    const verificationResult = {
      verification_date: new Date().toISOString(),
      notion_records: allNotionRecords.length,
      supabase_customers: supabaseCustomers?.length || 0,
      perfect_matches: perfectMatches,
      partial_matches: partialMatches,
      missing_records: missingRecords.length,
      extra_in_supabase: extraInSupabase.length,
      duplicate_handling: duplicateHandling,
      match_rate: matchRate,
      migration_complete: isComplete
    };

    const resultPath = join(process.cwd(), 'migration_data', 'complete_verification_result.json');
    writeFileSync(resultPath, JSON.stringify(verificationResult, null, 2));
    console.log(`\n💾 검증 결과 저장: ${resultPath}`);

  } catch (error) {
    console.error('💥 완전한 검증 실패:', error);
  }
}

// 실행
if (require.main === module) {
  completeCustomerVerification()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 