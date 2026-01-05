import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 환경 변수를 먼저 로드 (절대 경로 사용)
const envPath = path.join(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ .env.local 파일을 찾을 수 없습니다:', envPath);
  console.log('📝 다음 위치에 .env.local 파일을 생성해주세요:', process.cwd());
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function testGeminiAPI() {
  console.log('🧪 Gemini API 테스트 시작...\n');
  
  // 환경 변수 확인
  console.log('📍 현재 작업 디렉토리:', process.cwd());
  console.log('📄 .env.local 경로:', envPath);
  console.log('🔑 GEMINI_API_KEY 존재:', !!process.env.GEMINI_API_KEY);
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
    console.log('📝 .env.local 파일에 다음 내용을 추가하세요:');
    console.log('GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y');
    process.exit(1);
  }
  
  console.log('');

  try {
    // 1. 기본 텍스트 생성 테스트
    console.log('1. 기본 텍스트 생성 테스트...');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "안녕하세요! 음식 분석 AI입니다. 간단한 인사말을 해주세요.";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ 응답:', text);
    console.log('');

    // 2. JSON 구조화 테스트
    console.log('2. JSON 구조화 응답 테스트...');
    const jsonPrompt = `
다음 JSON 형태로 응답해주세요:
{
  "message": "테스트 성공",
  "status": "ok",
  "features": ["음식 분석", "칼로리 계산", "영양성분 분석"]
}
`;
    
    const jsonResult = await model.generateContent(jsonPrompt);
    const jsonResponse = await jsonResult.response;
    const jsonText = jsonResponse.text();
    
    console.log('✅ JSON 응답:', jsonText);
    console.log('');

    // 3. 샘플 음식 분석 프롬프트 테스트 (이미지 없이)
    console.log('3. 음식 분석 프롬프트 구조 테스트...');
    const foodPrompt = `
김치찌개 음식을 분석한다고 가정하고 다음 JSON 형태로 응답해주세요:

{
  "food_name": "음식 이름 (한국어)",
  "food_description": "음식에 대한 간단한 설명",
  "food_category": "음식 카테고리 (예: 한식, 양식, 중식, 일식, 간식, 음료 등)",
  "ingredients": ["재료1", "재료2", "재료3"],
  "estimated_calories": "추정 칼로리 (숫자만)",
  "nutritional_info": {
    "carbohydrates": "탄수화물 함량 추정 (g)",
    "protein": "단백질 함량 추정 (g)", 
    "fat": "지방 함량 추정 (g)"
  },
  "health_notes": "건강상 주의사항이나 영양학적 조언 (한국어)",
  "confidence": 0.85
}
`;
    
    const foodResult = await model.generateContent(foodPrompt);
    const foodResponse = await foodResult.response;
    const foodText = foodResponse.text();
    
    console.log('✅ 음식 분석 응답:', foodText);
    console.log('');

    // JSON 파싱 테스트
    try {
      const jsonMatch = foodText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJSON = JSON.parse(jsonMatch[0]);
        console.log('✅ JSON 파싱 성공:', parsedJSON.food_name);
      }
    } catch (parseError) {
      console.log('⚠️  JSON 파싱 실패 - 응답 형태 개선 필요');
    }

    console.log('\n🎉 Gemini API 테스트 완료!');
    console.log('\n📱 이제 고객용 앱에서 음식 분석 기능을 사용할 수 있습니다:');
    console.log('1. /customer/login 에서 PIN으로 로그인');
    console.log('2. 음식 기록 → 카메라 촬영');
    console.log('3. AI 음식 분석 실행');

  } catch (error) {
    console.error('❌ Gemini API 테스트 실패:', error);
    console.log('\n🔧 문제 해결 방법:');
    console.log('1. GEMINI_API_KEY 환경 변수 확인');
    console.log('2. API 키 유효성 확인');
    console.log('3. 네트워크 연결 확인');
  }
}

if (require.main === module) {
  testGeminiAPI()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

export default testGeminiAPI;
