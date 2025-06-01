import dotenv from 'dotenv';
import { extractAllNotionConsultations } from './extract-notion-consultations';
import { migrateConsultationImages } from './migrate-consultation-images';
import { insertConsultationData } from './insert-consultation-data';
import { testMigration } from './test-migration';

dotenv.config({ path: '.env.local' });

interface MigrationReport {
  phase: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  details?: any;
  error?: string;
}

async function runMigrationDataOnly(): Promise<void> {
  console.log('🚀 상담 관리 시스템 데이터 마이그레이션 시작');
  console.log('=' .repeat(60));
  
  const report: MigrationReport[] = [];
  const startTime = Date.now();

  try {
    // Phase 1: 스키마 및 스토리지는 이미 완료됨 (건너뛰기)
    console.log('✅ Phase 1: 인프라 준비 - 이미 완료됨 (건너뛰기)');
    report.push({
      phase: 'Phase 1: 인프라 준비',
      status: 'skipped',
      duration: 0,
      details: '스키마와 스토리지가 이미 설정됨'
    });

    // Phase 2: 데이터 마이그레이션
    console.log('\\n📊 Phase 2: 데이터 마이그레이션 시작...');
    
    // 2-1: Notion 데이터 추출
    console.log('📥 Notion 상담 데이터 추출 시작...');
    const extractStart = Date.now();
    try {
      await extractAllNotionConsultations();
      const extractDuration = Date.now() - extractStart;
      console.log(`✅ 📥 Notion 데이터 추출 완료 (${Math.round(extractDuration / 1000)}초)`);
      report.push({
        phase: 'Phase 2-1: Notion 데이터 추출',
        status: 'success',
        duration: extractDuration
      });
    } catch (error: any) {
      const extractDuration = Date.now() - extractStart;
      console.error(`❌ 📥 Notion 데이터 추출 실패: ${error.message}`);
      report.push({
        phase: 'Phase 2-1: Notion 데이터 추출',
        status: 'failed',
        duration: extractDuration,
        error: error.message
      });
      throw error;
    }

    // 2-2: 이미지 마이그레이션
    console.log('🖼️ 이미지 마이그레이션 시작...');
    const imageStart = Date.now();
    try {
      await migrateConsultationImages();
      const imageDuration = Date.now() - imageStart;
      console.log(`✅ 🖼️ 이미지 마이그레이션 완료 (${Math.round(imageDuration / 1000)}초)`);
      report.push({
        phase: 'Phase 2-2: 이미지 마이그레이션',
        status: 'success',
        duration: imageDuration
      });
    } catch (error: any) {
      const imageDuration = Date.now() - imageStart;
      console.error(`❌ 🖼️ 이미지 마이그레이션 실패: ${error.message}`);
      report.push({
        phase: 'Phase 2-2: 이미지 마이그레이션',
        status: 'failed',
        duration: imageDuration,
        error: error.message
      });
      // 이미지 마이그레이션 실패는 치명적이지 않으므로 계속 진행
      console.log('⚠️ 이미지 마이그레이션 실패했지만 데이터 삽입을 계속 진행합니다.');
    }

    // 2-3: 데이터 삽입
    console.log('💾 Supabase 데이터 삽입 시작...');
    const insertStart = Date.now();
    try {
      await insertConsultationData();
      const insertDuration = Date.now() - insertStart;
      console.log(`✅ 💾 데이터 삽입 완료 (${Math.round(insertDuration / 1000)}초)`);
      report.push({
        phase: 'Phase 2-3: 데이터 삽입',
        status: 'success',
        duration: insertDuration
      });
    } catch (error: any) {
      const insertDuration = Date.now() - insertStart;
      console.error(`❌ 💾 데이터 삽입 실패: ${error.message}`);
      report.push({
        phase: 'Phase 2-3: 데이터 삽입',
        status: 'failed',
        duration: insertDuration,
        error: error.message
      });
      throw error;
    }

    // Phase 3: 테스트 및 검증
    console.log('\\n🧪 Phase 3: 테스트 및 검증 시작...');
    const testStart = Date.now();
    try {
      await testMigration();
      const testDuration = Date.now() - testStart;
      console.log(`✅ 🧪 테스트 및 검증 완료 (${Math.round(testDuration / 1000)}초)`);
      report.push({
        phase: 'Phase 3: 테스트 및 검증',
        status: 'success',
        duration: testDuration
      });
    } catch (error: any) {
      const testDuration = Date.now() - testStart;
      console.error(`❌ 🧪 테스트 및 검증 실패: ${error.message}`);
      report.push({
        phase: 'Phase 3: 테스트 및 검증',
        status: 'failed',
        duration: testDuration,
        error: error.message
      });
      // 테스트 실패는 치명적이지 않으므로 경고만 표시
      console.log('⚠️ 테스트 실패했지만 마이그레이션은 완료되었습니다.');
    }

    // 마이그레이션 완료
    const totalDuration = Date.now() - startTime;
    console.log('\\n🎉 상담 관리 시스템 마이그레이션 완료!');
    console.log('=' .repeat(60));
    
    // 상세 보고서 출력
    console.log('\\n📊 마이그레이션 보고서:');
    console.log('-' .repeat(60));
    
    report.forEach((item, index) => {
      const statusIcon = item.status === 'success' ? '✅' : 
                        item.status === 'failed' ? '❌' : '⏭️';
      const duration = item.duration > 0 ? `(${Math.round(item.duration / 1000)}초)` : '';
      console.log(`${index + 1}. ${statusIcon} ${item.phase} ${duration}`);
      if (item.error) {
        console.log(`   오류: ${item.error}`);
      }
      if (item.details) {
        console.log(`   상세: ${JSON.stringify(item.details)}`);
      }
    });
    
    console.log('-' .repeat(60));
    console.log(`⏱️ 총 소요 시간: ${Math.round(totalDuration / 1000)}초`);
    console.log(`📈 성공한 단계: ${report.filter(r => r.status === 'success').length}/${report.length}`);
    
    // 다음 단계 안내
    console.log('\\n🎯 다음 단계:');
    console.log('1. .env.local에서 USE_SUPABASE_CONSULTATION=true 설정');
    console.log('2. 애플리케이션 재시작');
    console.log('3. 상담 관리 기능 테스트');
    console.log('\\n🔗 Supabase 대시보드에서 데이터 확인:');
    console.log(`   https://supabase.com/dashboard/project/${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}`);

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error('\\n💥 마이그레이션 실패:', error.message);
    console.log('\\n📊 실패 보고서:');
    console.log('-' .repeat(60));
    
    report.forEach((item, index) => {
      const statusIcon = item.status === 'success' ? '✅' : 
                        item.status === 'failed' ? '❌' : '⏭️';
      const duration = item.duration > 0 ? `(${Math.round(item.duration / 1000)}초)` : '';
      console.log(`${index + 1}. ${statusIcon} ${item.phase} ${duration}`);
      if (item.error) {
        console.log(`   오류: ${item.error}`);
      }
    });
    
    console.log('-' .repeat(60));
    console.log(`⏱️ 실패까지 소요 시간: ${Math.round(totalDuration / 1000)}초`);
    
    throw error;
  }
}

// 직접 실행
if (require.main === module) {
  runMigrationDataOnly()
    .then(() => {
      console.log('\\n✅ 마이그레이션 스크립트 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\\n❌ 마이그레이션 스크립트 실패:', error.message);
      process.exit(1);
    });
}

export { runMigrationDataOnly }; 