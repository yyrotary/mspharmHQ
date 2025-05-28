const fetch = require('node-fetch');

async function testSelfApproval() {
  try {
    console.log('Testing self-approval prevention...');
    
    // 1. manager123으로 로그인
    console.log('\n1. Logging in as manager123...');
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
      return;
    }

    const loginData = await loginResponse.json();
    console.log('✅ Manager login successful:', loginData.user);
    
    const cookies = loginResponse.headers.get('set-cookie');

    // 2. manager123의 구매 요청 ID 찾기
    console.log('\n2. Finding manager123\'s purchase request...');
    const requestsResponse = await fetch('http://localhost:3000/api/employee-purchase/requests?admin=true', {
      headers: {
        'Cookie': cookies
      }
    });

    if (!requestsResponse.ok) {
      console.log('❌ Failed to get requests');
      return;
    }

    const requestsData = await requestsResponse.json();
    const managerRequest = requestsData.data.find(req => 
      req.employee_id === loginData.user.id && req.status === 'pending'
    );

    if (!managerRequest) {
      console.log('❌ No pending request found for manager123');
      console.log('Available requests:', requestsData.data.map(r => ({
        id: r.id,
        employee_id: r.employee_id,
        employee_name: r.employee?.name,
        status: r.status
      })));
      return;
    }

    console.log('✅ Found manager123\'s request:', {
      id: managerRequest.id,
      amount: managerRequest.total_amount,
      status: managerRequest.status
    });

    // 3. 본인 요청 승인 시도 (실패해야 함)
    console.log('\n3. Attempting to approve own request (should fail)...');
    const approveResponse = await fetch(`http://localhost:3000/api/employee-purchase/requests/${managerRequest.id}/approve`, {
      method: 'POST',
      headers: {
        'Cookie': cookies
      }
    });

    console.log('Approve response status:', approveResponse.status);
    const approveData = await approveResponse.json();
    console.log('Approve response:', approveData);

    if (approveResponse.status === 403 && approveData.error === 'Cannot approve your own purchase request') {
      console.log('✅ Self-approval correctly prevented!');
    } else {
      console.log('❌ Self-approval was not prevented properly');
    }

    // 4. 본인 요청 거부 시도 (실패해야 함)
    console.log('\n4. Attempting to reject own request (should fail)...');
    const rejectResponse = await fetch(`http://localhost:3000/api/employee-purchase/requests/${managerRequest.id}/reject`, {
      method: 'POST',
      headers: {
        'Cookie': cookies
      }
    });

    console.log('Reject response status:', rejectResponse.status);
    const rejectData = await rejectResponse.json();
    console.log('Reject response:', rejectData);

    if (rejectResponse.status === 403 && rejectData.error === 'Cannot reject your own purchase request') {
      console.log('✅ Self-rejection correctly prevented!');
    } else {
      console.log('❌ Self-rejection was not prevented properly');
    }

    // 5. 다른 사람의 요청 승인 시도 (성공해야 함)
    console.log('\n5. Testing approval of other\'s request...');
    const otherRequest = requestsData.data.find(req => 
      req.employee_id !== loginData.user.id && req.status === 'pending'
    );

    if (otherRequest) {
      console.log('Found other\'s request:', {
        id: otherRequest.id,
        employee_name: otherRequest.employee?.name,
        amount: otherRequest.total_amount
      });

      const otherApproveResponse = await fetch(`http://localhost:3000/api/employee-purchase/requests/${otherRequest.id}/approve`, {
        method: 'POST',
        headers: {
          'Cookie': cookies
        }
      });

      if (otherApproveResponse.ok) {
        console.log('✅ Successfully approved other\'s request');
      } else {
        const errorData = await otherApproveResponse.json();
        console.log('❌ Failed to approve other\'s request:', errorData);
      }
    } else {
      console.log('ℹ️ No other pending requests found to test approval');
    }

  } catch (error) {
    console.error('Error testing self-approval:', error);
  }
}

testSelfApproval(); 