import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CONSULTATION_SCHEMA, NOTION_ENV_VARS, NotionConsultation } from '@/app/lib/notion-schema';
import { generateConsultationId } from '@/app/lib/utils';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 상담일지 데이터베이스 ID
const consultationDbId = process.env[NOTION_ENV_VARS.CONSULTATION_DB_ID];
// 고객 데이터베이스 ID
const customerDbId = process.env[NOTION_ENV_VARS.CUSTOMER_DB_ID];

// 상담일지 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  
  if (!consultationDbId) {
    return NextResponse.json({ error: '노션 상담일지 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  if (!customerId) {
    return NextResponse.json({ error: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const response = await notion.databases.query({
      database_id: consultationDbId,
      filter: {
        property: '고객',
        relation: {
          contains: customerId
        }
      },
      sorts: [
        {
          property: '상담일자',
          direction: 'descending'
        }
      ]
    });
    
    return NextResponse.json({ success: true, consultations: response.results });
  } catch (error) {
    console.error('상담일지 조회 오류:', error);
    return NextResponse.json({ error: '상담일지 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 상담일지 저장
export async function POST(request: Request) {
  if (!consultationDbId) {
    return NextResponse.json({ error: '노션 상담일지 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.customerId) {
      return NextResponse.json({ error: '고객 ID는 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    if (!data.consultDate) {
      return NextResponse.json({ error: '상담일자는 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    if (!data.content) {
      return NextResponse.json({ error: '상담내용은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 고객의 실제 ID 필드 조회
    let realCustomerId = data.customerId;
    
    // customerId가 Notion 페이지 ID 형식이면 실제 ID 필드 값을 조회
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(data.customerId) && customerDbId) {
      try {
        // 고객 페이지 조회
        const customerPage = await notion.pages.retrieve({
          page_id: data.customerId
        });
        
        // ID 필드 값 추출
        // @ts-expect-error - 타입 정의 문제 해결
        const idField = customerPage.properties?.id?.title?.[0]?.text?.content;
        
        if (idField) {
          realCustomerId = idField;
          console.log(`고객 페이지 ID ${data.customerId}에서 실제 ID ${realCustomerId} 조회됨`);
        } else {
          console.warn(`고객 페이지 ID ${data.customerId}에서 실제 ID를 찾을 수 없음`);
        }
      } catch (error) {
        console.error('고객 ID 조회 오류:', error);
      }
    }
    
    // 상담일지 ID 생성 (실제 고객 ID 사용)
    const consultationId = generateConsultationId(realCustomerId, data.consultDate);
    console.log(`상담일지 ID 생성: "${realCustomerId}" + "${data.consultDate}" -> "${consultationId}"`);
    
    // 노션 API 형식으로 데이터 변환
    const properties: any = {
      'id': {
        [CONSULTATION_SCHEMA.id.type]: [{ 
          type: 'text', 
          text: { content: consultationId } 
        }]
      },
      '상담일자': {
        [CONSULTATION_SCHEMA.상담일자.type]: {
          start: data.consultDate
        }
      },
      '고객': {
        [CONSULTATION_SCHEMA.고객.type]: [
          {
            id: data.customerId // 원래 고객 페이지 ID 사용
          }
        ]
      },
      '상담내용': {
        [CONSULTATION_SCHEMA.상담내용.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.content 
            } 
          }
        ]
      }
    };
    
    // 처방약 정보가 있는 경우
    if (data.medicine) {
      properties['처방약'] = {
        [CONSULTATION_SCHEMA.처방약.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.medicine 
            } 
          }
        ]
      };
    }
    
    // 결과 정보가 있는 경우
    if (data.result) {
      properties['결과'] = {
        [CONSULTATION_SCHEMA.결과.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.result 
            } 
          }
        ]
      };
    }
    
    // 증상 이미지 URL이 제공된 경우
    if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: data.imageUrls.map((url: string, index: number) => ({
          type: 'external',
          name: `증상이미지_${index + 1}.jpg`,
          external: {
            url: url
          }
        }))
      };
    }
    
    // 이미지 ID가 제공된 경우 (Google Drive 파일 ID)
    else if (data.imageIds && Array.isArray(data.imageIds) && data.imageIds.length > 0) {
      // Google Drive 링크 생성
      const imageUrls = data.imageIds.map((id: string) => {
        // 이미 전체 URL인 경우 그대로 사용
        if (id.includes('drive.google.com')) {
          return id;
        }
        // ID만 전달된 경우 Google Drive 링크 형식으로 변환
        return `https://drive.google.com/file/d/${id}/view`;
      });
      
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: imageUrls.map((url: string, index: number) => ({
          type: 'external',
          name: `증상이미지_${index + 1}.jpg`,
          external: {
            url: url
          }
        }))
      };
    }
    
    // 상담일지 생성
    const response = await notion.pages.create({
      parent: { database_id: consultationDbId },
      properties: properties
    });
    
    return NextResponse.json({ 
      success: true, 
      consultation: response,
      consultationId: consultationId, // 생성된 ID 반환
      realCustomerId: realCustomerId // 실제 사용된 고객 ID도 반환
    });
  } catch (error) {
    console.error('상담일지 저장 오류:', error);
    return NextResponse.json({ error: '상담일지 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 