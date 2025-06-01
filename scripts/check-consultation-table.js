const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConsultationTable() {
  console.log('🔍 상담 테이블 상태 확인...');
  console.log('=' .repeat(80));

  try {
    // 1. 상담 수 확인
    const { count, error: countError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ 상담 수 조회 실패:', countError);
      return;
    }

    console.log(`📊 현재 상담 수: ${count}개`);

    // 2. 샘플 데이터 확인
    const { data: sampleData, error: sampleError } = await supabase
      .from('consultations')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('❌ 샘플 데이터 조회 실패:', sampleError);
      return;
    }

    console.log('\n📋 샘플 데이터:');
    sampleData?.forEach((consultation, index) => {
      console.log(`${index + 1}. ID: ${consultation.id}, 고객코드: ${consultation.customer_code || 'N/A'}, 날짜: ${consultation.consultation_date || 'N/A'}`);
    });

    // 3. 고객 코드별 분포
    const { data: allConsultations, error: allError } = await supabase
      .from('consultations')
      .select('customer_code');

    if (!allError && allConsultations) {
      const counts = {};
      allConsultations.forEach(consultation => {
        const code = consultation.customer_code || 'undefined';
        counts[code] = (counts[code] || 0) + 1;
      });

      console.log('\n📊 고객 코드별 상담 수:');
      Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([code, count]) => {
          console.log(`  ${code}: ${count}개`);
        });
    }

  } catch (error) {
    console.error('💥 상담 테이블 확인 실패:', error);
  }
}

// 실행
if (require.main === module) {
  checkConsultationTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 