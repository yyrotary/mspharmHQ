# 음식 기록 질문 시스템 가이드 🤖

## 📋 개요

기존의 단순한 AI 분석 시스템을 **질문 기반의 대화형 시스템**으로 개선했습니다. 사용자가 음식 사진을 찍으면 AI가 음식 종류를 파악하고, 추가 질문을 통해 정확한 섭취 정보를 수집합니다.

### 🎯 목표
- **80% 정확도**로 빠른 기록
- **섭취량**, **섭취 시간**, **식사 구분** 정보 수집
- 영양 분석과 혈당 흐름 파악을 위한 데이터 구축

---

## 🔄 시스템 플로우

### 1. 기존 플로우 (Before)
```
사진 촬영 → AI 분석 → 즉시 저장 → 완료
```

### 2. 새로운 플로우 (After)
```
사진 촬영 → AI 음식 종류 분석 → 질문 생성 → 사용자 답변 → 최종 계산 → 저장 → 완료
```

---

## 🤖 AI 분석 단계

### 초기 분석 (analyze-with-questions API)
AI가 사진에서 다음 정보를 추출합니다:

```json
{
  "food_name": "김치찌개",
  "food_category": "한식", 
  "confidence": 0.85,
  "estimated_calories_per_100g": 120,
  "nutritional_info": {
    "carbohydrates": 8,
    "protein": 12,
    "fat": 5
  },
  "portion_visible": "전체",
  "needs_clarification": ["언제 먹었는지", "얼마나 먹었는지"]
}
```

### 질문 자동 생성
분석 결과에 따라 다음 질문들이 자동 생성됩니다:

1. **섭취량 질문** (필수)
   - 전부 (100%)
   - 절반 정도 (50%)
   - 1/4 이하 (25%)
   - 조금만 (10%)

2. **섭취 시간 질문** (필수)
   - 방금 전 (현재 시간)
   - 30분 전
   - 1시간 전
   - 2-3시간 전
   - 직접 입력

3. **식사 구분 질문** (자동 추정)
   - 아침/점심/저녁/간식/야식
   - 시간대 기반 기본값 제공

4. **음식명 확인** (신뢰도 낮을 때)
   - AI 분석 결과가 맞는지 확인
   - 틀리면 직접 입력 옵션

---

## 💾 데이터베이스 구조

### 새로운 테이블: `food_analysis_sessions`
질문-답변 프로세스를 관리하는 임시 세션 테이블입니다.

```sql
CREATE TABLE food_analysis_sessions (
    id UUID PRIMARY KEY,
    customer_id UUID REFERENCES customers(id),
    image_url TEXT,
    analysis_result JSONB,  -- AI 분석 결과
    questions JSONB,        -- 생성된 질문들
    user_answers JSONB,     -- 사용자 답변
    status VARCHAR(20),     -- pending_questions, completed, expired
    final_record_id UUID,   -- 최종 음식 기록 ID
    expires_at TIMESTAMP    -- 1시간 후 자동 만료
);
```

### 확장된 `food_records` 테이블
```sql
ALTER TABLE food_records ADD COLUMN
    portion_consumed INTEGER,    -- 섭취량 퍼센트 (0-100)
    actual_calories INTEGER,     -- 실제 섭취 칼로리
    consumed_at TIMESTAMP,       -- 실제 섭취 시간
    user_answers JSONB,          -- 사용자 답변 원본
    nutritional_info JSONB;      -- 상세 영양 정보
```

---

## 🎨 사용자 인터페이스

### 1. 카메라 촬영 화면 업데이트
- 버튼명: "🤖 음식 분석하고 질문 받기"
- 새로운 시스템 안내 추가
- 촬영 팁 개선

### 2. 질문 답변 화면 (신규)
- URL: `/customer/food-diary/questions/[sessionId]`
- 진행률 표시 바
- 단계별 질문 제시
- 질문 미리보기
- 이전/다음 네비게이션

### 3. 결과 화면 업데이트
- 섭취량 정보 표시
- 실제 칼로리 계산 결과
- 상세 영양 정보
- 사용자 답변 요약
- 하루 통계 링크

---

## 📊 칼로리 및 영양소 계산

