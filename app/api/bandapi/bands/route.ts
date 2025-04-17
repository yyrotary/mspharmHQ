import { NextResponse } from 'next/server';

// 밴드 API URL 및 인증 정보
const BAND_API_URL = 'https://openapi.band.us';
const ACCESS_TOKEN = process.env.BAND_ACCESS_TOKEN;

export async function GET() {
  try {
    console.log('밴드 목록 조회 시작');

    // 액세스 토큰 확인
    if (!ACCESS_TOKEN) {
      console.error('액세스 토큰이 없습니다');
      return NextResponse.json({
        success: false,
        error: '밴드 API 인증 정보가 없습니다'
      }, { status: 500 });
    }

    // 밴드 목록 조회 API 호출
    const url = new URL(`${BAND_API_URL}/v2.1/bands`);
    url.searchParams.append('access_token', ACCESS_TOKEN);

    const response = await fetch(url, {
      method: 'GET'
    });

    console.log('밴드 API 응답 상태:', response.status, response.statusText);
    const result = await response.json();
    console.log('밴드 API 응답 데이터:', result);

    // 응답 처리
    if (result.result_code === 1) {
      console.log('밴드 목록 조회 성공:', result.result_data?.bands?.length);
      return NextResponse.json({
        success: true,
        bands: result.result_data?.bands?.map((band: any) => ({
          name: band.name,
          band_key: band.band_key,
          cover: band.cover,
          member_count: band.member_count
        })) || []
      });
    } else {
      console.error('밴드 목록 조회 실패:', result);
      return NextResponse.json({
        success: false,
        error: result.message || '밴드 목록 조회에 실패했습니다'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('밴드 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '밴드 목록 조회 중 오류가 발생했습니다'
    }, { status: 500 });
  }
} 