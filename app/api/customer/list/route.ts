import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 데이터베이스 ID
const customerDbId = process.env.NOTION_CUSTOMER_DB_ID;

// 모든 고객 정보 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  
  try {
    if (!customerDbId) {
      return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
    }
    
    // 고객 정보 조회 필터 (삭제되지 않은 고객만)
    const filter = includeDeleted 
      ? undefined 
      : {
          property: '삭제됨',
          checkbox: {
            equals: false
          }
        };
    
    // 모든 고객 정보 조회 (최대 100개)
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: filter,
      sorts: [
        {
          property: '고객명',
          direction: 'ascending',
        },
      ],
      page_size: 100, // 한 번에 가져올 최대 고객 수
    });
    
    // 추가 페이지가 있는 경우 모두 가져오기 
    let allCustomers = [...response.results];
    let nextCursor = response.next_cursor;
    
    while (nextCursor) {
      const nextResponse = await notion.databases.query({
        database_id: customerDbId,
        filter: filter,
        start_cursor: nextCursor,
        page_size: 100,
      });
      
      allCustomers = [...allCustomers, ...nextResponse.results];
      nextCursor = nextResponse.next_cursor;
    }
    
    return NextResponse.json({ 
      success: true, 
      customers: allCustomers,
      totalCount: allCustomers.length
    });
  } catch (error) {
    console.error('고객 목록 조회 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '고객 목록 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 