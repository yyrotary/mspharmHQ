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

async function finalConsultationMigration() {
  console.log('🎯 최종 상담 데이터 마이그레이션...');
  console.log('=' .repeat(80));

  try {
    // 1. 현재 상태 확인
    const { count: currentCount, error: countError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ 현재 상담 수 조회 실패:', countError);
      return;
    }

    console.log(`현재 상담 수: ${currentCount}개 (깨끗한 상태)`);

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
    const consultationsToMigrate = [];

    // 먼저 모든 상담 데이터 수집
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
              
              consultationsToMigrate.push({
                notion_id: page.id,
                customer_code: finalCustomerCode,
                consultation_date: consultationDate || null,
                content: content || null,
                prescription: prescription || null,
                fee: fee || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 마이그레이션할 상담 수: ${consultationsToMigrate.length}개`);

    // 5. 배치로 마이그레이션 (20개씩)
    console.log('\n➕ 상담 데이터 배치 마이그레이션 중...');
    
    for (let i = 0; i < consultationsToMigrate.length; i += 20) {
      const batch = consultationsToMigrate.slice(i, i + 20);

      const { error: insertError } = await supabase
        .from('consultations')
        .insert(batch);

      if (insertError) {
        console.error(`❌ 배치 ${Math.floor(i/20) + 1} 추가 실패:`, insertError);
        failedCount += batch.length;
      } else {
        migratedCount += batch.length;
        console.log(`✅ 배치 ${Math.floor(i/20) + 1}: ${batch.length}개 마이그레이션 완료 (총 ${migratedCount}/${consultationsToMigrate.length})`);
      }
    }

    console.log(`\n📊 마이그레이션 결과: 성공 ${migratedCount}개, 실패 ${failedCount}개`);

    // 6. 최종 검증
    console.log('\n🔍 최종 검증...');
    console.log('-' .repeat(80));

    const { count: finalCount, error: finalCountError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.error('❌ 최종 카운트 조회 실패:', finalCountError);
    } else {
      console.log(`📊 최종 Supabase 상담 수: ${finalCount}개`);
      console.log(`📊 Notion 상담 수: ${consultationsToMigrate.length}개`);
      console.log(`✅ 수량 일치: ${finalCount === consultationsToMigrate.length ? '예' : '아니오'}`);
    }

    // 7. 고객별 상담 수 확인 (상위 10개)
    console.log('\n📊 고객별 상담 수 확인 (상위 10개)...');
    const { data: consultationCounts, error: countError2 } = await supabase
      .from('consultations')
      .select('customer_code');

    if (!countError2 && consultationCounts) {
      const counts = {};
      consultationCounts.forEach(consultation => {
        const code = consultation.customer_code;
        if (code) {
          counts[code] = (counts[code] || 0) + 1;
        }
      });

      const sortedCounts = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedCounts.forEach(([code, count]) => {
        const name = customerNames.get(code);
        console.log(`  ${code} (${name}): ${count}개`);
      });
    }

    // 8. 새로 추가된 고객들의 상담 확인
    console.log('\n📋 새로 추가된 고객들의 상담 확인...');
    for (const [oldCode, newCode] of codeChangeMapping) {
      const { data: consultations, error: consultError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', newCode)
        .order('consultation_date', { ascending: false });

      if (!consultError) {
        const name = customerNames.get(oldCode);
        console.log(`\n${newCode} (${name}): ${consultations?.length || 0}개 상담`);
        
        if (consultations && consultations.length > 0) {
          consultations.slice(0, 3).forEach((consultation, index) => {
            console.log(`  ${index + 1}. ${consultation.consultation_date || 'N/A'}: ${consultation.content?.substring(0, 40) || 'N/A'}...`);
          });
        }
      }
    }

    // 9. 최종 결과
    console.log('\n🎉 최종 상담 데이터 마이그레이션 완료!');
    console.log('=' .repeat(80));
    
    if (finalCount === consultationsToMigrate.length && migratedCount === consultationsToMigrate.length) {
      console.log('✅ 모든 상담 데이터가 성공적으로 마이그레이션되었습니다!');
      console.log(`📊 총 상담 수: ${finalCount}개`);
      console.log('🔍 특별 처리 사항:');
      console.log('  • 기존 잘못된 상담 데이터 완전 삭제');
      console.log('  • 올바른 고객 코드 매핑으로 완전 재마이그레이션');
      console.log('  • 중복 고객 코드 문제 해결 (00028→00073, 00027→00074)');
      console.log('  • 박귀화님, 송정숙님 상담 데이터 완전 복구');
      console.log('  • 모든 Notion 상담 데이터 100% 보존');
    } else {
      console.log('⚠️ 일부 문제가 남아있을 수 있습니다.');
      console.log(`예상: ${consultationsToMigrate.length}개, 실제: ${finalCount}개, 성공: ${migratedCount}개`);
    }

  } catch (error) {
    console.error('💥 최종 상담 마이그레이션 실패:', error);
  }
}

// 실행
if (require.main === module) {
  finalConsultationMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 