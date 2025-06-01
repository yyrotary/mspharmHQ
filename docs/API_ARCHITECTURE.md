# MSPharmHQ API 아키텍처 문서

## API 아키텍처 개요
MSPharmHQ는 Next.js의 API Routes를 활용한 서버리스 아키텍처를 채택하고 있으며, 각 기능별로 모듈화된 API 엔드포인트를 제공합니다.

## API 디렉토리 구조
```
app/api/
├── bandapi/          # 밴드 API 연동
├── consultation/     # 상담 관리 API
├── customer/         # 고객 관리 API
├── daily-income/     # 수입/지출 관리 API
├── extract-invoice/  # 영수증 데이터 추출 API
├── face-embedding/   # 얼굴 인식 임베딩 API
├── gemini/          # Google Gemini AI API
├── gemini-test/     # Gemini API 테스트
├── google-drive/    # Google Drive 파일 저장 API
├── master/          # 마스터 데이터 관리 API
├── recognize-medicine/ # 약품 인식 API
└── notion.ts        # Notion API 통합 모듈
```

## 주요 API 모듈 상세

### 1. Notion API 통합 모듈 (`notion.ts`)
- **목적**: 노션을 백엔드 데이터베이스로 활용하여 재무 데이터 관리
- **주요 기능**:
  - 일일 수입/지출 데이터 CRUD
  - 월별, 기간별 데이터 조회
  - 통계 계산 및 집계
  - 메모리 캐싱으로 성능 최적화
- **데이터 구조**:
  - `cas5`: 현금 5만원권 수입
  - `cas1`: 현금 1만원권 수입
  - `gif`: 상품권 수입
  - `car1`, `car2`: 카드 수입
  - `person`: 인건비 지출
  - `Pos`: POS 시스템 매출

### 2. 고객 관리 API (`/api/customer`)
- **엔드포인트**:
  - `GET /api/customer`: 고객 목록 조회
  - `GET /api/customer/[id]`: 특정 고객 조회
  - `POST /api/customer`: 신규 고객 등록
  - `PUT /api/customer/[id]`: 고객 정보 수정
  - `DELETE /api/customer/[id]`: 고객 삭제
- **데이터 모델**:
  ```typescript
  interface Customer {
    id: string;
    name: string;
    phone: string;
    birthDate?: string;
    registeredDate: string;
    lastVisitDate?: string;
    faceEmbedding?: number[];
    notes?: string;
  }
  ```

### 3. 상담 관리 API (`/api/consultation`)
- **엔드포인트**:
  - `POST /api/consultation`: 상담 기록 저장
  - `GET /api/consultation`: 상담 내역 조회
  - `GET /api/consultation/[id]`: 특정 상담 조회
  - `PUT /api/consultation/[id]`: 상담 내용 수정
- **데이터 모델**:
  ```typescript
  interface Consultation {
    id: string;
    customerId: string;
    consultDate: string;
    symptoms: string;
    prescription: string;
    result: string;
    imageIds?: string[];
    createdAt: string;
    updatedAt: string;
  }
  ```

### 4. 수입/지출 관리 API (`/api/daily-income`)
- **엔드포인트**:
  - `GET /api/daily-income?date=YYYY-MM-DD`: 특정일 데이터 조회
  - `POST /api/daily-income`: 일일 데이터 저장/수정
  - `GET /api/daily-income/monthly?month=YYYY-MM`: 월별 데이터 조회
  - `GET /api/daily-income/stats`: 통계 조회
- **노션 데이터베이스 연동**

### 5. AI 통합 API

#### 5.1 영수증 인식 (`/api/extract-invoice`)
- **기능**: AI를 활용한 영수증 이미지에서 데이터 추출
- **사용 AI**: Google Gemini Vision API
- **응답 형식**:
  ```typescript
  interface InvoiceData {
    storeName: string;
    date: string;
    totalAmount: number;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  }
  ```

#### 5.2 약품 인식 (`/api/recognize-medicine`)
- **기능**: 약품 이미지에서 약품명 및 정보 추출
- **사용 AI**: Google Gemini Vision API
- **응답 형식**:
  ```typescript
  interface MedicineInfo {
    name: string;
    manufacturer: string;
    ingredients?: string[];
    usage?: string;
    warnings?: string;
  }
  ```

