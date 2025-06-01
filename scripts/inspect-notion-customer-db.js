const { Client } = require('@notionhq/client');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function inspectNotionCustomerDB() {
  console.log('🔍 Notion 고객 DB 구조 분석 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. 데이터베이스 정보 조회
    console.log('📋 데이터베이스 정보 조회 중...');
    const database = await notion.databases.retrieve({
      database_id: process.env.NOTION_CUSTOMER_DB_ID,
    });

    console.log(`데이터베이스 제목: ${database.title?.[0]?.plain_text || 'N/A'}`);
    console.log(`데이터베이스 ID: ${database.id}`);
    console.log(`생성일: ${database.created_time}`);
    console.log(`수정일: ${database.last_edited_time}`);

    // 2. 속성(필드) 구조 분석
    console.log('\n📊 데이터베이스 속성(필드) 구조:');
    console.log('-' .repeat(80));
    
    const properties = database.properties;
    for (const [fieldName, fieldInfo] of Object.entries(properties)) {
      console.log(`🔸 ${fieldName}:`);
      console.log(`   타입: ${fieldInfo.type}`);
      
      if (fieldInfo.type === 'select' && fieldInfo.select?.options) {
        console.log(`   옵션: ${fieldInfo.select.options.map(opt => opt.name).join(', ')}`);
      }
      
      if (fieldInfo.type === 'multi_select' && fieldInfo.multi_select?.options) {
        console.log(`   옵션: ${fieldInfo.multi_select.options.map(opt => opt.name).join(', ')}`);
      }
      
      console.log('');
    }

    // 3. 샘플 데이터 조회 (첫 5개)
    console.log('\n📋 샘플 데이터 조회 (첫 5개):');
    console.log('-' .repeat(80));
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_CUSTOMER_DB_ID,
      page_size: 5,
    });

    console.log(`총 조회된 페이지 수: ${response.results.length}개`);
    console.log(`더 많은 데이터 있음: ${response.has_more}`);

    for (let i = 0; i < response.results.length; i++) {
      const page = response.results[i];
      console.log(`\n📄 페이지 ${i + 1}:`);
      console.log(`   ID: ${page.id}`);
      console.log(`   생성일: ${page.created_time}`);
      console.log(`   수정일: ${page.last_edited_time}`);
      
      if ('properties' in page) {
        console.log('   속성 데이터:');
        for (const [fieldName, fieldData] of Object.entries(page.properties)) {
          console.log(`     ${fieldName} (${fieldData.type}):`);
          
          switch (fieldData.type) {
            case 'title':
              const titleText = fieldData.title?.[0]?.plain_text || '';
              console.log(`       값: "${titleText}"`);
              break;
            case 'rich_text':
              const richText = fieldData.rich_text?.[0]?.plain_text || '';
              console.log(`       값: "${richText}"`);
              break;
            case 'number':
              console.log(`       값: ${fieldData.number}`);
              break;
            case 'select':
              console.log(`       값: "${fieldData.select?.name || 'N/A'}"`);
              break;
            case 'multi_select':
              const multiSelectValues = fieldData.multi_select?.map(item => item.name).join(', ') || '';
              console.log(`       값: "${multiSelectValues}"`);
              break;
            case 'date':
              console.log(`       값: "${fieldData.date?.start || 'N/A'}"`);
              break;
            case 'phone_number':
              console.log(`       값: "${fieldData.phone_number || 'N/A'}"`);
              break;
            case 'email':
              console.log(`       값: "${fieldData.email || 'N/A'}"`);
              break;
            case 'checkbox':
              console.log(`       값: ${fieldData.checkbox}`);
              break;
            case 'url':
              console.log(`       값: "${fieldData.url || 'N/A'}"`);
              break;
            case 'people':
              const peopleNames = fieldData.people?.map(person => person.name).join(', ') || '';
              console.log(`       값: "${peopleNames}"`);
              break;
            case 'files':
              const fileNames = fieldData.files?.map(file => file.name).join(', ') || '';
              console.log(`       값: "${fileNames}"`);
              break;
            case 'relation':
              console.log(`       관계 수: ${fieldData.relation?.length || 0}개`);
              break;
            case 'rollup':
              console.log(`       롤업 타입: ${fieldData.rollup?.type || 'N/A'}`);
              break;
            case 'formula':
              console.log(`       공식 결과: ${JSON.stringify(fieldData.formula)}`);
              break;
            default:
              console.log(`       값: ${JSON.stringify(fieldData)}`);
          }
        }
      }
    }

    // 4. 전체 데이터 수 확인
    console.log('\n📊 전체 데이터 수 확인:');
    console.log('-' .repeat(80));
    
    let totalCount = 0;
    let hasMore = true;
    let nextCursor = undefined;
    
    while (hasMore) {
      const countResponse = await notion.databases.query({
        database_id: process.env.NOTION_CUSTOMER_DB_ID,
        start_cursor: nextCursor,
        page_size: 100,
      });
      
      totalCount += countResponse.results.length;
      hasMore = countResponse.has_more;
      nextCursor = countResponse.next_cursor;
      
      console.log(`   현재까지 카운트: ${totalCount}개`);
      
      if (totalCount > 1000) {
        console.log('   1000개 이상 감지, 카운팅 중단');
        break;
      }
    }
    
    console.log(`\n📈 총 고객 데이터 수: ${totalCount}개`);

  } catch (error) {
    console.error('💥 Notion 고객 DB 분석 실패:', error);
    
    if (error.code === 'object_not_found') {
      console.error('❌ 데이터베이스를 찾을 수 없습니다. NOTION_CUSTOMER_DB_ID를 확인해주세요.');
    } else if (error.code === 'unauthorized') {
      console.error('❌ 권한이 없습니다. Notion API 키와 데이터베이스 권한을 확인해주세요.');
    }
  }
}

// 실행
if (require.main === module) {
  inspectNotionCustomerDB()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 