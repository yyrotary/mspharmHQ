import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 상세 영양 분석 인터페이스
interface NutritionAnalysis {
  calories: number;
  carbohydrates: number;
  protein: number;
  fat: number;
  fiber: number;
  sodium: number;
  sugar: number;
  cholesterol: number;
  saturated_fat: number;
  vitamins: {
    a?: number;
    b1?: number;
    b2?: number;
    b6?: number;
    b12?: number;
    c?: number;
    d?: number;
    e?: number;
  };
  minerals: {
    calcium?: number;
    iron?: number;
    potassium?: number;
    magnesium?: number;
  };
  gi_index?: string; // 혈당지수 (저/중/고)
  health_warnings: string[];
  health_benefits: string[];
}

// 환자 조건에 따른 영양소 제한 기준
interface PatientCondition {
  diabetes?: boolean;
  hypertension?: boolean;
  kidney_disease?: boolean;
  heart_disease?: boolean;
  obesity?: boolean;
  gout?: boolean;
}

// 영양소 제한 기준 정의
const NUTRITION_LIMITS = {
  daily: {
    calories: { min: 1500, max: 2500 },
    carbohydrates: { min: 225, max: 325 }, // g
    protein: { min: 50, max: 175 }, // g
    fat: { min: 44, max: 78 }, // g
    fiber: { min: 25, max: 38 }, // g
    sodium: { min: 500, max: 2300 }, // mg
    sugar: { min: 0, max: 50 }, // g
    cholesterol: { min: 0, max: 300 }, // mg
    saturated_fat: { min: 0, max: 22 }, // g
  },
  // 질환별 제한 기준
  conditions: {
    diabetes: {
      sugar: { max: 25 },
      carbohydrates: { max: 200 },
    },
    hypertension: {
      sodium: { max: 1500 },
    },
    kidney_disease: {
      protein: { max: 60 },
      sodium: { max: 1500 },
      potassium: { max: 2000 },
    },
    heart_disease: {
      saturated_fat: { max: 15 },
      cholesterol: { max: 200 },
      sodium: { max: 1500 },
    },
    obesity: {
      calories: { max: 1800 },
      fat: { max: 55 },
    },
    gout: {
      // 퓨린 함량이 높은 음식 주의
    }
  }
};

