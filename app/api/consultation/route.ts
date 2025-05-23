import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CONSULTATION_SCHEMA } from '@/app/lib/notion-schema';
import { generateConsultationId, getApiBaseUrl } from '@/app/lib/utils';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});
// 상담일지 데이터베이스 ID
const consultationDbId = process.env.NOTION_CONSULTATION_DB_ID
// 고객 데이터베이스 ID
const customerDbId = process.env.NOTION_CUSTOMER_DB_ID

// 상담일지 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  
 
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
  
  
  try {
    const data = await request.json();
    

    if (!data.content) {
      return NextResponse.json({ error: '호소증상은 필수 입력 항목입니다.' }, { status: 400 });
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
    // 현재 상담수 + 1을 3자리 문자열로 변환 (e.g., "030")
    let consultationCount = data.consultationCount || 0;
    console.log('상담수:', consultationCount);
    const newconsultation = consultationCount + 1;
    const consultationId = `${realCustomerId}_${String(newconsultation).padStart(3, '0')}`;
    
    // 고객 폴더 ID 조회 또는 생성
    let customerFolderId = data.customerFolderId || null;
    
    
    
    
    // 이미지 데이터가 있는 경우 업로드
    let processedImageUrls = [];
    if (data.imageDataArray && Array.isArray(data.imageDataArray) && data.imageDataArray.length > 0) {
      console.log(`${data.imageDataArray.length}개의 이미지 업로드 시작`);
      
      // API 기본 URL을 이용해 이미지 업로드 API URL 생성
      //const apiBaseUrl = getApiBaseUrl();
      const uploadApiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/google-drive`;
      
      // 이미지 업로드 함수
      const uploadImage = async (imageData: string, index: number) => {
        try {
          // 파일명 생성 (1부터 시작하는 인덱스)
          const fileIndex = index + 1;
          const fileName = `${consultationId}_${fileIndex}.jpg`;
          console.log(`이미지 #${fileIndex} 파일명: ${fileName}, 배열 인덱스: ${index}`);
          
          // JSON 방식으로 이미지 및 폴더 정보 전송
          const uploadResponse = await fetch(uploadApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData: imageData,
              fileName: fileName,
              customerFolderId: customerFolderId, // 고객 폴더 ID
              consultationId: consultationId,     // 상담일지 ID
              imageIndex: fileIndex               // 1부터 시작하는 이미지 인덱스
            }),
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success) {
              const fileUrl = uploadResult.file?.link || uploadResult.file?.webViewLink;
              console.log(`이미지 #${fileIndex} 업로드 성공: ${uploadResult.file?.id || uploadResult.fileId}, URL: ${fileUrl}`);
              // 인덱스 정보도 함께 반환
              return { url: fileUrl, index: fileIndex }; 
            }
          }
          console.error(`이미지 #${fileIndex} 업로드 실패`);
          return null;
        } catch (error) {
          console.error(`이미지 업로드 오류 (인덱스 ${index+1}):`, error);
          return null;
        }
      };
      
      // 배열 인덱스 로깅
      console.log('이미지 배열 내용:');
      data.imageDataArray.forEach((_, i) => console.log(`- 배열 항목 #${i}, 파일 인덱스: ${i+1}`));
      
      // 병렬 업로드 처리
      const uploadPromises = data.imageDataArray.map(uploadImage);
      const uploadResults = await Promise.all(uploadPromises);
      
      // 성공적으로 업로드된 이미지 URL만 추출 (null 필터링)
      const validResults = uploadResults.filter(result => result !== null && result !== undefined);
      processedImageUrls = validResults.map(result => result.url);
      
      console.log(`${processedImageUrls.length}개의 이미지 업로드 완료`);
      
      // 업로드 결과 로깅
      validResults.forEach((result, i) => {
        console.log(`- 결과 #${i}: 파일 인덱스 ${result.index}, URL: ${result.url.substring(0, 50)}...`);
      });
    }
    
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
      '호소증상': {
        [CONSULTATION_SCHEMA.호소증상.type]: [
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
    
    // 환자상태 정보가 있는 경우
    if (data.stateAnalysis) {
      properties['환자상태'] = {
        [CONSULTATION_SCHEMA.환자상태.type]: [
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
    
    // 업로드된 이미지 URL 처리
    if (processedImageUrls.length > 0) {
      console.log('Notion에 이미지 URL 저장 시작...');
      
      // 정확한 인덱스를 가진 외부 이미지 항목 생성 
      const externalImages = processedImageUrls.map((url, idx) => {
        console.log(`Notion 이미지 #${idx+1}: ${url.substring(0, 30)}...`);
        return {
          type: 'external',
          name: `${consultationId}_${idx+1}.jpg`,
          external: {
            url: url
          }
        };
      });
      
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: externalImages
      };
    }
    // 기존 이미지 URL이 제공된 경우
    else if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: data.imageUrls.map((url: string, index: number) => ({
          type: 'external',
          name: `${consultationId}_${index + 1}.jpg`,
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
        if (id && id.includes('drive.google.com')) {
          return id;
        }
        // ID만 전달된 경우 Google Drive 링크 형식으로 변환
        return id ? `https://drive.google.com/file/d/${id}/view` : null;
      }).filter(url => url !== null);
      
      if (imageUrls.length > 0) {
        properties['증상이미지'] = {
          [CONSULTATION_SCHEMA.증상이미지.type]: imageUrls.map((url: string, index: number) => ({
            type: 'external',
            name: `${consultationId}_${index + 1}.jpg`,
            external: {
              url: url
            }
          }))
        };
      }
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