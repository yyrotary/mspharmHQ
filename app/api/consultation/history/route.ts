import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import moment from 'moment-timezone';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 상담 데이터베이스 ID
const consultationDbId = process.env.NOTION_CONSULTATION_DB_ID;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  
  if (!consultationDbId) {
    return NextResponse.json({ error: '노션 상담 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  if (!startDate || !endDate) {
    return NextResponse.json({ error: '시작일과 종료일이 필요합니다.' }, { status: 400 });
  }
  
  try {
    // 시작일과 종료일을 UTC로 변환
    const startDateTime = moment.tz(startDate, 'Asia/Seoul').startOf('day').toISOString();
    const endDateTime = moment.tz(endDate, 'Asia/Seoul').endOf('day').toISOString();
    
    // 노션 API 호출
    const response = await notion.databases.query({
      database_id: consultationDbId,
      filter: {
        and: [
          {
            property: '상담일자',
            date: {
              on_or_after: startDateTime,
            },
          },
          {
            property: '상담일자',
            date: {
              on_or_before: endDateTime,
            },
          },
        ],
      },
      sorts: [
        {
          property: '상담일자',
          direction: 'descending',
        },
      ],
    });

    // 각 상담 내역에 대한 고객 정보 조회
    const consultationsWithCustomerInfo = await Promise.all(
      response.results.map(async (consultation: any) => {
        try {
          // 증상이미지 추출
          let symptomImages: string[] = [];
          try {
            const files = consultation.properties.증상이미지?.files || [];
            symptomImages = files.map((file: any) => {
              if (file.type === 'external' && file.external?.url) {
                const url = file.external.url.trim();
                if (!url) return null;
                if (url.includes('drive.google.com/file/d/')) {
                  try {
                    const fileId = url.split('/file/d/')[1].split('/')[0];
                    return `https://lh3.googleusercontent.com/d/${fileId}`;
                  } catch {
                    return url;
                  }
                }
                return url;
              } else if (file.type === 'file' && file.file?.url) {
                const url = file.file.url.trim();
                if (!url) return null;
                return url;
              }
              return null;
            }).filter(Boolean);
          } catch {}

          // 고객 relation ID 가져오기
          const customerId = consultation.properties.고객?.relation?.[0]?.id;
          let customerName = '이름 없음';
          if (customerId) {
            // 고객 정보 조회
            const customerPage = await notion.pages.retrieve({ page_id: customerId }) as any;
            customerName = customerPage.properties.고객명?.rich_text?.[0]?.text?.content || '이름 없음';
          }
          // 상담 내역에 고객 정보 및 증상이미지 추가
          return {
            ...consultation,
            properties: {
              ...consultation.properties,
              고객명: {
                rich_text: [{ text: { content: customerName } }]
              },
              symptomImages
            }
          };
        } catch (error) {
          console.error('고객 정보 조회 오류:', error);
          return consultation;
        }
      })
    );
    
    return NextResponse.json({ success: true, consultations: consultationsWithCustomerInfo });
  } catch (error) {
    console.error('상담 내역 조회 오류:', error);
    return NextResponse.json({ error: '상담 내역 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 