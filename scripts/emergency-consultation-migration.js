const { createClient } = require('@supabase/supabase-js');
const { Client } = require('@notionhq/client');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function emergencyConsultationMigration() {
  console.log('🚨 긴급 상담 데이터 재마이그레이션...');
  console.log('=' .repeat(80));

  try {
    // 1. 기존 상담 데이터 모두 삭제
    console.log('🗑️ 기존 상담 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('consultations')
      .delete()
      .neq('id', 0); // 모든 레코드 삭제

    if (deleteError) {
      console.error('❌ 기존 상담 삭제 실패:', deleteError);
      return;
    }

    console.log('✅ 기존 상담 데이터 삭제 완료');

    // 2. 고객 매핑 생성
    console.log('\n🔗 고객 매핑 생성 중...');
    
    const customerMapping = new Map(); // Notion ID → customer_code
    const customerNames = new Map(); // customer_code → name
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

          let isDeleted = false;
          if ('삭제됨' in properties && properties['삭제됨'].type === 'checkbox') {
            isDeleted = properties['삭제됨'].checkbox || false;
          }

          if (customerCode && !isDeleted) {
            customerMapping.set(page.id, customerCode);
            customerNames.set(customerCode, name || `고객_${customerCode}`);
          }
        }
      }

      customerHasMore = customerResponse.has_more;
      customerNextCursor = customerResponse.next_cursor || undefined;
    }

    console.log(`📊 고객 매핑: ${customerMapping.size}개`);

    // 3. 고객 코드 변경 매핑 (중복 처리)
    const codeChangeMapping = new Map();
    codeChangeMapping.set('00028', '00073'); // 송정숙
    codeChangeMapping.set('00027', '00074'); // 박귀화

    console.log('\n🔄 고객 코드 변경 매핑:');
    for (const [oldCode, newCode] of codeChangeMapping) {
      const name = customerNames.get(oldCode);
      console.log(`  ${oldCode} → ${newCode}: ${name}`);
    }

    // 4. Notion 상담 데이터 추출 및 마이그레이션
    console.log('\n📥 Notion 상담 데이터 추출 및 마이그레이션 중...');
    
    let hasMore = true;
    let nextCursor = undefined;
    let migratedCount = 0;
    let failedCount = 0;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: process.env.NOTION_CONSULTATION_DB_ID,
        start_cursor: nextCursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if ('properties' in page && 'created_time' in page) {
          const properties = page.properties;
          
          let customerRelationId = '';
          if ('고객' in properties && properties['고객'].type === 'relation') {
            const relationIds = properties['고객'].relation || [];
            if (relationIds.length > 0) {
              customerRelationId = relationIds[0].id;
            }
          }

          let consultationDate = '';
          if ('상담일' in properties && properties['상담일'].type === 'date') {
            consultationDate = properties['상담일'].date?.start || '';
          }

          let content = '';
          if ('상담내용' in properties && properties['상담내용'].type === 'rich_text') {
            content = properties['상담내용'].rich_text?.[0]?.plain_text || '';
          }

          let prescription = '';
          if ('처방' in properties && properties['처방'].type === 'rich_text') {
            prescription = properties['처방'].rich_text?.[0]?.plain_text || '';
          }

          let fee = null;
          if ('상담료' in properties && properties['상담료'].type === 'number') {
            fee = properties['상담료'].number;
          }

          if (customerRelationId) {
            const originalCustomerCode = customerMapping.get(customerRelationId);
            if (originalCustomerCode) {
              // 고객 코드 변경이 있는 경우 새 코드 사용
              const finalCustomerCode = codeChangeMapping.get(originalCustomerCode) || originalCustomerCode;
              
              const consultationData = {
                notion_id: page.id,
                customer_code: finalCustomerCode,
                consultation_date: consultationDate || null,
                content: content || null,
                prescription: prescription || null,
                fee: fee || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              const { error: insertError } = await supabase
                .from('consultations')
                .insert([consultationData]);

              if (insertError) {
                console.error(`❌ 상담 추가 실패 (${finalCustomerCode}, ${consultationDate}):`, insertError);
                failedCount++;
              } else {
                migratedCount++;
                if (migratedCount <= 10) { // 처음 10개만 로그 출력
                  const name = customerNames.get(originalCustomerCode);
                  console.log(`✅ ${finalCustomerCode} (${name}) - ${consultationDate}: ${content?.substring(0, 30) || 'N/A'}...`);
                }
              }
            } else {
              console.log(`⚠️ 고객 매핑 실패: ${customerRelationId}`);
              failedCount++;
            }
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`\n📊 마이그레이션 결과: 성공 ${migratedCount}개, 실패 ${failedCount}개`);

    // 5. 최종 검증
    console.log('\n🔍 최종 검증...');
    console.log('-' .repeat(80));

    const { count: finalCount, error: finalCountError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.error('❌ 최종 카운트 조회 실패:', finalCountError);
    } else {
      console.log(`📊 최종 Supabase 상담 수: ${finalCount}개`);
      console.log(`📊 예상 상담 수: 107개`);
      console.log(`✅ 수량 일치: ${finalCount === 107 ? '예' : '아니오'}`);
    }

    // 6. 고객별 상담 수 확인
    console.log('\n📊 고객별 상담 수 확인 (상위 10개)...');
    console.log('-' .repeat(80));

    const { data: consultationCounts, error: countError } = await supabase
      .from('consultations')
      .select('customer_code')
      .order('customer_code');

    if (!countError && consultationCounts) {
      const counts = {};
      consultationCounts.forEach(consultation => {
        const code = consultation.customer_code;
        counts[code] = (counts[code] || 0) + 1;
      });

      const sortedCounts = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedCounts.forEach(([code, count]) => {
        const name = customerNames.get(code);
        console.log(`  ${code} (${name}): ${count}개`);
      });
    }

    // 7. 새로 추가된 고객들의 상담 확인
    console.log('\n📋 새로 추가된 고객들의 상담 확인...');
    console.log('-' .repeat(80));

    for (const [oldCode, newCode] of codeChangeMapping) {
      const { data: consultations, error: consultError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', newCode)
        .order('consultation_date', { ascending: false });

      if (consultError) {
        console.error(`❌ ${newCode} 상담 조회 실패:`, consultError);
      } else {
        const name = customerNames.get(oldCode);
        console.log(`\n${newCode} (${name}): ${consultations?.length || 0}개 상담`);
        
        if (consultations && consultations.length > 0) {
          consultations.slice(0, 3).forEach((consultation, index) => {
            console.log(`  ${index + 1}. ${consultation.consultation_date}: ${consultation.content?.substring(0, 40) || 'N/A'}...`);
          });
        }
      }
    }

    // 8. 최종 결과
    console.log('\n🎉 긴급 상담 데이터 재마이그레이션 완료!');
    console.log('=' .repeat(80));
    
    if (finalCount === 107) {
      console.log('✅ 모든 상담 데이터가 성공적으로 재마이그레이션되었습니다!');
      console.log(`📊 총 상담 수: ${finalCount}개`);
      console.log('🔍 특별 처리 사항:');
      console.log('  • 기존 잘못된 상담 데이터 완전 삭제');
      console.log('  • 올바른 고객 코드 매핑으로 재마이그레이션');
      console.log('  • 중복 고객 코드 문제 해결');
    } else {
      console.log('⚠️ 일부 문제가 남아있을 수 있습니다. 재검증이 필요합니다.');
    }

  } catch (error) {
    console.error('💥 긴급 상담 재마이그레이션 실패:', error);
  }
}

// 실행
if (require.main === module) {
  emergencyConsultationMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 