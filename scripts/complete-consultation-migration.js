const { Client } = require('@notionhq/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY // RLS 우회를 위해 Service Role Key 사용
);

const CONSULTATION_DB_ID = process.env.NOTION_CONSULTATION_DB_ID;

async function getSupabaseCustomers() {
    console.log('Supabase 고객 데이터 조회 중...');
    const { data, error } = await supabase
        .from('customers')
        .select('id, customer_code, name');
    
    if (error) {
        console.error('Supabase 고객 조회 오류:', error);
        return new Map();
    }
    
    const customerMap = new Map();
    data.forEach(customer => {
        customerMap.set(customer.customer_code, {
            id: customer.id,
            name: customer.name
        });
    });
    
    console.log(`Supabase 고객 수: ${customerMap.size}`);
    return customerMap;
}

async function getAllNotionConsultations() {
    console.log('Notion 상담 데이터 조회 중...');
    let allConsultations = [];
    let hasMore = true;
    let nextCursor = undefined;

    while (hasMore) {
        try {
            const response = await notion.databases.query({
                database_id: CONSULTATION_DB_ID,
                start_cursor: nextCursor,
                page_size: 100
                // 필터 제거 - 수동으로 필터링
            });

            for (const page of response.results) {
                try {
                    // 고객 관계가 있는지 먼저 확인
                    const customerRelation = page.properties['고객']?.relation;
                    if (customerRelation && customerRelation.length > 0) {
                        const consultation = await extractConsultationData(page);
                        if (consultation) {
                            allConsultations.push(consultation);
                        }
                    }
                } catch (error) {
                    console.error(`상담 데이터 추출 오류 (${page.id}):`, error.message);
                }
            }

            hasMore = response.has_more;
            nextCursor = response.next_cursor;
            
            console.log(`진행 상황: ${allConsultations.length}개 상담 추출됨`);
        } catch (error) {
            console.error('Notion 조회 오류:', error);
            break;
        }
    }

    console.log(`총 ${allConsultations.length}개 상담 추출 완료`);
    return allConsultations;
}

async function extractConsultationData(page) {
    const properties = page.properties;
    
    // 고객 관계 추출
    const customerRelation = properties['고객']?.relation?.[0];
    if (!customerRelation) {
        return null;
    }

    // 고객 정보 조회
    let customerCode = null;
    try {
        const customerPage = await notion.pages.retrieve({
            page_id: customerRelation.id
        });
        
        // 올바른 필드명 사용: 'id' (title 타입)
        const customerTitle = customerPage.properties['id']?.title?.[0]?.plain_text;
        if (customerTitle) {
            customerCode = customerTitle; // 이미 00XXX 형태로 되어 있음
        }
    } catch (error) {
        console.error(`고객 정보 조회 오류 (${customerRelation.id}):`, error.message);
        return null;
    }

    if (!customerCode) {
        return null;
    }

    // 상담 데이터 추출 (Supabase 스키마에 맞춤)
    const consultation = {
        customer_code: customerCode, // 매핑용
        consult_date: properties['상담일자']?.date?.start || null,
        symptoms: properties['호소증상']?.rich_text?.[0]?.plain_text || '',
        patient_condition: properties['환자상태']?.rich_text?.[0]?.plain_text || null,
        tongue_analysis: properties['설진분석']?.rich_text?.[0]?.plain_text || null,
        prescription: properties['처방약']?.rich_text?.[0]?.plain_text || null,
        result: properties['결과']?.rich_text?.[0]?.plain_text || null,
        special_notes: properties['특이사항']?.rich_text?.[0]?.plain_text || null,
        image_urls: [], // 이미지는 나중에 처리
        created_at: page.created_time,
        updated_at: page.last_edited_time
    };

    return consultation;
}

