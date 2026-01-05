import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { image, customerId } = await request.json();

    if (!image || !customerId) {
      return NextResponse.json(
        { error: '이미지와 고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // Gemini Vision 모델로 음식 분석
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
이 음식 이미지를 분석해서 다음 정보를 JSON 형태로 제공해주세요:

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

분석이 어려우면 confidence를 낮게 설정하고, 가능한 한 정확한 정보를 제공해주세요.
모든 텍스트는 한국어로 작성해주세요.
`;

    const imagePart = {
      inlineData: {
        data: image,
        mimeType: "image/jpeg"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // JSON 파싱
    let analysisResult;
    try {
      // JSON 부분만 추출 (코드 블록 제거)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      analysisResult = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Gemini 응답 파싱 오류:', parseError);
      console.log('원본 응답:', text);
      return NextResponse.json(
        { error: 'AI 분석 결과를 처리하는데 실패했습니다' },
        { status: 500 }
      );
    }

    // 이미지를 Supabase Storage에 업로드
    const imageBuffer = Buffer.from(image, 'base64');
    const fileName = `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('food-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/jpeg'
      });

    let imageUrl = null;
    if (!uploadError && uploadData) {
      const { data: urlData } = supabase.storage
        .from('food-images')
        .getPublicUrl(uploadData.path);
      imageUrl = urlData.publicUrl;
    }

    // 음식 기록을 데이터베이스에 저장
    const { data: foodRecord, error: dbError } = await supabase
      .from('food_records')
      .insert({
        customer_id: customerId,
        food_name: analysisResult.food_name || '알 수 없는 음식',
        food_description: analysisResult.food_description,
        food_category: analysisResult.food_category,
        image_url: imageUrl,
        confidence_score: analysisResult.confidence || 0.5,
        gemini_analysis: analysisResult,
        recorded_date: new Date().toISOString().split('T')[0],
        recorded_time: new Date().toTimeString().split(' ')[0],
        meal_type: getMealType() // 현재 시간 기준으로 식사 시간 추정
      })
      .select()
      .single();

    if (dbError) {
      console.error('음식 기록 저장 오류:', dbError);
      return NextResponse.json(
        { error: '음식 기록 저장에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordId: foodRecord.id,
      analysis: analysisResult,
      imageUrl
    });

  } catch (error) {
    console.error('음식 분석 API 오류:', error);
    return NextResponse.json(
      { error: '음식 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 현재 시간을 기준으로 식사 시간 추정
function getMealType(): string {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 10) {
    return '아침';
  } else if (hour >= 11 && hour < 15) {
    return '점심';
  } else if (hour >= 17 && hour < 21) {
    return '저녁';
  } else {
    return '간식';
  }
}
