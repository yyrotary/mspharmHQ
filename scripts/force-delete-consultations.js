const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceDeleteConsultations() {
  console.log('🗑️ 강제 상담 데이터 삭제...');
  console.log('=' .repeat(80));

  try {
    // 1. 현재 상태 확인
    const { count: beforeCount, error: beforeError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (beforeError) {
      console.error('❌ 삭제 전 상담 수 조회 실패:', beforeError);
      return;
    }

    console.log(`삭제 전 상담 수: ${beforeCount}개`);

    // 2. 모든 상담 데이터 조회
    const { data: allConsultations, error: selectError } = await supabase
      .from('consultations')
      .select('id');

    if (selectError) {
      console.error('❌ 상담 ID 조회 실패:', selectError);
      return;
    }

    console.log(`조회된 상담 ID 수: ${allConsultations?.length || 0}개`);

    // 3. 배치로 삭제 (50개씩)
    if (allConsultations && allConsultations.length > 0) {
      console.log('\n🗑️ 배치 삭제 시작...');
      
      let deletedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < allConsultations.length; i += 50) {
        const batch = allConsultations.slice(i, i + 50);
        const ids = batch.map(c => c.id);

        const { error: deleteError } = await supabase
          .from('consultations')
          .delete()
          .in('id', ids);

        if (deleteError) {
          console.error(`❌ 배치 ${Math.floor(i/50) + 1} 삭제 실패:`, deleteError);
          failedCount += batch.length;
        } else {
          deletedCount += batch.length;
          console.log(`✅ 배치 ${Math.floor(i/50) + 1}: ${batch.length}개 삭제 완료`);
        }
      }

      console.log(`\n📊 삭제 결과: 성공 ${deletedCount}개, 실패 ${failedCount}개`);
    }

    // 4. 삭제 후 상태 확인
    const { count: afterCount, error: afterError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (afterError) {
      console.error('❌ 삭제 후 상담 수 조회 실패:', afterError);
      return;
    }

    console.log(`\n📊 삭제 후 상담 수: ${afterCount}개`);

    if (afterCount === 0) {
      console.log('✅ 모든 상담 데이터가 성공적으로 삭제되었습니다!');
      console.log('🔧 이제 올바른 데이터로 재마이그레이션을 진행할 수 있습니다.');
    } else {
      console.log('⚠️ 일부 상담 데이터가 남아있습니다. 추가 조치가 필요할 수 있습니다.');
    }

  } catch (error) {
    console.error('💥 강제 삭제 실패:', error);
  }
}

// 실행
if (require.main === module) {
  forceDeleteConsultations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 