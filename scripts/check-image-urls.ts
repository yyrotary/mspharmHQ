import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkImageUrls() {
  try {
    console.log('🔍 Supabase에 저장된 이미지 URL 확인 중...');
    
    const { data, error } = await supabase
      .from('consultations')
      .select('consultation_id, image_urls')
      .not('image_urls', 'is', null)
      .limit(5);
    
    if (error) throw error;
    
    console.log('\n📸 이미지 URL 샘플:');
    data.forEach(consultation => {
      console.log(`\n상담 ID: ${consultation.consultation_id}`);
      console.log(`이미지 URLs:`);
      if (Array.isArray(consultation.image_urls)) {
        consultation.image_urls.forEach((url, index) => {
          console.log(`  ${index + 1}. ${url}`);
        });
      } else {
        console.log(`  ${consultation.image_urls}`);
      }
      console.log('---');
    });

    // Storage 파일 목록도 확인
    console.log('\n🗂️ Storage 파일 목록 확인...');
    const { data: files, error: storageError } = await supabase.storage
      .from('consultation-images')
      .list('', { limit: 10 });

    if (storageError) {
      console.error('Storage 오류:', storageError);
    } else {
      console.log('Storage 파일들:');
      files.forEach(file => {
        console.log(`  - ${file.name}`);
      });
    }

  } catch (error) {
    console.error('💥 오류:', error);
  }
}

// 실행
if (require.main === module) {
  checkImageUrls()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 