# 상담 관리 시스템 Supabase 백업 설계 문서

## 📋 개요

현재 Notion API + Google Drive로 구현된 상담 관리 시스템을 Supabase (PostgreSQL + Storage)로 백업하여 데이터 안정성과 가용성을 향상시키는 시스템입니다.

### 목적
- **데이터 이중화**: Notion 장애 시 Fallback 시스템 역할
- **성능 향상**: PostgreSQL의 빠른 쿼리 성능 활용
- **데이터 분석**: SQL 기반 고급 분석 기능 제공
- **백업 & 복구**: 정기적 데이터 백업 및 복구 시스템

### 아키텍처 구조
```
[Notion + Google Drive] ──sync──> [Supabase + Storage]
        ↓                              ↓
    Primary System               Backup/Fallback System
```

## 🗃️ 현재 시스템 분석

### Notion 데이터베이스 구조

#### 1. 고객 테이블 (customers)
```typescript
interface NotionCustomer {
  id: string;                    // Notion Page ID
  properties: {
    id: string;                  // 5자리 고객 ID (00001)
    고객명: string;              // 고객 이름
    전화번호: string;            // 전화번호
    성별: string;                // 남/여
    생년월일: string;            // YYYY-MM-DD
    추정나이: number;            // 추정 나이
    주소: string;                // 주소
    특이사항: string;            // 특이사항
    얼굴_임베딩: string;         // JSON 형태 얼굴 인식 데이터
    customerFolderId: string;    // Google Drive 폴더 ID
    상담수: number;              // Formula로 계산된 상담 수
    삭제됨: boolean;             // 삭제 여부
  }
}
```

#### 2. 상담일지 테이블 (consultations)
```typescript
interface NotionConsultation {
  id: string;                    // Notion Page ID
  properties: {
    id: string;                  // 상담 ID (고객ID_상담번호)
    상담일자: string;            // YYYY-MM-DD
    고객: string;                // 고객 Notion Page ID
    호소증상: string;            // 호소 증상
    환자상태: string;            // 환자 상태 분석
    설진분석: string;            // 설진 분석
    특이사항: string;            // 특이사항
    증상이미지: Array<{          // Google Drive 이미지 URL 배열
      name: string;
      external: { url: string };
    }>;
    처방약: string;              // 처방약
    결과: string;                // 상담 결과
    생성일시: string;            // ISO 8601 형태
  }
}
```

### Google Drive 파일 구조
```
📁 MSPharmHQ/
├── 📁 00001/                   # 고객 폴더 (고객ID)
│   ├── 📄 00001_001_1.jpg      # 상담이미지 (상담ID_이미지번호)
│   ├── 📄 00001_001_2.jpg
│   └── 📄 00001_002_1.jpg
├── 📁 00002/
│   └── 📄 00002_001_1.jpg
```

## 🏗️ Supabase 백업 시스템 설계

### 1. 데이터베이스 스키마

#### 1.1 고객 백업 테이블 (consultation_customers)
```sql
-- 고객 백업 테이블
CREATE TABLE consultation_customers (
  -- 기본 키 및 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE NOT NULL,           -- Notion Page ID
  customer_id TEXT UNIQUE NOT NULL,              -- 5자리 고객 ID (00001)
  
  -- 고객 기본 정보
  name TEXT NOT NULL,                            -- 고객명
  phone TEXT,                                    -- 전화번호
  gender TEXT CHECK (gender IN ('남', '여')),   -- 성별
  birth_date DATE,                               -- 생년월일
  estimated_age INTEGER,                         -- 추정나이
  address TEXT,                                  -- 주소
  special_note TEXT,                             -- 특이사항
  
  -- 기술적 데이터
  face_embedding JSONB,                          -- 얼굴 인식 임베딩 데이터
  google_drive_folder_id TEXT,                   -- Google Drive 폴더 ID
  consultation_count INTEGER DEFAULT 0,          -- 상담 수
  is_deleted BOOLEAN DEFAULT FALSE,              -- 삭제 여부
  
  -- 백업 관련 메타데이터
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- 마지막 동기화 시간
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  notion_updated_at TIMESTAMP WITH TIME ZONE,    -- Notion 마지막 수정 시간
  
  -- 생성/수정 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_consultation_customers_customer_id ON consultation_customers(customer_id);
CREATE INDEX idx_consultation_customers_notion_page_id ON consultation_customers(notion_page_id);
CREATE INDEX idx_consultation_customers_name ON consultation_customers(name);
CREATE INDEX idx_consultation_customers_phone ON consultation_customers(phone);
CREATE INDEX idx_consultation_customers_sync_status ON consultation_customers(sync_status);
```

