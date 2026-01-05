import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

// Google AI API 키 환경변수에서 가져오기
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || '';

// Google Generative AI 초기화
const genAI = new GoogleGenerativeAI(API_KEY);

// 안전 설정 구성
const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// 기본 얼굴 임베딩 생성 함수
function createDefaultEmbedding(gender = "", age = 0) {
  return {
    faceDetected: true,
    embedding: {
      eyeDistanceRatio: 0.45,
      eyeNoseRatio: 0.35,
      noseMouthRatio: 0.25,
      symmetryScore: 0.8,
      contourFeatures: gender === "남성" ? "각진 형태" : "둥근 형태"
    },
    gender: gender,
    age: age,
    distinctiveFeatures: [],
    imageQualityScore: 70
  };
}

// 응답 데이터를 정규화하는 함수 - 항상 일관된 형식을 보장
function normalizeEmbeddingData(data: any) {
  // 기본 구조 생성
  const defaultData = createDefaultEmbedding(data?.gender || "불명확", data?.age || 30);
  
  // 얼굴 감지 여부
  const faceDetected = data?.faceDetected !== undefined ? data.faceDetected : defaultData.faceDetected;
  
  // 성별과 나이 정보
  const gender = data?.gender || defaultData.gender;
  const age = data?.age || defaultData.age;
  
  // 임베딩 데이터 통합
  // 직접 전달된 임베딩과 중첩된 임베딩을 모두 확인
  const embeddingDirectLevel = {
    eyeDistanceRatio: data?.eyeDistanceRatio !== undefined ? data.eyeDistanceRatio : null,
    eyeNoseRatio: data?.eyeNoseRatio !== undefined ? data.eyeNoseRatio : null,
    noseMouthRatio: data?.noseMouthRatio !== undefined ? data.noseMouthRatio : null,
    symmetryScore: data?.symmetryScore !== undefined ? data.symmetryScore : null,
    contourFeatures: data?.contourFeatures || null,
  };
  
  const embeddingNestedLevel = data?.embedding || {};
  
  // 통합된 임베딩 객체 생성 (중첩된 것 먼저, 직접 전달된 것으로 덮어쓰기)
  const embedding = {
    eyeDistanceRatio: embeddingNestedLevel.eyeDistanceRatio !== undefined 
      ? embeddingNestedLevel.eyeDistanceRatio 
      : (embeddingDirectLevel.eyeDistanceRatio !== null 
          ? embeddingDirectLevel.eyeDistanceRatio 
          : defaultData.embedding.eyeDistanceRatio),
    
    eyeNoseRatio: embeddingNestedLevel.eyeNoseRatio !== undefined 
      ? embeddingNestedLevel.eyeNoseRatio 
      : (embeddingDirectLevel.eyeNoseRatio !== null 
          ? embeddingDirectLevel.eyeNoseRatio 
          : defaultData.embedding.eyeNoseRatio),
    
    noseMouthRatio: embeddingNestedLevel.noseMouthRatio !== undefined 
      ? embeddingNestedLevel.noseMouthRatio 
      : (embeddingDirectLevel.noseMouthRatio !== null 
          ? embeddingDirectLevel.noseMouthRatio 
          : defaultData.embedding.noseMouthRatio),
    
    symmetryScore: embeddingNestedLevel.symmetryScore !== undefined 
      ? embeddingNestedLevel.symmetryScore 
      : (embeddingDirectLevel.symmetryScore !== null 
          ? embeddingDirectLevel.symmetryScore 
          : defaultData.embedding.symmetryScore),
    
    contourFeatures: embeddingNestedLevel.contourFeatures || embeddingDirectLevel.contourFeatures || defaultData.embedding.contourFeatures
  };
  
  // 기타 정보
  const distinctiveFeatures = data?.distinctiveFeatures || defaultData.distinctiveFeatures;
  const imageQualityScore = data?.imageQualityScore || defaultData.imageQualityScore;
  
  // 최종 정규화된 데이터 반환
  return {
    faceDetected,
    embedding,
    gender,
    age,
    distinctiveFeatures,
    imageQualityScore
  };
}

