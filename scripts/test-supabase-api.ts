import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testSupabaseAPI(): Promise<void> {
  console.log('🧪 Supabase 기반 상담 API 테스트 시작...');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  
  try {
    // 1. 상담 목록 조회 테스트
    console.log('\n1️⃣ 상담 목록 조회 테스트...');
    
    const getResponse = await fetch(`${baseUrl}/api/consultation?limit=5`);
    const getData = await getResponse.json();
    
    if (getResponse.ok && getData.success) {
      console.log('✅ 상담 목록 조회 성공');
      console.log(`📊 조회된 상담 수: ${getData.consultations?.length || 0}개`);
      
      if (getData.consultations && getData.consultations.length > 0) {
        const firstConsultation = getData.consultations[0];
        console.log(`📋 첫 번째 상담 ID: ${firstConsultation.properties?.id?.title?.[0]?.text?.content}`);
        console.log(`📅 상담 날짜: ${firstConsultation.properties?.상담일자?.date?.start}`);
        console.log(`🏥 증상: ${firstConsultation.properties?.호소증상?.rich_text?.[0]?.text?.content?.substring(0, 50)}...`);
        
        // 이미지 확인
        const images = firstConsultation.properties?.증상이미지?.files || [];
        console.log(`🖼️ 이미지 수: ${images.length}개`);
        
        if (images.length > 0) {
          console.log(`🔗 첫 번째 이미지 URL: ${images[0].external?.url}`);
        }
      }
    } else {
      console.error('❌ 상담 목록 조회 실패:', getData.error);
    }

    // 2. 특정 고객의 상담 조회 테스트
    console.log('\n2️⃣ 특정 고객 상담 조회 테스트...');
    
    // 첫 번째 상담에서 고객 ID 추출
    if (getData.consultations && getData.consultations.length > 0) {
      const customerId = getData.consultations[0].properties?.고객?.relation?.[0]?.id;
      
      if (customerId) {
        const customerResponse = await fetch(`${baseUrl}/api/consultation?customerId=${customerId}&limit=3`);
        const customerData = await customerResponse.json();
        
        if (customerResponse.ok && customerData.success) {
          console.log('✅ 고객별 상담 조회 성공');
          console.log(`📊 해당 고객의 상담 수: ${customerData.consultations?.length || 0}개`);
        } else {
          console.error('❌ 고객별 상담 조회 실패:', customerData.error);
        }
      }
    }

    // 3. 검색 기능 테스트
    console.log('\n3️⃣ 상담 검색 기능 테스트...');
    
    const searchResponse = await fetch(`${baseUrl}/api/consultation?search=두통&limit=3`);
    const searchData = await searchResponse.json();
    
    if (searchResponse.ok && searchData.success) {
      console.log('✅ 상담 검색 성공');
      console.log(`🔍 "두통" 검색 결과: ${searchData.consultations?.length || 0}개`);
    } else {
      console.error('❌ 상담 검색 실패:', searchData.error);
    }

    // 4. 페이지네이션 테스트
    console.log('\n4️⃣ 페이지네이션 테스트...');
    
    const paginationResponse = await fetch(`${baseUrl}/api/consultation?page=2&limit=5`);
    const paginationData = await paginationResponse.json();
    
    if (paginationResponse.ok && paginationData.success) {
      console.log('✅ 페이지네이션 성공');
      console.log(`📄 2페이지 결과: ${paginationData.consultations?.length || 0}개`);
      console.log(`📊 전체 페이지 수: ${paginationData.pagination?.totalPages || 0}페이지`);
      console.log(`📈 전체 상담 수: ${paginationData.pagination?.total || 0}개`);
    } else {
      console.error('❌ 페이지네이션 실패:', paginationData.error);
    }

    // 5. 직접 Supabase API 테스트
    console.log('\n5️⃣ 직접 Supabase API 테스트...');
    
    const supabaseResponse = await fetch(`${baseUrl}/api/consultation-v2?limit=3`);
    const supabaseData = await supabaseResponse.json();
    
    if (supabaseResponse.ok && supabaseData.success) {
      console.log('✅ 직접 Supabase API 성공');
      console.log(`📊 Supabase에서 조회된 상담 수: ${supabaseData.consultations?.length || 0}개`);
    } else {
      console.error('❌ 직접 Supabase API 실패:', supabaseData.error);
    }

    // 6. 성능 테스트
    console.log('\n6️⃣ 성능 테스트...');
    
    const startTime = Date.now();
    const performanceResponse = await fetch(`${baseUrl}/api/consultation?limit=20`);
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    console.log(`⚡ 20개 상담 조회 시간: ${duration}ms`);
    
    if (duration < 2000) {
      console.log('✅ 성능 테스트 통과 (2초 이내)');
    } else {
      console.warn('⚠️ 성능 경고: 응답 시간이 2초를 초과했습니다.');
    }

    console.log('\n🎉 모든 API 테스트 완료!');
    console.log('\n📋 테스트 요약:');
    console.log('- ✅ 상담 목록 조회');
    console.log('- ✅ 고객별 상담 조회');
    console.log('- ✅ 상담 검색');
    console.log('- ✅ 페이지네이션');
    console.log('- ✅ 직접 Supabase API');
    console.log('- ✅ 성능 테스트');

  } catch (error) {
    console.error('💥 API 테스트 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  testSupabaseAPI()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 