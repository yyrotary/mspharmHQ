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

async function comprehensiveConsultationAnalysis() {
  console.log('🔍 포괄적 상담 데이터 분석...');
  console.log('=' .repeat(80));

  try {
    // 1. 고객 매핑 생성
    console.log('🔗 고객 매핑 생성 중...');
    
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

    // 2. Notion 상담 데이터 추출
    console.log('\n📥 Notion 상담 데이터 추출 중...');
    
    const notionConsultations = [];
    let hasMore = true;
    let nextCursor = undefined;

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
            const customerCode = customerMapping.get(customerRelationId);
            if (customerCode) {
              notionConsultations.push({
                notion_id: page.id,
                customer_code: customerCode,
                customer_name: customerNames.get(customerCode),
                consultation_date: consultationDate,
                content: content,
                prescription: prescription,
                fee: fee,
                created_at: page.created_time,
              });
            }
          }
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;
    }

    console.log(`📊 Notion 상담 수: ${notionConsultations.length}개`);

    // 3. Supabase 상담 데이터 조회
    console.log('📋 Supabase 상담 데이터 조회 중...');
    const { data: supabaseConsultations, error } = await supabase
      .from('consultations')
      .select('*');

    if (error) {
      console.error('❌ Supabase 상담 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 상담 수: ${supabaseConsultations?.length || 0}개`);

    // 4. 고객별 상담 수 비교
    console.log('\n📊 고객별 상담 수 비교...');
    console.log('-' .repeat(80));

    // Notion 고객별 상담 수
    const notionByCustomer = {};
    notionConsultations.forEach(consultation => {
      const code = consultation.customer_code;
      if (!notionByCustomer[code]) {
        notionByCustomer[code] = [];
      }
      notionByCustomer[code].push(consultation);
    });

    // Supabase 고객별 상담 수
    const supabaseByCustomer = {};
    supabaseConsultations?.forEach(consultation => {
      const code = consultation.customer_code;
      if (!supabaseByCustomer[code]) {
        supabaseByCustomer[code] = [];
      }
      supabaseByCustomer[code].push(consultation);
    });

    // 차이 분석
    const differences = [];
    const allCustomerCodes = new Set([
      ...Object.keys(notionByCustomer),
      ...Object.keys(supabaseByCustomer)
    ]);

    for (const code of allCustomerCodes) {
      const notionCount = notionByCustomer[code]?.length || 0;
      const supabaseCount = supabaseByCustomer[code]?.length || 0;
      const difference = notionCount - supabaseCount;

      if (difference !== 0) {
        differences.push({
          customer_code: code,
          customer_name: customerNames.get(code) || 'N/A',
          notion_count: notionCount,
          supabase_count: supabaseCount,
          difference: difference
        });
      }
    }

    // 차이가 큰 순으로 정렬
    differences.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));

    console.log('상담 수 차이가 있는 고객들:');
    differences.forEach(item => {
      console.log(`${item.customer_code} (${item.customer_name}): Notion ${item.notion_count}개, Supabase ${item.supabase_count}개, 차이 ${item.difference > 0 ? '+' : ''}${item.difference}개`);
    });

    // 5. 누락된 상담 찾기 (notion_id 기준)
    console.log('\n🔍 누락된 상담 찾기 (notion_id 기준)...');
    console.log('-' .repeat(80));

    const supabaseNotionIds = new Set(supabaseConsultations?.map(c => c.notion_id).filter(id => id) || []);
    const missingConsultations = notionConsultations.filter(c => !supabaseNotionIds.has(c.notion_id));

    console.log(`❌ 누락된 상담: ${missingConsultations.length}개`);

    if (missingConsultations.length > 0) {
      console.log('\n누락된 상담 상세:');
      missingConsultations.slice(0, 10).forEach((consultation, index) => {
        console.log(`${index + 1}. ${consultation.customer_code} (${consultation.customer_name}) - ${consultation.consultation_date}: ${consultation.content?.substring(0, 40) || 'N/A'}...`);
      });

      // 고객별 누락 상담 수
      const missingByCustomer = {};
      missingConsultations.forEach(consultation => {
        const code = consultation.customer_code;
        missingByCustomer[code] = (missingByCustomer[code] || 0) + 1;
      });

      console.log('\n고객별 누락 상담 수:');
      Object.entries(missingByCustomer)
        .sort(([,a], [,b]) => b - a)
        .forEach(([code, count]) => {
          const name = customerNames.get(code);
          console.log(`  ${code} (${name}): ${count}개`);
        });
    }

    // 6. 중복 고객 문제 분석
    console.log('\n🔍 중복 고객 문제 분석...');
    console.log('-' .repeat(80));

    const duplicateCustomers = ['00027', '00028'];
    const newCustomers = ['00074', '00073'];

    for (let i = 0; i < duplicateCustomers.length; i++) {
      const oldCode = duplicateCustomers[i];
      const newCode = newCustomers[i];
      
      const notionConsultationsForOld = notionByCustomer[oldCode] || [];
      const supabaseConsultationsForOld = supabaseByCustomer[oldCode] || [];
      const supabaseConsultationsForNew = supabaseByCustomer[newCode] || [];

      console.log(`\n${oldCode} → ${newCode} 분석:`);
      console.log(`  Notion ${oldCode}: ${notionConsultationsForOld.length}개`);
      console.log(`  Supabase ${oldCode}: ${supabaseConsultationsForOld.length}개`);
      console.log(`  Supabase ${newCode}: ${supabaseConsultationsForNew.length}개`);
      console.log(`  총 Supabase: ${supabaseConsultationsForOld.length + supabaseConsultationsForNew.length}개`);
      console.log(`  차이: ${notionConsultationsForOld.length - (supabaseConsultationsForOld.length + supabaseConsultationsForNew.length)}개`);
    }

    // 7. 결과 저장
    const analysisResult = {
      analysis_date: new Date().toISOString(),
      notion_consultations: notionConsultations.length,
      supabase_consultations: supabaseConsultations?.length || 0,
      missing_consultations: missingConsultations.length,
      customer_differences: differences,
      missing_consultation_details: missingConsultations.slice(0, 20) // 상위 20개만 저장
    };

    const resultPath = join(process.cwd(), 'migration_data', 'comprehensive_consultation_analysis.json');
    writeFileSync(resultPath, JSON.stringify(analysisResult, null, 2));
    console.log(`\n💾 분석 결과 저장: ${resultPath}`);

    // 8. 요약
    console.log('\n📊 포괄적 분석 요약');
    console.log('=' .repeat(80));
    console.log(`총 누락된 상담: ${missingConsultations.length}개`);
    console.log(`차이가 있는 고객 수: ${differences.length}개`);
    
    if (missingConsultations.length > 0) {
      console.log('\n🔧 권장 조치:');
      console.log('1. 누락된 상담 데이터를 Supabase에 추가');
      console.log('2. 중복 고객 코드 문제로 인한 상담 데이터 재매핑');
      console.log('3. 데이터 무결성 재검증');
    }

  } catch (error) {
    console.error('💥 포괄적 상담 분석 실패:', error);
  }
}

// 실행
if (require.main === module) {
  comprehensiveConsultationAnalysis()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 