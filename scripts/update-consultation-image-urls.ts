import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateConsultationImageUrls(): Promise<void> {
  console.log('🔄 상담 테이블 이미지 URL 업데이트 시작...');

  try {
    // 이미지 URL 매핑 파일 읽기
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
    const imageUrlMapping: Record<string, string[]> = JSON.parse(
      readFileSync(imageUrlMappingPath, 'utf-8')
    );

    console.log(`📥 로드된 이미지 매핑: ${Object.keys(imageUrlMapping).length}개`);

    // 현재 consultations 테이블의 상태 확인
    const { data: consultations, error: fetchError } = await supabase
      .from('consultations')
      .select('id, consultation_id, image_urls')
      .order('consultation_id');

    if (fetchError) throw fetchError;

    console.log(`📊 조회된 상담 데이터: ${consultations.length}개`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 배치 단위로 업데이트
    const batchSize = 50;
    const batches = chunkArray(consultations, batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      const updatePromises = batch.map(async (consultation) => {
        try {
          const consultationId = consultation.consultation_id;
          const mappedUrls = imageUrlMapping[consultationId];

          // 매핑된 URL이 없거나 빈 배열인 경우
          if (!mappedUrls || mappedUrls.length === 0) {
            // 현재 image_urls가 비어있지 않다면 빈 배열로 설정
            if (consultation.image_urls && consultation.image_urls.length > 0) {
              const { error: updateError } = await supabase
                .from('consultations')
                .update({ image_urls: [] })
                .eq('id', consultation.id);

              if (updateError) throw updateError;
              console.log(`🔄 ${consultationId}: 이미지 URL 초기화`);
            }
            skippedCount++;
            return;
          }

          // 현재 저장된 URL과 매핑된 URL이 다른 경우에만 업데이트
          const currentUrls = consultation.image_urls || [];
          const urlsChanged = JSON.stringify(currentUrls) !== JSON.stringify(mappedUrls);

          if (urlsChanged) {
            const { error: updateError } = await supabase
              .from('consultations')
              .update({ image_urls: mappedUrls })
              .eq('id', consultation.id);

            if (updateError) throw updateError;

            console.log(`✅ ${consultationId}: ${mappedUrls.length}개 이미지 URL 업데이트`);
            updatedCount++;
          } else {
            console.log(`⏭️ ${consultationId}: 이미지 URL 변경 없음`);
            skippedCount++;
          }

        } catch (error) {
          console.error(`❌ ${consultation.consultation_id} 업데이트 실패:`, error);
          errorCount++;
        }
      });

      // 배치 내 모든 업데이트 완료 대기
      await Promise.all(updatePromises);

      // API 부하 방지
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n🎉 이미지 URL 업데이트 완료!');
    console.log(`📊 통계:`);
    console.log(`  - 업데이트됨: ${updatedCount}개`);
    console.log(`  - 건너뜀: ${skippedCount}개`);
    console.log(`  - 실패: ${errorCount}개`);

    // 업데이트 결과 검증
    await validateImageUrlUpdate();

  } catch (error) {
    console.error('💥 이미지 URL 업데이트 실패:', error);
    throw error;
  }
}

async function validateImageUrlUpdate(): Promise<void> {
  console.log('\n🔍 업데이트 결과 검증 중...');

  try {
    // 이미지가 있는 상담 수 확인
    const { data: consultationsWithImages, error: countError } = await supabase
      .from('consultations')
      .select('consultation_id, image_urls')
      .not('image_urls', 'eq', '[]');

    if (countError) throw countError;

    console.log(`📊 이미지가 있는 상담: ${consultationsWithImages.length}개`);

    // 샘플 검증 (처음 5개)
    const sampleConsultations = consultationsWithImages.slice(0, 5);
    
    for (const consultation of sampleConsultations) {
      const imageUrls = consultation.image_urls as string[];
      console.log(`🔍 ${consultation.consultation_id}: ${imageUrls.length}개 이미지`);
      
      // 첫 번째 이미지 URL 접근 테스트
      if (imageUrls.length > 0) {
        try {
          const response = await fetch(imageUrls[0], { method: 'HEAD' });
          if (response.ok) {
            console.log(`  ✅ 첫 번째 이미지 접근 가능`);
          } else {
            console.log(`  ⚠️ 첫 번째 이미지 접근 실패: ${response.status}`);
          }
        } catch (error) {
          console.log(`  ❌ 첫 번째 이미지 접근 오류: ${error}`);
        }
      }
    }

    console.log('✅ 검증 완료');

  } catch (error) {
    console.error('❌ 검증 실패:', error);
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 실행
if (require.main === module) {
  updateConsultationImageUrls()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 