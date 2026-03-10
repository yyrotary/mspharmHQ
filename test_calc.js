const hourlyRate = 13000;
const holidayOvertimeHours = 32; // Assumption based on 4 weekends
const holidayRateValue = 13500; // From DB

const calculateAllowance = (hours, rateValue, defaultMultiplier) => {
    const rate = parseFloat(rateValue) || defaultMultiplier;
    console.log(`Rate parsed: ${rate}, Type: ${typeof rate}`);

    // 10보다 크면 고정 금액으로 간주 (예: 13500)
    if (rate > 10) {
        console.log('Case: Fixed Amount');
        return hours * rate;
    }
    // 10 이하이면 배율로 간주 (예: 1.5)
    console.log('Case: Multiplier');
    return hours * hourlyRate * rate;
};

const result = calculateAllowance(holidayOvertimeHours, holidayRateValue, 1.5);
console.log(`Result: ${result}`);
console.log(`Expected (Fixed): ${holidayOvertimeHours * holidayRateValue}`);
console.log(`Exploded (Multiplier): ${holidayOvertimeHours * hourlyRate * holidayRateValue}`);
