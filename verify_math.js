const attendance = [
    { status: 'present', work_hours: '8', is_holiday: false },
    { status: 'present', work_hours: '8', is_holiday: false },
    { status: 'present', work_hours: '8', is_holiday: true }, // Holiday
    { status: 'present', work_hours: '8', is_holiday: true }, // Holiday
];
// Total: 32 hours. Holiday: 16. Weekday: 16.

const salary = {
    base_salary: 0,
    hourly_rate: 13000,
    holiday_rate: 13500 // Fixed rate
};

// --- LOGIC FROM ROUTE.TS ---
const totalWorkDays = attendance.filter(a => a.status === 'present').length;
const totalWorkHours = attendance.reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
const holidayWorkHours = attendance
    .filter(a => a.is_holiday)
    .reduce((sum, a) => sum + (parseFloat(a.work_hours) || 0), 0);
const weekdayWorkHours = totalWorkHours - holidayWorkHours;

let baseSalary = parseFloat(salary.base_salary);
const hourlyRate = salary.hourly_rate
    ? parseFloat(salary.hourly_rate)
    : baseSalary / 209;

if (baseSalary === 0) {
    baseSalary = Math.round((hourlyRate || 0) * weekdayWorkHours);
}

const calculateAllowance = (hours, rateValue, defaultMultiplier, type) => {
    const cleanRate = typeof rateValue === 'string' ? rateValue.replace(/,/g, '') : rateValue;
    const rate = parseFloat(cleanRate) || defaultMultiplier;

    if (rate > 50) {
        console.log(`[Calc] ${type} -> Fixed Amount: ${hours} * ${rate}`);
        return hours * rate;
    }
    return hours * hourlyRate * rate;
};

const holidayPay = calculateAllowance(holidayWorkHours, salary.holiday_rate, 2.0, 'Holiday');
// ---------------------------

console.log(`Total Hours: ${totalWorkHours}`);
console.log(`Weekday Hours: ${weekdayWorkHours} -> Base Pay: ${baseSalary}`);
console.log(`Holiday Hours: ${holidayWorkHours} -> Holiday Pay: ${holidayPay}`);
console.log(`Total: ${baseSalary + holidayPay}`);
