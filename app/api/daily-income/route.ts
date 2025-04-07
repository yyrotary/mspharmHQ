import { NextResponse } from 'next/server';
import { getDailyIncome, saveDailyIncome } from '../notion';

// GET 요청 처리 (데이터 조회)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  
  if (!date) {
    return NextResponse.json({ error: '날짜 파라미터가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const data = await getDailyIncome(date);
    return NextResponse.json({ data });
  } catch (error) {
    console.error('데이터 조회 오류:', error);
    // 더 상세한 에러 메시지 반환
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: `데이터 조회 중 오류가 발생했습니다: ${errorMessage}` }, { status: 500 });
  }
}

// POST 요청 처리 (데이터 생성/업데이트)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, ...data } = body;
    
    if (!date) {
      return NextResponse.json({ error: '날짜 필드가 필요합니다.' }, { status: 400 });
    }
    
    const response = await saveDailyIncome(date, data);
    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('데이터 저장 오류:', error);
    // 더 상세한 에러 메시지 반환
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ error: `데이터 저장 중 오류가 발생했습니다: ${errorMessage}` }, { status: 500 });
  }
} 