const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function extractNotionCustomers() {
  console.log('📥 Notion 고객 DB에서 데이터 추출 중...');
  
  const customers = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    try {
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

          // 삭제되지 않은 고객만 포함
          if (customerCode && !isDeleted) {
            customers.push({
              id: page.id,
              customer_code: customerCode,
              name: name || `고객_${customerCode}`,
              phone: phone || undefined,
              address: address || undefined,
              birth_date: birthDate || undefined,
              gender: gender || undefined,
              estimated_age: estimatedAge,
              special_notes: specialNotes || undefined,
              created_at: page.created_time,
              updated_at: page.last_edited_time,
            });
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
      
      console.log(`   추출된 고객: ${customers.length}개`);
      
    } catch (error) {
      console.error('❌ Notion 고객 데이터 추출 실패:', error);
      break;
    }
  }

  return customers;
}

async function checkCustomerMigration() {
  console.log('🔍 고객 데이터 마이그레이션 상세 점검 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 고객 데이터 추출
    const notionCustomers = await extractNotionCustomers();
    console.log(`📊 Notion 고객 수: ${notionCustomers.length}개`);

    // 2. Notion 고객 데이터 저장
    const notionCustomersPath = join(process.cwd(), 'migration_data', 'notion_customers.json');
    writeFileSync(notionCustomersPath, JSON.stringify(notionCustomers, null, 2));
    console.log(`💾 Notion 고객 데이터 저장: ${notionCustomersPath}`);

    // 3. Supabase 고객 데이터 조회
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

    // 4. 기본 수량 비교
    console.log('\n📊 기본 수량 비교');
    console.log('-' .repeat(80));
    console.log(`Notion 고객 수: ${notionCustomers.length}개`);
    console.log(`Supabase 고객 수: ${supabaseCustomers?.length || 0}개`);
    console.log(`수량 일치: ${notionCustomers.length === (supabaseCustomers?.length || 0) ? '✅' : '❌'}`);

    // 5. 고객별 상세 비교
    console.log('\n🔍 고객별 상세 비교');
    console.log('-' .repeat(80));

    let perfectMatches = 0;
    let partialMatches = 0;
    let missingInSupabase = 0;
    let extraInSupabase = 0;

    // Notion 고객들을 customer_code로 매핑
    const notionCustomerMap = new Map();
    notionCustomers.forEach(customer => {
      notionCustomerMap.set(customer.customer_code, customer);
    });

    // Supabase 고객들을 customer_code로 매핑
    const supabaseCustomerMap = new Map();
    supabaseCustomers?.forEach(customer => {
      supabaseCustomerMap.set(customer.customer_code, customer);
    });

    // Notion 고객들 검증
    for (const notionCustomer of notionCustomers) {
      const supabaseCustomer = supabaseCustomerMap.get(notionCustomer.customer_code);
      
      if (!supabaseCustomer) {
        console.log(`❌ ${notionCustomer.customer_code}: Supabase에 없음`);
        console.log(`   Notion: ${notionCustomer.name} | ${notionCustomer.phone || 'N/A'} | ${notionCustomer.gender || 'N/A'}`);
        missingInSupabase++;
        continue;
      }

      // 데이터 비교
      const issues = [];
      
      if (notionCustomer.name !== supabaseCustomer.name) {
        issues.push(`이름: "${notionCustomer.name}" vs "${supabaseCustomer.name}"`);
      }
      
      if (notionCustomer.phone !== supabaseCustomer.phone) {
        issues.push(`전화: "${notionCustomer.phone || 'N/A'}" vs "${supabaseCustomer.phone || 'N/A'}"`);
      }
      
      if (notionCustomer.gender !== supabaseCustomer.gender) {
        issues.push(`성별: "${notionCustomer.gender || 'N/A'}" vs "${supabaseCustomer.gender || 'N/A'}"`);
      }
      
      if (notionCustomer.address !== supabaseCustomer.address) {
        issues.push(`주소: "${notionCustomer.address || 'N/A'}" vs "${supabaseCustomer.address || 'N/A'}"`);
      }
      
      if (notionCustomer.birth_date !== supabaseCustomer.birth_date) {
        issues.push(`생년월일: "${notionCustomer.birth_date || 'N/A'}" vs "${supabaseCustomer.birth_date || 'N/A'}"`);
      }
      
      if (notionCustomer.estimated_age !== supabaseCustomer.estimated_age) {
        issues.push(`나이: "${notionCustomer.estimated_age || 'N/A'}" vs "${supabaseCustomer.estimated_age || 'N/A'}"`);
      }
      
      if (notionCustomer.special_notes !== supabaseCustomer.special_notes) {
        issues.push(`특이사항: "${notionCustomer.special_notes || 'N/A'}" vs "${supabaseCustomer.special_notes || 'N/A'}"`);
      }

      if (issues.length === 0) {
        console.log(`✅ ${notionCustomer.customer_code}: 완벽 일치`);
        perfectMatches++;
      } else {
        console.log(`⚠️ ${notionCustomer.customer_code}: 부분 일치 (${issues.length}개 차이)`);
        issues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });
        partialMatches++;
      }
    }

    // Supabase에만 있는 고객 확인
    for (const supabaseCustomer of supabaseCustomers || []) {
      if (!notionCustomerMap.has(supabaseCustomer.customer_code)) {
        console.log(`➕ ${supabaseCustomer.customer_code}: Notion에 없음 (Supabase 전용)`);
        console.log(`   Supabase: ${supabaseCustomer.name} | ${supabaseCustomer.phone || 'N/A'} | ${supabaseCustomer.gender || 'N/A'}`);
        extraInSupabase++;
      }
    }

    // 6. 최종 결과 요약
    console.log('\n📊 고객 마이그레이션 결과 요약');
    console.log('=' .repeat(80));
    console.log(`✅ 완벽 일치: ${perfectMatches}개`);
    console.log(`⚠️ 부분 일치: ${partialMatches}개`);
    console.log(`❌ Supabase 누락: ${missingInSupabase}개`);
    console.log(`➕ Supabase 추가: ${extraInSupabase}개`);
    console.log('-' .repeat(80));
    
    const totalNotionCustomers = notionCustomers.length;
    const matchRate = totalNotionCustomers > 0 ? Math.round(((perfectMatches + partialMatches) / totalNotionCustomers) * 100) : 0;
    console.log(`📈 매칭률: ${matchRate}%`);

    // 7. 마이그레이션 완료 여부 판단
    const isComplete = perfectMatches === totalNotionCustomers && 
                      missingInSupabase === 0 && 
                      extraInSupabase === 0;

    console.log('\n🎯 고객 마이그레이션 완료 상태');
    console.log('=' .repeat(80));
    if (isComplete) {
      console.log('🎉 ✅ 고객 데이터 마이그레이션 100% 완료!');
    } else {
      console.log('❌ 고객 데이터 마이그레이션 미완료');
      console.log('📋 해결해야 할 문제:');
      if (missingInSupabase > 0) console.log(`   - ${missingInSupabase}개 고객 누락`);
      if (partialMatches > 0) console.log(`   - ${partialMatches}개 고객 데이터 불일치`);
      if (extraInSupabase > 0) console.log(`   - ${extraInSupabase}개 불필요한 고객 데이터`);
      
      console.log('\n🔧 권장 조치:');
      if (missingInSupabase > 0) {
        console.log('   1. 누락된 고객 데이터를 Supabase에 추가');
      }
      if (partialMatches > 0) {
        console.log('   2. 불일치하는 고객 데이터를 Notion 기준으로 업데이트');
      }
      if (extraInSupabase > 0) {
        console.log('   3. Supabase 전용 고객 데이터 검토 및 정리');
      }
    }

    // 8. 샘플 데이터 출력
    if (notionCustomers.length > 0) {
      console.log('\n📋 Notion 고객 데이터 샘플:');
      console.log('-' .repeat(80));
      const sample = notionCustomers[0];
      console.log(`고객코드: ${sample.customer_code}`);
      console.log(`이름: ${sample.name}`);
      console.log(`전화번호: ${sample.phone || 'N/A'}`);
      console.log(`주소: ${sample.address || 'N/A'}`);
      console.log(`생년월일: ${sample.birth_date || 'N/A'}`);
      console.log(`성별: ${sample.gender || 'N/A'}`);
      console.log(`추정나이: ${sample.estimated_age || 'N/A'}`);
      console.log(`특이사항: ${sample.special_notes || 'N/A'}`);
    }

  } catch (error) {
    console.error('💥 고객 마이그레이션 점검 실패:', error);
  }
}

// 실행
if (require.main === module) {
  checkCustomerMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 