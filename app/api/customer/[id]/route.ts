import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CUSTOMER_SCHEMA, NOTION_ENV_VARS } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 고객 정보 업데이트
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 페이지 속성 설정
    const properties: any = {
      [CUSTOMER_SCHEMA.NAME.name]: {
        title: [
          {
            text: {
              content: data.name,
            },
          },
        ],
      }
    };
    
    if (data.phone !== undefined) {
      properties[CUSTOMER_SCHEMA.PHONE.name] = {
        rich_text: data.phone ? [
          {
            text: {
              content: data.phone,
            },
          },
        ] : [],
      };
    }
    
    if (data.gender !== undefined) {
      properties[CUSTOMER_SCHEMA.GENDER.name] = {
        select: data.gender ? { name: data.gender } : null,
      };
    }
    
    if (data.birth !== undefined) {
      properties[CUSTOMER_SCHEMA.BIRTH.name] = {
        date: data.birth ? { start: data.birth } : null,
      };
    }
    
    if (data.address !== undefined) {
      properties[CUSTOMER_SCHEMA.ADDRESS.name] = {
        rich_text: data.address ? [
          {
            text: {
              content: data.address,
            },
          },
        ] : [],
      };
    }
    
    if (data.email !== undefined) {
      properties[CUSTOMER_SCHEMA.EMAIL.name] = {
        email: data.email || null,
      };
    }
    
    if (data.specialNote !== undefined) {
      properties[CUSTOMER_SCHEMA.SPECIAL_NOTE.name] = {
        rich_text: data.specialNote ? [
          {
            text: {
              content: data.specialNote,
            },
          },
        ] : [],
      };
    }
    
    if (data.customerFolderId !== undefined) {
      properties[CUSTOMER_SCHEMA.CUSTOMER_FOLDER_ID.name] = {
        rich_text: data.customerFolderId ? [
          {
            text: {
              content: data.customerFolderId,
            },
          },
        ] : [],
      };
    }
    
    // 고객 정보 업데이트
    console.log(`고객 ID ${id} 정보 업데이트 중...`, properties);
    
    const response = await notion.pages.update({
      page_id: id,
      properties: properties
    });
    
    console.log(`고객 정보 업데이트 성공:`, response.id);
    
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 업데이트되었습니다.',
      customer: {
        id: response.id,
        name: data.name,
      }
    });
  } catch (error: any) {
    console.error('고객 정보 업데이트 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: `고객 정보 업데이트 중 오류가 발생했습니다: ${error.message}`
    }, { status: 500 });
  }
}

// 고객 정보 삭제 (아카이브)
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    // 노션에서는 완전 삭제 대신 아카이브 처리
    const response = await notion.pages.update({
      page_id: id,
      archived: true
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 삭제되었습니다.' 
    });
  } catch (error: any) {
    console.error('고객 정보 삭제 오류:', error);
    return NextResponse.json({ 
      success: false,
      error: `고객 정보 삭제 중 오류가 발생했습니다: ${error.message}`
    }, { status: 500 });
  }
} 