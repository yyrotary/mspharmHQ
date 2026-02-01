
// Mock logic from app/daily-income/page.tsx
const dailyPageLogic = (data) => {
    const income = (data.cas5 || 0) + (data.cas1 || 0) + (data.gif || 0) + (data.car1 || 0) + (data.car2 || 0);
    const expense = (data.person || 0);
    const total = income - expense;
    const posDiff = total - (data.Pos || 0);
    return { income, expense, total, posDiff };
};

// Mock logic from app/api/notion.ts (calculateStats)
const notionApiLogic = (properties) => {
    const income =
        (properties['cas5']?.number || 0) +
        (properties['cas1']?.number || 0) +
        (properties['gif']?.number || 0) +
        (properties['car1']?.number || 0) +
        (properties['car2']?.number || 0);

    const expense = properties['person']?.number || 0;
    const net = income - expense;
    const pos = properties['Pos']?.number || 0;

    return { income, expense, net, diff: net - pos };
};

// Sample Data
const sample = {
    cas5: 50000,
    cas1: 10000,
    gif: 5000,
    car1: 100000,
    car2: 200000,
    person: 10000, // Expense
    Pos: 355000
};

const pageResult = dailyPageLogic(sample);

const notionProperties = {
    'cas5': { number: sample.cas5 },
    'cas1': { number: sample.cas1 },
    'gif': { number: sample.gif },
    'car1': { number: sample.car1 },
    'car2': { number: sample.car2 },
    'person': { number: sample.person },
    'Pos': { number: sample.Pos }
};

const apiResult = notionApiLogic(notionProperties);

console.log('Daily Page Logic Result:', pageResult);
console.log('Notion API Logic Result:', apiResult);

if (pageResult.total === apiResult.net && pageResult.posDiff === apiResult.diff) {
    console.log('SUCCESS: Logic matches!');
} else {
    console.log('FAILURE: Logic mismatch!');
}