#### 5.3 얼굴 인식 임베딩 (`/api/face-embedding`)
- **기능**: 고객 얼굴 인식을 위한 임베딩 벡터 생성
- **사용 기술**: TensorFlow.js (BlazeFace, Face Landmarks Detection)
- **프로세스**:
  1. 얼굴 감지 (BlazeFace)
  2. 랜드마크 추출
  3. 임베딩 벡터 생성
  4. 고객 매칭

### 6. 외부 서비스 연동 API

#### 6.1 Supabase Storage API ⭐ **업데이트됨**
- **기능**: 이미지 및 파일 저장 (Google Drive 대체)
- **엔드포인트**:
  - `POST /api/consultation-v2`: 상담 등록 시 이미지 업로드
  - `PUT /api/consultation-v2`: 상담 수정 시 이미지 업로드
  - `DELETE /api/consultation-v2`: 상담 삭제 시 이미지 삭제
- **인증**: Supabase Service Role Key
- **폴더 구조**: customer_code 기반 직관적 구조
  ```
  consultation-images/
  ├── 00001/                    # 고객 코드
  │   ├── 00001_001/            # 상담 ID
  │   │   ├── image_1.jpg       # 이미지 파일
  │   │   └── image_2.jpg
  │   └── 00001_002/
  │       └── image_1.jpg
  └── 00002/
      └── 00002_001/
          └── image_1.jpg
  ```
- **응답**: 공개 URL, 파일 경로

#### 6.2 이미지 업로드 함수 ⭐ **업데이트됨**
```typescript
// app/lib/consultation-utils.ts
export async function uploadConsultationImages(
  customerCode: string,        // UUID → customer_code 변경
  consultationId: string,
  imageDataArray: string[]
): Promise<string[]> {
  const uploadPromises = imageDataArray.map(async (imageData, index) => {
    // Base64 데이터 처리
    const base64Data = imageData.includes(';base64,')
      ? imageData.split(';base64,')[1]
      : imageData;

    const buffer = Buffer.from(base64Data, 'base64');

    // customer_code 기반 파일 경로 생성
    const filePath = generateConsultationImagePath(
      customerCode,
      consultationId,
      index + 1
    );

    // Supabase Storage에 업로드
    const { data, error } = await supabase.storage
      .from('consultation-images')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;

    // 공개 URL 생성
    const { data: publicUrl } = supabase.storage
      .from('consultation-images')
      .getPublicUrl(filePath);

    return publicUrl.publicUrl;
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null) as string[];
}

// 파일 경로 생성 함수
export function generateConsultationImagePath(
  customerCode: string,        // UUID → customer_code 변경
  consultationId: string,
  imageIndex: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerCode}/${consultationId}/image_${imageIndex}.${fileExtension}`;
}
```

#### 6.3 API 변경사항 ⭐ **업데이트됨**
- **PUT/DELETE 메서드**: customers 테이블 JOIN으로 customer_code 조회
- **이미지 경로**: `{customerCode}/{consultationId}/image_{index}.jpg`
- **성능 개선**: URL 길이 단축 (약 30자 절약)
- **관리 편의성**: 직관적인 폴더 구조로 백업/복구 용이

#### ~~6.1 Google Drive API (`/api/google-drive`)~~ ❌ **제거됨**
- ~~**기능**: 이미지 및 파일 저장~~
- ~~**엔드포인트**:~~
  - ~~`POST /api/google-drive`: 파일 업로드~~
  - ~~`GET /api/google-drive/[fileId]`: 파일 조회~~
- ~~**인증**: 서비스 계정 인증~~
- ~~**응답**: 파일 ID, 보기 URL, 다운로드 URL~~

#### 6.2 Gemini API (`/api/gemini`)
- **기능**: Google의 생성형 AI 활용
- **사용 사례**:
  - 텍스트 분석
  - 이미지 인식
  - 자연어 처리
- **모델**: Gemini Pro, Gemini Pro Vision

### 7. 마스터 데이터 API (`/api/master`)
- **기능**: 약품, 카테고리 등 마스터 데이터 관리
- **데이터 유형**:
  - 약품 마스터
  - 증상 카테고리
  - 보험 코드
  - 가격 정보

## API 보안 및 인증

### 1. 환경 변수 관리
```env
# Notion API
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CLIENT_EMAIL=your_client_email
GOOGLE_CLOUD_PRIVATE_KEY=your_private_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 2. API 보안 모범 사례
- 환경 변수를 통한 민감 정보 관리
- API 키 노출 방지
- CORS 설정
- Rate Limiting (필요시)
- 입력 검증 및 sanitization

