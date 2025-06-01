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

async function migrateMissingConsultations() {
  console.log('🔄 누락된 상담 데이터 마이그레이션...');
  console.log('=' .repeat(80));

  try {
    // 1. 고객 매핑 생성 (Notion ID → 고객 코드)
    console.log('🔗 고객 매핑 생성 중...');
    
    const customerMapping = new Map(); // Notion customer ID → customer_code
    const customerNameMapping = new Map(); // customer_code → name
    let customerHasMore = true;
    let customerNextCursor = undefined;

    while (customerHasMore) {
      const customerResponse = await notion.databases.query({
        database_id: process.env.NOTION_CUSTOMER_DB_ID,
        start_cursor: customerNextCursor,
        page_size: 100,
      });

      for (const page of customerResponse.results) {
        if ('properties' in page) {
          const properties = page.properties;
          
          let customerCode = '';
          if ('id' in properties && properties['id'].type === 'title') {
            customerCode = properties['id'].title?.[0]?.plain_text || '';
          }

          let name = '';
          if ('고객명' in properties && properties['고객명'].type === 'rich_text') {
            name = properties['고객명'].rich_text?.[0]?.plain_text || '';
          }

          // 삭제됨 체크
          let isDeleted = false;
          if ('삭제됨' in properties && properties['삭제됨'].type === 'checkbox') {
            isDeleted = properties['삭제됨'].checkbox || false;
          }

          if (customerCode && !isDeleted) {
            customerMapping.set(page.id, customerCode);
            customerNameMapping.set(customerCode, name || `고객_${customerCode}`);
          }
        }
      }

      customerHasMore = customerResponse.has_more;
      customerNextCursor = customerResponse.next_cursor || undefined;
    }

    console.log(`📊 고객 매핑 생성: ${customerMapping.size}개`);

    // 2. 고객 코드 변경 매핑 (중복 처리된 고객들)
    const codeChangeMapping = new Map();
    codeChangeMapping.set('00028', '00073'); // 송정숙
    codeChangeMapping.set('00027', '00074'); // 박귀화

    console.log('🔄 고객 코드 변경 매핑:');
    for (const [oldCode, newCode] of codeChangeMapping) {
      const name = customerNameMapping.get(oldCode);
      console.log(`  ${oldCode} → ${newCode}: ${name}`);
    }

    // 3. 모든 Notion 상담 데이터 추출
    console.log('\n📥 모든 Notion 상담 데이터 추출 중...');
    
    const allNotionConsultations = [];
    let hasMore = true;
    let nextCursor = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: process.env.NOTION_CONSULTATION_DB_ID,
        start_cursor: nextCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if ('properties' in page && 'created_time' in page && 'last_edited_time' in page) {
          const properties = page.properties;
          
          // 고객 관계 ID 추출
          let customerRelationId = '';
          if ('고객' in properties && properties['고객'].type === 'relation') {
            const relationIds = properties['고객'].relation || [];
            if (relationIds.length > 0) {
              customerRelationId = relationIds[0].id;
            }
          }

          // 상담일 추출
          let consultationDate = '';
          if ('상담일' in properties && properties['상담일'].type === 'date') {
            consultationDate = properties['상담일'].date?.start || '';
          }

          // 상담 내용 추출
          let content = '';
          if ('상담내용' in properties && properties['상담내용'].type === 'rich_text') {
            content = properties['상담내용'].rich_text?.[0]?.plain_text || '';
          }

          // 처방 추출
          let prescription = '';
          if ('처방' in properties && properties['처방'].type === 'rich_text') {
            prescription = properties['처방'].rich_text?.[0]?.plain_text || '';
          }

          // 상담료 추출
          let fee = null;
          if ('상담료' in properties && properties['상담료'].type === 'number') {
            fee = properties['상담료'].number;
          }

          if (customerRelationId) {
            const originalCustomerCode = customerMapping.get(customerRelationId);
            if (originalCustomerCode) {
              // 고객 코드 변경이 있는 경우 새 코드 사용
              const finalCustomerCode = codeChangeMapping.get(originalCustomerCode) || originalCustomerCode;
              
              allNotionConsultations.push({
                notion_id: page.id,
                customer_relation_id: customerRelationId,
                original_customer_code: originalCustomerCode,
                final_customer_code: finalCustomerCode,
                consultation_date: consultationDate,
                content: content,
                prescription: prescription,
                fee: fee,
                created_at: page.created_time,
                updated_at: page.last_edited_time,
              });
            }
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 총 Notion 상담 레코드: ${allNotionConsultations.length}개`);

    // 4. 기존 Supabase 상담 데이터 조회
    console.log('📋 기존 Supabase 상담 데이터 조회 중...');
    const { data: existingConsultations, error: selectError } = await supabase
      .from('consultations')
      .select('notion_id, customer_code, consultation_date');

    if (selectError) {
      console.error('❌ 기존 상담 조회 실패:', selectError);
      return;
    }

    console.log(`📋 기존 Supabase 상담 수: ${existingConsultations?.length || 0}개`);

    // 5. 누락된 상담 찾기
    console.log('\n🔍 누락된 상담 찾기...');
    console.log('-' .repeat(80));

    const existingNotionIds = new Set(existingConsultations?.map(c => c.notion_id) || []);
    const missingConsultations = allNotionConsultations.filter(c => !existingNotionIds.has(c.notion_id));

    console.log(`❌ 누락된 상담: ${missingConsultations.length}개`);

    // 고객별 누락 상담 분석
    const missingByCustomer = {};
    missingConsultations.forEach(consultation => {
      const code = consultation.final_customer_code;
      if (!missingByCustomer[code]) {
        missingByCustomer[code] = [];
      }
      missingByCustomer[code].push(consultation);
    });

    console.log('\n고객별 누락 상담:');
    for (const [code, consultations] of Object.entries(missingByCustomer)) {
      const name = customerNameMapping.get(consultations[0].original_customer_code);
      const isCodeChanged = codeChangeMapping.has(consultations[0].original_customer_code);
      console.log(`  ${code} (${name})${isCodeChanged ? ' [코드 변경됨]' : ''}: ${consultations.length}개`);
    }

    // 6. 누락된 상담 추가
    if (missingConsultations.length > 0) {
      console.log('\n➕ 누락된 상담 추가 중...');
      console.log('-' .repeat(80));

      let addedCount = 0;
      let failedCount = 0;

      for (const consultation of missingConsultations) {
        const consultationData = {
          notion_id: consultation.notion_id,
          customer_code: consultation.final_customer_code,
          consultation_date: consultation.consultation_date || null,
          content: consultation.content || null,
          prescription: consultation.prescription || null,
          fee: consultation.fee || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase
          .from('consultations')
          .insert([consultationData]);

        if (insertError) {
          console.error(`❌ 상담 추가 실패 (${consultation.final_customer_code}, ${consultation.consultation_date}):`, insertError);
          failedCount++;
        } else {
          addedCount++;
          if (addedCount <= 5) { // 처음 5개만 로그 출력
            const name = customerNameMapping.get(consultation.original_customer_code);
            console.log(`✅ ${consultation.final_customer_code} (${name}) - ${consultation.consultation_date}: ${consultation.content?.substring(0, 30) || 'N/A'}...`);
          }
        }
      }

      console.log(`\n📊 추가 결과: 성공 ${addedCount}개, 실패 ${failedCount}개`);
    }

    // 7. 최종 검증
    console.log('\n🔍 최종 검증...');
    console.log('-' .repeat(80));

    const { count: finalConsultationCount, error: finalCountError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.error('❌ 최종 카운트 조회 실패:', finalCountError);
    } else {
      console.log(`📊 최종 Supabase 상담 수: ${finalConsultationCount}개`);
      console.log(`📊 Notion 상담 수: ${allNotionConsultations.length}개`);
      console.log(`✅ 수량 일치: ${finalConsultationCount === allNotionConsultations.length ? '예' : '아니오'}`);
    }

    // 8. 새로 추가된 고객들의 상담 확인
    console.log('\n🔍 새로 추가된 고객들의 상담 확인...');
    console.log('-' .repeat(80));

    for (const [oldCode, newCode] of codeChangeMapping) {
      const { data: customerConsultations, error: customerError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', newCode)
        .order('consultation_date', { ascending: false });

      if (customerError) {
        console.error(`❌ ${newCode} 상담 조회 실패:`, customerError);
      } else {
        const name = customerNameMapping.get(oldCode);
        console.log(`${newCode} (${name}): ${customerConsultations?.length || 0}개 상담`);
        
        if (customerConsultations && customerConsultations.length > 0) {
          customerConsultations.slice(0, 3).forEach((consultation, index) => {
            console.log(`  ${index + 1}. ${consultation.consultation_date}: ${consultation.content?.substring(0, 40) || 'N/A'}...`);
          });
        }
      }
    }

    // 9. 결과 저장
    const migrationResult = {
      migration_date: new Date().toISOString(),
      notion_consultations: allNotionConsultations.length,
      existing_supabase_consultations: existingConsultations?.length || 0,
      missing_consultations: missingConsultations.length,
      added_consultations: missingConsultations.length,
      final_supabase_consultations: finalConsultationCount,
      code_changes: Object.fromEntries(codeChangeMapping),
      migration_complete: finalConsultationCount === allNotionConsultations.length
    };

    const resultPath = join(process.cwd(), 'migration_data', 'consultation_migration_result.json');
    writeFileSync(resultPath, JSON.stringify(migrationResult, null, 2));
    console.log(`\n💾 마이그레이션 결과 저장: ${resultPath}`);

    // 10. 최종 결과
    console.log('\n🎉 상담 데이터 마이그레이션 완료!');
    console.log('=' .repeat(80));
    
    if (migrationResult.migration_complete) {
      console.log('✅ 모든 상담 데이터가 성공적으로 마이그레이션되었습니다!');
      console.log(`📊 총 상담 수: ${finalConsultationCount}개`);
      console.log('🔍 특별 처리 사항:');
      console.log('  • 고객 코드 변경에 따른 상담 데이터 업데이트 완료');
      console.log('  • 중복 고객 문제로 누락된 상담 데이터 복구 완료');
    } else {
      console.log('⚠️ 일부 문제가 남아있을 수 있습니다. 재검증이 필요합니다.');
    }

  } catch (error) {
    console.error('💥 상담 마이그레이션 실패:', error);
  }
}

// 실행
if (require.main === module) {
  migrateMissingConsultations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 