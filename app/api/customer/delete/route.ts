import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 삭제 (휴지통으로 이동)
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { customerId } = data;
    
    if (!customerId) {
      return NextResponse.json({ 
        success: false, 
        error: '고객 ID가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 고객 페이지 업데이트 - 삭제됨 필드를 true로 설정
    await notion.pages.update({
      page_id: customerId,
      properties: {
        '삭제됨': {
          checkbox: true
        }
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '고객이 휴지통으로 이동되었습니다.'
    });
  } catch (error) {
    console.error('고객 삭제 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '고객 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 고객 복원 (휴지통에서 복원)
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { customerId } = data;
    
    if (!customerId) {
      return NextResponse.json({ 
        success: false, 
        error: '고객 ID가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 고객 페이지 업데이트 - 삭제됨 필드를 false로 설정
    await notion.pages.update({
      page_id: customerId,
      properties: {
        '삭제됨': {
          checkbox: false
        }
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '고객이 복원되었습니다.'
    });
  } catch (error) {
    console.error('고객 복원 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '고객 복원 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 고객 영구 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    
    if (!customerId) {
      return NextResponse.json({ 
        success: false, 
        error: '고객 ID가 필요합니다.' 
      }, { status: 400 });
    }
    
    try {
      // 고객 정보 조회
      const customerPage = await notion.pages.retrieve({
        page_id: customerId
      });
    
      // 고객 폴더 ID 추출
      // @ts-expect-error - 타입 정의 문제 해결
      const customerFolderId = customerPage.properties?.customerFolderId?.rich_text?.[0]?.text?.content;
      
      // 고객 페이지 아카이브
      await notion.pages.update({
        page_id: customerId,
        archived: true
      });
    
      // 구글 드라이브 폴더가 있다면 삭제 요청
      if (customerFolderId) {
        console.log(`고객 폴더 ID ${customerFolderId} 삭제 시도 중...`);
        
        // 폴더 삭제 기능이 활성화되면 아래 주석을 해제하세요
        /*
        try {
          const response = await fetch('/api/google-drive/delete-folder', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ folderId: customerFolderId })
          });
          
          const result = await response.json();
          console.log('폴더 삭제 결과:', result);
        } catch (driveError) {
          console.error('구글 드라이브 폴더 삭제 오류:', driveError);
          // 드라이브 오류가 있어도 계속 진행 (부분적 삭제)
        }
        */
      }
    
      return NextResponse.json({ 
        success: true, 
        message: '고객이 영구적으로 삭제되었습니다.'
      });
    } catch (notionError) {
      console.error('노션 고객 조회/삭제 오류:', notionError);
      return NextResponse.json({ 
        success: false, 
        error: '노션 고객 정보 처리 중 오류가 발생했습니다.' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('고객 영구 삭제 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '고객 영구 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 