// const fetch = require('node-fetch'); // Built-in in Node 18+

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
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Convert to text first
        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);

        try {
            const json = JSON.parse(text);
            if (json.data) {
                console.log('--- Result Summary ---');
                console.log('Base Salary:', json.data.base_salary);
                console.log('Overtime Pay:', json.data.overtime_pay);
                console.log('Holiday Pay:', json.data.holiday_pay);
                console.log('Gross Pay:', json.data.gross_pay);
            }
        } catch (e) {
            console.log('Could not parse JSON body');
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

triggerCalc();
