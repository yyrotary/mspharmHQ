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

async function checkConsultationGaps() {
  console.log('🔍 상담 데이터 누락 점검...');
  console.log('=' .repeat(80));

  try {
    // 1. 모든 Notion 상담 데이터 추출
    console.log('📥 모든 Notion 상담 데이터 추출 중...');
    
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
          
          // 고객 코드 추출
          let customerCode = '';
          if ('고객' in properties && properties['고객'].type === 'relation') {
            // relation에서 고객 ID 추출 후 고객 코드 매핑 필요
            const relationIds = properties['고객'].relation || [];
            if (relationIds.length > 0) {
              // 첫 번째 관련 고객 ID 사용
              customerCode = relationIds[0].id;
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

          if (customerCode) {
            allNotionConsultations.push({
              notion_id: page.id,
              customer_relation_id: customerCode,
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

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 총 Notion 상담 레코드 수: ${allNotionConsultations.length}개`);

    // 2. 고객 관계 매핑 생성 (Notion ID → 고객 코드)
    console.log('🔗 고객 관계 매핑 생성 중...');
    
    const customerMapping = new Map(); // Notion customer ID → customer_code
    const allCustomers = [];
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
            allCustomers.push({
              notion_id: page.id,
              customer_code: customerCode,
              name: name || `고객_${customerCode}`
            });
          }
        }
      }

      customerHasMore = customerResponse.has_more;
      customerNextCursor = customerResponse.next_cursor || undefined;
    }

    console.log(`📊 고객 매핑 생성: ${customerMapping.size}개`);

    // 3. 상담 데이터에 고객 코드 매핑
    const mappedConsultations = [];
    for (const consultation of allNotionConsultations) {
      const customerCode = customerMapping.get(consultation.customer_relation_id);
      if (customerCode) {
        mappedConsultations.push({
          ...consultation,
          customer_code: customerCode
        });
      } else {
        console.log(`⚠️ 고객 매핑 실패: ${consultation.customer_relation_id}`);
      }
    }

    console.log(`📊 매핑된 상담 레코드: ${mappedConsultations.length}개`);

    // 4. Supabase 상담 데이터 조회
    console.log('📋 Supabase 상담 데이터 조회 중...');
    const { data: supabaseConsultations, error } = await supabase
      .from('consultations')
      .select('*')
      .order('consultation_date', { ascending: false });

    if (error) {
      console.error('❌ Supabase 상담 데이터 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 상담 수: ${supabaseConsultations?.length || 0}개`);

    // 5. 새로 추가된 고객들의 상담 확인
    console.log('\n🔍 새로 추가된 고객들의 상담 확인');
    console.log('-' .repeat(80));
    
    const newCustomers = ['00027', '00028']; // 박귀화, 송정숙의 원래 코드
    const newCustomerCodes = ['00074', '00073']; // 새로 할당된 코드
    
    for (const originalCode of newCustomers) {
      const consultationsForCustomer = mappedConsultations.filter(c => c.customer_code === originalCode);
      console.log(`\n${originalCode} 고객의 상담 기록: ${consultationsForCustomer.length}개`);
      
      if (consultationsForCustomer.length > 0) {
        const customer = allCustomers.find(c => c.customer_code === originalCode);
        console.log(`고객명: ${customer?.name || 'N/A'}`);
        
        consultationsForCustomer.forEach((consultation, index) => {
          console.log(`  ${index + 1}. ${consultation.consultation_date}: ${consultation.content?.substring(0, 50) || 'N/A'}...`);
        });
        
        // Supabase에서 해당 고객의 상담 확인
        const supabaseConsultationsForCustomer = supabaseConsultations?.filter(c => 
          c.customer_code === originalCode || newCustomerCodes.includes(c.customer_code)
        ) || [];
        
        console.log(`  Supabase 상담 수: ${supabaseConsultationsForCustomer.length}개`);
        console.log(`  누락된 상담: ${consultationsForCustomer.length - supabaseConsultationsForCustomer.length}개`);
      }
    }

    // 6. 전체 상담 데이터 비교
    console.log('\n📊 전체 상담 데이터 비교');
    console.log('-' .repeat(80));
    console.log(`Notion 상담 수: ${mappedConsultations.length}개`);
    console.log(`Supabase 상담 수: ${supabaseConsultations?.length || 0}개`);
    console.log(`차이: ${mappedConsultations.length - (supabaseConsultations?.length || 0)}개`);

    // 7. 고객별 상담 수 비교
    console.log('\n🔍 고객별 상담 수 비교 (상위 10개)');
    console.log('-' .repeat(80));
    
    // Notion 고객별 상담 수 계산
    const notionConsultationsByCustomer = {};
    mappedConsultations.forEach(consultation => {
      const code = consultation.customer_code;
      notionConsultationsByCustomer[code] = (notionConsultationsByCustomer[code] || 0) + 1;
    });

    // Supabase 고객별 상담 수 계산
    const supabaseConsultationsByCustomer = {};
    supabaseConsultations?.forEach(consultation => {
      const code = consultation.customer_code;
      supabaseConsultationsByCustomer[code] = (supabaseConsultationsByCustomer[code] || 0) + 1;
    });

    // 차이가 있는 고객들 찾기
    const customerDifferences = [];
    const allCustomerCodes = new Set([
      ...Object.keys(notionConsultationsByCustomer),
      ...Object.keys(supabaseConsultationsByCustomer)
    ]);

    for (const code of allCustomerCodes) {
      const notionCount = notionConsultationsByCustomer[code] || 0;
      const supabaseCount = supabaseConsultationsByCustomer[code] || 0;
      const difference = notionCount - supabaseCount;
      
      if (difference !== 0) {
        const customer = allCustomers.find(c => c.customer_code === code);
        customerDifferences.push({
          customer_code: code,
          customer_name: customer?.name || 'N/A',
          notion_count: notionCount,
          supabase_count: supabaseCount,
          difference: difference
        });
      }
    }

    // 차이가 큰 순으로 정렬
    customerDifferences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    console.log('차이가 있는 고객들:');
    customerDifferences.slice(0, 10).forEach(item => {
      console.log(`${item.customer_code} (${item.customer_name}): Notion ${item.notion_count}개, Supabase ${item.supabase_count}개, 차이 ${item.difference > 0 ? '+' : ''}${item.difference}개`);
    });

    // 8. 결과 저장
    const gapAnalysis = {
      analysis_date: new Date().toISOString(),
      notion_consultations: mappedConsultations.length,
      supabase_consultations: supabaseConsultations?.length || 0,
      total_difference: mappedConsultations.length - (supabaseConsultations?.length || 0),
      customer_differences: customerDifferences,
      new_customers_analysis: newCustomers.map(code => ({
        original_code: code,
        notion_consultations: notionConsultationsByCustomer[code] || 0,
        supabase_consultations: supabaseConsultationsByCustomer[code] || 0
      }))
    };

    const resultPath = join(process.cwd(), 'migration_data', 'consultation_gap_analysis.json');
    writeFileSync(resultPath, JSON.stringify(gapAnalysis, null, 2));
    console.log(`\n💾 분석 결과 저장: ${resultPath}`);

    // 9. 요약
    console.log('\n📊 상담 데이터 누락 분석 요약');
    console.log('=' .repeat(80));
    console.log(`총 누락된 상담: ${gapAnalysis.total_difference}개`);
    console.log(`차이가 있는 고객 수: ${customerDifferences.length}개`);
    
    if (gapAnalysis.total_difference > 0) {
      console.log('\n🔧 권장 조치:');
      console.log('1. 누락된 상담 데이터를 Supabase에 추가');
      console.log('2. 새로 추가된 고객들의 상담 데이터 특별 처리');
      console.log('3. 고객 코드 변경에 따른 상담 데이터 업데이트');
    }

  } catch (error) {
    console.error('💥 상담 데이터 누락 점검 실패:', error);
  }
}

// 실행
if (require.main === module) {
  checkConsultationGaps()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 