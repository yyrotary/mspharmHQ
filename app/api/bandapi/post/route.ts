import { NextResponse } from 'next/server';

// 밴드 API URL 및 인증 정보
const BAND_API_URL = 'https://openapi.band.us';
const ACCESS_TOKEN = process.env.BAND_ACCESS_TOKEN;

// Notion 스키마와 유틸리티 함수 임포트
import { CONSULTATION_SCHEMA } from '@/app/lib/notion-schema';

export async function POST(request: Request) {
  try {
    console.log('밴드 포스팅 API 호출됨');

    // 요청 데이터 파싱
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.bandKey) {
      return NextResponse.json({
        success: false,
        error: '밴드 키가 필요합니다'
      }, { status: 400 });
    }

    if (!data.consultation) {
      return NextResponse.json({
        success: false,
        error: '진료 정보가 필요합니다'
      }, { status: 400 });
    }

    if (!ACCESS_TOKEN) {
      console.error('액세스 토큰이 없습니다');
      return NextResponse.json({
        success: false,
        error: '밴드 API 인증 정보가 없습니다'
      }, { status: 500 });
    }

    const consultation = data.consultation;
    
    // 진료 정보에서 필요한 데이터 추출
    const getPropertyValue = (obj: any, key: string) => {
      try {
        return obj?.[key] || '';
      } catch (e) {
        console.warn(`${key} 값 추출 실패:`, e);
        return '';
      }
    };
    
    const consultDate = getPropertyValue(consultation, 'consultDate') || '날짜 정보 없음';
    const customerName = getPropertyValue(consultation, 'customerName') || '고객명 정보 없음';
    const result = getPropertyValue(consultation, 'result') || '';
    const stateAnalysis = getPropertyValue(consultation, 'stateAnalysis') || '';
    const prescription = getPropertyValue(consultation, 'prescription') || '';
    const specialNote = getPropertyValue(consultation, 'specialNote') || '';
    const imageUrls = getPropertyValue(consultation, 'imageUrls') || [];

    // 포스트 내용 구성
    let content = `[${consultDate}] ${customerName} 님 진료기록\n\n`;
    
    if (stateAnalysis) {
      content += `■ 상태분석\n${stateAnalysis}\n\n`;
    }
    
    if (prescription) {
      content += `■ 처방\n${prescription}\n\n`;
    }
    
    if (result) {
      content += `■ 결과\n${result}\n\n`;
    }
    
    if (specialNote) {
      content += `■ 특이사항\n${specialNote}\n\n`;
    }
    
    // 밴드 API에 포스트 요청
    console.log(`밴드(${data.bandKey})에 포스팅 시도. 내용 길이: ${content.length}`);
    
    // URL 인코딩된 폼 데이터 생성
    const urlEncodedData = new URLSearchParams();
    urlEncodedData.append('access_token', ACCESS_TOKEN);
    urlEncodedData.append('band_key', data.bandKey);
    urlEncodedData.append('content', content);
    
    // 이미지가 있는 경우 추가
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      console.log(`이미지 ${imageUrls.length}개 첨부`);
      urlEncodedData.append('photo_urls', imageUrls.join(','));
    }

    // 밴드 API 호출
    const response = await fetch(`${BAND_API_URL}/v2.2/band/post/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: urlEncodedData
    });

    console.log('밴드 API 응답 상태:', response.status, response.statusText);
    const result_data = await response.json();
    console.log('밴드 API 응답 데이터:', result_data);
    
    // 응답 처리
    if (result_data.result_code === 1) {
      console.log('밴드 포스팅 성공:', result_data.result_data);
      return NextResponse.json({
        success: true,
        post_key: result_data.result_data.post_key
      });
    } else {
      console.error('밴드 포스팅 실패:', result_data);
      return NextResponse.json({
        success: false,
        error: result_data.message || '밴드 포스팅에 실패했습니다'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('밴드 포스팅 오류:', error);
    return NextResponse.json({
      success: false,
      error: '밴드 포스팅 중 오류가 발생했습니다'
    }, { status: 500 });
  }
} 