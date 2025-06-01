import dotenv from 'dotenv';

// 환경 변수를 먼저 로드
dotenv.config({ path: '.env.local' });

async function testConsultationAPI() {
  console.log('🧪 상담일지 API 테스트 (Google Drive 없이)...\n');

  try {
    // 1. 고객 검색 테스트
    console.log('1️⃣ 고객 검색 테스트');
    const customerResponse = await fetch('http://localhost:3000/api/customer?name=김분옥');
    const customerData = await customerResponse.json();
    
    if (customerData.success && customerData.customers.length > 0) {
      const customer = customerData.customers[0];
      console.log(`✅ 고객 찾음: ${customer.properties.고객명.rich_text[0].text.content}`);
      console.log(`   - 고객 ID: ${customer.id}`);
      console.log(`   - 고객 코드: ${customer.properties.id.title[0].text.content}`);

      // 2. 상담일지 생성 테스트
      console.log('\n2️⃣ 상담일지 생성 테스트');
      const consultationData = {
        customerId: customer.id,
        consultationDate: new Date().toISOString().split('T')[0],
        chiefComplaint: '테스트 호소증상 - Google Drive 제거 후 테스트',
        prescription: '테스트 처방약',
        result: '테스트 결과',
        patientCondition: '테스트 환자상태',
        tongueAnalysis: '테스트 설진분석',
        specialNotes: '테스트 특이사항',
        imageDataArray: [] // 이미지 없이 테스트
      };

      const consultationResponse = await fetch('http://localhost:3000/api/consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(consultationData),
      });

      const consultationResult = await consultationResponse.json();

      if (consultationResponse.ok && consultationResult.success) {
        console.log('✅ 상담일지 생성 성공!');
        console.log(`   - 상담일지 ID: ${consultationResult.consultationId}`);
        console.log(`   - 메시지: ${consultationResult.message}`);

        // 3. 생성된 상담일지 조회 테스트
        console.log('\n3️⃣ 생성된 상담일지 조회 테스트');
        const consultationsResponse = await fetch(`http://localhost:3000/api/consultation?customerId=${customer.id}`);
        const consultationsData = await consultationsResponse.json();

        if (consultationsData.success) {
          console.log(`✅ 상담일지 조회 성공: ${consultationsData.consultations.length}개`);
          
          // 방금 생성한 상담일지 찾기
          const newConsultation = consultationsData.consultations.find((c: any) => 
            c.properties.상담일지ID.title[0].text.content === consultationResult.consultationId
          );

          if (newConsultation) {
            console.log(`   - 상담일지 ID: ${newConsultation.properties.상담일지ID.title[0].text.content}`);
            console.log(`   - 호소증상: ${newConsultation.properties.호소증상.rich_text[0]?.text.content || '없음'}`);
            console.log(`   - 처방약: ${newConsultation.properties.처방약.rich_text[0]?.text.content || '없음'}`);
            console.log(`   - 이미지 수: ${newConsultation.properties.증상이미지.files.length}개`);
          }
        } else {
          console.log('❌ 상담일지 조회 실패:', consultationsData.error);
        }

      } else {
        console.log('❌ 상담일지 생성 실패:', consultationResult.error);
      }

    } else {
      console.log('❌ 고객을 찾을 수 없습니다:', customerData.error);
    }

    console.log('\n🎉 API 테스트 완료!');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
  }
}

testConsultationAPI().catch(console.error); 