#### 1.2 상담일지 백업 테이블 (consultation_records)
```sql
-- 상담일지 백업 테이블
CREATE TABLE consultation_records (
  -- 기본 키 및 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE NOT NULL,           -- Notion Page ID
  consultation_id TEXT UNIQUE NOT NULL,          -- 상담 ID (고객ID_상담번호)
  
  -- 관계 데이터
  customer_id UUID NOT NULL REFERENCES consultation_customers(id), -- 고객 FK
  customer_notion_id TEXT NOT NULL,              -- 고객 Notion Page ID
  
  -- 상담 정보
  consultation_date DATE NOT NULL,               -- 상담일자
  symptoms TEXT NOT NULL,                        -- 호소증상
  patient_condition TEXT,                        -- 환자상태
  tongue_analysis TEXT,                          -- 설진분석
  special_note TEXT,                             -- 특이사항
  prescription TEXT,                             -- 처방약
  result TEXT,                                   -- 상담결과
  
  -- 이미지 관련
  image_count INTEGER DEFAULT 0,                 -- 이미지 개수
  google_drive_urls JSONB,                       -- Google Drive URL 배열
  supabase_image_urls JSONB,                     -- Supabase Storage URL 배열 (백업)
  
  -- 백업 관련 메타데이터
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  notion_created_at TIMESTAMP WITH TIME ZONE,    -- Notion 생성 시간
  notion_updated_at TIMESTAMP WITH TIME ZONE,    -- Notion 마지막 수정 시간
  
  -- 생성/수정 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_consultation_records_consultation_id ON consultation_records(consultation_id);
CREATE INDEX idx_consultation_records_notion_page_id ON consultation_records(notion_page_id);
CREATE INDEX idx_consultation_records_customer_id ON consultation_records(customer_id);
CREATE INDEX idx_consultation_records_consultation_date ON consultation_records(consultation_date);
CREATE INDEX idx_consultation_records_sync_status ON consultation_records(sync_status);
```

#### 1.3 동기화 로그 테이블 (sync_logs)
```sql
-- 동기화 로그 테이블
CREATE TABLE consultation_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('customers', 'consultations', 'images', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  
  -- 통계 정보
  total_records INTEGER DEFAULT 0,
  synced_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  
  -- 상세 정보
  error_message TEXT,
  details JSONB,                                 -- 동기화 상세 정보
  
  -- 시간 정보
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_consultation_sync_logs_sync_type ON consultation_sync_logs(sync_type);
CREATE INDEX idx_consultation_sync_logs_status ON consultation_sync_logs(status);
CREATE INDEX idx_consultation_sync_logs_started_at ON consultation_sync_logs(started_at);
```

#### 1.4 트리거 함수 (자동 업데이트)
```sql
-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
CREATE TRIGGER update_consultation_customers_updated_at 
    BEFORE UPDATE ON consultation_customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consultation_records_updated_at 
    BEFORE UPDATE ON consultation_records 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Supabase Storage 구조

#### 2.1 버킷 설정
```typescript
// consultation-images 버킷 생성
const bucketName = 'consultation-images';
const bucketConfig = {
  public: false,          // 비공개 설정
  fileSizeLimit: 10485760, // 10MB 제한
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
};
```

#### 2.2 폴더 구조
```
📁 consultation-images/
├── 📁 customers/
│   ├── 📁 00001/                    # 고객 ID별 폴더
│   │   ├── 📁 consultations/
│   │   │   ├── 📁 00001_001/        # 상담 ID별 폴더
│   │   │   │   ├── 📄 image_1.jpg   # 이미지 파일
│   │   │   │   └── 📄 image_2.jpg
│   │   │   └── 📁 00001_002/
│   │   │       └── 📄 image_1.jpg
│   │   └── 📁 profile/              # 프로필 이미지 (향후 확장)
│   └── 📁 00002/
│       └── 📁 consultations/
│           └── 📁 00002_001/
│               └── 📄 image_1.jpg
└── 📁 temp/                         # 임시 파일
    └── 📄 processing_*.jpg
```

### 3. Row Level Security (RLS) 정책
```sql
-- RLS 활성화
ALTER TABLE consultation_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_sync_logs ENABLE ROW LEVEL SECURITY;

-- 전체 읽기 권한 (인증된 사용자)
CREATE POLICY "consultation_customers_select" ON consultation_customers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "consultation_records_select" ON consultation_records
    FOR SELECT TO authenticated USING (true);

-- 서비스 역할만 쓰기 가능
CREATE POLICY "consultation_customers_write" ON consultation_customers
    FOR ALL TO service_role USING (true);

CREATE POLICY "consultation_records_write" ON consultation_records
    FOR ALL TO service_role USING (true);

CREATE POLICY "consultation_sync_logs_write" ON consultation_sync_logs
    FOR ALL TO service_role USING (true);
