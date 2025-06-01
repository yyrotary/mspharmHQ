import dotenv from 'dotenv';

// 환경 변수를 먼저 로드
dotenv.config({ path: '.env.local' });

import { 
  createCustomer,
  getCustomerById,
  type CreateCustomerData 
} from '@/app/lib/supabase-customer';

async function testCustomerCreation() {
  console.log('🧪 고객 생성 테스트 (Google Drive 없이)...\n');

  try {
    // 테스트 고객 데이터
    const testCustomerData: CreateCustomerData = {
      name: '테스트고객_' + Date.now(),
      phone: '010-9999-8888',
      gender: '여성',
      birth_date: '1985-03-15',
      estimated_age: 39,
      address: '서울시 서초구',
      special_notes: 'Google Drive 제거 후 테스트용 고객'
    };

    console.log('📝 고객 생성 중...');
    console.log(`   - 이름: ${testCustomerData.name}`);
    console.log(`   - 전화번호: ${testCustomerData.phone}`);
    console.log(`   - 성별: ${testCustomerData.gender}`);

    // 고객 생성
    const newCustomer = await createCustomer(testCustomerData);
    
    console.log('\n✅ 고객 생성 성공!');
    console.log(`   - 고객 ID: ${newCustomer.id}`);
    console.log(`   - 고객 코드: ${newCustomer.customer_code}`);
    console.log(`   - 이름: ${newCustomer.name}`);
    console.log(`   - 상담 수: ${newCustomer.consultation_count}`);
    console.log(`   - 생성일시: ${newCustomer.created_at}`);

    // 생성된 고객 다시 조회해서 확인
    console.log('\n🔍 생성된 고객 재조회 테스트...');
    const retrievedCustomer = await getCustomerById(newCustomer.id);
    
    if (retrievedCustomer) {
      console.log('✅ 고객 재조회 성공!');
      console.log(`   - 조회된 이름: ${retrievedCustomer.name}`);
      console.log(`   - 조회된 코드: ${retrievedCustomer.customer_code}`);
      console.log(`   - Google Drive 폴더 ID: ${retrievedCustomer.google_drive_folder_id || '없음'}`);
    } else {
      console.log('❌ 고객 재조회 실패');
    }

    console.log('\n🎉 Google Drive 없이 고객 생성이 정상적으로 작동합니다!');
    console.log('⚠️ 테스트 고객이 생성되었습니다. 필요시 수동으로 삭제해주세요.');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
}

testCustomerCreation().catch(console.error); 