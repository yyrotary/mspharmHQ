import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { NOTION_ENV_VARS, NotionMasterDB } from '@/app/lib/notion-schema';

// 노션 API 키와 마스터 DB ID
const NOTION_API_KEY = process.env[NOTION_ENV_VARS.API_KEY];
const MASTER_DB_ID = process.env[NOTION_ENV_VARS.MASTER_DB_ID];

// GET 요청 처리 (마스터 DB 정보 조회)
export async function GET() {
  // API 키나 DB ID가 없으면 에러 반환
  if (!NOTION_API_KEY) {
    return NextResponse.json({ error: 'Notion API 키가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  if (!MASTER_DB_ID) {
    return NextResponse.json({ error: '마스터 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    // Notion 클라이언트 초기화
    const notion = new Client({ auth: NOTION_API_KEY });
    
    // 마스터 DB에서 첫 번째 레코드 조회
    const response = await notion.databases.query({
      database_id: MASTER_DB_ID,
      page_size: 1 // 첫 번째 레코드만 필요
    });
    
    if (response.results.length === 0) {
      return NextResponse.json({ error: '마스터 DB에 레코드가 없습니다.' }, { status: 404 });
    }
    
    // 첫 번째 레코드 반환
    const master = response.results[0] as unknown as NotionMasterDB;
    
    return NextResponse.json({ 
      success: true, 
      master 
    });
  } catch (error) {
    console.error('마스터 DB 조회 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ 
      success: false, 
      error: `마스터 DB 조회 중 오류가 발생했습니다: ${errorMessage}` 
    }, { status: 500 });
  }
} 