```

## 🔄 데이터 동기화 전략

### 1. 동기화 방식

#### 1.1 초기 풀 동기화 (Initial Full Sync)
```typescript
interface FullSyncConfig {
  batchSize: number;          // 배치 크기 (기본: 50)
  imageDownload: boolean;     // 이미지 다운로드 여부
  validateData: boolean;      // 데이터 검증 여부
  overwriteExisting: boolean; // 기존 데이터 덮어쓰기 여부
}
```

#### 1.2 증분 동기화 (Incremental Sync)
```typescript
interface IncrementalSyncConfig {
  lastSyncTime: string;       // 마지막 동기화 시간
  syncNewOnly: boolean;       // 신규 데이터만 동기화
  syncModified: boolean;      // 수정된 데이터 동기화
  checkInterval: number;      // 체크 간격 (분)
}
```

#### 1.3 실시간 동기화 (Real-time Sync)
```typescript
interface RealtimeSyncConfig {
  webhookUrl: string;         // Notion 웹훅 URL (향후)
  enabled: boolean;           // 실시간 동기화 활성화
  retryCount: number;         // 재시도 횟수
  retryDelay: number;         // 재시도 지연 (초)
}
```

### 2. 충돌 해결 전략

#### 2.1 우선순위 규칙
1. **Notion 우선**: Notion 데이터를 Primary로 취급
2. **최신 타임스탬프**: 수정 시간이 더 최신인 데이터 우선
3. **수동 해결**: 관리자가 수동으로 충돌 해결

#### 2.2 충돌 감지
```typescript
interface ConflictDetection {
  compareFields: string[];    // 비교할 필드 목록
  ignoreFields: string[];     // 무시할 필드 목록
  timestampField: string;     // 타임스탬프 필드명
  resolutionStrategy: 'notion_wins' | 'latest_wins' | 'manual';
}
```

## 🛠️ 구현 계획

### Phase 1: 기본 인프라 구축 (1-2일)
1. **Supabase 테이블 생성**
   - SQL 스키마 실행
   - RLS 정책 설정
   - 인덱스 최적화

2. **Storage 버킷 설정**
   - consultation-images 버킷 생성
   - 정책 설정
   - 폴더 구조 생성

3. **기본 라이브러리 구현**
   - Supabase 클라이언트 설정
   - 타입 정의 파일 생성
   - 유틸리티 함수 구현

### Phase 2: 데이터 동기화 시스템 (2-3일)
1. **Notion 데이터 추출기**
   - 고객 데이터 추출
   - 상담 데이터 추출
   - 배치 처리 로직

2. **Supabase 데이터 저장기**
   - 고객 데이터 저장
   - 상담 데이터 저장
   - 오류 처리 및 롤백

3. **이미지 동기화**
   - Google Drive에서 이미지 다운로드
   - Supabase Storage 업로드
   - URL 매핑 관리

### Phase 3: API 및 관리 도구 (2-3일)
1. **백업 API 엔드포인트**
   - 수동 동기화 API
   - 동기화 상태 조회 API
   - 충돌 해결 API

2. **관리 대시보드**
   - 동기화 상태 모니터링
   - 오류 로그 조회
   - 수동 동기화 실행

3. **스케줄링 시스템**
   - 정기 동기화 스케줄
   - 실패 시 재시도 로직
   - 알림 시스템

### Phase 4: 테스트 및 최적화 (1-2일)
1. **단위 테스트**
   - 동기화 로직 테스트
   - 오류 처리 테스트
   - 성능 테스트

2. **통합 테스트**
   - 전체 워크플로우 테스트
   - 대용량 데이터 테스트
   - 장애 시나리오 테스트

3. **성능 최적화**
   - 배치 크기 최적화
   - 인덱스 튜닝
   - 캐싱 전략

## 📊 예상 효과

### 1. 데이터 안정성
- **이중화**: Notion 장애 시 Supabase로 Fallback
- **백업**: 정기적 데이터 백업으로 손실 방지
- **복구**: 빠른 데이터 복구 가능

### 2. 성능 향상
- **쿼리 성능**: PostgreSQL의 빠른 쿼리 성능
- **분석 기능**: SQL 기반 고급 분석
- **확장성**: 대용량 데이터 처리 가능

### 3. 운영 효율성
- **모니터링**: 실시간 동기화 상태 모니터링
- **자동화**: 스케줄링을 통한 자동 백업
- **관리**: 통합 관리 대시보드

## 🔧 기술 스택

### Backend
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage
- **API**: Next.js API Routes
- **Scheduling**: Vercel Cron (또는 자체 스케줄러)

### Libraries
- **@supabase/supabase-js**: Supabase 클라이언트
- **@notionhq/client**: Notion API 클라이언트
- **node-cron**: 스케줄링
- **sharp**: 이미지 처리 (필요시)

### Monitoring
- **로깅**: Console + Custom Dashboard
- **알림**: 이메일/슬랙 알림 (선택사항)
- **메트릭**: 동기화 성공률, 처리 시간 등

## 🚀 다음 단계

1. **문서 검토**: 이 설계 문서 검토 및 피드백
2. **환경 설정**: Supabase 프로젝트 설정 확인
3. **구현 시작**: Phase 1부터 순차적 구현
4. **테스트**: 단계별 테스트 및 검증
5. **배포**: 프로덕션 환경 배포

---

**📌 참고사항**
- 이 시스템은 기존 Notion 시스템을 대체하지 않고 백업 목적으로 사용
- 모든 Primary 작업은 여전히 Notion에서 수행
- Supabase는 Fallback 및 분석 용도로 활용
- 향후 필요시 Primary 시스템으로 전환 가능한 구조로 설계