async function migrateConsultationsToSupabase(consultations, customerMap) {
    console.log('\nSupabase로 상담 데이터 마이그레이션 시작...');
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // 배치 크기 설정
    const batchSize = 10;
    
    for (let i = 0; i < consultations.length; i += batchSize) {
        const batch = consultations.slice(i, i + batchSize);
        
        // 고객 코드를 customer_id로 변환하고 consultation_id 생성
        const processedBatch = batch.map((consultation, index) => {
            const customer = customerMap.get(consultation.customer_code);
            if (!customer) {
                throw new Error(`고객 코드 ${consultation.customer_code}를 찾을 수 없습니다.`);
            }
            
            const globalIndex = i + index + 1;
            const consultationId = `CONS_${String(globalIndex).padStart(4, '0')}`;
            
            return {
                consultation_id: consultationId,
                customer_id: customer.id,
                consult_date: consultation.consult_date,
                symptoms: consultation.symptoms || '상담 내용 없음',
                patient_condition: consultation.patient_condition,
                tongue_analysis: consultation.tongue_analysis,
                prescription: consultation.prescription,
                result: consultation.result,
                special_notes: consultation.special_notes,
                image_urls: consultation.image_urls,
                created_at: consultation.created_at,
                updated_at: consultation.updated_at
            };
        });
        
        try {
            const { data, error } = await supabase
                .from('consultations')
                .insert(processedBatch);
            
            if (error) {
                console.error(`배치 ${Math.floor(i/batchSize) + 1} 오류:`, error);
                errorCount += batch.length;
                errors.push(`배치 ${Math.floor(i/batchSize) + 1}: ${error.message}`);
            } else {
                successCount += batch.length;
                console.log(`배치 ${Math.floor(i/batchSize) + 1} 완료: ${batch.length}개 상담 추가`);
            }
        } catch (error) {
            console.error(`배치 ${Math.floor(i/batchSize) + 1} 예외:`, error);
            errorCount += batch.length;
            errors.push(`배치 ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        }
        
        // 잠시 대기 (API 제한 방지)
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n=== 마이그레이션 결과 ===');
    console.log(`성공: ${successCount}개`);
    console.log(`실패: ${errorCount}개`);
    
    if (errors.length > 0) {
        console.log('\n오류 목록:');
        errors.forEach(error => console.log(`- ${error}`));
    }
    
    return { successCount, errorCount };
}

async function verifyMigration() {
    console.log('\n마이그레이션 검증 중...');
    
    const { data: supabaseConsultations, error } = await supabase
        .from('consultations')
        .select(`
            consultation_id, 
            consult_date, 
            symptoms,
            customers!inner(customer_code, name)
        `)
        .order('created_at', { ascending: true });
    
    if (error) {
        console.error('검증 오류:', error);
        return;
    }
    
    console.log(`Supabase 상담 수: ${supabaseConsultations.length}`);
    
    // 고객별 상담 수 통계
    const customerStats = {};
    supabaseConsultations.forEach(consultation => {
        const code = consultation.customers.customer_code;
        customerStats[code] = (customerStats[code] || 0) + 1;
    });
    
    console.log('\n고객별 상담 수 (상위 10개):');
    Object.entries(customerStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([code, count]) => {
            console.log(`  ${code}: ${count}개`);
        });
}

async function main() {
    try {
        console.log('=== 상담 데이터 완전 재마이그레이션 시작 ===\n');
        
        // 1. Supabase 고객 데이터 조회
        const customerMap = await getSupabaseCustomers();
        
        // 2. Notion 상담 데이터 조회
        const consultations = await getAllNotionConsultations();
        
        if (consultations.length === 0) {
            console.log('마이그레이션할 상담 데이터가 없습니다.');
            return;
        }
        
        // 3. 고객 코드 검증
        console.log('\n고객 코드 검증 중...');
        const validConsultations = [];
        const invalidConsultations = [];
        
        consultations.forEach(consultation => {
            if (customerMap.has(consultation.customer_code)) {
                validConsultations.push(consultation);
            } else {
                invalidConsultations.push(consultation);
            }
        });
        
        console.log(`유효한 상담: ${validConsultations.length}개`);
        console.log(`무효한 상담: ${invalidConsultations.length}개`);
        
        if (invalidConsultations.length > 0) {
            console.log('\n무효한 고객 코드:');
            invalidConsultations.forEach(consultation => {
                console.log(`  ${consultation.customer_code}`);
            });
        }
        
        // 4. 마이그레이션 실행
        if (validConsultations.length > 0) {
            const result = await migrateConsultationsToSupabase(validConsultations, customerMap);
            
            // 5. 검증
            await verifyMigration();
            
            console.log('\n=== 마이그레이션 완료 ===');
            console.log(`총 처리: ${consultations.length}개`);
            console.log(`성공: ${result.successCount}개`);
            console.log(`실패: ${result.errorCount}개`);
        }
        
    } catch (error) {
        console.error('메인 프로세스 오류:', error);
    }
}

main(); 