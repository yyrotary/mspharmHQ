// const fetch = require('node-fetch'); // Native fetch in Node 20+

async function main() {
    const employeeId = '429e129b-b814-4eeb-a0ff-fda7545cb98c'; // 정하나

    // We need to know payment_date etc.
    const body = {
        employee_id: employeeId,
        pay_period_start: '2026-01-01',
        pay_period_end: '2026-01-31',
        payment_date: '2026-02-10'
    };

    console.log("Sending request...", body);
    const response = await fetch('http://localhost:3000/api/hr/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    const json = await response.json();
    console.log('Status:', response.status);
    console.log('Error Message:', json.error);
    console.log('Env Status:', json.env);
    console.log('Error Details:', JSON.stringify(json.details, null, 2));
}

main();
