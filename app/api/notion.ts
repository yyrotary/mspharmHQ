/**
 * @fileoverview 노션 API 통합 모듈
 * @description 명성약국의 일일 수입/지출 데이터를 노션 데이터베이스와 연동하는 API 모듈입니다.
 * 노션을 백엔드 데이터베이스로 활용하여 약국의 재무 데이터를 관리합니다.
 * 
 * @module api/notion
 * @requires @notionhq/client
 */

import { Client } from '@notionhq/client';

/**
 * 기본 API 키 (개발/테스트용)
 * @constant {string} DEFAULT_API_KEY - 노션 API 인증 키
 * @warning 실제 배포 시에는 반드시 환경 변수를 사용해야 합니다
 */
const DEFAULT_API_KEY = 'ntn_R79244355263GBYcvHFosCBgZPea5o6efgEgnAthWXb8UB';

/**
 * 기본 데이터베이스 ID
 * @constant {string} DEFAULT_DATABASE_ID - 노션 데이터베이스 ID
 * @warning 실제 배포 시에는 반드시 환경 변수를 사용해야 합니다
 */
const DEFAULT_DATABASE_ID = '714b76dc6cde47f696309c5f70d189e9';

// 환경 변수 체크 (없으면 콘솔에 경고)
if (!process.env.NOTION_API_KEY) {
  console.warn('⚠️ 경고: NOTION_API_KEY 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.');
}

if (!process.env.NOTION_DATABASE_ID) {
  console.warn('⚠️ 경고: NOTION_DATABASE_ID 환경 변수가 설정되지 않았습니다. 기본값을 사용합니다.');
}

// 노션 클라이언트 초기화 (환경 변수 없으면 기본값 사용)
const notion = new Client({
  auth: process.env.NOTION_API_KEY || DEFAULT_API_KEY,
});

// 데이터베이스 ID (환경 변수 없으면 기본값 사용)
const databaseId = process.env.NOTION_DATABASE_ID || DEFAULT_DATABASE_ID;

/**
 * 메모리 캐시 저장소
 * @type {Map<string, {data: any, timestamp: number}>}
 * @description API 호출 결과를 일시적으로 저장하여 불필요한 중복 호출을 방지합니다
 */
const cache = new Map();

/**
 * 캐시 유효 시간 (밀리초)
 * @constant {number} CACHE_DURATION - 1분(60,000ms) 동안 캐시 유지
 */
const CACHE_DURATION = 60 * 1000;

/**
 * 특정 날짜의 일일 수입/지출 데이터를 조회합니다
 * @async
 * @function getDailyIncome
 * @param {string} date - 조회할 날짜 (YYYY-MM-DD 형식)
 * @returns {Promise<Object|null>} 해당 날짜의 데이터 또는 null
 * @throws {Error} 노션 API 호출 실패 시
 * @example
 * const data = await getDailyIncome('2025-05-27');
 */
