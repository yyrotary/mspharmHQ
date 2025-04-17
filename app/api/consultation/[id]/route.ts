import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CONSULTATION_SCHEMA, NOTION_ENV_VARS } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 상담일지 조회
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ success: false, error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    console.log(`상담일지 조회: ${id}`);
    
    // 노션 페이지 조회
    const response = await notion.pages.retrieve({ page_id: id });
    console.log('상담일지 조회 결과:', JSON.stringify(response).substring(0, 500) + '...');
    
    return NextResponse.json({ 
      success: true, 
      consultation: response
    });
  } catch (error) {
    console.error('상담일지 조회 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '상담일지 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 상담일지 수정
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.content) {
      return NextResponse.json({ error: '상담내용은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 API 형식으로 데이터 변환
    const properties: any = {
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
    
    // 상담일자 정보가 있는 경우
    if (data.consultDate) {
      properties['상담일자'] = {
        [CONSULTATION_SCHEMA.상담일자.type]: {
          start: data.consultDate
        }
      };
    }
    
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
    
    // 상태분석 정보가 있는 경우
    if (data.stateAnalysis) {
      properties['상태분석'] = {
        [CONSULTATION_SCHEMA.상태분석.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.stateAnalysis 
            } 
          }
        ]
      };
    }
    
    // 설진분석 정보가 있는 경우
    if (data.tongueAnalysis) {
      properties['설진분석'] = {
        [CONSULTATION_SCHEMA.설진분석.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.tongueAnalysis 
            } 
          }
        ]
      };
    }
    
    // 특이사항 정보가 있는 경우
    if (data.specialNote) {
      properties['특이사항'] = {
        [CONSULTATION_SCHEMA.특이사항.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.specialNote 
            } 
          }
        ]
      };
    }
    
    // 새 이미지 URL이 제공된 경우, 기존 이미지를 업데이트 (추가)
    if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
      // 먼저 현재 이미지 가져오기
      const pageResponse = await notion.pages.retrieve({ page_id: id });
      let existingImages = [];
      
      // @ts-expect-error - 타입 정의 문제 해결
      if (pageResponse.properties?.증상이미지?.files && 
          // @ts-expect-error - 타입 정의 문제 해결
          Array.isArray(pageResponse.properties.증상이미지.files)) {
        // @ts-expect-error - 타입 정의 문제 해결
        existingImages = pageResponse.properties.증상이미지.files;
      }
      
      // 이미지 이름 패턴 생성 (고객 ID 포함)
      let imageNamePrefix = "";
      try {
        // @ts-expect-error - 타입 정의 문제 해결
        const idTitle = pageResponse.properties?.id?.title?.[0]?.text?.content || "";
        if (idTitle) {
          const parts = idTitle.split('_');
          if (parts.length > 0) {
            imageNamePrefix = parts[0]; // 첫 부분을 고객 ID로 가정
          }
        }
      } catch (error) {
        console.warn('이미지 이름 패턴 생성 오류:', error);
      }
      
      // 새 이미지를 기존 이미지에 추가 (Notion에 보낼 형식)
      const allImages = [
        ...existingImages,
        ...data.imageUrls.map((url: string, index: number) => ({
          type: 'external',
          name: `${imageNamePrefix ? imageNamePrefix + '_' : ''}${Date.now()}_${index + 1}.jpg`,
          external: {
            url: url
          }
        }))
      ];
      
      // 이미지 속성 업데이트
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: allImages
      };
    }
    
    // 상담일지 업데이트
    const response = await notion.pages.update({
      page_id: id,
      properties: properties
    });
    
    return NextResponse.json({ 
      success: true, 
      consultation: response,
      // 고객 폴더 ID를 응답에도 포함 (클라이언트가 사용할 수 있도록)
      customerFolderId: data.customerFolderId || null
    });
  } catch (error) {
    console.error('상담일지 수정 오류:', error);
    return NextResponse.json({ error: '상담일지 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 상담일지 삭제
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    // Notion API는 실제 삭제 대신 보관(아카이브) 기능을 제공
    const response = await notion.pages.update({
      page_id: id,
      archived: true
    });
    
    return NextResponse.json({ success: true, message: '상담일지가 삭제되었습니다.' });
  } catch (error) {
    console.error('상담일지 삭제 오류:', error);
    return NextResponse.json({ error: '상담일지 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 