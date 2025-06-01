const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');
const { writeFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function analyzeAllNotionRecords() {
  console.log('🔍 모든 Notion 레코드 분석 및 누락 고객 찾기...');
  console.log('=' .repeat(80));

  try {
    // 1. 모든 Notion 레코드 추출 (삭제된 것 포함)
    console.log('📥 모든 Notion 레코드 추출 중...');
    
    const allRecords = [];
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
          
          // 고객 코드 추출 (id 필드가 title 타입)
          let customerCode = '';
          if ('id' in properties && properties['id'].type === 'title') {
            customerCode = properties['id'].title?.[0]?.plain_text || '';
          }

          // 이름 추출 (고객명 필드가 rich_text 타입)
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

          // 주소 추출
          let address = '';
          if ('주소' in properties && properties['주소'].type === 'rich_text') {
            address = properties['주소'].rich_text?.[0]?.plain_text || '';
          }

          // 생년월일 추출
          let birthDate = '';
          if ('생년월일' in properties && properties['생년월일'].type === 'date') {
            birthDate = properties['생년월일'].date?.start || '';
          }

          // 성별 추출
          let gender = '';
          if ('성별' in properties && properties['성별'].type === 'select') {
            const selectValue = properties['성별'].select;
            gender = selectValue && 'name' in selectValue ? selectValue.name : '';
          }

          // 추정나이 추출
          let estimatedAge = undefined;
          if ('추정나이' in properties && properties['추정나이'].type === 'number') {
            const numberValue = properties['추정나이'].number;
            estimatedAge = typeof numberValue === 'number' ? numberValue : undefined;
          }

          // 특이사항 추출
          let specialNotes = '';
          if ('특이사항' in properties && properties['특이사항'].type === 'rich_text') {
            specialNotes = properties['특이사항'].rich_text?.[0]?.plain_text || '';
          }

          // 삭제됨 체크박스 확인
          let isDeleted = false;
          if ('삭제됨' in properties && properties['삭제됨'].type === 'checkbox') {
            isDeleted = properties['삭제됨'].checkbox || false;
          }

          if (customerCode) {
            allRecords.push({
              notion_id: page.id,
              customer_code: customerCode,
              name: name || `고객_${customerCode}`,
              phone: phone || undefined,
              address: address || undefined,
              birth_date: birthDate || undefined,
              gender: gender || undefined,
              estimated_age: estimatedAge,
              special_notes: specialNotes || undefined,
              is_deleted: isDeleted,
              created_at: page.created_time,
              updated_at: page.last_edited_time,
            });
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 총 Notion 레코드 수: ${allRecords.length}개`);
    
    // 삭제된 것과 활성 레코드 분리
    const activeRecords = allRecords.filter(r => !r.is_deleted);
    const deletedRecords = allRecords.filter(r => r.is_deleted);
    
    console.log(`📊 활성 레코드: ${activeRecords.length}개`);
    console.log(`📊 삭제된 레코드: ${deletedRecords.length}개`);

    // 2. Supabase 고객 데이터 조회
    console.log('\n📋 Supabase 고객 데이터 조회 중...');
    const { data: supabaseCustomers, error } = await supabase
      .from('customers')
      .select('*')
      .order('customer_code');

    if (error) {
      console.error('❌ Supabase 고객 데이터 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 고객 수: ${supabaseCustomers?.length || 0}개`);

    // 3. Supabase 고객들을 notion_id로 매핑 (가능한 경우)
    const supabaseByCode = new Map();
    supabaseCustomers?.forEach(customer => {
      supabaseByCode.set(customer.customer_code, customer);
    });

    // 4. 누락된 레코드 찾기
    console.log('\n🔍 누락된 레코드 분석...');
    console.log('-' .repeat(80));

    const missingRecords = [];
    const duplicateCodeGroups = {};

    // 활성 레코드만 분석
    activeRecords.forEach(record => {
      if (!duplicateCodeGroups[record.customer_code]) {
        duplicateCodeGroups[record.customer_code] = [];
      }
      duplicateCodeGroups[record.customer_code].push(record);
    });

    // 각 고객 코드별로 분석
    for (const [code, records] of Object.entries(duplicateCodeGroups)) {
      const supabaseCustomer = supabaseByCode.get(code);
      
      if (records.length === 1) {
        // 단일 레코드
        if (!supabaseCustomer) {
          console.log(`❌ ${code}: Supabase에 없음 - ${records[0].name}`);
          missingRecords.push(records[0]);
        } else {
          console.log(`✅ ${code}: 존재함 - ${records[0].name}`);
        }
      } else {
        // 중복 레코드
        console.log(`\n🔄 ${code}: ${records.length}개 중복 레코드`);
        
        if (!supabaseCustomer) {
          console.log(`❌ ${code}: Supabase에 전혀 없음`);
          records.forEach((record, index) => {
            console.log(`   ${index + 1}. ${record.name} (${record.phone || 'N/A'})`);
            missingRecords.push(record);
          });
        } else {
          console.log(`⚠️ ${code}: Supabase에 1개만 있음, ${records.length - 1}개 누락`);
          
          // 가장 유사한 레코드 찾기
          let bestMatch = null;
          let bestScore = -1;
          
          records.forEach(record => {
            let score = 0;
            if (record.name === supabaseCustomer.name) score += 3;
            if (record.phone === supabaseCustomer.phone) score += 2;
            if (record.gender === supabaseCustomer.gender) score += 1;
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = record;
            }
          });
          
          records.forEach((record, index) => {
            if (record === bestMatch) {
              console.log(`   ✅ ${index + 1}. ${record.name} (${record.phone || 'N/A'}) - 매칭됨`);
            } else {
              console.log(`   ❌ ${index + 1}. ${record.name} (${record.phone || 'N/A'}) - 누락됨`);
              missingRecords.push(record);
            }
          });
        }
      }
    }

    console.log(`\n📊 누락된 레코드 총 ${missingRecords.length}개`);

    // 5. 새로운 고객 코드 생성 계획
    console.log('\n🔧 새로운 고객 코드 생성 계획...');
    console.log('-' .repeat(80));

    // 기존 고객 코드들 분석
    const existingCodes = new Set();
    activeRecords.forEach(r => existingCodes.add(r.customer_code));
    supabaseCustomers?.forEach(c => existingCodes.add(c.customer_code));

    // 가장 큰 번호 찾기
    let maxNumber = 0;
    existingCodes.forEach(code => {
      const match = code.match(/^(\d+)$/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxNumber) maxNumber = num;
      }
    });

    console.log(`현재 최대 고객 번호: ${maxNumber}`);

    // 누락된 레코드에 새 코드 할당
    const recordsToAdd = [];
    let nextNumber = maxNumber + 1;

    missingRecords.forEach(record => {
      const newCode = String(nextNumber).padStart(5, '0');
      recordsToAdd.push({
        ...record,
        new_customer_code: newCode,
        original_code: record.customer_code
      });
      nextNumber++;
      
      console.log(`${record.customer_code} → ${newCode}: ${record.name} (${record.phone || 'N/A'})`);
    });

    // 6. 결과 저장
    const resultPath = join(process.cwd(), 'migration_data', 'missing_customers_analysis.json');
    const result = {
      total_notion_records: allRecords.length,
      active_records: activeRecords.length,
      deleted_records: deletedRecords.length,
      supabase_customers: supabaseCustomers?.length || 0,
      missing_records: missingRecords.length,
      records_to_add: recordsToAdd,
      analysis_date: new Date().toISOString()
    };

    writeFileSync(resultPath, JSON.stringify(result, null, 2));
    console.log(`\n💾 분석 결과 저장: ${resultPath}`);

    // 7. 요약
    console.log('\n📊 최종 요약');
    console.log('=' .repeat(80));
    console.log(`총 Notion 레코드: ${allRecords.length}개`);
    console.log(`활성 레코드: ${activeRecords.length}개`);
    console.log(`Supabase 고객: ${supabaseCustomers?.length || 0}개`);
    console.log(`누락된 레코드: ${missingRecords.length}개`);
    console.log(`추가해야 할 고객: ${recordsToAdd.length}개`);
    
    if (recordsToAdd.length > 0) {
      console.log('\n🔧 다음 단계:');
      console.log('1. 누락된 고객들을 새로운 고객 코드로 Supabase에 추가');
      console.log('2. 최종 검증 수행');
      console.log(`3. 예상 최종 고객 수: ${(supabaseCustomers?.length || 0) + recordsToAdd.length}개`);
    }

  } catch (error) {
    console.error('💥 분석 실패:', error);
  }
}

// 실행
if (require.main === module) {
  analyzeAllNotionRecords()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 