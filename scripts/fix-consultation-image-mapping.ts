import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixConsultationImageMapping(): Promise<void> {
  console.log('🔧 상담 이미지 매핑 수정 시작...');

  try {
    // 1. 현재 DB의 상담 데이터 조회
    const { data: consultations, error: consultationError } = await supabase
      .from('consultations')
      .select('id, consultation_id, customer_id, consult_date')
      .order('consultation_id');

    if (consultationError) throw consultationError;

    console.log(`📊 DB 상담 수: ${consultations.length}개`);

    // 2. 고객 데이터 조회 (customer_id 매핑용)
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_code, name');

    if (customerError) throw customerError;

    console.log(`📊 고객 수: ${customers.length}개`);

    // 3. 이미지 매핑 파일 읽기
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
    const originalImageMapping: Record<string, string[]> = JSON.parse(
      readFileSync(imageUrlMappingPath, 'utf-8')
    );

    console.log(`📥 원본 이미지 매핑: ${Object.keys(originalImageMapping).length}개`);

    // 4. consultation_id 매핑 생성
    // 원본 형식: 00001_002 -> 새 형식: CONS_0001 (두 번째 상담)
    const consultationIdMapping = new Map<string, string>();
    const customerCodeMapping = new Map<string, string>();

    // 고객 코드 매핑 생성
    customers.forEach(customer => {
      // customer_code가 "00001" 형태라고 가정
      const customerCode = customer.customer_code.replace(/^0+/, ''); // 앞의 0 제거
      customerCodeMapping.set(customer.id, customerCode);
    });

    // 5. 상담별 순서 계산 및 매핑
    const customerConsultationCounts = new Map<string, number>();

    consultations.forEach(consultation => {
      const customerId = consultation.customer_id;
      const customerCode = customerCodeMapping.get(customerId);
      
      if (!customerCode) {
        console.warn(`⚠️ 고객 코드를 찾을 수 없음: ${customerId}`);
        return;
      }

      // 해당 고객의 상담 순서 계산
      const currentCount = customerConsultationCounts.get(customerId) || 0;
      const nextCount = currentCount + 1;
      customerConsultationCounts.set(customerId, nextCount);

      // 원본 형식 생성: 00001_001, 00001_002, ...
      const paddedCustomerCode = customerCode.padStart(5, '0');
      const paddedConsultationNumber = nextCount.toString().padStart(3, '0');
      const originalFormat = `${paddedCustomerCode}_${paddedConsultationNumber}`;

      consultationIdMapping.set(originalFormat, consultation.consultation_id);
      
      console.log(`🔗 매핑: ${originalFormat} → ${consultation.consultation_id}`);
    });

    // 6. 새로운 이미지 매핑 생성
    const newImageMapping: Record<string, string[]> = {};
    let mappedCount = 0;
    let unmappedCount = 0;

    Object.entries(originalImageMapping).forEach(([originalId, imageUrls]) => {
      const newConsultationId = consultationIdMapping.get(originalId);
      
      if (newConsultationId) {
        newImageMapping[newConsultationId] = imageUrls;
        mappedCount++;
        if (imageUrls.length > 0) {
          console.log(`✅ ${originalId} → ${newConsultationId}: ${imageUrls.length}개 이미지`);
        }
      } else {
        unmappedCount++;
        console.log(`❌ 매핑 실패: ${originalId}`);
      }
    });

    console.log(`\n📊 매핑 결과:`);
    console.log(`  - 성공: ${mappedCount}개`);
    console.log(`  - 실패: ${unmappedCount}개`);

    // 7. 새로운 매핑 파일 저장
    const newMappingPath = join(process.cwd(), 'migration_data', 'fixed_image_url_mapping.json');
    writeFileSync(newMappingPath, JSON.stringify(newImageMapping, null, 2));
    console.log(`💾 수정된 매핑 파일 저장: ${newMappingPath}`);

    // 8. DB 업데이트 실행
    await updateConsultationImageUrls(newImageMapping);

  } catch (error) {
    console.error('💥 매핑 수정 실패:', error);
    throw error;
  }
}

async function updateConsultationImageUrls(imageMapping: Record<string, string[]>): Promise<void> {
  console.log('\n🔄 DB 이미지 URL 업데이트 시작...');

  try {
    const { data: consultations, error: fetchError } = await supabase
      .from('consultations')
      .select('id, consultation_id, image_urls');

    if (fetchError) throw fetchError;

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
          const mappedUrls = imageMapping[consultationId];

          if (!mappedUrls) {
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
            skippedCount++;
          }

        } catch (error) {
          console.error(`❌ ${consultation.consultation_id} 업데이트 실패:`, error);
          errorCount++;
        }
      });

      await Promise.all(updatePromises);

      // API 부하 방지
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`\n🎉 DB 업데이트 완료!`);
    console.log(`📊 통계:`);
    console.log(`  - 업데이트됨: ${updatedCount}개`);
    console.log(`  - 건너뜀: ${skippedCount}개`);
    console.log(`  - 실패: ${errorCount}개`);

    // 결과 검증
    await validateResults();

  } catch (error) {
    console.error('💥 DB 업데이트 실패:', error);
    throw error;
  }
}

async function validateResults(): Promise<void> {
  console.log('\n🔍 결과 검증 중...');

  try {
    const { data: consultationsWithImages, error } = await supabase
      .from('consultations')
      .select('consultation_id, image_urls')
      .not('image_urls', 'eq', '[]');

    if (error) throw error;

    console.log(`📊 이미지가 있는 상담: ${consultationsWithImages.length}개`);

    // 샘플 검증
    const samples = consultationsWithImages.slice(0, 3);
    for (const consultation of samples) {
      const imageUrls = consultation.image_urls as string[];
      console.log(`🔍 ${consultation.consultation_id}: ${imageUrls.length}개 이미지`);
      
      if (imageUrls.length > 0) {
        try {
          const response = await fetch(imageUrls[0], { method: 'HEAD' });
          console.log(`  ${response.ok ? '✅' : '❌'} 첫 번째 이미지 접근: ${response.status}`);
        } catch (error) {
          console.log(`  ❌ 이미지 접근 오류: ${error}`);
        }
      }
    }

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
  fixConsultationImageMapping()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 