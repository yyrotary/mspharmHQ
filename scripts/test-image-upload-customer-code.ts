import { createClient } from '@supabase/supabase-js';
import { uploadConsultationImages, generateConsultationImagePath } from '../app/lib/consultation-utils';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 테스트용 1x1 픽셀 이미지 (Base64)
const TEST_IMAGE_BASE64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function testImageUploadWithCustomerCode() {
  console.log('🧪 customer_code 방식 이미지 업로드 테스트 시작...\n');

  try {
    // 1. 테스트용 고객 조회
    console.log('1️⃣ 테스트용 고객 조회 중...');
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_code, name')
      .limit(1);

    if (customerError) throw customerError;

    if (!customers || customers.length === 0) {
      throw new Error('테스트용 고객이 없습니다.');
    }

    const customer = customers[0];
    console.log(`✅ 테스트 고객: ${customer.name} (${customer.customer_code})\n`);

    // 2. 테스트용 상담 ID 생성
    const testConsultationId = `${customer.customer_code}_TEST_${Date.now()}`;
    console.log(`2️⃣ 테스트 상담 ID: ${testConsultationId}\n`);

    // 3. 이미지 업로드 테스트
    console.log('3️⃣ 이미지 업로드 테스트 중...');
    const imageDataArray = [TEST_IMAGE_BASE64, TEST_IMAGE_BASE64]; // 2개 이미지

    const uploadedUrls = await uploadConsultationImages(
      customer.customer_code,
      testConsultationId,
      imageDataArray
    );

    console.log(`✅ 이미지 업로드 완료: ${uploadedUrls.length}개`);
    uploadedUrls.forEach((url, index) => {
      console.log(`   - 이미지 ${index + 1}: ${url}`);
    });

    // 4. 생성된 파일 경로 확인
    console.log('\n4️⃣ 생성된 파일 경로 확인...');
    for (let i = 1; i <= uploadedUrls.length; i++) {
      const expectedPath = generateConsultationImagePath(
        customer.customer_code,
        testConsultationId,
        i
      );
      console.log(`   - 예상 경로 ${i}: ${expectedPath}`);
    }

    // 5. Storage에서 파일 목록 확인
    console.log('\n5️⃣ Storage 파일 목록 확인...');
    const folderPath = `${customer.customer_code}/${testConsultationId}`;
    const { data: files, error: listError } = await supabase.storage
      .from('consultation-images')
      .list(folderPath);

    if (listError) throw listError;

    console.log(`✅ Storage에서 발견된 파일: ${files?.length || 0}개`);
    files?.forEach(file => {
      console.log(`   - ${file.name} (${file.metadata?.size} bytes)`);
    });

    // 6. 테스트 파일 정리
    console.log('\n6️⃣ 테스트 파일 정리 중...');
    if (files && files.length > 0) {
      const filePaths = files.map(file => `${folderPath}/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from('consultation-images')
        .remove(filePaths);

      if (deleteError) {
        console.warn('⚠️ 파일 삭제 실패:', deleteError.message);
      } else {
        console.log('✅ 테스트 파일 정리 완료');
      }
    }

    console.log('\n🎉 customer_code 방식 이미지 업로드 테스트 성공!');
    console.log(`📁 폴더 구조: ${customer.customer_code}/${testConsultationId}/image_*.jpg`);

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testImageUploadWithCustomerCode();
}

export { testImageUploadWithCustomerCode }; 