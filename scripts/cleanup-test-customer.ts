import dotenv from 'dotenv';

// 환경 변수를 먼저 로드
dotenv.config({ path: '.env.local' });

import { 
  searchCustomers, 
  deleteCustomer 
} from '@/app/lib/supabase-customer';

async function cleanupTestCustomer() {
  console.log('🧹 테스트 고객 정리 중...\n');

  try {
    // 테스트 고객 검색 (이름에 "테스트고객_"이 포함된 고객들)
    const allCustomers = await searchCustomers('');
    const testCustomers = allCustomers.filter(customer => 
      customer.name.includes('테스트고객_')
    );

    console.log(`🔍 발견된 테스트 고객: ${testCustomers.length}명`);

    if (testCustomers.length === 0) {
      console.log('✅ 정리할 테스트 고객이 없습니다.');
      return;
    }

    for (const customer of testCustomers) {
      console.log(`\n🗑️ 테스트 고객 삭제 중...`);
      console.log(`   - 고객 코드: ${customer.customer_code}`);
      console.log(`   - 이름: ${customer.name}`);
      console.log(`   - 생성일시: ${customer.created_at}`);

      try {
        await deleteCustomer(customer.id);
        console.log(`   ✅ 삭제 완료`);
      } catch (error) {
        console.log(`   ❌ 삭제 실패: ${error}`);
      }
    }

    console.log('\n🎉 테스트 고객 정리 완료!');

  } catch (error) {
    console.error('❌ 정리 중 오류 발생:', error);
  }
}

cleanupTestCustomer().catch(console.error); 