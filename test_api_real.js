const employeeId = '3ba0ba22-953f-4548-8a0e-96ab497e7c72'; // Correct ID
async function main() {
    const url = `http://localhost:3000/api/employee-purchase/employees/${employeeId}`;

    console.log(`Testing PATCH to ${url}`);

    const payload = {
        hourly_rate: "12345",
        effective_from: "2026-02-02" // Future date for testing
    };

    try {
        const res = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(json, null, 2));

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

main();
