# MSPharmHQ 시스템 아키텍처 및 데이터 플로우

## 시스템 아키텍처 개요

MSPharmHQ는 Next.js 기반의 풀스택 웹 애플리케이션으로, 서버리스 아키텍처와 외부 서비스 통합을 통해 약국 운영의 디지털 전환을 실현합니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   React     │  │  Tailwind   │  │ TensorFlow  │            │
│  │ Components  │  │     CSS     │  │     .js     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Routes (Next.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Customer   │  │Consultation │  │   Income    │            │
│  │     API     │  │     API     │  │     API     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Notion API    │ │ Google Drive API│ │    AI APIs      │
│   (Database)    │ │    (Storage)    │ │(Gemini, Claude) │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## 주요 데이터 플로우

### 1. 고객 상담 플로우

```
사용자 입력
    │
    ▼
고객 검색/선택
    │
    ├─→ 기존 고객 ─→ 고객 정보 조회 (Notion)
    │
    └─→ 신규 고객 ─→ 얼굴 인식 등록
                         │
                         ▼
                    얼굴 임베딩 생성
                    (TensorFlow.js)
                         │
                         ▼
                    고객 정보 저장
                      (Notion)
    │
    ▼
상담 내용 입력
    │
    ├─→ 호소증상
    ├─→ 처방약
    ├─→ 결과
    └─→ 증상 이미지
           │
           ▼
      이미지 업로드
     (Google Drive)
           │
           ▼
    상담 내역 저장
      (Notion)
```

### 2. 고객 인식 플로우

```
카메라 활성화
    │
    ▼
실시간 얼굴 감지
(TensorFlow.js - BlazeFace)
    │
    ▼
얼굴 랜드마크 추출
(Face Landmarks Detection)
    │
    ▼
임베딩 벡터 생성
    │
    ▼
기존 고객 DB와 매칭
(벡터 유사도 계산)
    │
    ├─→ 매칭 성공 ─→ 고객 정보 표시
    │
    └─→ 매칭 실패 ─→ 수동 검색 제안
```

### 3. 수입/지출 관리 플로우

```
날짜 선택
    │
    ▼
기존 데이터 조회
(Notion API - getDailyIncome)
    │
    ├─→ 데이터 있음 ─→ 기존 데이터 표시
    │
    └─→ 데이터 없음 ─→ 빈 폼 표시
    │
    ▼
데이터 입력/수정
    │
    ├─→ 현금 수입 (cas5, cas1)
    ├─→ 상품권 수입 (gif)
    ├─→ 카드 수입 (car1, car2)
    ├─→ 인건비 지출 (person)
    └─→ POS 매출 (Pos)
    │
    ▼
자동 계산
    │
    ├─→ 총 수입 = cas5 + cas1 + gif + car1 + car2
    ├─→ 순이익 = 총 수입 - person
    └─→ 차액 = 순이익 - Pos
    │
    ▼
데이터 저장
(Notion API - saveDailyIncome)
```

### 4. 영수증 스캔 플로우

```
영수증 촬영/업로드
    │
    ▼
이미지 전처리
    │
    ▼
AI 분석 요청
(Gemini Vision API)
    │
    ▼
데이터 추출
    │
    ├─→ 매장명
    ├─→ 날짜
    ├─→ 품목 리스트
    └─→ 총액
    │
    ▼
추출 데이터 검증
    │
    ▼
수입/지출 데이터 자동 입력
```

### 5. 월별 통계 플로우

```
년월 선택
    │
    ▼
월별 데이터 조회
(Notion API - getMonthlyIncome)
    │
    ▼
통계 계산
(calculateStats)
    │
    ├─→ 일별 데이터 집계
    ├─→ 총계 계산
    ├─→ 평균 계산
    └─→ 최대/최소값 추출
    │
    ▼
차트 데이터 생성
    │
    ├─→ 일별 추이 그래프
    └─→ 카테고리별 원형 차트
    │
    ▼
### 6. 마스터 로그인 및 접근 플로우

```
메인 페이지 상단 마스터 로그인 버튼
    │
    ▼
마스터 로그인 페이지
    │
    ├─→ 이름 입력
    ├─→ 4자리 비밀번호 입력
    └─→ 로그인 요청
           │
           ▼
Supabase employee 테이블 조회
    │
    ├─→ bcrypt 비밀번호 검증
    └─→ owner 권한 확인
           │
           ├─→ 성공 ─→ JWT 토큰 발급 ─→ 마스터 대시보드
           │                                  │
           │                                  ├─→ 수입/지출 관리
           │                                  ├─→ 월별 통계
           │                                  └─→ 직원 구매 관리
           │
           └─→ 실패 ─→ 에러 메시지 표시
```

### 7. 직원 구매 승인 플로우

```
직원 구매 신청
    │
    ▼
Supabase purchase_requests 테이블 저장
    │
    ├─→ 영수증 이미지 → Supabase Storage
    └─→ 상태: pending
           │
           ▼
관리자/약국장 승인 페이지
    │
    ├─→ 대기 중 요청 목록 표시
    └─→ 승인/거부 버튼
           │
           ├─→ 승인 ─→ 상태: approved
           │            │
           │            └─→ approved_by, approved_at 기록
           │
           └─→ 거부 ─→ 상태: rejected
                        │
                        └─→ approved_by, approved_at 기록
```

## 데이터 모델

### 1. 고객 (Customer)
```typescript
interface Customer {
  id: string;                  // 고유 식별자
  name: string;                // 이름
  phone: string;               // 전화번호
  birthDate?: string;          // 생년월일
  registeredDate: string;      // 등록일
  lastVisitDate?: string;      // 마지막 방문일
  faceEmbedding?: number[];    // 얼굴 인식 임베딩 벡터
  notes?: string;              // 메모
}
```

### 2. 상담 (Consultation)
```typescript
interface Consultation {
  id: string;                  // 고유 식별자
  customerId: string;          // 고객 ID (relation)
  consultDate: string;         // 상담 날짜
  symptoms: string;            // 호소증상
  prescription: string;        // 처방약
  result: string;              // 결과
  imageIds?: string[];         // 증상 이미지 ID 배열
  createdAt: string;           // 생성일시
  updatedAt: string;           // 수정일시
}
```

### 3. 일일 수입/지출 (DailyIncome)
```typescript
interface DailyIncome {
  날짜: string;                // YYYY-MM-DD
  cas5: number;                // 현금 5만원권
  cas1: number;                // 현금 1만원권
  gif: number;                 // 상품권
  car1: number;                // 카드1
  car2: number;                // 카드2
  person: number;              // 인건비
  Pos: number;                 // POS 매출
  // 계산 필드 (자동)
  총수입: number;              // cas5 + cas1 + gif + car1 + car2
  순이익: number;              // 총수입 - person
  차액: number;                // 순이익 - Pos
}
```

### 4. 직원 (Employee)
```typescript
interface Employee {
  id: string;                  // UUID
  name: string;                // 직원명
  password_hash: string;       // bcrypt 암호화된 비밀번호
  role: 'staff' | 'manager' | 'owner'; // 권한
  created_at: string;          // 생성일
  last_login: string | null;   // 마지막 로그인
}
```

### 5. 구매 요청 (PurchaseRequest)
```typescript
interface PurchaseRequest {
  id: string;                  // UUID
  employee_id: string;         // 직원 ID
  total_amount: number;        // 총 금액
  notes?: string;              // 메모
  image_urls: string[];        // 영수증 이미지 URL
  status: 'pending' | 'approved' | 'rejected'; // 상태
  created_at: string;          // 신청일
  approved_by: string | null;  // 승인자 ID
  approved_at: string | null;  // 승인일
}
```

## 보안 및 데이터 보호

### 1. 데이터 보안
- **암호화**: HTTPS를 통한 모든 통신 암호화
- **인증**: API 키를 통한 외부 서비스 인증
- **환경 변수**: 민감한 정보는 환경 변수로 관리
- **접근 제어**: 각 API별 권한 검증

### 2. 인증 및 권한 관리
- **마스터 시스템**: owner 권한만 수입/지출 관리 접근
- **직원 구매**: JWT 기반 인증, 권한별 접근 제어
- **비밀번호**: bcrypt를 통한 안전한 암호화
- **세션 관리**: 쿠키 및 JWT 토큰 활용

### 3. 개인정보 보호
- **최소 수집**: 필요한 최소한의 정보만 수집
- **얼굴 데이터**: 임베딩 벡터만 저장 (원본 이미지 미저장)
- **데이터 격리**: 고객별 데이터 격리 저장
- **삭제 정책**: 요청 시 즉시 삭제 가능

### 4. 백업 및 복구
- **Notion 백업**: Notion의 자동 백업 기능 활용
- **Google Drive**: 이미지 파일 자동 백업
- **Supabase**: 직원 구매 데이터 자동 백업
- **로컬 캐시**: 일시적 오프라인 지원

## 성능 최적화 전략

### 1. 프론트엔드 최적화
- **이미지 최적화**: Next.js Image 컴포넌트 활용
- **코드 스플리팅**: 동적 import로 번들 크기 최소화
- **캐싱**: 정적 자산 브라우저 캐싱
- **lazy loading**: 컴포넌트 지연 로딩

### 2. API 최적화
- **메모리 캐시**: 1분간 API 응답 캐싱
- **배치 처리**: 다중 요청 배치 처리
- **페이지네이션**: 대량 데이터 페이지 단위 처리
- **병렬 처리**: Promise.all 활용

### 3. 데이터베이스 최적화
- **인덱싱**: Notion 데이터베이스 속성 인덱싱
- **필터링**: 서버 사이드 필터링으로 데이터 전송량 최소화
- **압축**: 이미지 압축 후 저장

## 확장성 및 유지보수

### 1. 모듈화
- **기능별 분리**: 각 기능을 독립적인 모듈로 구성
- **재사용성**: 공통 컴포넌트 및 유틸리티 함수
- **테스트 용이성**: 단위 테스트 가능한 구조

### 2. 확장 가능성
- **플러그인 구조**: 새로운 기능 쉽게 추가 가능
- **API 버전관리**: 하위 호환성 유지
- **다국어 지원**: i18n 구조 준비

### 3. 모니터링
- **에러 추적**: 에러 로깅 및 알림
- **성능 모니터링**: 응답 시간 및 리소스 사용량
- **사용자 분석**: 사용 패턴 분석

## 향후 로드맵

### Phase 1 (현재 - 완료)
- ✅ 기본 고객 관리
- ✅ 상담 기록 관리
- ✅ 수입/지출 관리 (마스터 전용)
- ✅ 얼굴 인식 기능
- ✅ AI 통합 (영수증, 약품 인식)
- ✅ 직원 구매 장부 시스템
- ✅ 마스터 로그인 시스템

### Phase 2 (계획)
- 재고 관리 시스템
- 처방전 관리
- 보험 청구 자동화
- 고객 알림 시스템
- 모바일 앱 개발

### Phase 3 (장기)
- 약물 상호작용 검사
- 건강 상담 AI 어시스턴트
- 다중 지점 관리
- 의료진 협업 도구
- 빅데이터 분석 대시보드
