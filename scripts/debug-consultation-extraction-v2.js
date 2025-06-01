const { Client } = require('@notionhq/client');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const CONSULTATION_DB_ID = process.env.NOTION_CONSULTATION_DB_ID;

async function debugConsultationExtraction() {
    try {
        console.log('=== 상담 데이터 추출 디버깅 v2 ===\n');
        
        // 1. 전체 데이터 조회
        console.log('1. 전체 데이터 조회...');
        const allResponse = await notion.databases.query({
            database_id: CONSULTATION_DB_ID,
            page_size: 100
        });
        
        console.log(`전체 레코드 수: ${allResponse.results.length}`);
        
        // 2. 각 레코드의 고객 관계 상태 확인
        console.log('\n2. 고객 관계 상태 확인...');
        let validCount = 0;
        let invalidCount = 0;
        
        for (let i = 0; i < Math.min(allResponse.results.length, 10); i++) {
            const page = allResponse.results[i];
            const customerRelation = page.properties['고객']?.relation;
            
            console.log(`\n레코드 ${i + 1}:`);
            console.log(`  고객 관계: ${JSON.stringify(customerRelation)}`);
            
            if (customerRelation && customerRelation.length > 0) {
                validCount++;
                console.log(`  ✅ 유효한 고객 관계`);
                
                // 고객 정보 조회 시도
                try {
                    const customerPage = await notion.pages.retrieve({
                        page_id: customerRelation[0].id
                    });
                    
                    const customerTitle = customerPage.properties['고객']?.title?.[0]?.plain_text;
                    console.log(`  고객 제목: ${customerTitle}`);
                    
                    if (customerTitle) {
                        const customerCode = customerTitle.replace('고객_', '');
                        console.log(`  고객 코드: ${customerCode}`);
                    }
                } catch (error) {
                    console.log(`  ❌ 고객 정보 조회 실패: ${error.message}`);
                }
            } else {
                invalidCount++;
                console.log(`  ❌ 고객 관계 없음`);
            }
        }
        
        console.log(`\n유효한 관계: ${validCount}개`);
        console.log(`무효한 관계: ${invalidCount}개`);
        
        // 3. 필터 조건 테스트
        console.log('\n3. 필터 조건 테스트...');
        
        // 다양한 필터 조건 시도
        const filters = [
            {
                name: '고객 관계 is_not_empty',
                filter: {
                    property: '고객',
                    relation: {
                        is_not_empty: true
                    }
                }
            },
            {
                name: '고객 관계 contains any',
                filter: {
                    property: '고객',
                    relation: {
                        contains: '1ff8065e-4391-8195-82a9-d5c56ec0e74a'
                    }
                }
            }
        ];
        
        for (const filterTest of filters) {
            try {
                const response = await notion.databases.query({
                    database_id: CONSULTATION_DB_ID,
                    filter: filterTest.filter,
                    page_size: 10
                });
                
                console.log(`${filterTest.name}: ${response.results.length}개`);
            } catch (error) {
                console.log(`${filterTest.name}: 오류 - ${error.message}`);
            }
        }
        
        // 4. 필터 없이 모든 데이터 추출 시도
        console.log('\n4. 필터 없이 모든 데이터 추출...');
        let allConsultations = [];
        let hasMore = true;
        let nextCursor = undefined;
        
        while (hasMore) {
            const response = await notion.databases.query({
                database_id: CONSULTATION_DB_ID,
                start_cursor: nextCursor,
                page_size: 100
            });
            
            for (const page of response.results) {
                const customerRelation = page.properties['고객']?.relation;
                if (customerRelation && customerRelation.length > 0) {
                    allConsultations.push(page);
                }
            }
            
            hasMore = response.has_more;
            nextCursor = response.next_cursor;
        }
        
        console.log(`필터 없이 추출된 유효한 상담: ${allConsultations.length}개`);
        
    } catch (error) {
        console.error('디버깅 오류:', error);
    }
}

debugConsultationExtraction(); 