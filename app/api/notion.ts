import { Client } from '@notionhq/client';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY || 'ntn_R79244355263GBYcvHFosCBgZPea5o6efgEgnAthWXb8UB',
});

// 데이터베이스 ID
const databaseId = process.env.NOTION_DATABASE_ID || '714b76dc6cde47f696309c5f70d189e9';

// app/api/notion.ts에 캐싱 기능 추가
const cache = new Map();
const CACHE_DURATION = 60 * 1000; // 1분 캐시

// 특정 날짜의 데이터 조회
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

// 데이터 생성 또는 업데이트
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

// API 호출 재시도 함수
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