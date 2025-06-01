import dotenv from 'dotenv';

// 환경 변수를 먼저 로드
dotenv.config({ path: '.env.local' });

import { 
  searchConsultations, 
  deleteConsultation 
} from '@/app/lib/supabase-consultation';

async function cleanupTestConsultation() {
  console.log('🧹 테스트 상담일지 정리 중...\n');

  try {
    // 테스트 상담일지 검색 (호소증상에 "테스트"가 포함된 상담일지들)
    const allConsultations = await searchConsultations({});
    const testConsultations = allConsultations.filter(consultation => 
      consultation.chief_complaint?.includes('테스트') || 
      consultation.chief_complaint?.includes('Google Drive 제거 후 테스트')
    );

    console.log(`🔍 발견된 테스트 상담일지: ${testConsultations.length}개`);

    if (testConsultations.length === 0) {
      console.log('✅ 정리할 테스트 상담일지가 없습니다.');
      return;
    }

    for (const consultation of testConsultations) {
      console.log(`\n🗑️ 테스트 상담일지 삭제 중...`);
      console.log(`   - 상담일지 ID: ${consultation.consultation_id}`);
      console.log(`   - 고객명: ${consultation.customer_name}`);
      console.log(`   - 호소증상: ${consultation.chief_complaint?.substring(0, 50)}...`);
      console.log(`   - 생성일시: ${consultation.created_at}`);

      try {
        await deleteConsultation(consultation.id);
        console.log(`   ✅ 삭제 완료`);
      } catch (error) {
        console.log(`   ❌ 삭제 실패: ${error}`);
      }
    }

    console.log('\n🎉 테스트 상담일지 정리 완료!');

  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error);
  }
}

cleanupTestConsultation().catch(console.error); 