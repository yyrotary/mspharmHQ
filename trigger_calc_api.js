const fetch = require('node-fetch');

async function triggerCalc() {
    const url = 'http://localhost:3000/api/hr/payroll/calculate';

    // Ham Min ID (from previous steps)
    const employeeId = '63cb4cb2-c153-4198-af32-0023792880f5';

    const payload = {
        employee_id: employeeId,
        pay_period_start: '2026-01-01',
        pay_period_end: '2026-01-31',
        payment_date: '2026-02-10'
    };

    console.log('Sending Request:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Mock auth cookie/header if needed?
                // The API checks verifyEmployeeAuth.
                // I disabled auth check in step 2268? No, I see it enabled:
                // const user = await verifyEmployeeAuth(request);
            },
            body: JSON.stringify(payload)
        });

        // Convert to text first
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);

    } catch (err) {
        console.error('Error:', err);
    }
}

triggerCalc();
