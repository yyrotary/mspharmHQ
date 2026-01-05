# 고객 앱 가이드 (Customer App Guide)

## 📱 개요

고객(환자) 전용 모바일 앱으로, 기존 약국 관리 시스템의 데이터베이스를 공유하면서 독립적인 UI/UX를 제공합니다.

## 🎯 주요 기능

### 1. 대시보드 (홈)
- 건강 점수 표시
- 오늘의 목표 (칼로리, 식사, 물)
- 빠른 기록 버튼
- 오늘 먹은 음식 목록
- AI 건강 팁

### 2. 음식 기록
- **카메라 촬영**: 음식 사진 촬영 → AI 분석 → 영양 정보 자동 계산
- **일기 형태**: 날짜별 음식 기록 조회
- **영양 요약**: 일일 탄수화물/단백질/지방/칼로리 합계
- **식사 유형**: 아침/점심/저녁/간식 구분

### 3. 건강 리포트
- **주간/월간 통계**: 평균 영양소 섭취량
- **칼로리 차트**: 일별 칼로리 추이
- **영양소 분석**: 각 영양소별 목표 대비 섭취량
- **영양 알림**: 부족/과잉 영양소 경고
- **AI 권장사항**: 맞춤형 건강 조언

### 4. 상담 내역
- 약국 상담 기록 조회
- AI 요약된 상담 내용
- 처방 약품 목록
- 생활 권장사항

### 5. 생활 기록
- **수면**: 수면 시간, 수면 품질 기록
- **운동**: 운동 종류, 시간 기록
- **복약**: 약 복용 여부 기록
- **물 섭취**: 물 마신 잔 수 기록

### 6. 내 정보
- 프로필 조회
- 건강 정보 관리 (기저 질환 등록)
- PIN 변경
- 알림 설정
- 데이터 내보내기

## 🛠 기술 스택

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Google Gemini API (음식 분석)
- **State**: React Hooks + LocalStorage

## 📂 파일 구조

```
app/customer/
├── layout.tsx              # 앱 레이아웃 (하단 네비게이션)
├── dashboard/
│   └── page.tsx           # 대시보드 (홈)
├── food-diary/
│   ├── page.tsx           # 음식 일기
│   ├── camera/
│   │   └── page.tsx       # 카메라 촬영 & 분석
│   └── history/
│       └── page.tsx       # 전체 기록
├── health-report/
│   └── page.tsx           # 건강 리포트
├── consultations/
│   └── page.tsx           # 상담 목록
├── consultation/
│   └── [id]/
│       └── page.tsx       # 상담 상세
├── lifestyle/
│   └── page.tsx           # 생활 기록
├── profile/
│   └── page.tsx           # 내 정보
├── notifications/
│   └── page.tsx           # 알림 설정
├── login/
│   └── page.tsx           # 로그인
└── change-pin/
    └── page.tsx           # PIN 변경
```

## 🔌 API 엔드포인트

### 음식 관련
- `POST /api/customer/food/analyze-with-questions` - 음식 사진 AI 분석
- `GET /api/customer/food/records` - 음식 기록 조회
- `POST /api/customer/food/records` - 음식 기록 저장

### 영양 분석
- `GET /api/customer/nutrition/stats` - 영양 통계
- `GET /api/customer/nutrition/recommendations` - AI 권장사항

### 생활 기록
- `GET /api/customer/lifestyle` - 생활 기록 조회
- `POST /api/customer/lifestyle` - 생활 기록 저장

### 상담
- `GET /api/customer/consultations` - 상담 목록
- `GET /api/customer/consultations/[id]` - 상담 상세

### 프로필
- `GET /api/customer/profile` - 프로필 조회
- `PUT /api/customer/profile` - 프로필 수정

## 🎨 UI/UX 특징

### 디자인 원칙
1. **모바일 퍼스트**: 최대 너비 제한 (max-w-md)
2. **터치 친화적**: 큰 버튼, 넉넉한 패딩
3. **그라데이션**: 생동감 있는 색상 조합
4. **카드 기반**: 정보 그룹화
5. **원형 프로그레스**: 목표 달성률 시각화

### 색상 팔레트
- **Green**: 음식, 건강 (#22c55e)
- **Blue**: 물, 데이터 (#3b82f6)
- **Purple**: 상담, AI (#8b5cf6)
- **Orange**: 운동, 에너지 (#f97316)
- **Pink**: 복약 (#ec4899)

### 하단 네비게이션
- 홈 | 음식 | 📷 | 건강리포트 | 상담 | 내정보
- 중앙 플로팅 카메라 버튼

## 🚀 실행 방법

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start
```

## 📝 데이터베이스 스키마

`database/customer_app_schema_v2.sql` 파일 참고

### 주요 테이블
- `customers`: 고객 기본 정보 + 건강 정보
- `food_records`: 음식 기록
- `lifestyle_records`: 생활 기록
- `consultations`: 상담 기록
- `consultation_summaries`: AI 상담 요약

## 🔐 인증

- PIN 기반 인증
- LocalStorage에 세션 저장
- 고객 ID로 데이터 필터링

## 📊 건강 점수 계산

```
건강 점수 = (영양 균형 점수 + 식사 규칙성 점수 + 생활 습관 점수) / 3

- 영양 균형: 권장 섭취량 대비 실제 섭취량
- 식사 규칙성: 하루 3끼 여부
- 생활 습관: 수면, 운동, 물 섭취 충족도
```

## 🔄 업데이트 내역

### v1.0.0 (2024-12)
- 초기 릴리즈
- 대시보드, 음식 기록, 건강 리포트
- 상담 내역, 생활 기록, 프로필

## 📞 문의

약국에 직접 문의해 주세요.
