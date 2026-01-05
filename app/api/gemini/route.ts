import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const modelName = 'gemini-2.5-flash';

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
    
    // 텍스트 형식에서 JSON 추출 시도
    let jsonData;
    try {
      // JSON 문자열 형식 추출 시도
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      jsonData = JSON.parse(jsonStr);
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      jsonData = { age: null, gender: null, faceDetected: false };
    }
    
    // 얼굴 감지 여부 확인 (text에 "얼굴을 감지할 수 없습니다" 또는 "사람이 없습니다" 등의 단어가 있는지)
    const noFaceDetected = 
      text.includes('얼굴을 감지할 수 없') || 
      text.includes('사람이 없') || 
      text.includes('얼굴이 없') || 
      text.includes('감지되지 않') ||
      text.includes('could not detect') ||
      text.includes('no face') ||
      text.includes('no person');
      
    if (noFaceDetected) {
      jsonData.faceDetected = false;
    } else {
      jsonData.faceDetected = true;
    }
    
    return NextResponse.json({ success: true, data: jsonData });
  } catch (error) {
    console.error('Gemini API 오류:', error);
    return NextResponse.json({ error: '이미지 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 