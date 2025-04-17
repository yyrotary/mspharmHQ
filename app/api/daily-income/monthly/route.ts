import { NextResponse } from 'next/server';
import { calculateMonthlyStats, calculateRecentDaysStats, calculateAllTimeStats } from '../../notion';

// GET 요청 처리 (통계 데이터 조회)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'month'; // 기본값은 month
  const yearMonth = searchParams.get('yearMonth');
  const days = searchParams.get('days') ? parseInt(searchParams.get('days')!) : 31;
  
  console.log(`[API] 통계 데이터 조회 요청: mode=${mode}, yearMonth=${yearMonth}, days=${days}`);
  
  try {
    let stats;
    let period;
    let filterInfo;
    
    // 모드에 따라 다른 통계 방식 사용
    switch (mode) {
      case 'month': 
        // 월별 통계
        if (!yearMonth) {
          return NextResponse.json({ error: 'yearMonth 파라미터가 필요합니다 (YYYY-MM 형식)' }, { status: 400 });
        }
        
        // yearMonth 형식 검증 (YYYY-MM)
        const yearMonthRegex = /^\d{4}-\d{2}$/;
        if (!yearMonthRegex.test(yearMonth)) {
          return NextResponse.json({ error: 'yearMonth는 YYYY-MM 형식이어야 합니다' }, { status: 400 });
        }
        
        console.log(`[API] 월별 통계 계산 시작: ${yearMonth}`);
        stats = await calculateMonthlyStats(yearMonth);
        period = yearMonth;
        
        // 조회 기간 정보 추가
        const [year, month] = yearMonth.split('-');
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        filterInfo = {
          startDate: `${yearMonth}-01`,
          endDate: `${yearMonth}-${lastDay}`,
          description: `${year}년 ${month}월 1일부터 ${lastDay}일까지`
        };
        break;
      
      case 'recent':
        // 최근 N일 통계 (기본 31일)
        if (isNaN(days) || days <= 0) {
          return NextResponse.json({ error: 'days 값은 양수여야 합니다' }, { status: 400 });
        }
        
        console.log(`[API] 최근 ${days}일 통계 계산 시작`);
        stats = await calculateRecentDaysStats(days);
        period = `최근 ${days}일`;
        
        // 오늘 날짜와 N일 전 날짜 계산
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (days - 1));
        const startDateStr = startDate.toISOString().split('T')[0];
        
        filterInfo = {
          startDate: startDateStr,
          endDate: todayStr,
          description: `${startDateStr}부터 ${todayStr}까지 (${days}일)`
        };
        break;
      
      case 'all':
        // 전체 통계
        console.log(`[API] 전체 기간 통계 계산 시작`);
        stats = await calculateAllTimeStats();
        period = '전체 기간';
        filterInfo = {
          description: '전체 기록'
        };
        break;
      
      default:
        return NextResponse.json({ error: 'mode는 month, recent, all 중 하나여야 합니다' }, { status: 400 });
    }
    
    console.log(`[API] 통계 계산 완료: 총 ${stats.totalDays}일의 데이터`);
    
    return NextResponse.json({ 
      success: true, 
      mode,
      period,
      filterInfo,
      stats,
      recordCount: stats.dailyData.length
    });
  } catch (error) {
    console.error('[API] 데이터 조회 오류:', error);
    // 더 상세한 에러 메시지 반환
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return NextResponse.json({ 
      success: false, 
      error: `데이터 조회 중 오류가 발생했습니다: ${errorMessage}` 
    }, { status: 500 });
  }
} 