import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 데이터베이스 ID
const customerDbId = process.env.NOTION_CUSTOMER_DB_ID;

// 휴지통에 있는 고객 정보 조회
export async function GET() {
  try {
    if (!customerDbId) {
      return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
    }
    
    // 삭제된 고객만 조회
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: {
        property: '삭제됨',
        checkbox: {
          equals: true
        }
      },
      sorts: [
        {
          property: '고객명',
          direction: 'ascending',
        },
      ],
      page_size: 100,
    });
    
    // 추가 페이지가 있는 경우 모두 가져오기
    let allCustomers = [...response.results];
    let nextCursor = response.next_cursor;
    
    while (nextCursor) {
      const nextResponse = await notion.databases.query({
        database_id: customerDbId,
        filter: {
          property: '삭제됨',
          checkbox: {
            equals: true
          }
        },
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
    console.error('휴지통 고객 목록 조회 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '휴지통 고객 목록 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 