import dotenv from 'dotenv';

// 환경 변수를 먼저 로드
dotenv.config({ path: '.env.local' });

import { 
  searchCustomers, 
  getCustomerById, 
  createCustomer,
  getNextCustomerCode,
  type CreateCustomerData 
} from '@/app/lib/supabase-customer';
import { 
  searchConsultations, 
  getConsultationById, 
  createConsultation,
  type CreateConsultationData 
} from '@/app/lib/supabase-consultation';

async function testCompleteSystem() {
  console.log('🚀 완전 Supabase 기반 시스템 테스트 시작...\n');

  try {
    // 환경 변수 확인
    console.log('🔍 환경 변수 확인...');
    console.log(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '설정됨' : '❌ 미설정'}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '설정됨' : '❌ 미설정'}\n`);

    // 1. 고객 번호 생성 로직 테스트
    console.log('1️⃣ 고객 번호 생성 로직 테스트');
    const nextCustomerCode = await getNextCustomerCode();
    console.log(`✅ 다음 고객 코드: ${nextCustomerCode}\n`);

    // 2. 고객 검색 테스트
    console.log('2️⃣ 고객 검색 테스트');
    const customers = await searchCustomers('김분옥');
    console.log(`✅ '김분옥' 검색 결과: ${customers.length}명`);
    if (customers.length > 0) {
      const customer = customers[0];
      console.log(`   - 고객 코드: ${customer.customer_code}`);
      console.log(`   - 이름: ${customer.name}`);
      console.log(`   - 상담 수: ${customer.consultation_count}\n`);

      // 3. 해당 고객의 상담일지 조회 테스트
      console.log('3️⃣ 상담일지 조회 테스트');
      const consultations = await searchConsultations({ customerId: customer.id });
      console.log(`✅ ${customer.name} 고객의 상담일지: ${consultations.length}개`);
      
      if (consultations.length > 0) {
        const consultation = consultations[0];
        console.log(`   - 상담일지 ID: ${consultation.consultation_id}`);
        console.log(`   - 상담일자: ${consultation.consultation_date}`);
        console.log(`   - 호소증상: ${consultation.chief_complaint?.substring(0, 50)}...`);
        console.log(`   - 이미지 수: ${consultation.image_urls?.length || 0}개\n`);

        // 4. 특정 상담일지 상세 조회 테스트
        console.log('4️⃣ 상담일지 상세 조회 테스트');
        const detailConsultation = await getConsultationById(consultation.id);
        if (detailConsultation) {
          console.log(`✅ 상담일지 상세 조회 성공`);
          console.log(`   - ID: ${detailConsultation.consultation_id}`);
          console.log(`   - 고객명: ${detailConsultation.customer_name}`);
          console.log(`   - 호소증상: ${detailConsultation.chief_complaint?.substring(0, 30)}...`);
          console.log(`   - 환자상태: ${detailConsultation.patient_condition?.substring(0, 30)}...`);
          console.log(`   - 설진분석: ${detailConsultation.tongue_analysis?.substring(0, 30)}...`);
          console.log(`   - 처방약: ${detailConsultation.prescription?.substring(0, 30)}...`);
          console.log(`   - 특이사항: ${detailConsultation.special_notes?.substring(0, 30)}...`);
          console.log(`   - 결과: ${detailConsultation.result?.substring(0, 30)}...`);
          console.log(`   - 이미지 URLs:`);
          detailConsultation.image_urls?.forEach((url, index) => {
            console.log(`     ${index + 1}. ${url.substring(0, 80)}...`);
          });
        }
      }
    }

    console.log('\n5️⃣ 시스템 통계');
    
    // 전체 고객 수 조회
    const allCustomers = await searchCustomers('');
    console.log(`✅ 전체 고객 수: ${allCustomers.length}명`);
    
    // 전체 상담일지 수 조회
    const allConsultations = await searchConsultations({});
    console.log(`✅ 전체 상담일지 수: ${allConsultations.length}개`);

    // 이미지가 있는 상담일지 수
    const consultationsWithImages = allConsultations.filter(c => c.image_urls && c.image_urls.length > 0);
    console.log(`✅ 이미지가 있는 상담일지: ${consultationsWithImages.length}개`);

    // 총 이미지 수
    const totalImages = allConsultations.reduce((sum, c) => sum + (c.image_urls?.length || 0), 0);
    console.log(`✅ 총 이미지 수: ${totalImages}개`);

    console.log('\n🎉 모든 테스트 완료! 시스템이 정상적으로 작동합니다.');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
}

// 새 고객 생성 테스트 (선택사항)
async function testCustomerCreation() {
  console.log('\n6️⃣ 새 고객 생성 테스트 (테스트용)');
  
  try {
    const testCustomerData: CreateCustomerData = {
      name: '테스트고객',
      phone: '010-1234-5678',
      gender: '남성',
      birth_date: '1990-01-01',
      estimated_age: 34,
      address: '서울시 강남구',
      special_notes: '테스트용 고객입니다.'
    };

    console.log('새 고객 생성 중...');
    const newCustomer = await createCustomer(testCustomerData);
    console.log(`✅ 새 고객 생성 성공:`);
    console.log(`   - 고객 코드: ${newCustomer.customer_code}`);
    console.log(`   - 이름: ${newCustomer.name}`);
    console.log(`   - ID: ${newCustomer.id}`);

    // 생성된 테스트 고객으로 상담일지 생성 테스트
    console.log('\n7️⃣ 새 상담일지 생성 테스트');
    const testConsultationData: CreateConsultationData = {
      customer_id: newCustomer.id,
      chief_complaint: '테스트 호소증상',
      patient_condition: '테스트 환자상태',
      tongue_analysis: '테스트 설진분석',
      prescription: '테스트 처방약',
      special_notes: '테스트 특이사항',
      result: '테스트 결과',
      consultation_date: new Date().toISOString().split('T')[0]
    };

    console.log('새 상담일지 생성 중...');
    const newConsultation = await createConsultation(testConsultationData);
    console.log(`✅ 새 상담일지 생성 성공:`);
    console.log(`   - 상담일지 ID: ${newConsultation.consultation_id}`);
    console.log(`   - 고객명: ${newConsultation.customer_name}`);
    console.log(`   - 호소증상: ${newConsultation.chief_complaint}`);

    console.log('\n⚠️ 테스트 데이터가 생성되었습니다. 필요시 수동으로 삭제해주세요.');

  } catch (error) {
    console.error('❌ 고객/상담일지 생성 테스트 중 오류:', error);
  }
}

// 메인 실행
async function main() {
  await testCompleteSystem();
  
  // 새 데이터 생성 테스트는 주석 처리 (필요시 활성화)
  // await testCustomerCreation();
}

main().catch(console.error); 