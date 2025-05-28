# 직원 구매 장부 시스템 설계 문서

## 1. 시스템 개요

### 1.1 목적
명성약국 직원들이 약국 내 물품을 구매할 때 사용하는 디지털 장부 시스템입니다. 직원들이 물품을 촬영하고 가격을 입력하면, 관리자가 승인하는 워크플로우를 통해 구매를 관리합니다.

### 1.2 핵심 기능
- **직원 인증**: 이름과 비밀번호를 통한 간단한 로그인
- **구매 신청**: 물품 사진 촬영 및 가격 입력
- **승인 워크플로우**: 관리자 승인 프로세스
- **결제 확인**: 오프라인 결제 후 완료 처리
- **통계 및 리포트**: 약국장 전용 전체 현황 조회

### 1.3 사용자 권한 체계
1. **일반 직원**: 구매 신청, 본인 구매 내역 조회
2. **관리자급 직원**: 일반 직원 구매 승인, 본인 구매 신청
3. **약국장**: 모든 구매 승인, 전체 통계 조회, 시스템 관리

## 2. 기술 스택

### 2.1 백엔드
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (물품 이미지)
- **Authentication**: 자체 구현 (Supabase Auth 미사용)
- **API**: Next.js API Routes

### 2.2 프론트엔드
- **Framework**: Next.js 15 (기존 프로젝트 통합)
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Camera**: Web API (MediaDevices)

## 3. 데이터베이스 설계

### 3.1 테이블 구조

#### employees (직원)
```sql
CREATE TABLE employees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('staff', 'manager', 'owner')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_employees_role ON employees(role);
```

#### purchase_requests (구매 요청)
```sql
CREATE TABLE purchase_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id),
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'completed', 'cancelled')),
  image_urls TEXT[], -- Supabase Storage URLs
  request_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES employees(id),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX idx_purchase_requests_employee_id ON purchase_requests(employee_id);
CREATE INDEX idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX idx_purchase_requests_request_date ON purchase_requests(request_date);
```

#### purchase_items (구매 상품 - 선택적)
```sql
-- 향후 확장을 위한 테이블 (MVP에서는 사용하지 않음)
CREATE TABLE purchase_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_name VARCHAR(255),
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2),
  subtotal DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### purchase_logs (구매 로그)
```sql
CREATE TABLE purchase_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_request_id UUID NOT NULL REFERENCES purchase_requests(id),
  action VARCHAR(50) NOT NULL,
  performed_by UUID NOT NULL REFERENCES employees(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  details JSONB
);

-- 인덱스
CREATE INDEX idx_purchase_logs_purchase_request_id ON purchase_logs(purchase_request_id);
CREATE INDEX idx_purchase_logs_performed_by ON purchase_logs(performed_by);
```

### 3.2 보안 및 권한 관리

#### RLS 비활성화
이 시스템은 Row Level Security(RLS)를 사용하지 않습니다. 대신 다음과 같은 방식으로 보안을 관리합니다:

1. **Service Role Key 사용**: 모든 데이터베이스 접근은 Service Role Key를 통해 이루어집니다.
2. **API 레벨 권한 검증**: Next.js API Routes에서 사용자 인증 및 권한을 검증합니다.
3. **클라이언트 직접 접근 차단**: 클라이언트에서는 Supabase에 직접 접근할 수 없습니다.

#### 권한 검증 로직 (API Routes에서 구현)

```typescript
// API Route에서의 권한 검증 예시
async function checkPermission(user: AuthUser, action: string, resource: any) {
  switch (action) {
    case 'VIEW_OWN_REQUESTS':
      return resource.employee_id === user.id;
    
    case 'VIEW_ALL_REQUESTS':
      return ['manager', 'owner'].includes(user.role);
    
    case 'APPROVE_REQUEST':
      // 자신의 요청은 승인할 수 없음
      if (resource.employee_id === user.id) return false;
      // 관리자 요청은 약국장만 승인 가능
      if (resource.employee_role === 'manager') return user.role === 'owner';
      // 일반 직원 요청은 관리자 이상이 승인 가능
      return ['manager', 'owner'].includes(user.role);
    
    case 'VIEW_STATISTICS':
      return user.role === 'owner';
    
    default:
      return false;
  }
}
```

## 4. API 설계

### 4.1 인증 관련

#### POST /api/employee-purchase/auth/login
직원 로그인
```typescript
interface LoginRequest {
  name: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  employee: {
    id: string;
    name: string;
    role: 'staff' | 'manager' | 'owner';
  };
  token: string; // JWT
}
```

#### POST /api/employee-purchase/auth/logout
로그아웃
```typescript
interface LogoutResponse {
  success: boolean;
}
```

### 4.2 구매 요청 관련

#### POST /api/employee-purchase/requests
새 구매 요청 생성
```typescript
interface CreatePurchaseRequest {
  totalAmount: number;
  imageUrls: string[];
  notes?: string;
}

