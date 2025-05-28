const fetch = require('node-fetch');

async function testStatisticsAPI() {
  try {
    console.log('🧪 통계 API 테스트 시작...\n');

    // 1. 먼저 약국장으로 로그인
    console.log('1. 약국장(admin123) 로그인...');
    const loginResponse = await fetch('http://localhost:3000/api/employee-purchase/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'admin123',
        password: 'admin123'
      })
    });

    if (!loginResponse.ok) {
      const loginError = await loginResponse.text();
      console.error('❌ 로그인 실패:', loginError);
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ 로그인 성공:', loginData.user.name, '(' + loginData.user.role + ')');

    // 쿠키 추출
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('🍪 쿠키:', cookies);

    // 2. 통계 API 호출 (전체 기간)
    console.log('\n2. 통계 API 호출 (전체 기간)...');
    const statsResponse = await fetch('http://localhost:3000/api/employee-purchase/statistics?period=all', {
      method: 'GET',
      headers: {
        'Cookie': cookies || '',
      }
    });

    console.log('📊 통계 API 응답 상태:', statsResponse.status);

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ 통계 데이터 조회 성공:');
      console.log('   - 총 요청 수:', statsData.totalRequests);
      console.log('   - 총 금액:', statsData.totalAmount);
      console.log('   - 승인 대기:', statsData.pendingRequests);
      console.log('   - 승인 완료:', statsData.approvedRequests);
      console.log('   - 거부/취소:', statsData.cancelledRequests);
      console.log('   - 월별 통계:', statsData.monthlyStats.length, '개월');
      console.log('   - 직원별 통계:', statsData.employeeStats.length, '명');
      
      if (statsData.employeeStats.length > 0) {
        console.log('   - 직원별 상세:');
        statsData.employeeStats.forEach(emp => {
          console.log(`     * ${emp.employeeName}: ${emp.requests}건, ${emp.amount}원`);
        });
      }
    } else {
      const errorText = await statsResponse.text();
      console.error('❌ 통계 API 실패:', errorText);
    }

    // 3. 다른 기간으로도 테스트
    console.log('\n3. 통계 API 호출 (이번 달)...');
    const thisMonthResponse = await fetch('http://localhost:3000/api/employee-purchase/statistics?period=thisMonth', {
      method: 'GET',
      headers: {
        'Cookie': cookies || '',
      }
    });

    if (thisMonthResponse.ok) {
      const thisMonthData = await thisMonthResponse.json();
      console.log('✅ 이번 달 통계:', thisMonthData.totalRequests, '건');
    } else {
      console.error('❌ 이번 달 통계 실패:', await thisMonthResponse.text());
    }

  } catch (error) {
    console.error('💥 테스트 중 오류 발생:', error.message);
  }
}

// 스크립트 실행
testStatisticsAPI(); 