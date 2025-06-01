const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, 
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkConsultationSchema() {
    try {
        console.log('=== Supabase 상담 테이블 스키마 확인 ===\n');
        
        // 테이블 정보 조회 (PostgreSQL 시스템 테이블 사용)
        const { data, error } = await supabase
            .rpc('get_table_columns', { table_name: 'consultations' })
            .single();
        
        if (error) {
            console.log('RPC 함수가 없어서 직접 조회합니다...');
            
            // 샘플 데이터로 스키마 추정
            const { data: sampleData, error: sampleError } = await supabase
                .from('consultations')
                .select('*')
                .limit(1);
            
            if (sampleError) {
                console.error('샘플 데이터 조회 오류:', sampleError);
                return;
            }
            
            if (sampleData && sampleData.length > 0) {
                console.log('현재 테이블 컬럼 (샘플 데이터 기준):');
                Object.keys(sampleData[0]).forEach(column => {
                    console.log(`  ${column}`);
                });
            } else {
                console.log('테이블이 비어있습니다.');
            }
        } else {
            console.log('테이블 스키마:', data);
        }
        
        // 필요한 새 컬럼들
        const newColumns = [
            'patient_condition',
            'symptoms', 
            'tongue_analysis',
            'prescription'
        ];
        
        console.log('\n추가가 필요할 수 있는 컬럼들:');
        newColumns.forEach(col => {
            console.log(`  ${col} TEXT`);
        });
        
    } catch (error) {
        console.error('스키마 확인 오류:', error);
    }
}

checkConsultationSchema(); 