export async function getDailyIncome(date: string) {
  const cacheKey = `daily-income-${date}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    return cachedData.data;
  }
  
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: '날짜',
        date: {
          equals: date,
        },
      },
    });
    
    const result = response.results[0] || null;
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('노션 API 조회 오류:', error);
    throw error;
  }
}

/**
 * 일일 수입/지출 데이터를 저장하거나 업데이트합니다
 * @async
 * @function saveDailyIncome
 * @param {string} date - 저장할 날짜 (YYYY-MM-DD 형식)
 * @param {Object} data - 저장할 데이터 (노션 properties 형식)
 * @param {number} [data.cas5] - 현금 5만원권 수입
 * @param {number} [data.cas1] - 현금 1만원권 수입
 * @param {number} [data.gif] - 상품권 수입
 * @param {number} [data.car1] - 카드1 수입
 * @param {number} [data.car2] - 카드2 수입
 * @param {number} [data.person] - 인건비 지출
 * @param {number} [data.Pos] - POS 시스템 매출
 * @returns {Promise<Object>} 생성 또는 업데이트된 페이지 객체
 * @throws {Error} 노션 API 호출 실패 시
 */
export async function saveDailyIncome(date: string, data: any) {
  try {
    // 해당 날짜의 데이터가 있는지 확인
    const existingData = await getDailyIncome(date);
    
    if (existingData) {
      // 데이터 업데이트
      return await notion.pages.update({
        page_id: existingData.id,
        properties: data,
      });
    } else {
      // 새 데이터 생성
      return await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          날짜: {
            date: {
              start: date,
            },
          },
          ...data,
        },
      });
    }
  } catch (error) {
    console.error('노션 API 저장 오류:', error);
    throw error;
  }
}

/**
 * 특정 월의 모든 일일 데이터를 조회합니다
 * @async
 * @function getMonthlyIncome
 * @param {string} yearMonth - 조회할 년월 (YYYY-MM 형식)
 * @returns {Promise<Array>} 해당 월의 모든 일일 데이터 배열
 * @throws {Error} 노션 API 호출 실패 시
 * @example
 * const monthData = await getMonthlyIncome('2025-05');
 */
export async function getMonthlyIncome(yearMonth: string) {
  const cacheKey = `monthly-income-${yearMonth}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    return cachedData.data;
  }
  
  try {
    // YYYY-MM 형식에서 년도와 월 추출
    const [year, month] = yearMonth.split('-');
    
    // 해당 월의 시작일과 종료일 계산
    const startDate = `${year}-${month}-01`;
    
    // 월의 마지막 날짜 계산 (다음 달 1일에서 하루를 빼면 현재 달의 마지막 날)
    const nextMonth = parseInt(month) === 12 ? 1 : parseInt(month) + 1;
    const nextYear = parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year);
    
    // 다음 달 1일에서 하루를 빼면 현재 달의 마지막 날
    const lastDay = new Date(nextYear, nextMonth - 1, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;
    
    console.log(`월별 데이터 조회: ${startDate}부터 ${endDate}까지`);
    
    // 해당 월의 모든 데이터 조회
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        and: [
          {
            property: '날짜',
            date: {
              on_or_after: startDate
            }
          },
          {
            property: '날짜',
            date: {
              on_or_before: endDate
            }
          }
        ]
      },
      sorts: [
        {
          property: '날짜',
          direction: 'ascending'
        }
      ]
    });
    
    const result = response.results;
    
    // 추가 검증: 결과에서 날짜 범위 외의 데이터 필터링
    const filteredResults = result.filter((item: any) => {
      const itemDate = item.properties['날짜']?.date?.start;
      if (!itemDate) return false;
      
      // 날짜가 범위 내에 있는지 확인
      return itemDate >= startDate && itemDate <= endDate;
    });
    
    console.log(`조회된 데이터 수: ${filteredResults.length}개 (전체 ${result.length}개)`);
    
    cache.set(cacheKey, { data: filteredResults, timestamp: Date.now() });
    return filteredResults;
  } catch (error) {
    console.error('노션 API 월별 조회 오류:', error);
    throw error;
  }
}

// 지정한 기간의 모든 데이터 조회
export async function getPeriodIncome(startDate: string, endDate: string) {
  const cacheKey = `period-income-${startDate}-${endDate}`;
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    return cachedData.data;
  }
  
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: '날짜',
        date: {
          on_or_after: startDate,
          on_or_before: endDate
        }
      },
      sorts: [
        {
          property: '날짜',
          direction: 'ascending'
        }
      ]
    });
    
    const result = response.results;
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('노션 API 기간 조회 오류:', error);
    throw error;
  }
}

// 최근 31일간 데이터 조회
export async function getRecentDaysIncome(days: number = 31) {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // 시작일 계산 (오늘로부터 days일 전)
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (days - 1));
  const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  return getPeriodIncome(startDateStr, endDate);
}

// 전체 데이터 조회
export async function getAllIncome() {
  const cacheKey = 'all-income';
  const cachedData = cache.get(cacheKey);
  
  if (cachedData && (Date.now() - cachedData.timestamp < CACHE_DURATION)) {
    return cachedData.data;
  }
  
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: '날짜',
          direction: 'ascending'
        }
      ]
    });
    
    const result = response.results;
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('노션 API 전체 조회 오류:', error);
    throw error;
  }
}

/**
 * 주어진 데이터 배열에 대한 통계를 계산합니다
 * @async
 * @function calculateStats
 * @param {Array<Object>} data - 노션에서 조회한 데이터 배열
 * @returns {Promise<Object>} 계산된 통계 정보
 * @returns {number} returns.totalDays - 총 일수
 * @returns {number} returns.totalIncome - 총 수입
 * @returns {number} returns.totalExpense - 총 지출
 * @returns {number} returns.totalNet - 총 순이익
 * @returns {number} returns.avgIncome - 평균 일일 수입
 * @returns {number} returns.avgExpense - 평균 일일 지출
 * @returns {number} returns.avgNet - 평균 일일 순이익
 * @returns {Object} returns.maxIncome - 최대 수입 정보 {date, amount}
 * @returns {Object} returns.minIncome - 최소 수입 정보 {date, amount}
 * @returns {Array} returns.dailyData - 일별 상세 데이터
 */