export async function POST(request: NextRequest) {
  try {
    // 요청에서 이미지 파일 추출
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    
    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 파일 크기 제한 체크 (10MB)
    if (imageFile.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: '이미지 파일 크기는 10MB 이하여야 합니다.' },
        { status: 400 }
      );
    }
    
    // 이미지를 Base64로 변환
    const imageArrayBuffer = await imageFile.arrayBuffer();
    const imageUint8Array = new Uint8Array(imageArrayBuffer);
    const base64Image = Buffer.from(imageUint8Array).toString('base64');
    
    // 이미지를 MIME 타입과 함께 처리
    const mimeType = imageFile.type || 'image/jpeg';
    
    // Gemini 2.0 Flash 모델 사용 (더 빠르고 가벼움)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    // 이미지 분석 요청
    let responseText = '';
    try {
      console.log('Gemini 모델 호출 시작...');
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { text: "이 사진에서 사람의 얼굴을 감지하고 다음 정보를 JSON 형식으로만 추출해 주세요. 가능한 한 정확한 값을 추정해 주세요. JSON 외의 다른 텍스트는 포함하지 말고, 오직 JSON 형식만 반환해주세요." },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: mimeType
                }
              },
              { text: `다음과 같은 JSON 형식만 반환해주세요:
              {
                "faceDetected": true/false,
                "embedding": {
                  "eyeDistanceRatio": 0.5, // 0.3~0.7 사이 값으로, 개인마다 다른 값
                  "eyeNoseRatio": 0.5,    // 0.3~0.7 사이 값으로, 개인마다 다른 값
                  "noseMouthRatio": 0.5,  // 0.3~0.7 사이 값으로, 개인마다 다른 값
                  "symmetryScore": 0.5,   // 0~1 사이 값
                  "contourFeatures": "타원형/사각형/둥근형/각진형 등"
                },
                "gender": "남성/여성",
                "age": 30, // 정확한 나이 추정 (5살 단위가 아닌 구체적인 나이)
                "distinctiveFeatures": ["안경", "수염", "흉터" 등],
                "imageQualityScore": 85 // 0~100 사이 값
              }` }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          topP: 0.1,
          topK: 16,
          maxOutputTokens: 2048,
        },
        safetySettings,
      });
      
      const response = await result.response;
      responseText = response.text();
      console.log('Gemini 응답 완료, JSON 파싱 시작');
    } catch (err) {
      console.error('Gemini API 호출 오류:', err);
      return NextResponse.json(
        { error: '이미지 분석 중 오류가 발생했습니다.', details: (err as Error).message },
        { status: 500 }
      );
    }
    
    // JSON 응답 파싱
    try {
      // 텍스트에서 유효한 JSON 부분만 추출
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        console.error('유효한 JSON 형식을 찾을 수 없습니다:', responseText);
        const defaultData = createDefaultEmbedding("불명확", 30);
        return NextResponse.json(
          { 
            error: '유효한 응답을 받지 못했습니다.',
            data: defaultData,
            note: '모델이 유효한 JSON을 반환하지 않아 기본값을 사용합니다.'
          },
          { status: 200 }
        );
      }
      
      const jsonStr = jsonMatch[0];
      const result = JSON.parse(jsonStr);
      console.log('JSON 파싱 성공');
      
      const normalizedData = normalizeEmbeddingData(result);
      return NextResponse.json(
        { success: true, data: normalizedData },
        { status: 200 }
      );
    } catch (err) {
      console.error('JSON 파싱 오류:', err, 'Raw response:', responseText);
      
      // 오류가 발생해도 기본 응답 반환하여 프론트엔드가 계속 작동할 수 있게 함
      const defaultData = createDefaultEmbedding("불명확", 30);
      return NextResponse.json(
        { 
          error: 'JSON 형식 오류',
          data: defaultData,
          note: '응답을 파싱하는 중 오류가 발생했습니다. 기본 데이터를 사용합니다.'
        },
        { status: 200 }
      );
    }
  } catch (err) {
    console.error('전체 요청 처리 오류:', err);
    return NextResponse.json(
      { error: '요청을 처리하는 중 오류가 발생했습니다.', details: (err as Error).message },
      { status: 500 }
    );
  }
} 