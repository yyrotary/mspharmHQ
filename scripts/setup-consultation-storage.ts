import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function setupConsultationStorage() {
  console.log('🗂️ 상담 이미지 스토리지 설정 시작...');

  try {
    // 1. 버킷 생성
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket(
      'consultation-images',
      {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB
      }
    );

    if (bucketError && bucketError.message !== 'Bucket already exists') {
      throw bucketError;
    }

    console.log('✅ 버킷 생성 완료:', bucket || '이미 존재함');

    // 2. 버킷 목록 확인
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) throw listError;

    const consultationBucket = buckets.find(bucket => bucket.name === 'consultation-images');
    
    if (consultationBucket) {
      console.log('✅ consultation-images 버킷 확인됨');
      console.log(`   - ID: ${consultationBucket.id}`);
      console.log(`   - 공개: ${consultationBucket.public ? 'Yes' : 'No'}`);
      console.log(`   - 생성일: ${consultationBucket.created_at}`);
    }

    // 3. 테스트 파일 업로드 및 삭제
    console.log('🧪 버킷 테스트 중...');
    
    const testContent = 'test';
    const testPath = 'test/test.txt';
    
    // 테스트 파일 업로드
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('consultation-images')
      .upload(testPath, testContent, {
        contentType: 'text/plain'
      });

    if (uploadError) throw uploadError;

    console.log('✅ 테스트 업로드 성공');

    // 공개 URL 생성 테스트
    const { data: publicUrl } = supabase.storage
      .from('consultation-images')
      .getPublicUrl(testPath);

    console.log(`✅ 공개 URL 생성 성공: ${publicUrl.publicUrl}`);

    // 테스트 파일 삭제
    const { error: deleteError } = await supabase.storage
      .from('consultation-images')
      .remove([testPath]);

    if (deleteError) throw deleteError;

    console.log('✅ 테스트 파일 삭제 완료');

    console.log('🎉 스토리지 설정 완료');
    return true;

  } catch (error) {
    console.error('💥 스토리지 설정 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  setupConsultationStorage()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 