interface CreatePurchaseResponse {
  success: boolean;
  purchaseRequest: {
    id: string;
    status: 'pending';
    requestDate: string;
  };
}
```

#### GET /api/employee-purchase/requests
구매 요청 목록 조회
```typescript
interface GetPurchaseRequestsParams {
  status?: 'pending' | 'approved' | 'completed' | 'cancelled';
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface GetPurchaseRequestsResponse {
  success: boolean;
  requests: PurchaseRequest[];
  total: number;
  page: number;
  totalPages: number;
}
```

#### PUT /api/employee-purchase/requests/:id/approve
구매 요청 승인
```typescript
interface ApproveRequestResponse {
  success: boolean;
  message: string;
}
```

#### PUT /api/employee-purchase/requests/:id/complete
구매 완료 처리
```typescript
interface CompleteRequestResponse {
  success: boolean;
  message: string;
}
```

### 4.3 파일 업로드

#### POST /api/employee-purchase/upload
이미지 업로드
```typescript
interface UploadResponse {
  success: boolean;
  urls: string[];
}
```

### 4.4 통계 및 리포트

#### GET /api/employee-purchase/statistics
전체 통계 조회 (약국장 전용)
```typescript
interface StatisticsParams {
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'week' | 'month';
}

interface StatisticsResponse {
  success: boolean;
  statistics: {
    totalRequests: number;
    totalAmount: number;
    byStatus: {
      pending: number;
      approved: number;
      completed: number;
      cancelled: number;
    };
    byEmployee: Array<{
      employeeId: string;
      employeeName: string;
      totalRequests: number;
      totalAmount: number;
    }>;
    timeline: Array<{
      date: string;
      requests: number;
      amount: number;
    }>;
  };
}
```

## 5. UI/UX 설계

### 5.1 페이지 구조

#### 메인 메뉴 추가
- 기존 메인 화면에 "직원 구매 장부" 메뉴 카드 추가
- 아이콘: 쇼핑 카트 또는 장바구니
- 색상: 보라색 계열 (#9333EA)

#### 로그인 페이지 (/employee-purchase/login)
```
┌─────────────────────────────┐
│      직원 구매 장부         │
│                             │
│  ┌───────────────────────┐  │
│  │ 이름:                 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 비밀번호:             │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │       로그인          │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

#### 구매 신청 페이지 (/employee-purchase/new)
```
┌─────────────────────────────┐
│   새 구매 신청              │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │                       │  │
│  │    📷 사진 촬영       │  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [이미지 미리보기 영역]      │
│                             │
│  총 금액: ₩ [      ]        │
│                             │
│  메모 (선택):               │
│  ┌───────────────────────┐  │
│  │                       │  │
│  └───────────────────────┘  │
│                             │
│  [취소]        [구매 신청]   │
└─────────────────────────────┘
```

#### 승인 대기 목록 (관리자용)
```
┌─────────────────────────────┐
│   승인 대기 구매 요청       │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 김직원 - ₩35,000      │  │
│  │ 2025-05-27 14:30      │  │
│  │ [사진보기] [승인]      │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 박직원 - ₩12,500      │  │
│  │ 2025-05-27 15:45      │  │
│  │ [사진보기] [승인]      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### 5.2 사용자 플로우

#### 일반 직원 플로우
1. 메인 화면 → 직원 구매 장부 클릭
2. 로그인 (이름/비밀번호)
3. 구매 신청 화면
   - 물품 사진 촬영
   - 총 금액 입력
   - 구매 신청
4. 승인 대기 상태 확인
5. 관리자 승인 후 오프라인 결제
6. 완료 확인

#### 관리자 플로우
1. 로그인 후 대시보드
2. 승인 대기 목록 확인
3. 각 요청 검토
   - 사진 확인
   - 금액 확인
4. 승인 처리
5. 오프라인 결제 수령
6. 완료 처리

#### 약국장 플로우
1. 모든 관리자 기능 포함
2. 전체 통계 조회
   - 기간별 구매 현황
   - 직원별 구매 통계
   - 금액 추이 그래프

## 6. 구현 가이드라인

### 6.1 디렉토리 구조
```
app/
├── employee-purchase/
│   ├── page.tsx              # 메인 대시보드
│   ├── login/
│   │   └── page.tsx          # 로그인 페이지
│   ├── new/
│   │   └── page.tsx          # 새 구매 신청
│   ├── requests/
│   │   └── page.tsx          # 구매 요청 목록
│   ├── admin/
│   │   ├── page.tsx          # 관리자 대시보드
│   │   └── statistics/
│   │       └── page.tsx      # 통계 (약국장 전용)
│   └── components/
│       ├── LoginForm.tsx
│       ├── PurchaseForm.tsx
│       ├── RequestList.tsx
│       └── StatisticsChart.tsx
├── api/
│   └── employee-purchase/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── logout/route.ts
│       ├── requests/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── approve/route.ts
│       │       └── complete/route.ts
│       ├── upload/route.ts
│       └── statistics/route.ts
└── lib/
    └── employee-purchase/
        ├── supabase.ts       # Supabase 클라이언트
        ├── auth.ts           # 인증 관련 유틸
        └── types.ts          # TypeScript 타입 정의
```

### 6.2 환경 변수 추가
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://wzoykdmybmrkrahbgyak.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=sbp_e6cf52dd2ddc0d6bf6d89a1211f18236b4fbe1ec

# Supabase Storage
SUPABASE_STORAGE_BUCKET=employee-purchases
```

### 6.3 보안 고려사항
1. **비밀번호**: bcrypt를 사용한 해싱
2. **인증**: JWT 토큰 기반 (httpOnly 쿠키)
3. **파일 업로드**: 이미지 파일만 허용, 크기 제한 (5MB)
4. **권한 검증**: 모든 API에서 사용자 권한 확인
5. **데이터베이스 접근**: Service Role Key를 서버 사이드에서만 사용
6. **클라이언트 보안**: Supabase에 직접 접근 차단, API Routes를 통한 접근만 허용

### 6.4 성능 최적화
1. **이미지 최적화**: 업로드 시 리사이징 (최대 1024px)
2. **페이지네이션**: 목록 조회 시 기본 20개씩
3. **캐싱**: 통계 데이터 5분 캐싱
4. **인덱싱**: 자주 조회되는 컬럼에 인덱스 생성

## 7. 테스트 시나리오

### 7.1 기능 테스트
1. **로그인**: 올바른/잘못된 자격 증명
2. **구매 신청**: 이미지 업로드, 금액 입력
3. **승인 워크플로우**: 권한별 접근 제한
4. **통계 조회**: 데이터 정확성

### 7.2 엣지 케이스
1. 관리자가 자신의 구매 승인 시도 (차단)
2. 약국장만 관리자 구매 승인 가능
3. 동시 승인 처리 방지
4. 네트워크 오류 시 재시도

## 8. 마이그레이션 전략

### 8.1 초기 데이터
```sql
-- 기본 직원 계정 생성
INSERT INTO employees (name, password_hash, role) VALUES
  ('약국장', '$2b$10$...', 'owner'),
  ('관리자1', '$2b$10$...', 'manager'),
  ('직원1', '$2b$10$...', 'staff'),
  ('직원2', '$2b$10$...', 'staff');
```

### 8.2 단계별 배포
1. **Phase 1**: 기본 CRUD 및 워크플로우
2. **Phase 2**: 통계 및 리포트
3. **Phase 3**: 고급 기능 (알림, 반복 구매 등)

## 9. 향후 확장 계획

### 9.1 기능 확장
- 모바일 앱 지원
- 푸시 알림 (승인/완료 시)
- 반복 구매 템플릿
- 예산 관리 기능
- 구매 카테고리 분류

### 9.2 통합 확장
- POS 시스템 연동
- 재고 관리 시스템 연동
- 회계 시스템 자동 연동

---

**문서 작성일**: 2025년 5월 27일  
**작성자**: AI 아키텍트  
**버전**: 1.0.0  
**상태**: 설계 완료, 구현 대기
