const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickConsultationCheck() {
  console.log('🔍 빠른 상담 데이터 점검...');
  console.log('=' .repeat(80));

  try {
    // 1. Supabase 상담 데이터 기본 정보
    console.log('📋 Supabase 상담 데이터 기본 정보...');
    
    const { count: totalConsultations, error: countError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ 상담 수 조회 실패:', countError);
      return;
    }

    console.log(`📊 총 Supabase 상담 수: ${totalConsultations}개`);

    // 2. 새로 추가된 고객들의 상담 확인
    console.log('\n🔍 새로 추가된 고객들의 상담 확인...');
    console.log('-' .repeat(80));

    const newCustomerCodes = ['00073', '00074']; // 송정숙, 박귀화
    const originalCodes = ['00028', '00027']; // 원래 코드

    for (let i = 0; i < newCustomerCodes.length; i++) {
      const newCode = newCustomerCodes[i];
      const originalCode = originalCodes[i];
      
      console.log(`\n${newCode} (원래: ${originalCode}) 고객의 상담 확인:`);
      
      // 새 코드로 상담 조회
      const { data: newCodeConsultations, error: newError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', newCode)
        .order('consultation_date', { ascending: false });

      if (newError) {
        console.error(`❌ ${newCode} 상담 조회 실패:`, newError);
        continue;
      }

      // 원래 코드로 상담 조회
      const { data: originalCodeConsultations, error: originalError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', originalCode)
        .order('consultation_date', { ascending: false });

      if (originalError) {
        console.error(`❌ ${originalCode} 상담 조회 실패:`, originalError);
        continue;
      }

      console.log(`  새 코드 ${newCode} 상담: ${newCodeConsultations?.length || 0}개`);
      console.log(`  원래 코드 ${originalCode} 상담: ${originalCodeConsultations?.length || 0}개`);
      console.log(`  총 상담: ${(newCodeConsultations?.length || 0) + (originalCodeConsultations?.length || 0)}개`);

      // 상담 내용 샘플 출력
      if (originalCodeConsultations && originalCodeConsultations.length > 0) {
        console.log(`  원래 코드 상담 샘플:`);
        originalCodeConsultations.slice(0, 3).forEach((consultation, index) => {
          console.log(`    ${index + 1}. ${consultation.consultation_date}: ${consultation.content?.substring(0, 30) || 'N/A'}...`);
        });
      }
    }

    // 3. 고객별 상담 수 상위 10개
    console.log('\n📊 고객별 상담 수 상위 10개...');
    console.log('-' .repeat(80));

    const { data: consultationCounts, error: groupError } = await supabase
      .rpc('get_consultation_counts_by_customer');

    if (groupError) {
      console.log('RPC 함수가 없어서 직접 조회합니다...');
      
      // 직접 조회
      const { data: allConsultations, error: allError } = await supabase
        .from('consultations')
        .select('customer_code');

      if (allError) {
        console.error('❌ 모든 상담 조회 실패:', allError);
        return;
      }

      // 고객별 카운트
      const counts = {};
      allConsultations?.forEach(consultation => {
        const code = consultation.customer_code;
        counts[code] = (counts[code] || 0) + 1;
      });

      // 상위 10개 정렬
      const sortedCounts = Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);

      sortedCounts.forEach(([code, count]) => {
        console.log(`  ${code}: ${count}개`);
      });
    } else {
      consultationCounts?.slice(0, 10).forEach(item => {
        console.log(`  ${item.customer_code}: ${item.consultation_count}개`);
      });
    }

    // 4. 최근 상담 데이터 확인
    console.log('\n📅 최근 상담 데이터 확인...');
    console.log('-' .repeat(80));

    const { data: recentConsultations, error: recentError } = await supabase
      .from('consultations')
      .select('customer_code, consultation_date, content')
      .order('consultation_date', { ascending: false })
      .limit(5);

    if (recentError) {
      console.error('❌ 최근 상담 조회 실패:', recentError);
    } else {
      recentConsultations?.forEach((consultation, index) => {
        console.log(`  ${index + 1}. ${consultation.customer_code} (${consultation.consultation_date}): ${consultation.content?.substring(0, 40) || 'N/A'}...`);
      });
    }

    // 5. 요약
    console.log('\n📊 빠른 점검 요약');
    console.log('=' .repeat(80));
    console.log(`총 Supabase 상담 수: ${totalConsultations}개`);
    console.log(`Notion 상담 수 (예상): 107개`);
    console.log(`차이: ${107 - totalConsultations}개`);
    
    if (107 - totalConsultations > 0) {
      console.log('\n⚠️ 상담 데이터 누락이 감지되었습니다!');
      console.log('🔧 권장 조치:');
      console.log('1. 누락된 상담 데이터 마이그레이션 스크립트 실행');
      console.log('2. 새로 추가된 고객들의 상담 데이터 특별 처리');
    } else {
      console.log('\n✅ 상담 데이터가 정상적으로 마이그레이션된 것으로 보입니다.');
    }

  } catch (error) {
    console.error('💥 빠른 상담 점검 실패:', error);
  }
}

// 실행
if (require.main === module) {
  quickConsultationCheck()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 