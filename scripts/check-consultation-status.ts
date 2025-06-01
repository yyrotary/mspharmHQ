import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkConsultationStatus(): Promise<void> {
  console.log('🔍 상담 테이블 상태 확인 중...');

  try {
    // 1. 전체 상담 수 확인
    const { data: allConsultations, error: allError } = await supabase
      .from('consultations')
      .select('id, consultation_id, image_urls')
      .order('consultation_id');

    if (allError) throw allError;

    console.log(`📊 전체 상담 수: ${allConsultations.length}개`);

    // 2. image_urls 상태 분석
    let emptyImageUrls = 0;
    let nullImageUrls = 0;
    let withImageUrls = 0;

    allConsultations.forEach(consultation => {
      if (consultation.image_urls === null) {
        nullImageUrls++;
      } else if (Array.isArray(consultation.image_urls) && consultation.image_urls.length === 0) {
        emptyImageUrls++;
      } else if (Array.isArray(consultation.image_urls) && consultation.image_urls.length > 0) {
        withImageUrls++;
      }
    });

    console.log(`📊 이미지 URL 상태:`);
    console.log(`  - null: ${nullImageUrls}개`);
    console.log(`  - 빈 배열: ${emptyImageUrls}개`);
    console.log(`  - 이미지 있음: ${withImageUrls}개`);

    // 3. 샘플 데이터 확인 (처음 5개)
    console.log('\n📋 샘플 데이터:');
    allConsultations.slice(0, 5).forEach(consultation => {
      console.log(`  ${consultation.consultation_id}: ${JSON.stringify(consultation.image_urls)}`);
    });

    // 4. 이미지 매핑 파일과 비교
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
    const imageUrlMapping: Record<string, string[]> = JSON.parse(
      readFileSync(imageUrlMappingPath, 'utf-8')
    );

    console.log(`\n📥 매핑 파일 정보:`);
    console.log(`  - 총 매핑 수: ${Object.keys(imageUrlMapping).length}개`);

    // 이미지가 있는 매핑 수 계산
    const mappingsWithImages = Object.entries(imageUrlMapping).filter(([_, urls]) => urls.length > 0);
    console.log(`  - 이미지가 있는 매핑: ${mappingsWithImages.length}개`);

    // 5. 매핑과 DB 데이터 비교
    console.log('\n🔍 매핑과 DB 비교:');
    let matchingIds = 0;
    let missingInDb = 0;

    Object.keys(imageUrlMapping).forEach(consultationId => {
      const dbRecord = allConsultations.find(c => c.consultation_id === consultationId);
      if (dbRecord) {
        matchingIds++;
      } else {
        missingInDb++;
        console.log(`  ❌ DB에 없음: ${consultationId}`);
      }
    });

    console.log(`  - 매핑과 DB 일치: ${matchingIds}개`);
    console.log(`  - DB에 없는 매핑: ${missingInDb}개`);

    // 6. 업데이트가 필요한 상담 확인
    console.log('\n🔄 업데이트 필요한 상담:');
    let needsUpdate = 0;

    allConsultations.forEach(consultation => {
      const consultationId = consultation.consultation_id;
      const mappedUrls = imageUrlMapping[consultationId];
      
      if (mappedUrls && mappedUrls.length > 0) {
        const currentUrls = consultation.image_urls || [];
        const urlsChanged = JSON.stringify(currentUrls) !== JSON.stringify(mappedUrls);
        
        if (urlsChanged) {
          needsUpdate++;
          if (needsUpdate <= 5) { // 처음 5개만 출력
            console.log(`  📝 ${consultationId}: ${currentUrls.length} → ${mappedUrls.length}개 이미지`);
          }
        }
      }
    });

    console.log(`  - 업데이트 필요: ${needsUpdate}개`);

  } catch (error) {
    console.error('💥 상태 확인 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  checkConsultationStatus()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 