export async function POST(request: NextRequest) {
  try {
    const { image, customerId, mealType, consumedAt } = await request.json();

    if (!image || !customerId) {
      return NextResponse.json(
        { error: '이미지와 고객 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 고객 정보 및 건강 상태 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, name, special_notes')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: '고객 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 고객의 건강 상태 파악 (special_notes에서 질환 정보 추출)
    const patientConditions = parsePatientConditions(customer.special_notes || '');

    // Gemini Vision으로 상세 영양 분석
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
이 음식 이미지를 분석하여 상세한 영양 정보를 JSON 형태로 제공해주세요.

{
  "food_name": "음식 이름 (한국어)",
  "food_description": "음식에 대한 간단한 설명",
  "food_category": "음식 카테고리 (한식/양식/중식/일식/간식/음료/과일/디저트 등)",
  "estimated_weight_grams": 예상 중량(g),
  "confidence": 0.85,
  "ingredients": ["재료1", "재료2", "재료3"],
  "nutrition": {
    "calories": 추정 칼로리(kcal),
    "carbohydrates": 탄수화물(g),
    "protein": 단백질(g),
    "fat": 지방(g),
    "fiber": 식이섬유(g),
    "sodium": 나트륨(mg),
    "sugar": 당류(g),
    "cholesterol": 콜레스테롤(mg),
    "saturated_fat": 포화지방(g),
    "vitamins": {
      "a": 비타민A(μg),
      "c": 비타민C(mg),
      "d": 비타민D(μg),
      "b1": 티아민(mg),
      "b2": 리보플라빈(mg)
    },
    "minerals": {
      "calcium": 칼슘(mg),
      "iron": 철분(mg),
      "potassium": 칼륨(mg),
      "magnesium": 마그네슘(mg)
    }
  },
  "gi_index": "저/중/고 (혈당지수)",
  "health_benefits": ["건강상 이점1", "건강상 이점2"],
  "health_warnings": ["주의사항1", "주의사항2"],
  "diabetes_friendly": true/false,
  "hypertension_friendly": true/false,
  "heart_friendly": true/false,
  "kidney_friendly": true/false
}

주의사항:
- 모든 영양소 값은 숫자만 입력 (단위 제외)
- 분석이 어려운 값은 0 또는 null로 설정
- 한국인의 일반적인 1인분 기준으로 계산
- health_warnings에는 특정 질환자가 주의해야 할 사항 포함
- 모든 텍스트는 한국어로 작성
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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      analysisResult = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('Gemini 응답 파싱 오류:', parseError);
      return NextResponse.json(
        { error: 'AI 분석 결과를 처리하는데 실패했습니다' },
        { status: 500 }
      );
    }

    // 환자 조건에 따른 맞춤 경고 생성
    const customWarnings = generateCustomWarnings(analysisResult, patientConditions);

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

    // 현재 시간 기반 식사 타입 결정
    const determinedMealType = mealType || getMealTypeByTime(new Date());
    const now = new Date();
    const recordedDate = now.toISOString().split('T')[0];
    const recordedTime = now.toTimeString().split(' ')[0];

    // 음식 기록 저장
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
        recorded_date: recordedDate,
        recorded_time: recordedTime,
        meal_type: determinedMealType,
        consumed_at: consumedAt || now.toISOString(),
        actual_calories: analysisResult.nutrition?.calories || 0,
        portion_consumed: 100,
        nutritional_info: {
          ...analysisResult.nutrition,
          gi_index: analysisResult.gi_index,
          health_benefits: analysisResult.health_benefits,
          health_warnings: [...(analysisResult.health_warnings || []), ...customWarnings],
          patient_specific_warnings: customWarnings,
          diabetes_friendly: analysisResult.diabetes_friendly,
          hypertension_friendly: analysisResult.hypertension_friendly,
          heart_friendly: analysisResult.heart_friendly,
          kidney_friendly: analysisResult.kidney_friendly
        }
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
      analysis: {
        ...analysisResult,
        custom_warnings: customWarnings,
        patient_conditions: patientConditions
      },
      imageUrl
    });

  } catch (error) {
    console.error('영양 분석 API 오류:', error);
    return NextResponse.json(
      { error: '영양 분석 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 고객의 특이사항에서 건강 상태 파싱
function parsePatientConditions(specialNotes: string): PatientCondition {
  const notes = specialNotes.toLowerCase();
  
  return {
    diabetes: notes.includes('당뇨') || notes.includes('diabetes') || notes.includes('혈당'),
    hypertension: notes.includes('고혈압') || notes.includes('hypertension') || notes.includes('혈압'),
    kidney_disease: notes.includes('신장') || notes.includes('kidney') || notes.includes('신부전') || notes.includes('투석'),
    heart_disease: notes.includes('심장') || notes.includes('heart') || notes.includes('심혈관') || notes.includes('협심증'),
    obesity: notes.includes('비만') || notes.includes('obesity') || notes.includes('체중관리') || notes.includes('다이어트'),
    gout: notes.includes('통풍') || notes.includes('gout') || notes.includes('요산'),
  };
}

// 환자 조건에 따른 맞춤 경고 생성
function generateCustomWarnings(analysis: any, conditions: PatientCondition): string[] {
  const warnings: string[] = [];
  const nutrition = analysis.nutrition || {};

  if (conditions.diabetes) {
    if (analysis.gi_index === '고' || nutrition.sugar > 15) {
      warnings.push('⚠️ 당뇨 주의: 혈당 지수가 높은 음식입니다. 섭취량을 조절하세요.');
    }
    if (nutrition.carbohydrates > 60) {
      warnings.push('⚠️ 당뇨 주의: 탄수화물 함량이 높습니다.');
    }
    if (!analysis.diabetes_friendly) {
      warnings.push('⚠️ 당뇨 환자에게 권장하지 않는 음식입니다.');
    }
  }

  if (conditions.hypertension) {
    if (nutrition.sodium > 600) {
      warnings.push('⚠️ 고혈압 주의: 나트륨 함량이 높습니다 (' + nutrition.sodium + 'mg).');
    }
    if (!analysis.hypertension_friendly) {
      warnings.push('⚠️ 고혈압 환자에게 권장하지 않는 음식입니다.');
    }
  }

  if (conditions.kidney_disease) {
    if (nutrition.protein > 20) {
      warnings.push('⚠️ 신장질환 주의: 단백질 함량이 높습니다.');
    }
    if (nutrition.minerals?.potassium > 400) {
      warnings.push('⚠️ 신장질환 주의: 칼륨 함량이 높습니다.');
    }
    if (nutrition.sodium > 500) {
      warnings.push('⚠️ 신장질환 주의: 나트륨 함량이 높습니다.');
    }
  }

  if (conditions.heart_disease) {
    if (nutrition.cholesterol > 100) {
      warnings.push('⚠️ 심장질환 주의: 콜레스테롤이 높습니다.');
    }
    if (nutrition.saturated_fat > 5) {
      warnings.push('⚠️ 심장질환 주의: 포화지방이 높습니다.');
    }
  }

  if (conditions.obesity) {
    if (nutrition.calories > 500) {
      warnings.push('⚠️ 체중관리 주의: 고칼로리 음식입니다 (' + nutrition.calories + 'kcal).');
    }
    if (nutrition.fat > 20) {
      warnings.push('⚠️ 체중관리 주의: 지방 함량이 높습니다.');
    }
  }

  if (conditions.gout) {
    const highPurineWords = ['내장', '곱창', '간', '등심', '갈비', '새우', '조개', '멸치', '정어리'];
    const foodName = analysis.food_name || '';
    const ingredients = analysis.ingredients || [];
    const allText = [foodName, ...ingredients].join(' ').toLowerCase();
    
    if (highPurineWords.some(word => allText.includes(word))) {
      warnings.push('⚠️ 통풍 주의: 퓨린 함량이 높을 수 있는 음식입니다.');
    }
  }

  return warnings;
}

// 시간대별 식사 타입 결정
function getMealTypeByTime(dateTime: Date): string {
  const hour = dateTime.getHours();
  
  if (hour >= 6 && hour < 10) return '아침';
  if (hour >= 11 && hour < 15) return '점심';
  if (hour >= 17 && hour < 21) return '저녁';
  if (hour >= 21 || hour < 2) return '야식';
  return '간식';
}

