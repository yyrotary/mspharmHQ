
import { supabaseAdmin } from './supabase-admin';

// Supabase Table Name
const TABLE_NAME = 'daily_income';

export interface DailyIncomeRecord {
    id: string;
    date: string;
    cas5: number;
    cas1: number;
    gif: number;
    car1: number;
    car2: number;
    person: number;
    pos: number;
    income: number;
    expense: number;
    net_income: number;
    diff: number;
    created_at: string;
    updated_at: string;
}

/**
 * 특정 날짜의 일일 수입/지출 데이터를 조회합니다.
 * 중복된 날짜가 있을 경우 가장 최근에 수정된 데이터를 반환합니다 (단일 조회 시).
 */
export async function getDailyIncome(date: string) {
    const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .eq('date', date)
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Supabase Daily Income API Error:', error);
        throw error;
    }

    return data?.[0] || null;
}

/**
 * 일일 수입/지출 데이터를 저장하거나 업데이트합니다.
 * 해당 날짜에 데이터가 있으면 업데이트(가장 최근 것), 없으면 생성합니다.
 * 주의: V2 마이그레이션으로 인해 중복 데이터가 있을 수 있습니다.
 */
export async function saveDailyIncome(date: string, payload: any) {
    // 계산된 필드 생성
    const income =
        (payload.cas5 || 0) +
        (payload.cas1 || 0) +
        (payload.gif || 0) +
        (payload.car1 || 0) +
        (payload.car2 || 0);
    const expense = payload.person || 0;
    const net_income = income - expense;
    const diff = net_income - (payload.Pos || 0); // Notion uses 'Pos', Schema uses 'pos', payload key might be 'Pos' from frontend

    const dbPayload = {
        date: date,
        cas5: payload.cas5,
        cas1: payload.cas1,
        gif: payload.gif,
        car1: payload.car1,
        car2: payload.car2,
        person: payload.person,
        pos: payload.Pos, // Frontend sends 'Pos'
        income,
        expense,
        net_income,
        diff,
        updated_at: new Date().toISOString()
    };

    // 기존 데이터 확인 (가장 최근 것)
    const existing = await getDailyIncome(date);

    if (existing) {
        // Update
        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .update(dbPayload)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } else {
        // Insert
        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

/**
 * 월별 데이터 조회
 */
export async function getMonthlyIncome(yearMonth: string) {
    // YYYY-MM
    const startDate = `${yearMonth}-01`;
    // Month calculation logic handled by database query range usually, 
    // or simple string matching if format is YYYY-MM can use like or gte/lte

    const [year, month] = yearMonth.split('-');
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    // Last day of month
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;

    return getPeriodIncome(startDate, endDate);
}

/**
 * 기간별 데이터 조회
 */
export async function getPeriodIncome(startDate: string, endDate: string) {
    const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

    if (error) {
        console.error('Supabase Period Query Error:', error);
        throw error;
    }

    return data || [];
}

/**
 * 최근 N일 데이터 조회
 */
export async function getRecentDaysIncome(days: number = 31) {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];

    const startDateObj = new Date(today);
    startDateObj.setDate(startDateObj.getDate() - (days - 1));
    const startDate = startDateObj.toISOString().split('T')[0];

    return getPeriodIncome(startDate, endDate);
}

/**
 * 전체 데이터 조회
 */
export async function getAllIncome() {
    const { data, error } = await supabaseAdmin
        .from(TABLE_NAME)
        .select('*')
        .order('date', { ascending: true });

    if (error) throw error;
    return data || [];
}

/**
 * 통계 계산 (Supabase 데이터 구조 기준)
 * 중복(Multiple rows per date)을 그대로 유지하며 합계 계산
 */
export async function calculateStats(data: DailyIncomeRecord[]) {
    const stats = {
        totalDays: 0,
        totalIncome: 0,
        totalExpense: 0,
        totalNet: 0,
        totalPos: 0,
        totalDiff: 0,
        avgIncome: 0,
        avgExpense: 0,
        avgNet: 0,
        maxIncome: { date: '', amount: 0 },
        minIncome: { date: '', amount: Number.MAX_SAFE_INTEGER },
        maxNet: { date: '', amount: -Number.MAX_SAFE_INTEGER }, // New: Max Settlement
        minNet: { date: '', amount: Number.MAX_SAFE_INTEGER },  // New: Min Settlement
        dailyData: [] as any[]
    };

    if (!data || data.length === 0) {
        // Fix min values for empty data
        stats.minIncome.amount = 0;
        stats.maxNet.amount = 0;
        stats.minNet.amount = 0;
        return stats;
    }

    data.forEach(row => {
        // 이미 DB에 계산된 값이 있지만, 안전을 위해 raw 값 확인 가능
        // DB 컬럼: income, expense, net_income, pos, diff

        const income = row.income;
        const expense = row.expense;
        const net = row.net_income;
        const pos = row.pos;
        const diff = row.diff;

        const dailyInfo = {
            date: row.date,
            income,
            expense,
            net,
            pos,
            diff
        };

        // 원본 그대로 리스트에 추가 (중복 날짜 포함)
        stats.dailyData.push(dailyInfo);

        // 합계 누적
        stats.totalIncome += income;
        stats.totalExpense += expense;
        stats.totalNet += net;
        stats.totalPos += pos;
        stats.totalDiff += diff;

        // Max/Min Income 업데이트
        if (income > stats.maxIncome.amount) {
            stats.maxIncome = { date: row.date, amount: income };
        }
        if (income < stats.minIncome.amount && income > 0) {
            stats.minIncome = { date: row.date, amount: income };
        }

        // Max/Min Net 업데이트
        if (net > stats.maxNet.amount) {
            stats.maxNet = { date: row.date, amount: net };
        }
        if (net < stats.minNet.amount) { // Net can be negative, so we take the absolute minimum
            stats.minNet = { date: row.date, amount: net };
        }
    });

    // 평균 계산 (Record 수 기준이 아닌 날짜 수 기준? 아니면 전체 Row 기준?)
    // 사용자 요청은 "Raw Copy". Row 자체를 하나의 단위로 본다면 Row 수로 나누는게 맞음.
    // 하지만 "일 평균"의 의미라면 날짜 수로 나누는게 맞음.
    // 여기서는 일단 Row 수(totalDays)로 나눔.

    stats.totalDays = stats.dailyData.length;
    stats.avgIncome = stats.totalDays > 0 ? stats.totalIncome / stats.totalDays : 0;
    stats.avgExpense = stats.totalDays > 0 ? stats.totalExpense / stats.totalDays : 0;
    stats.avgNet = stats.totalDays > 0 ? stats.totalNet / stats.totalDays : 0;

    if (stats.minIncome.amount === Number.MAX_SAFE_INTEGER) {
        stats.minIncome = { date: '', amount: 0 };
    }
    if (stats.minNet.amount === Number.MAX_SAFE_INTEGER) {
        stats.minNet = { date: '', amount: 0 };
    }
    if (stats.maxNet.amount === -Number.MAX_SAFE_INTEGER) {
        stats.maxNet = { date: '', amount: 0 };
    }

    return stats;
}

export async function calculateMonthlyStats(yearMonth: string) {
    const data = await getMonthlyIncome(yearMonth);
    return calculateStats(data as DailyIncomeRecord[]);
}

export async function calculateRecentDaysStats(days: number) {
    const data = await getRecentDaysIncome(days);
    return calculateStats(data as DailyIncomeRecord[]);
}

export async function calculateAllTimeStats() {
    const data = await getAllIncome();
    return calculateStats(data as DailyIncomeRecord[]);
}
