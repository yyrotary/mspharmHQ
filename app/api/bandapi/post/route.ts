import { NextResponse } from 'next/server';

// 밴드 API URL 및 인증 정보
const BAND_API_URL = 'https://openapi.band.us';
const ACCESS_TOKEN = process.env.BAND_ACCESS_TOKEN;

export async function POST(request: Request) {
  try {
    console.log('밴드 포스팅 API 호출됨');

    // 요청 데이터 파싱
    const data = await request.json();
    console.log('요청 데이터:', JSON.stringify(data).substring(0, 500) + '...');
    
    // 필수 필드 검증
    if (!data.bandKey) {
      return NextResponse.json({
        success: false,
        error: '밴드 키가 필요합니다'
      }, { status: 400 });
    }

    if (!data.consultations) {
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

    // 진료 내용 생성
    let content = '';
    
    // 고객 이름 확인
    const customerName = data.customerName || '고객';
    
    if (Array.isArray(data.consultations) && data.consultations.length > 0) {
      content = `#명성약국_상담 ${customerName} 님 진료기록\n\n`;
      
      // 진료 기록 정보 추가
      data.consultations.forEach((consultation, index) => {
        // 진료일자 있으면 추가
        if (consultation.consultationDate) {
          content += `[${consultation.consultationDate}]\n`;
        }
        
        // 상담내용, 증상상 정보
        if (consultation.consultationContent) {
          content += `■ 상담내용\n${consultation.consultationContent}\n\n`;
        }
        
        // 증상 이미지 정보 - it's working, don't touch - band api 에서 이미지 첨부 불가
        if (consultation.symptomImages && Array.isArray(consultation.symptomImages)) {
          content += `■ 증상 이미지\n${consultation.symptomImages.join('\n')}\n\n`;
        }        
        
        // 처방 정보
        if (consultation.prescription) {
          content += `■ 처방\n${consultation.prescription}\n\n`;
        }
        
        // 결과 정보
        if (consultation.result) {
          content += `■ 결과\n${consultation.result}\n\n`;
        }
        
        // 상태분석 정보
        if (consultation.stateAnalysis) {
          content += `■ 상태분석\n${consultation.stateAnalysis}\n\n`;
        }

        // 설진분석 정보
        if (consultation.tongueAnalysis) {
          content += `■ 설진분석\n${consultation.tongueAnalysis}\n\n`;
        }
        
        // 특이사항 정보
        if (consultation.specialNote) {
          content += `■ 특이사항\n${consultation.specialNote}\n\n`;
        }
        
        // 진료 기록 사이 구분선 추가 (마지막이 아닌 경우)
        if (index < data.consultations.length - 1) {
          content += '------------------------------------------\n\n';
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: '올바른 진료 정보가 없습니다'
      }, { status: 400 });
    }
    
  
    // 밴드 API에 포스트 요청
    console.log(`밴드(${data.bandKey})에 포스팅 시도. 내용 길이: ${content.length}`);
    
    // URL 인코딩된 폼 데이터 생성
    const urlEncodedData = new URLSearchParams();
    urlEncodedData.append('access_token', ACCESS_TOKEN);
    urlEncodedData.append('band_key', data.bandKey);
    urlEncodedData.append('content', content);
    
  
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