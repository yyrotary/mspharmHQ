// Test the corrected calculation logic
const testCases = [
    {
        name: "Regular Employee with Fixed OT",
        rawBaseSalary: 3000000,
        fixedOT: 500000,
        hourlyRate: 13000,
        otHours: 40,
        otRate: 1.5,
        expected: {
            pureBase: 2500000,
            calculatedOT: 40 * 13000 * 1.5, // 780,000
            actualOT: (40 * 13000 * 1.5) - 500000, // 280,000 extra
            gross: 3000000 + 280000 // 3,280,000
        }
    },
    {
        name: "Employee with OT less than Fixed",
        rawBaseSalary: 3000000,
        fixedOT: 500000,
        hourlyRate: 13000,
        otHours: 20,
        otRate: 1.5,
        expected: {
            calculatedOT: 20 * 13000 * 1.5, // 390,000
            actualOT: 0, // Less than fixed, so no extra
            gross: 3000000 // Just the base
        }
    },
    {
        name: "Fixed Rate (13500) Holiday Pay",
        rawBaseSalary: 2794748,
        fixedOT: 0,
        holidayHours: 9,
        holidayRate: 18500,
        expected: {
            holidayPay: 9 * 18500, // 166,500
            gross: 2794748 + 166500 // 2,961,248
        }
    }
];

testCases.forEach(tc => {
    console.log(`\n=== ${tc.name} ===`);
    console.log(`Raw Base: ${tc.rawBaseSalary}`);
    console.log(`Fixed OT: ${tc.fixedOT}`);
    if (tc.otHours) {
        const calculatedOT = tc.otHours * tc.hourlyRate * tc.otRate;
        const actualOT = Math.max(0, calculatedOT - tc.fixedOT);
        console.log(`OT Hours: ${tc.otHours}`);
        console.log(`Calculated OT: ${calculatedOT}`);
        console.log(`Actual OT to pay: ${actualOT}`);
        console.log(`Expected OT: ${tc.expected.actualOT}`);
        console.log(`Match: ${actualOT === tc.expected.actualOT ? '✓' : '✗'}`);
    }
    if (tc.holidayHours) {
        const holidayPay = tc.holidayHours * tc.holidayRate;
        console.log(`Holiday Hours: ${tc.holidayHours} × ${tc.holidayRate} = ${holidayPay}`);
        console.log(`Expected: ${tc.expected.holidayPay}`);
        console.log(`Match: ${holidayPay === tc.expected.holidayPay ? '✓' : '✗'}`);
    }
});