## 에러 처리

### 1. 표준 에러 응답 형식
```typescript
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}
```

### 2. 에러 코드 체계
- 400: Bad Request - 잘못된 요청
- 401: Unauthorized - 인증 실패
- 404: Not Found - 리소스 없음
- 429: Too Many Requests - 요청 제한 초과
- 500: Internal Server Error - 서버 오류

## 성능 최적화

### 1. 캐싱 전략
- 메모리 캐시: 1분간 API 응답 캐싱
- 노션 API 호출 최소화
- 정적 데이터 CDN 활용

### 2. 비동기 처리
- Promise.all을 활용한 병렬 처리
- 스트리밍 응답 (대용량 데이터)
- 백그라운드 작업 큐

### 3. 재시도 메커니즘
```typescript
async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>, 
  maxRetries = 3
): Promise<T>
```

## API 테스트

### 1. 단위 테스트
- Jest를 활용한 API 로직 테스트
- Mock 데이터 활용

### 2. 통합 테스트
- Postman/Insomnia 활용
- API 엔드포인트 테스트
- 시나리오 기반 테스트

### 3. 부하 테스트
- 동시 사용자 처리 능력
- 응답 시간 측정
- 리소스 사용량 모니터링

## 모니터링 및 로깅

### 1. 로깅 전략
- 요청/응답 로깅
- 에러 로깅
- 성능 메트릭 로깅

### 2. 모니터링 도구
- Vercel Analytics (프로덕션)
- Console 로깅 (개발)
- 커스텀 대시보드

## 향후 개선 계획

### 1. GraphQL 도입 검토
- 유연한 데이터 쿼리
- 오버페칭 방지
- 타입 안정성 향상

### 2. WebSocket 지원
- 실시간 알림
- 라이브 데이터 업데이트
- 채팅 기능

### 3. API Gateway 도입
- 중앙 집중식 관리
- 인증/인가 통합
- API 버전 관리

### 4. 마이크로서비스 전환
- 기능별 독립 배포
- 확장성 향상
- 장애 격리

## 직원 구매 장부 시스템 API

### 인증 API
- `POST /api/employee-purchase/auth/login` - 직원 로그인
- `POST /api/employee-purchase/auth/logout` - 로그아웃
- `GET /api/employee-purchase/auth/me` - 현재 사용자 정보

### 구매 요청 API
- `GET /api/employee-purchase/requests` - 구매 요청 목록 조회 (권한별 접근)
- `POST /api/employee-purchase/requests` - 새 구매 요청 생성
- `POST /api/employee-purchase/requests/[id]/approve` - 구매 요청 승인
- `POST /api/employee-purchase/requests/[id]/reject` - 구매 요청 거부

### 파일 업로드 API
- `POST /api/employee-purchase/upload` - 이미지 파일 업로드

## 구매 요청 조회 API 상세

### 엔드포인트: `GET /api/employee-purchase/requests`

**권한별 접근 제어**:

#### 1. 개인 구매내역 조회 (기본)
**URL**: `/api/employee-purchase/requests`
**권한**: 모든 사용자 (staff, manager, owner)
**반환 데이터**: 요청자 본인의 구매 요청만

```javascript
// 예시 요청
GET /api/employee-purchase/requests

// 응답 (manager123이 요청한 경우)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "total_amount": 33233,
      "status": "pending",
      "employee": { "name": "manager123" }
      // 본인의 요청만 반환
    }
  ]
}
```

#### 2. 승인관리용 전체 조회 (관리자)
**URL**: `/api/employee-purchase/requests?admin=true`
**권한**: manager, owner만
**반환 데이터**: 모든 직원의 구매 요청

```javascript
// 예시 요청
GET /api/employee-purchase/requests?admin=true

// 응답 (manager123이 요청한 경우)
{
  "success": true,
  "data": [
    {
      "id": "uuid1",
      "total_amount": 33233,
      "status": "pending",
      "employee": { "name": "manager123" }
    },
    {
      "id": "uuid2", 
      "total_amount": 200000,
      "status": "pending",
      "employee": { "name": "staff123" }
    },
    {
      "id": "uuid3",
      "total_amount": 111111,
      "status": "pending", 
      "employee": { "name": "staff456" }
    }
    // 모든 직원의 요청 반환
  ]
}
```

