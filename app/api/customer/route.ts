import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 데이터베이스 ID
const customerDbId = process.env.NOTION_CUSTOMER_DB_ID;

// 고객 정보 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const phone = searchParams.get('phone');
  
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    let filter = {};
    
    if (name) {
      filter = {
        property: '이름',
        rich_text: {
          contains: name,
        },
      };
    } else if (phone) {
      filter = {
        property: '전화번호',
        phone_number: {
          contains: phone,
        },
      };
    }
    
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: Object.keys(filter).length > 0 ? filter : undefined,
    });
    
    return NextResponse.json({ success: true, customers: response.results });
  } catch (error) {
    console.error('고객 정보 조회 오류:', error);
    return NextResponse.json({ error: '고객 정보 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 고객 정보 저장
export async function POST(request: Request) {
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 API 형식에 맞게 데이터 변환
    const properties: any = {
      '이름': {
        rich_text: [{ type: 'text', text: { content: data.name } }]
      }
    };
    
    if (data.phone) {
      properties['전화번호'] = {
        phone_number: data.phone
      };
    }
    
    if (data.gender) {
      properties['성별'] = {
        select: {
          name: data.gender
        }
      };
    }
    
    if (data.birth) {
      properties['생년월일'] = {
        date: {
          start: data.birth
        }
      };
    }
    
    if (data.address) {
      properties['주소'] = {
        rich_text: [{ type: 'text', text: { content: data.address } }]
      };
    }
    
    // 새 고객 생성
    const response = await notion.pages.create({
      parent: { database_id: customerDbId },
      properties: properties
    });
    
    return NextResponse.json({ success: true, customer: response });
  } catch (error) {
    console.error('고객 정보 저장 오류:', error);
    return NextResponse.json({ error: '고객 정보 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 