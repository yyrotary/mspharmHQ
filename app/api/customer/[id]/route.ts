import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CUSTOMER_SCHEMA, NOTION_ENV_VARS, NotionCustomer } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 고객 정보 업데이트
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const customerId = params.id;
  
  if (!customerId) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 API 형식에 맞게 데이터 변환
    const properties: any = {
      '고객명': {
        [CUSTOMER_SCHEMA.고객명.type]: [{ type: 'text', text: { content: data.name } }]
      }
    };
    
    if (data.phone !== undefined) {
      properties['전화번호'] = {
        [CUSTOMER_SCHEMA.전화번호.type]: data.phone
      };
    }
    
    if (data.gender !== undefined) {
      properties['성별'] = {
        [CUSTOMER_SCHEMA.성별.type]: {
          name: data.gender
        }
      };
    }
    
    if (data.birth !== undefined) {
      properties['생년월일'] = {
        [CUSTOMER_SCHEMA.생년월일.type]: data.birth ? {
          start: data.birth
        } : null
      };
    }
    
    if (data.address !== undefined) {
      properties['주소'] = {
        [CUSTOMER_SCHEMA.주소.type]: [{ type: 'text', text: { content: data.address } }]
      };
    }
    
    if (data.specialNote !== undefined) {
      properties['특이사항'] = {
        [CUSTOMER_SCHEMA.특이사항.type]: [{ type: 'text', text: { content: data.specialNote } }]
      };
    }
    
    // 고객 정보 업데이트
    console.log(`고객 ID ${customerId} 정보 업데이트 중...`, properties);
    
    const response = await notion.pages.update({
      page_id: customerId,
      properties: properties
    });
    
    console.log(`고객 정보 업데이트 성공:`, response.id);
    
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 업데이트되었습니다.',
      customer: response 
    });
  } catch (error) {
    console.error('고객 정보 업데이트 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: '고객 정보 업데이트 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 고객 정보 삭제 (아카이브)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const customerId = params.id;
  
  if (!customerId) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    // 노션에서는 완전 삭제 대신 아카이브 처리
    const response = await notion.pages.update({
      page_id: customerId,
      archived: true
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('고객 정보 삭제 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: '고객 정보 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 