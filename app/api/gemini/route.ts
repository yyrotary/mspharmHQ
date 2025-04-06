import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const modelName = 'gemini-1.5-flash';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }
    
    // 이미지 데이터를 Base64로 변환
    const imageData = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageData).toString('base64');
    
    // Gemini 모델 인스턴스 생성
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // 이미지를 MIME 타입과 함께 처리
    const mimeType = imageFile.type || 'image/jpeg';
    
    // 텍스트 및 이미지 입력 생성
    const prompt = '이 사진에서 사람의 얼굴을 감지하고, 나이, 성별을 추정하세요. JSON 형식으로 응답해주세요.';
    
    // 이미지 분석 요청
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    // JSON 응답 추출 시도
    try {
      // "{...}" 형태의 JSON 문자열을 찾아 파싱
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let jsonData = {};
      
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[0]);
      } else {
        // JSON 형식이 아니면 텍스트 결과 반환
        jsonData = { text };
      }
      
      return NextResponse.json({ success: true, data: jsonData });
    } catch (jsonError) {
      // JSON 파싱에 실패하면 원본 텍스트 반환
      return NextResponse.json({ success: true, data: { text } });
    }
  } catch (error) {
    console.error('Gemini API 오류:', error);
    return NextResponse.json({ error: '이미지 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 