### 계산 로직
```javascript
// 기본 가정: 1인분 = 150g
const baseCalories = analysisResult.estimated_calories_per_100g;
const estimatedPortionGrams = 150;
const portionPercentage = userAnswer.portion_percentage;

// 실제 섭취 칼로리
const actualCalories = (baseCalories * estimatedPortionGrams * portionPercentage) / 10000;

// 영양소 계산
const nutritionalRatio = (portionPercentage / 100) * (estimatedPortionGrams / 100);
const carbs = originalCarbs * nutritionalRatio;
const protein = originalProtein * nutritionalRatio;
const fat = originalFat * nutritionalRatio;
```

### 예시 계산
- **김치찌개 120kcal/100g**
- **사용자가 절반(50%) 섭취**
- **1인분 가정 150g**

```
실제 칼로리 = (120 × 150 × 50) / 10000 = 90kcal
실제 중량 = 150g × 50% = 75g
```

---

## 🔧 API 엔드포인트

### 1. 음식 분석 및 질문 생성
```
POST /api/customer/food/analyze-with-questions
```

**Request:**
```json
{
  "image": "base64_image_data",
  "customerId": "uuid",
  "capturedAt": "2024-01-15T14:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_uuid",
  "imageUrl": "https://...",
  "analysis": {
    "food_name": "김치찌개",
    "questions": [...],
    "confidence": 0.85
  }
}
```

### 2. 답변 제출 및 최종 저장
```
POST /api/customer/food/submit-answers
```

**Request:**
```json
{
  "sessionId": "session_uuid",
  "customerId": "uuid", 
  "answers": [
    {
      "questionId": "portion",
      "answer": "절반 정도 (50%)",
      "customValue": null
    }
  ]
}
```

### 3. 음식 기록 조회
```
GET /api/customer/food/record?recordId=uuid
```

---

## 📈 분석 가능한 데이터

### 일일 패턴 분석
- 시간대별 섭취 칼로리
- 식사별 영양소 분포
- 섭취량 패턴 (완식률)

### 혈당 흐름 추적
- 탄수화물 섭취 시점
- 식사 간격
- 간식 타이밍

### 영양 균형 평가
- 하루 총 칼로리
- 3대 영양소 비율
- 식사 빈도

---

## 🚀 사용법

### 고객 사용 흐름
1. **사진 촬영**: 음식 사진을 찍거나 갤러리에서 선택
2. **분석 대기**: AI가 음식 종류와 카테고리를 파악 (3-5초)
3. **질문 답변**: 3-4개의 간단한 질문에 답변 (1-2분)
4. **결과 확인**: 최종 기록된 정보 확인 및 수정 가능
5. **완료**: 자동으로 일일 통계에 반영

### 약사 확인 사항
- **고객별 식단 패턴**: 대시보드에서 확인 가능
- **혈당 관련 조언**: 탄수화물 섭취 패턴 기반
- **영양 상담**: 편중된 영양소 섭취 시 알림

---

## ⚠️ 주의사항

### 정확도 한계
- AI 분석은 **참고용**으로만 사용
- 80% 정확도 목표, 완벽하지 않음
- 사용자 답변으로 보완

### 데이터 정리
- 세션은 1시간 후 자동 만료
- 완료된 세션은 7일 후 자동 삭제
- 정기적인 데이터베이스 정리 필요

### 개인정보 보호
- 음식 이미지는 Supabase Storage에 암호화 저장
- 개인 식단 정보는 본인만 접근 가능
- RLS(Row Level Security) 정책 적용

---

## 🔄 향후 개선 계획

### 단기 (1개월)
- [ ] 음성 질문 답변 기능
- [ ] 자주 먹는 음식 학습 기능
- [ ] 배경 기반 장소 추정 (집/외식/직장)

### 중기 (3개월)
- [ ] 개인별 AI 모델 튜닝
- [ ] 영양사 상담 연계
- [ ] 혈당 기기 연동

### 장기 (6개월)
- [ ] 레시피 추천 시스템
- [ ] 가족 구성원 식단 공유
- [ ] 병원 EMR 연동

---

**🏥 명성약국 AI 질문 시스템 v2.0**  
*정확하고 편리한 식단 관리의 새로운 시작*
