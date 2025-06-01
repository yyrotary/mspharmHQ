import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

async function checkEnvironment(): Promise<void> {
  console.log('🔍 환경 변수 확인 중...');

  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NOTION_API_KEY',
    'NOTION_CONSULTATION_DB_ID'
  ];

  const missingVars: string[] = [];
  const presentVars: string[] = [];

  // 필수 환경 변수 확인
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  });

  console.log('\n📋 환경 변수 상태:');
  presentVars.forEach(varName => {
    console.log(`✅ ${varName}: 설정됨`);
  });

  if (missingVars.length > 0) {
    console.log('\n❌ 누락된 환경 변수:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
  }

  // Supabase 연결 테스트
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n🔗 Supabase 연결 테스트...');
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data, error } = await supabase
        .from('consultations')
        .select('count', { count: 'exact' })
        .limit(1);

      if (error) throw error;

      console.log('✅ Supabase 연결 성공');
      console.log(`📊 상담 테이블 레코드 수: ${data?.length || 0}`);

    } catch (error) {
      console.error('❌ Supabase 연결 실패:', error);
    }
  }

  // 마이그레이션 모드 확인
  const useSupabase = process.env.USE_SUPABASE_CONSULTATION === 'true';
  console.log(`\n🔄 현재 상담 시스템 모드: ${useSupabase ? 'Supabase' : 'Notion'}`);

  if (!useSupabase) {
    console.log('\n⚠️ Supabase 모드로 전환하려면 다음 환경 변수를 설정하세요:');
    console.log('');
    console.log('# .env.local 파일에 추가');
    console.log('USE_SUPABASE_CONSULTATION=true');
    console.log('CONSULTATION_MIGRATION_MODE=false');
    console.log('SUPABASE_CONSULTATION_BUCKET=consultation-images');
    console.log('');
    console.log('설정 후 개발 서버를 재시작하세요: npm run dev');
  } else {
    console.log('✅ Supabase 모드가 활성화되어 있습니다.');
  }

  // Storage 버킷 확인
  if (useSupabase && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\n🗂️ Storage 버킷 확인...');
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) throw error;

      const consultationBucket = buckets.find(bucket => bucket.name === 'consultation-images');
      
      if (consultationBucket) {
        console.log('✅ consultation-images 버킷 존재함');
      } else {
        console.log('❌ consultation-images 버킷이 없습니다.');
        console.log('   다음 명령으로 버킷을 생성하세요: npm run setup:consultation-storage');
      }

    } catch (error) {
      console.error('❌ Storage 확인 실패:', error);
    }
  }

  console.log('\n🎉 환경 변수 확인 완료!');
}

// 실행
if (require.main === module) {
  checkEnvironment()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 