export async function calculateStats(data: any[]) {
  // 초기 통계 객체
  const stats = {
    totalDays: 0,
    totalIncome: 0,
    totalExpense: 0,
    totalNet: 0,
    avgIncome: 0,
    avgExpense: 0,
    avgNet: 0,
    maxIncome: { date: '', amount: 0 },
    minIncome: { date: '', amount: Number.MAX_SAFE_INTEGER },
    dailyData: [] as any[]
  };
  
  if (data.length === 0) {
    return stats;
  }
  
  // 각 일별 데이터 처리
  data.forEach((dayData: any) => {
    const properties = dayData.properties;
    const date = properties['날짜']?.date?.start || '';
    
    if (!date) return;
    
    // 수입 계산 (cas5, cas1, gif, car1, car2 합계)
    const income = 
      (properties['cas5']?.number || 0) +
      (properties['cas1']?.number || 0) +
      (properties['gif']?.number || 0) +
      (properties['car1']?.number || 0) +
      (properties['car2']?.number || 0);
    
    // 지출 (person)
    const expense = properties['person']?.number || 0;
    
    // 순이익 (수입 - 지출)
    const net = income - expense;
    
    // POS 데이터
    const pos = properties['Pos']?.number || 0;
    
    // 일별 데이터 저장
    const dailyInfo = {
      date,
      income,
      expense,
      net,
      pos,
      diff: net - pos
    };
    
    stats.dailyData.push(dailyInfo);
    
    // 누적 합계 업데이트
    stats.totalIncome += income;
    stats.totalExpense += expense;
    stats.totalNet += net;
    
    // 최대/최소 수입 업데이트
    if (income > stats.maxIncome.amount) {
      stats.maxIncome = { date, amount: income };
    }
    
    if (income < stats.minIncome.amount && income > 0) {
      stats.minIncome = { date, amount: income };
    }
  });
  
  // 총 일수 및 평균 계산
  stats.totalDays = stats.dailyData.length;
  stats.avgIncome = stats.totalDays > 0 ? stats.totalIncome / stats.totalDays : 0;
  stats.avgExpense = stats.totalDays > 0 ? stats.totalExpense / stats.totalDays : 0;
  stats.avgNet = stats.totalDays > 0 ? stats.totalNet / stats.totalDays : 0;
  
  // 최소 수입이 설정되지 않은 경우 (모든 일의 수입이 0인 경우)
  if (stats.minIncome.amount === Number.MAX_SAFE_INTEGER) {
    stats.minIncome = { date: '', amount: 0 };
  }
  
  return stats;
}

// 월별 데이터 집계 및 통계 계산
export async function calculateMonthlyStats(yearMonth: string) {
  try {
    const monthlyData = await getMonthlyIncome(yearMonth);
    return calculateStats(monthlyData);
  } catch (error) {
    console.error('월별 통계 계산 오류:', error);
    throw error;
  }
}

// 최근 지정 일수 집계 및 통계 계산
export async function calculateRecentDaysStats(days: number = 31) {
  try {
    const recentData = await getRecentDaysIncome(days);
    return calculateStats(recentData);
  } catch (error) {
    console.error('최근 일수 통계 계산 오류:', error);
    throw error;
  }
}

// 전체 데이터 집계 및 통계 계산
export async function calculateAllTimeStats() {
  try {
    const allData = await getAllIncome();
    return calculateStats(allData);
  } catch (error) {
    console.error('전체 통계 계산 오류:', error);
    throw error;
  }
}

/**
 * API 호출을 재시도하는 헬퍼 함수
 * @async
 * @function fetchWithRetry
 * @template T
 * @param {Function} fetchFn - 실행할 비동기 함수
 * @param {number} [maxRetries=3] - 최대 재시도 횟수
 * @returns {Promise<T>} 함수 실행 결과
 * @throws {Error} 최대 재시도 횟수 초과 시
 * @description 네트워크 오류나 일시적인 API 오류 시 자동으로 재시도합니다.
 * 재시도 간격은 실패 횟수에 비례하여 증가합니다 (1초, 2초, 3초...).
 */
async function fetchWithRetry<T>(fetchFn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      return await fetchFn();
    } catch (error) {
      retries++;
      if (retries === maxRetries) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
  throw new Error('Max retries reached');
} 