import { createClient } from '@supabase/supabase-js';

async function testCustomerAPI() {
  console.log('🧪 고객 API 테스트 시작...\n');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 1. 연결 테스트
    console.log('1️⃣ Supabase 연결 테스트...');
    const { data: testData, error: testError } = await supabase
      .from('customers')
      .select('count')
      .limit(1);
    
    if (testError) {
      throw new Error(`연결 실패: ${testError.message}`);
    }
    console.log('✅ Supabase 연결 성공\n');

    // 2. 고객 목록 조회 테스트
    console.log('2️⃣ 고객 목록 조회 테스트...');
    const { data: customers, error: listError } = await supabase
      .from('customers')
      .select('*')
      .order('customer_code', { ascending: true })
      .limit(5);
    
    if (listError) {
      throw new Error(`고객 목록 조회 실패: ${listError.message}`);
    }
    
    console.log(`✅ 고객 ${customers?.length || 0}명 조회 성공`);
    if (customers && customers.length > 0) {
      console.log(`   첫 번째 고객: ${customers[0].name} (${customers[0].customer_code})`);
    }
    console.log('');

    // 3. 고객 검색 테스트
    console.log('3️⃣ 고객 검색 테스트...');
    if (customers && customers.length > 0) {
      const searchName = customers[0].name;
      const { data: searchResults, error: searchError } = await supabase
        .from('customers')
        .select('*')
        .ilike('name', `%${searchName}%`);
      
      if (searchError) {
        throw new Error(`고객 검색 실패: ${searchError.message}`);
      }
      
      console.log(`✅ "${searchName}" 검색 결과: ${searchResults?.length || 0}명`);
    } else {
      console.log('⚠️ 검색할 고객이 없습니다.');
    }
    console.log('');

    // 4. 다음 고객 코드 생성 테스트
    console.log('4️⃣ 다음 고객 코드 생성 테스트...');
    const { data: maxCustomer, error: maxError } = await supabase
      .from('customers')
      .select('customer_code')
      .order('customer_code', { ascending: false })
      .limit(1);
    
    if (maxError) {
      throw new Error(`최대 고객 코드 조회 실패: ${maxError.message}`);
    }
    
    let nextCode = '00001';
    if (maxCustomer && maxCustomer.length > 0) {
      const maxCode = maxCustomer[0].customer_code;
      const nextNumber = parseInt(maxCode) + 1;
      nextCode = nextNumber.toString().padStart(5, '0');
    }
    
    console.log(`✅ 다음 고객 코드: ${nextCode}\n`);

    // 5. 통계 정보
    console.log('5️⃣ 고객 통계 정보...');
    const { count: totalCustomers, error: countError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      throw new Error(`고객 수 조회 실패: ${countError.message}`);
    }
    
    console.log(`✅ 전체 고객 수: ${totalCustomers}명`);

    // 성별 통계
    const { data: genderStats, error: genderError } = await supabase
      .from('customers')
      .select('gender')
      .not('gender', 'is', null);
    
    if (!genderError && genderStats) {
      const maleCount = genderStats.filter(c => c.gender === '남성').length;
      const femaleCount = genderStats.filter(c => c.gender === '여성').length;
      console.log(`   남성: ${maleCount}명, 여성: ${femaleCount}명`);
    }

    console.log('\n🎉 고객 API 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testCustomerAPI();
}

export { testCustomerAPI }; 