# 영양 분석 시스템 가이드

## 개요

이 시스템은 Gemini AI를 활용하여 환자의 음식 사진을 분석하고, 영양 정보를 추출하여 약사 상담에 활용할 수 있도록 합니다.

## 주요 기능

### 1. 음식 사진 영양 분석
- **API**: `POST /api/customer/nutrition/analyze`
- 음식 사진에서 자동으로 영양소 추출
- 기본 영양소: 칼로리, 탄수화물, 단백질, 지방, 나트륨, 당류, 식이섬유
- 확장 영양소: 콜레스테롤, 포화지방, 비타민, 미네랄
- 혈당지수(GI) 분석

### 2. 환자 맞춤 경고
환자의 `special_notes` 필드에 기록된 질환 정보를 기반으로 자동 경고 생성:
- **당뇨 환자**: 고당류/고탄수화물 음식 경고
- **고혈압 환자**: 고나트륨 음식 경고
- **신장질환 환자**: 단백질/칼륨/나트륨 주의
- **심장질환 환자**: 콜레스테롤/포화지방 주의
- **비만 환자**: 고칼로리 음식 경고
- **통풍 환자**: 퓨린 함량 높은 음식 경고

### 3. 영양 통계
- **API**: `GET /api/customer/nutrition/stats`
- 일일, 주간, 월간 영양 섭취 통계
- 영양소별 권장량 대비 섭취율
- 건강 점수 계산
- 식사 패턴 분석

### 4. AI 맞춤 권장사항
- **API**: `GET /api/customer/nutrition/recommendations`
- 환자 상담 기록과 식사 패턴 분석
- 질환별 맞춤 식단 조언
- 영양소 개선 권고
- 추천 식단 제안

### 5. 상담 노트용 영양 요약
- **API**: `GET /api/customer/nutrition/summary`
- 상담 시 바로 사용할 수 있는 텍스트 요약
- HTML, JSON, 텍스트 포맷 지원

## API 사용법

### 음식 사진 분석
```javascript
const response = await fetch('/api/customer/nutrition/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64ImageData,
    customerId: 'customer-uuid',
    mealType: '점심', // 선택사항
    consumedAt: new Date().toISOString() // 선택사항
  })
});

const { success, recordId, analysis, imageUrl } = await response.json();
```

### 영양 통계 조회
```javascript
const response = await fetch(
  `/api/customer/nutrition/stats?customerId=${customerId}&period=week`
);

const { 
  dailyStats,      // 일별 상세 통계
  periodStats,     // 기간 평균 통계
  nutritionWarnings, // 경고 메시지
  eatingPatterns,  // 식습관 패턴
  recommendations  // 개선 권장사항
} = await response.json();
```

### 맞춤 권장사항 조회
```javascript
const response = await fetch(
  `/api/customer/nutrition/recommendations?customerId=${customerId}`
);

const { 
  nutritionSummary,  // 영양 요약
  recommendations    // AI 생성 권장사항
} = await response.json();
```

### 상담 노트용 요약
```javascript
// 텍스트 형식
const response = await fetch(
  `/api/customer/nutrition/summary?customerId=${customerId}&days=7&format=text`
);

// HTML 형식 (상담 노트에 삽입용)
const response = await fetch(
  `/api/customer/nutrition/summary?customerId=${customerId}&days=7&format=html`
);
```

## 프론트엔드 컴포넌트

### 약사용 영양 분석 패널
```tsx
import NutritionAnalysisPanel from '@/app/components/NutritionAnalysisPanel';

// 상담 페이지에서 사용
<NutritionAnalysisPanel 
  customerId={customer.id} 
  customerName={customer.name} 
/>
```

### 환자용 영양 통계 페이지
- URL: `/customer/food-diary/stats`
- 일일/주간/월간 영양 통계 확인
- 건강 점수 및 영양소 섭취 현황
- AI 맞춤 조언 확인

## 데이터베이스

### 테이블 구조

#### food_records
```sql
- id: UUID (PK)
- customer_id: UUID (FK -> customers)
- food_name: VARCHAR
- food_category: VARCHAR
- image_url: TEXT
- confidence_score: DECIMAL
- gemini_analysis: JSONB (AI 분석 원본)
- nutritional_info: JSONB (상세 영양 정보)
- actual_calories: INTEGER
- portion_consumed: INTEGER (0-100)
- recorded_date: DATE
- recorded_time: TIME
- meal_type: VARCHAR
- consumed_at: TIMESTAMP
```

#### nutritional_info JSONB 구조
```json
{
  "calories": 350,
  "carbohydrates": 45,
  "protein": 20,
  "fat": 12,
  "fiber": 5,
  "sodium": 800,
  "sugar": 8,
  "cholesterol": 50,
  "saturated_fat": 3,
  "vitamins": {"a": 100, "c": 15, "d": 2},
  "minerals": {"calcium": 80, "iron": 3, "potassium": 350},
  "gi_index": "중",
  "health_benefits": ["단백질 풍부"],
  "health_warnings": ["나트륨 주의"],
  "patient_specific_warnings": ["당뇨 환자: 탄수화물 주의"],
  "diabetes_friendly": true,
  "hypertension_friendly": false
}
```

### 스키마 적용
```bash
# Supabase SQL Editor에서 실행
database/nutrition_analysis_schema.sql
```

## 환자 질환 등록

환자의 `special_notes` 필드에 다음 키워드를 포함하면 자동으로 맞춤 경고가 생성됩니다:

| 질환 | 키워드 |
|------|--------|
| 당뇨 | 당뇨, 혈당, diabetes |
| 고혈압 | 고혈압, 혈압, hypertension |
| 신장질환 | 신장, kidney, 신부전, 투석 |
| 심장질환 | 심장, heart, 심혈관, 협심증 |
| 비만 | 비만, obesity, 체중관리, 다이어트 |
| 통풍 | 통풍, gout, 요산 |

## 권장 섭취량 기준

| 영양소 | 일일 권장량 |
|--------|------------|
| 칼로리 | 2,000 kcal |
| 탄수화물 | 300g |
| 단백질 | 65g |
| 지방 | 65g |
| 식이섬유 | 25g |
| 나트륨 | 2,000mg 이하 |
| 당류 | 50g 이하 |
| 콜레스테롤 | 300mg 이하 |
| 포화지방 | 20g 이하 |

## 상담 페이지 연동

상담 페이지에서 영양 분석 패널을 사용하려면:

1. `NutritionAnalysisPanel` 컴포넌트 import
2. 고객 선택 후 패널에 customerId 전달
3. "영양 분석 요약 복사" 버튼으로 상담 노트에 붙여넣기

```tsx
// consultation/page.tsx
import NutritionAnalysisPanel from '@/app/components/NutritionAnalysisPanel';

// 고객 선택 후
{customer && (
  <NutritionAnalysisPanel 
    customerId={customer.id} 
    customerName={customer.name} 
  />
)}
```

## 환자 앱 사용법

1. **로그인**: PIN 코드로 로그인
2. **음식 촬영**: 카메라로 음식 사진 촬영
3. **AI 분석**: 자동으로 영양 정보 분석
4. **기록 확인**: 식사 기록 및 영양 통계 확인
5. **권장사항**: AI 맞춤 영양 조언 확인

## 트러블슈팅

### Gemini API 오류
- GEMINI_API_KEY 환경변수 확인
- API 할당량 확인

### 이미지 업로드 오류
- Supabase Storage 'food-images' 버킷 생성 확인
- 버킷 공개 설정 확인

### 영양 데이터 없음
- food_records 테이블 데이터 확인
- customer_id 연결 확인

