import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CUSTOMER_SCHEMA } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 데이터베이스 ID
const customerDbId = process.env.NOTION_CUSTOMER_DB_ID;
// Master 데이터베이스 ID
const masterDbId = process.env.NOTION_MASTER_DB_ID;

// 고객 정보 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const phone = searchParams.get('phone');
  const gender = searchParams.get('gender');
  
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    let filter = {};
    
    if (name) {
      filter = {
        property: '고객명',
        [CUSTOMER_SCHEMA.고객명.type]: {
          contains: name,
        },
      };
    } else if (phone) {
      filter = {
        property: '전화번호',
        [CUSTOMER_SCHEMA.전화번호.type]: {
          contains: phone,
        },
      };
    } else if (gender) {
      filter = {
        property: '성별',
        [CUSTOMER_SCHEMA.성별.type]: {
          equals: gender,
        },
      };
    } else {
      // 파라미터가 없으면 빈 결과를 반환
      return NextResponse.json({ success: true, customers: [] });
    }
    
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: Object.keys(filter).length > 0 ? filter as any : undefined,
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
    
    // Master DB 조회
    const responsem = await notion.databases.query({
      database_id: masterDbId as string,
      page_size: 1, // 첫 번째 레코드만 가져옴
    });

    // 첫 번째 레코드에서 '고객수' 값 추출
    const masterData = responsem.results[0] as any;
    // 업데이트된 formula 타입의 고객수 필드 처리 (ID: LOs})
    const customerCount = masterData.properties?.고객수?.formula?.number || 0;
    
    // 현재 고객 수 + 1을 5자리 문자열로 변환 (e.g., "00030")
    const newCustomerNumber = customerCount + 1;
    const customId = String(newCustomerNumber).padStart(5, '0');
    
    // Notion 페이지 속성 설정 (임시로 폴더 ID 없이)
    const properties = {
      'id': {
        title: [
          {
            text: {
              content: customId,
            },
          },
        ],
      },
      '고객명': {
        rich_text: [
          {
            text: {
              content: data.name,
            },
          },
        ],
      },
      '전화번호': {
        phone_number: data.phone || null,
      },
      '성별': {
        select: data.gender ? { name: data.gender } : null,
      },
      '생년월일': {
        date: data.birth ? { start: data.birth } : null,
      },
      '주소': {
        rich_text: data.address ? [
          {
            text: {
              content: data.address,
            },
          },
        ] : [],
      },
      '특이사항': {
        rich_text: data.specialNote ? [
          {
            text: {
              content: data.specialNote,
            },
          },
        ] : [],
      },
      // 얼굴 임베딩 데이터 저장
      '얼굴_임베딩': {
        rich_text: data.faceEmbedding ? [
          {
            text: {
              content: data.faceEmbedding,
            },
          },
        ] : [],
      },
    };
    
    // Notion에 고객 페이지 생성
    const response = await notion.pages.create({
      parent: {
        database_id: customerDbId,
      },
      properties: properties
    });

    
    // 1. 구글 드라이브에 고객 폴더 생성 (비동기로 처리)
    let customerFolderId = '';
    //const apiBaseUrl = getApiBaseUrl();
    const folderResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/google-drive/folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ folderName: customId }),
    });
    
    if (folderResponse.ok) {
      const folderData = await folderResponse.json();
      //customerFolderId = folderData.folderId;     
      
      notion.pages.update({
        page_id: response.id,
        properties: {
          'customerFolderId': {
            rich_text: [
              {
                text: {
                  content: folderData.folderId,
                },
              },
            ],
          },
        }
      })
      
    }
    
    
    // 즉시 성공 응답 반환
    return NextResponse.json({ 
      success: true,
      customer: {
        id: response.id,
        customId: customId,
        name: data.name,
        folderId: customerFolderId, // 빈 값일 수 있음 (비동기 처리 때문)
      }
    });
  } catch (error: any) {
    console.error('고객 정보 저장 오류:', error);
    return NextResponse.json(
      { error: `고객 정보 저장 중 오류가 발생했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}

