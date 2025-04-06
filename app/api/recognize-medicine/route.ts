import { NextResponse } from 'next/server';

// Gemini API 키 (기존 extract-invoice API와 동일한 키 사용)
const GEMINI_API_KEY = 'AIzaSyCNyZ7ZuQR0RNjXhky9GKD1FApRDEOeV14';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// 약품 인식 API 엔드포인트
export async function POST(request: Request) {
  try {
    // 폼 데이터 파싱
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const invoiceItems = formData.get('invoiceItems') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '이미지 파일이 필요합니다' },
        { status: 400 }
      );
    }

    // 파일 타입 검사
    const fileType = file.type;
    if (!fileType.includes('image/')) {
      return NextResponse.json(
        { success: false, error: '지원하지 않는 파일 형식입니다. 이미지만 업로드해 주세요.' },
        { status: 400 }
      );
    }

    // 거래내역서 아이템 목록 파싱
    let itemsList: any[] = [];
    try {
      if (invoiceItems) {
        itemsList = JSON.parse(invoiceItems);
      }
    } catch (e) {
      console.error('거래내역서 아이템 파싱 오류:', e);
    }

    // 파일을 Base64로 변환
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    
    // 약품 이름 목록 문자열 생성
    const medicineNames = itemsList.length > 0 
      ? itemsList.map((item: any) => item.name).join(', ')
      : '';
    
    // Gemini API 호출을 위한 프롬프트 구성
    const prompt = `
      이 이미지는 약품입니다. 다음 약품 목록 중에서 이 이미지와 일치하는 약품을 찾아주세요:
      ${medicineNames ? medicineNames : '(약품 목록이 제공되지 않았습니다)'}
      
      결과는 다음 JSON 형식으로 반환해주세요:
      {
        "identified": true/false,
        "medicineName": "식별된 약품 이름",
        "confidence": 0~100 사이의 신뢰도 점수
      }
      
      약품을 식별할 수 없는 경우:
      {
        "identified": false,
        "medicineName": "",
        "confidence": 0
      }
      
      오직 JSON 결과만 반환해주세요. JSON 외에 어떠한 설명도 포함하지 마세요.
    `;
    
    // Gemini API 요청 데이터 구성
    const requestData = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: file.type,
                data: base64Image
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 1,
        topK: 32,
        maxOutputTokens: 4096,
      }
    };
    
    // Gemini API 호출
    const geminiResponse = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      }
    );
    
    if (!geminiResponse.ok) {
      console.error('Gemini API 오류:', await geminiResponse.text());
      throw new Error('이미지 분석 중 오류가 발생했습니다');
    }
    
    const geminiResult = await geminiResponse.json();
    
    // Gemini API 응답에서 텍스트 추출
    let extractedText = '';
    try {
      extractedText = geminiResult.candidates[0].content.parts[0].text.trim();
      
      // JSON 문자열만 추출 (Gemini가 때로는 코드 블록으로 감싸는 경우가 있음)
      if (extractedText.includes('```json')) {
        extractedText = extractedText.split('```json')[1].split('```')[0].trim();
      } else if (extractedText.includes('```')) {
        extractedText = extractedText.split('```')[1].split('```')[0].trim();
      }
      
      // 추출된 텍스트를 JSON으로 파싱
      const recognitionResult = JSON.parse(extractedText);
      
      return NextResponse.json({
        success: true,
        data: recognitionResult
      });
      
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.log('추출된 텍스트:', extractedText);
      
      // 실패 시 빈 결과 반환
      return NextResponse.json({
        success: false,
        error: '약품 인식에 실패했습니다',
        data: {
          identified: false,
          medicineName: "",
          confidence: 0
        }
      });
    }
    
  } catch (error) {
    console.error('약품 인식 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '약품 인식 중 오류가 발생했습니다.',
        data: {
          identified: false,
          medicineName: "",
          confidence: 0
        }
      },
      { status: 500 }
    );
  }
} 