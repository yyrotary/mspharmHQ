import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanExistingData() {
  console.log('🧹 기존 데이터 정리 시작...');

  try {
    // 기존 상담 데이터 삭제
    console.log('🗑️ 기존 상담 데이터 삭제 중...');
    const { error: consultationError } = await supabase
      .from('consultations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 데이터 삭제

    if (consultationError) {
      console.error('상담 데이터 삭제 실패:', consultationError);
      return;
    }

    console.log('✅ 상담 데이터 삭제 완료');

    // 마이그레이션 로그 삭제
    console.log('🗑️ 마이그레이션 로그 삭제 중...');
    const { error: logError } = await supabase
      .from('consultation_migration_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 데이터 삭제

    if (logError) {
      console.warn('마이그레이션 로그 삭제 실패 (무시 가능):', logError);
    } else {
      console.log('✅ 마이그레이션 로그 삭제 완료');
    }

    // 최종 확인
    const { data: remainingConsultations } = await supabase
      .from('consultations')
      .select('id', { count: 'exact' });

    const { data: remainingCustomers } = await supabase
      .from('customers')
      .select('id', { count: 'exact' });

    console.log('📊 정리 후 데이터 현황:');
    console.log(`   - 상담 데이터: ${remainingConsultations?.length || 0}개`);
    console.log(`   - 고객 데이터: ${remainingCustomers?.length || 0}개 (유지됨)`);

    console.log('🎉 데이터 정리 완료! 이제 마이그레이션을 다시 실행할 수 있습니다.');

  } catch (error) {
    console.error('💥 데이터 정리 실패:', error);
  }
}

cleanExistingData(); 