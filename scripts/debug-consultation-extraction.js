const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const CONSULTATION_DB_ID = process.env.NOTION_CONSULTATION_DB_ID;

async function debugConsultationDB() {
    try {
        console.log('=== Notion 상담 DB 디버깅 ===\n');
        console.log(`DB ID: ${CONSULTATION_DB_ID}`);
        
        // 1. DB 구조 확인
        console.log('1. DB 구조 조회 중...');
        const dbInfo = await notion.databases.retrieve({
            database_id: CONSULTATION_DB_ID
        });
        
        console.log('\n속성 목록:');
        Object.entries(dbInfo.properties).forEach(([name, prop]) => {
            console.log(`  ${name}: ${prop.type}`);
        });
        
        // 2. 전체 데이터 조회 (필터 없이)
        console.log('\n2. 전체 데이터 조회 중...');
        const allResponse = await notion.databases.query({
            database_id: CONSULTATION_DB_ID,
            page_size: 10
        });
        
        console.log(`전체 레코드 수: ${allResponse.results.length}`);
        
        if (allResponse.results.length > 0) {
            console.log('\n첫 번째 레코드 구조:');
            const firstPage = allResponse.results[0];
            console.log('Properties:');
            Object.entries(firstPage.properties).forEach(([name, prop]) => {
                console.log(`  ${name}: ${prop.type}`);
                if (prop.type === 'relation') {
                    console.log(`    relation: ${JSON.stringify(prop.relation)}`);
                } else if (prop.type === 'rich_text') {
                    console.log(`    text: ${prop.rich_text?.[0]?.plain_text || 'empty'}`);
                } else if (prop.type === 'select') {
                    console.log(`    select: ${prop.select?.name || 'empty'}`);
                } else if (prop.type === 'date') {
                    console.log(`    date: ${prop.date?.start || 'empty'}`);
                }
            });
        }
        
        // 3. 고객 관계가 있는 데이터만 조회
        console.log('\n3. 고객 관계 필터 조회 중...');
        const filteredResponse = await notion.databases.query({
            database_id: CONSULTATION_DB_ID,
            filter: {
                property: '고객',
                relation: {
                    is_not_empty: true
                }
            },
            page_size: 10
        });
        
        console.log(`고객 관계가 있는 레코드 수: ${filteredResponse.results.length}`);
        
        if (filteredResponse.results.length > 0) {
            console.log('\n고객 관계 샘플:');
            const sample = filteredResponse.results[0];
            const customerRelation = sample.properties['고객']?.relation;
            console.log(`고객 관계: ${JSON.stringify(customerRelation)}`);
            
            if (customerRelation && customerRelation.length > 0) {
                try {
                    const customerPage = await notion.pages.retrieve({
                        page_id: customerRelation[0].id
                    });
                    console.log('\n연결된 고객 정보:');
                    console.log(`고객 제목: ${customerPage.properties['고객']?.title?.[0]?.plain_text}`);
                } catch (error) {
                    console.error('고객 페이지 조회 오류:', error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('디버깅 오류:', error);
    }
}

debugConsultationDB(); 