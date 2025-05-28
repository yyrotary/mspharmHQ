const fetch = require('node-fetch');

async function testManagerRequests() {
  try {
    console.log('1. Testing manager123 login...');
    
    // 1. manager123으로 로그인
    const loginResponse = await fetch('http://localhost:3000/api/employee-purchase/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'manager123',
        password: 'manager123'
      })
    });

    if (!loginResponse.ok) {
      console.log('❌ Manager login failed');
      const errorData = await loginResponse.text();
      console.log('Error:', errorData);
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Manager login successful:', loginData.user);
    
    // 쿠키 추출
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Cookies:', cookies);

    // 2. 개인 구매내역 조회 (admin=false)
    console.log('\n2. Testing personal requests (admin=false)...');
    const personalResponse = await fetch('http://localhost:3000/api/employee-purchase/requests', {
      headers: {
        'Cookie': cookies
      }
    });

    if (personalResponse.ok) {
      const personalData = await personalResponse.json();
      console.log('✅ Personal requests:', personalData.data.length, 'items');
      personalData.data.forEach(req => {
        console.log(`  - ${req.total_amount}원 (${req.status}) by ${req.employee?.name || 'unknown'}`);
      });
    } else {
      console.log('❌ Personal requests failed');
    }

    // 3. 승인관리용 전체 구매내역 조회 (admin=true)
    console.log('\n3. Testing admin requests (admin=true)...');
    const adminResponse = await fetch('http://localhost:3000/api/employee-purchase/requests?admin=true', {
      headers: {
        'Cookie': cookies
      }
    });

    if (adminResponse.ok) {
      const adminData = await adminResponse.json();
      console.log('✅ Admin requests:', adminData.data.length, 'items');
      adminData.data.forEach(req => {
        console.log(`  - ${req.total_amount}원 (${req.status}) by ${req.employee?.name || 'unknown'}`);
      });
    } else {
      console.log('❌ Admin requests failed');
      const errorData = await adminResponse.text();
      console.log('Error:', errorData);
    }

  } catch (error) {
    console.error('Error testing manager requests:', error);
  }
}

testManagerRequests(); 