**권한 검증**:
- `admin=true` 파라미터가 있을 때 사용자 권한 확인
- staff 권한으로는 admin=true 접근 불가
- manager/owner만 모든 구매 요청 조회 가능

### 쿼리 파라미터
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 10)
- `status`: 상태 필터 (pending, approved, rejected)
- `admin`: 관리자 모드 (true/false, manager/owner만)

### 응답 데이터 구조
```typescript
interface PurchaseRequest {
  id: string;
  employee_id: string;
  total_amount: number;
  notes?: string;
  image_urls: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  employee: {
    id: string;
    name: string;
    role: string;
  };
}
```

## 새로 추가된 승인 관리 API

### 구매 요청 승인 API
**엔드포인트**: `POST /api/employee-purchase/requests/[id]/approve`

**권한**: manager, owner

**기능**: 대기 중인 구매 요청을 승인합니다.

**내부 통제 규칙**: 
- ❌ 본인의 구매 요청은 승인할 수 없음
- ✅ 다른 직원의 구매 요청만 승인 가능

**응답**:
```json
// 성공 시
{
  "message": "Request approved successfully",
  "request": {
    "id": "request_id",
    "status": "approved",
    "approved_by": "approver_id",
    "approved_at": "2025-05-28T02:30:00Z"
  }
}

// 본인 요청 승인 시도 시
{
  "error": "Cannot approve your own purchase request"
}
```

### 구매 요청 거부 API
**엔드포인트**: `POST /api/employee-purchase/requests/[id]/reject`

**권한**: manager, owner

**기능**: 대기 중인 구매 요청을 거부합니다.

**내부 통제 규칙**: 
- ❌ 본인의 구매 요청은 거부할 수 없음
- ✅ 다른 직원의 구매 요청만 거부 가능

**응답**:
```json
// 성공 시
{
  "message": "Request rejected successfully", 
  "request": {
    "id": "request_id",
    "status": "rejected",
    "approved_by": "approver_id",
    "approved_at": "2025-05-28T02:30:00Z"
  }
}

// 본인 요청 거부 시도 시
{
  "error": "Cannot reject your own purchase request"
}
```

## 보안 고려사항

1. **권한별 데이터 접근 제어**
   - 일반 직원: 본인 데이터만 접근
   - 관리자/약국장: 승인관리 시에만 전체 데이터 접근

2. **API 레벨 권한 검증**
   - 모든 요청에서 JWT 토큰 검증
   - 권한별 접근 제어 로직 적용

3. **내부 통제 (Internal Control)**
   - 본인의 구매 요청은 본인이 승인/거부할 수 없음
   - 승인관리 페이지에서 본인 요청에 대한 버튼 비활성화
   - API 레벨에서 본인 요청 승인/거부 시도 시 403 에러 반환

## 마스터 로그인 시스템 API

### 인증 API

#### 마스터 로그인 및 권한 확인
**엔드포인트**: `POST /api/employee-purchase/auth/me`

**기능**: 마스터 로그인 요청을 처리하고 owner 권한을 확인합니다.

**주의**: 기존 직원 구매 시스템의 `/api/employee-purchase/auth/me` 엔드포인트를 공유하여 사용합니다.

**요청 바디**:
```json
{
  "name": "이자영",
  "password": "1234"
}
```

**권한 검증**:
- Supabase의 employee 테이블에서 사용자 확인
- bcrypt로 비밀번호 검증
- role이 'owner'인지 확인

**응답**:
```json
// 성공 시 (owner 권한)
{
  "success": true,
  "user": {
    "id": "user_id",
    "name": "이자영",
    "role": "owner"
  }
}

// 실패 시 (owner 권한 없음)
{
  "error": "Unauthorized",
  "message": "마스터 권한이 없습니다."
}
```

### 마스터 대시보드 접근 제어

**페이지**: `/master-dashboard`

**접근 제어**:
1. 클라이언트 측에서 JWT 토큰 확인
2. `/api/employee-purchase/auth/me`로 사용자 정보 확인
3. role이 'owner'가 아니면 마스터 로그인 페이지로 리다이렉트

### 보안 고려사항

1. **권한 분리**: 직원 구매 시스템과 마스터 시스템의 권한 체계 공유
2. **세션 관리**: 같은 JWT 토큰 및 쿠키 사용
3. **API 재사용**: 기존 employee-purchase API를 활용하여 개발 효율성 향상
