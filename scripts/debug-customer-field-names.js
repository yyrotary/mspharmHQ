const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const CUSTOMER_DB_ID = process.env.NOTION_CUSTOMER_DB_ID;

async function debugCustomerFields() {
    try {
        console.log('=== 고객 DB 필드명 확인 ===\n');
        
        // 1. 고객 DB 구조 확인
        const dbInfo = await notion.databases.retrieve({
            database_id: CUSTOMER_DB_ID
        });
        
        console.log('고객 DB 속성 목록:');
        Object.entries(dbInfo.properties).forEach(([name, prop]) => {
            console.log(`  ${name}: ${prop.type}`);
        });
        
        // 2. 샘플 고객 데이터 확인
        const response = await notion.databases.query({
            database_id: CUSTOMER_DB_ID,
            page_size: 3
        });
        
        console.log(`\n샘플 고객 데이터 (${response.results.length}개):`);
        
        response.results.forEach((page, index) => {
            console.log(`\n고객 ${index + 1}:`);
            Object.entries(page.properties).forEach(([name, prop]) => {
                if (prop.type === 'title') {
                    console.log(`  ${name} (title): ${prop.title?.[0]?.plain_text || 'empty'}`);
                } else if (prop.type === 'rich_text') {
                    console.log(`  ${name} (rich_text): ${prop.rich_text?.[0]?.plain_text || 'empty'}`);
                }
            });
        });
        
        // 3. 특정 고객 ID로 직접 조회
        const testCustomerId = '1ff8065e-4391-8195-82a9-d5c56ec0e74a';
        console.log(`\n특정 고객 조회 (${testCustomerId}):`);
        
        try {
            const customerPage = await notion.pages.retrieve({
                page_id: testCustomerId
            });
            
            console.log('속성들:');
            Object.entries(customerPage.properties).forEach(([name, prop]) => {
                if (prop.type === 'title') {
                    console.log(`  ${name} (title): ${prop.title?.[0]?.plain_text || 'empty'}`);
                } else if (prop.type === 'rich_text') {
                    console.log(`  ${name} (rich_text): ${prop.rich_text?.[0]?.plain_text || 'empty'}`);
                }
            });
        } catch (error) {
            console.error('특정 고객 조회 오류:', error.message);
        }
        
    } catch (error) {
        console.error('디버깅 오류:', error);
    }
}

debugCustomerFields(); 