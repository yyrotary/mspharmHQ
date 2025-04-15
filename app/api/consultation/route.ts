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
    
    // 변수 분리 - 페이지 ID와 고객 ID 값을 구분
    let customerPageId = data.customerId;  // Notion 페이지 ID (relation에 사용)
    let customerIdValue = data.customerId; // 고객 ID 텍스트 값 (ID 생성에 사용)
    
    // data.customerId가 Notion 페이지 ID(UUID)인 경우, 해당 고객의 실제 ID 값을 조회
    if (data.customerId.includes('-')) {
      try {
        // 고객 페이지를 조회하여 실제 ID 값 가져오기
        const customerPage = await notion.pages.retrieve({
          page_id: data.customerId
        });
        
        // @ts-expect-error - 타입 정의 문제
        const idField = customerPage.properties?.id?.title?.[0]?.text?.content;
        
        if (idField) {
          customerIdValue = idField; // 고객 ID 값만 업데이트
          console.log(`고객 페이지 ID(${data.customerId})에서 실제 ID 값(${customerIdValue})을 추출했습니다.`);
        }
      } catch (error) {
        console.warn('고객 ID 조회 중 오류가 발생했습니다. 제공된 ID를 그대로 사용합니다:', error);
      }
    }
    
    // 상담일지 ID 생성 - 고객 ID 텍스트 값 사용
    const consultationId = generateConsultationId(customerIdValue, data.consultDate);
    
    // 노션 API 형식으로 데이터 변환
    const properties: any = {
      // ID 필드는 title 타입임
      'id': {
        [CONSULTATION_SCHEMA.id.type]: [{ 
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
            id: customerPageId // 관계 필드에는 페이지 ID를 사용
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
      consultationId: consultationId // 생성된 ID 반환
    });
  } catch (error) {
    console.error('상담일지 저장 오류:', error);
    return NextResponse.json({ error: '상담일지 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 