# 고객 관리 시스템 Supabase 마이그레이션 계획서

> **문서 버전**: 1.0  
> **작성일**: 2025-05-31  
> **상태**: 설계 단계  
> **연관 문서**: CONSULTATION_MIGRATION_TO_SUPABASE.md

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [현재 구조 분석](#현재-구조-분석)
- [Supabase 목표 구조](#supabase-목표-구조)
- [마이그레이션 계획](#마이그레이션-계획)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [스토리지 구조](#스토리지-구조)
- [얼굴 인식 시스템](#얼굴-인식-시스템)
- [API 변경 계획](#api-변경-계획)
- [데이터 마이그레이션 전략](#데이터-마이그레이션-전략)
- [통합 마이그레이션 전략](#통합-마이그레이션-전략)

## 🎯 프로젝트 개요

### 마이그레이션 목표
현재 **Notion API + Google Drive**로 구현된 고객 관리 시스템을 **Supabase (PostgreSQL + Storage)**로 마이그레이션하여 다음과 같은 이점을 얻습니다:

#### 📈 **기대 효과**
- **성능 향상**: PostgreSQL의 빠른 쿼리 및 인덱싱
- **데이터 일관성**: ACID 트랜잭션과 관계형 데이터베이스
- **확장성**: 복잡한 고객 검색 및 필터링 기능
- **통합성**: 상담 관리 시스템과 동일 인프라 사용
- **얼굴 인식 최적화**: JSONB 및 벡터 검색 지원
- **실시간 기능**: Supabase Realtime으로 고객 정보 동기화

#### 🔧 **핵심 개선 사항**
- **고객 검색 성능**: Full-text search + 인덱스 최적화
- **얼굴 매칭 정확도**: 구조화된 임베딩 데이터 저장
- **관계 데이터 관리**: 고객-상담 관계 외래키로 보장
- **이미지 관리**: 통합된 스토리지 시스템
- **백업 및 복구**: 자동화된 데이터 보호

## 📊 현재 구조 분석

### 1. Notion API 기반 고객 데이터

#### **고객 데이터베이스 스키마**
```typescript
interface NotionCustomer {
  id: string;                    // 고객 페이지 ID
  고객명: string;                // 고객 이름
  전화번호: string;              // 전화번호
  성별: '남성' | '여성';         // 성별 선택
  생년월일: string;              // 생년월일 (date)
  추정나이: number;              // 추정 나이
  주소: string;                  // 주소
  특이사항: string;              // 특이사항
  얼굴_임베딩: string;           // 얼굴 임베딩 (JSON 문자열)
  customerFolderId: string;      // Google Drive 폴더 ID
  상담일지DB: relation[];        // 상담일지와 관계
  상담수: number;                // 상담 수 (formula)
  삭제됨: boolean;               // 소프트 삭제 플래그
}
```

#### **고객 ID 생성 규칙**
- **Master DB에서 자동 증가**: 현재 고객수 + 1
- **5자리 Zero-padding**: `00001`, `00002`, `00030` 형식
- **고유성 보장**: Notion 페이지 ID와 별도 관리

### 2. Google Drive 연동

#### **폴더 구조**
```
📁 MSPharmHQ 메인 폴더/
├── 📁 00001 (고객별 폴더)/
│   ├── 📁 00001_001 (상담별 폴더)/
│   └── 📁 00001_002 (상담별 폴더)/
├── 📁 00002 (고객별 폴더)/
└── 📁 00030 (고객별 폴더)/
```

#### **폴더 관리 특징**
- **자동 생성**: 고객 등록 시 Google Drive 폴더 자동 생성
- **ID 연동**: customerFolderId로 Notion과 Drive 연결
- **상담 연동**: 상담별 하위 폴더 생성

### 3. 얼굴 인식 시스템

#### **현재 얼굴 임베딩 구조**
```typescript
interface FaceEmbedding {
  faceDetected: boolean;
  embedding: {
    eyeDistanceRatio: number;     // 0.3~0.7
    eyeNoseRatio: number;         // 0.3~0.7  
    noseMouthRatio: number;       // 0.3~0.7
    symmetryScore: number;        // 0~1
    contourFeatures: string;      // "타원형", "사각형" 등
  };
  gender: string;                 // "남성", "여성"
  age: number;                    // 추정 나이
  distinctiveFeatures: string[]; // ["안경", "수염"] 등
  imageQualityScore: number;      // 0~100
}
```

#### **Google Gemini 연동**
- **이미지 분석**: Gemini 1.5 Flash 모델 사용
- **JSON 응답**: 구조화된 얼굴 특징 추출
- **품질 보장**: 이미지 품질 점수 평가

### 4. 현재 API 엔드포인트

```typescript
// 고객 관리 API
GET  /api/customer?name={name}         // 고객 검색
GET  /api/customer/list                // 전체 고객 목록
POST /api/customer                     // 고객 등록
PUT  /api/customer/{id}                // 고객 수정
POST /api/customer/delete              // 소프트 삭제
PUT  /api/customer/delete              // 복원
DELETE /api/customer/delete            // 영구 삭제

// 얼굴 인식 API
POST /api/face-embedding               // 얼굴 분석
```

## 🎯 Supabase 목표 구조

### 1. PostgreSQL 테이블 설계

#### **customers 테이블**
```sql
CREATE TABLE customers (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(10) UNIQUE NOT NULL,  -- 00001 형식
  
  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  gender VARCHAR(10) CHECK (gender IN ('남성', '여성', '기타')),
  birth_date DATE,
  estimated_age INTEGER,
  address TEXT,
  special_notes TEXT,
  
  -- 얼굴 인식 데이터
  face_embedding JSONB,
  face_image_url TEXT,
  
  -- 폴더 관리
  drive_folder_id VARCHAR(100),
  storage_folder_path VARCHAR(200),
  
  -- 상태 관리
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT customers_customer_id_format 
    CHECK (customer_id ~ '^[0-9]{5}$'),
  CONSTRAINT customers_phone_format 
    CHECK (phone IS NULL OR phone ~ '^[0-9\-+() ]+$'),
  CONSTRAINT customers_age_range 
    CHECK (estimated_age IS NULL OR (estimated_age >= 0 AND estimated_age <= 150))
);
```

#### **customers 테이블 특징**
- **고유 고객 ID**: 5자리 숫자 형식 (`00001`)
- **JSONB 얼굴 임베딩**: 구조화된 얼굴 특징 저장
- **소프트 삭제**: `is_deleted` + `deleted_at`
- **스토리지 경로**: Supabase Storage 경로 저장
- **검증 제약**: 데이터 무결성 보장

### 2. 인덱스 및 성능 최적화

```sql
-- 기본 인덱스
CREATE INDEX idx_customers_customer_id ON customers(customer_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_is_deleted ON customers(is_deleted);

-- 복합 인덱스 (활성 고객)
CREATE INDEX idx_customers_active ON customers(id) 
  WHERE is_deleted = false;

-- 전체 텍스트 검색 인덱스
CREATE INDEX idx_customers_name_fts 
  ON customers USING gin(to_tsvector('korean', name));
CREATE INDEX idx_customers_address_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(address, '')));
CREATE INDEX idx_customers_notes_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(special_notes, '')));

-- 얼굴 임베딩 검색 인덱스
CREATE INDEX idx_customers_face_embedding 
  ON customers USING gin(face_embedding);

-- 성별 및 나이 필터링
CREATE INDEX idx_customers_gender_age 
  ON customers(gender, estimated_age) 
  WHERE is_deleted = false;
```

### 3. 관계 설정 및 외래키

```sql
-- 고객-상담 관계 (consultations 테이블과 연결)
ALTER TABLE consultations 
ADD CONSTRAINT consultations_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;

-- 고객별 상담 수 계산 뷰
CREATE VIEW customer_consultation_stats AS
SELECT 
  c.id,
  c.customer_id,
  c.name,
  COUNT(con.id) as consultation_count,
  MAX(con.consult_date) as last_consultation_date
FROM customers c
LEFT JOIN consultations con ON c.id = con.customer_id
WHERE c.is_deleted = false
GROUP BY c.id, c.customer_id, c.name;
```

### 4. Supabase Storage 구조

#### **버킷 구성**
```
📦 Supabase Storage
├── 🗂️ customer-profiles (버킷)
│   ├── 📁 {customer_id}/              -- 고객별 폴더
│   │   ├── 🖼️ profile.jpg            -- 프로필 이미지
│   │   ├── 🖼️ face_samples/          -- 얼굴 샘플들
│   │   │   ├── 🖼️ sample_1.jpg
│   │   │   └── 🖼️ sample_2.jpg
│   │   └── 📄 documents/              -- 고객 관련 문서
│   └── 📁 {다른_고객_id}/
├── 🗂️ consultation-images (기존 버킷)
└── 🗂️ employee-purchases (기존 버킷)
```

#### **스토리지 정책**
```sql
-- 고객 프로필 이미지 읽기 정책
CREATE POLICY "Customer profiles read access" ON storage.objects 
FOR SELECT TO public USING (bucket_id = 'customer-profiles');

-- 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated customer upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer-profiles');

-- 기존 이미지 업데이트 정책
CREATE POLICY "Customer profile update" ON storage.objects 
FOR UPDATE TO authenticated USING (bucket_id = 'customer-profiles');
```

## 📋 마이그레이션 계획

### Phase 1: 인프라 준비 (2일)

#### **1단계: Supabase 설정**
- [ ] customers 테이블 생성
- [ ] 인덱스 및 제약조건 적용
- [ ] customer-profiles 버킷 생성
- [ ] 스토리지 정책 설정

#### **2단계: 관계 설정**
- [ ] consultations 테이블과 외래키 연결
- [ ] 통계 뷰 생성
- [ ] 데이터 검증 함수 작성

### Phase 2: 데이터 마이그레이션 (4일)

#### **1단계: 고객 데이터 추출**
- [ ] Notion에서 모든 고객 데이터 추출
- [ ] 얼굴 임베딩 데이터 파싱 및 검증
- [ ] 삭제된 고객 데이터 별도 처리

#### **2단계: 고객 ID 매핑**
- [ ] 기존 고객 ID 유지 (`00001` 형식)
- [ ] Notion 페이지 ID → Supabase UUID 매핑
- [ ] 상담 데이터와의 관계 검증

#### **3단계: 이미지 마이그레이션**
- [ ] Google Drive 이미지를 Supabase Storage로 이전
- [ ] 프로필 이미지 경로 업데이트
- [ ] 얼굴 샘플 이미지 정리

### Phase 3: API 개발 (3일)

#### **1단계: 새로운 API 개발**
- [ ] Supabase 기반 고객 CRUD API
- [ ] 고급 검색 및 필터링 기능
- [ ] 얼굴 인식 통합 API
- [ ] 통계 및 리포트 API

#### **2단계: 호환성 유지**
- [ ] 기존 API 응답 형식 보장
- [ ] 점진적 마이그레이션 지원
- [ ] 오류 처리 및 폴백 메커니즘

### Phase 4: 통합 테스트 (2일)

#### **1단계: 기능 테스트**
- [ ] 고객 등록/수정/삭제 테스트
- [ ] 검색 및 필터링 성능 테스트
- [ ] 얼굴 인식 정확도 테스트
- [ ] 상담-고객 관계 무결성 테스트

#### **2단계: 성능 테스트**
- [ ] 대용량 고객 데이터 처리
- [ ] 동시 접속 처리 능력
- [ ] 검색 응답 시간 측정

## 💾 데이터베이스 스키마

### 상세 테이블 생성 스크립트

```sql
-- 고객 관리 시스템 테이블 생성
CREATE TABLE IF NOT EXISTS customers (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id VARCHAR(10) UNIQUE NOT NULL,
  notion_id VARCHAR(100), -- 마이그레이션 추적용
  
  -- 기본 정보
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  gender VARCHAR(10) CHECK (gender IN ('남성', '여성', '기타', '불명')),
  birth_date DATE,
  estimated_age INTEGER,
  address TEXT,
  special_notes TEXT,
  
  -- 얼굴 인식 데이터
  face_embedding JSONB,
  face_image_url TEXT,
  face_samples_count INTEGER DEFAULT 0,
  
  -- 폴더 관리
  drive_folder_id VARCHAR(100), -- 기존 Google Drive ID (호환용)
  storage_folder_path VARCHAR(200), -- Supabase Storage 경로
  
  -- 상태 관리
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100),
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_consultation_date DATE,
  consultation_count INTEGER DEFAULT 0,
  
  -- 제약 조건
  CONSTRAINT customers_customer_id_format 
    CHECK (customer_id ~ '^[0-9]{5}$'),
  CONSTRAINT customers_phone_format 
    CHECK (phone IS NULL OR length(trim(phone)) > 0),
  CONSTRAINT customers_age_range 
    CHECK (estimated_age IS NULL OR (estimated_age >= 0 AND estimated_age <= 150)),
  CONSTRAINT customers_name_not_empty 
    CHECK (length(trim(name)) > 0)
);

-- 인덱스 생성 (성능 최적화)
CREATE UNIQUE INDEX idx_customers_customer_id ON customers(customer_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_is_deleted ON customers(is_deleted);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- 활성 고객 전용 인덱스
CREATE INDEX idx_customers_active_name 
  ON customers(name) WHERE is_deleted = false;
CREATE INDEX idx_customers_active_phone 
  ON customers(phone) WHERE is_deleted = false AND phone IS NOT NULL;

-- 전체 텍스트 검색 인덱스
CREATE INDEX idx_customers_name_fts 
  ON customers USING gin(to_tsvector('korean', name));
CREATE INDEX idx_customers_address_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(address, '')));
CREATE INDEX idx_customers_notes_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(special_notes, '')));

-- 얼굴 임베딩 검색 (JSONB GIN 인덱스)
CREATE INDEX idx_customers_face_embedding 
  ON customers USING gin(face_embedding) 
  WHERE face_embedding IS NOT NULL;

-- 복합 인덱스
CREATE INDEX idx_customers_gender_age 
  ON customers(gender, estimated_age) 
  WHERE is_deleted = false;
CREATE INDEX idx_customers_consultation_stats 
  ON customers(consultation_count DESC, last_consultation_date DESC) 
  WHERE is_deleted = false;

-- 업데이트 트리거
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_customers_updated_at();

-- RLS 정책
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (활성 고객만)
CREATE POLICY "Public read active customers" ON customers 
  FOR SELECT TO public USING (is_deleted = false);

-- 인증된 사용자 전체 접근
CREATE POLICY "Authenticated full access" ON customers 
  FOR ALL TO authenticated USING (true);

-- 고객 번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_next_customer_id()
RETURNS VARCHAR(10) AS $$
DECLARE
  next_number INTEGER;
BEGIN
  -- 마지막 고객 번호 조회
  SELECT COALESCE(MAX(CAST(customer_id AS INTEGER)), 0) + 1 
  INTO next_number
  FROM customers;
  
  RETURN lpad(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 고객 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_customer_consultation_stats(customer_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE customers 
  SET 
    consultation_count = (
      SELECT COUNT(*) 
      FROM consultations 
      WHERE customer_id = customer_uuid
    ),
    last_consultation_date = (
      SELECT MAX(consult_date) 
      FROM consultations 
      WHERE customer_id = customer_uuid
    )
  WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- 얼굴 유사도 검색 함수
CREATE OR REPLACE FUNCTION find_similar_faces(
  target_embedding JSONB,
  similarity_threshold FLOAT DEFAULT 0.8,
  max_results INTEGER DEFAULT 10
)
RETURNS TABLE(
  customer_id VARCHAR(10),
  customer_name VARCHAR(100),
  similarity_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.customer_id,
    c.name,
    -- 간단한 유클리드 거리 기반 유사도 계산
    (1.0 - sqrt(
      power((target_embedding->>'eyeDistanceRatio')::FLOAT - 
            (c.face_embedding->'embedding'->>'eyeDistanceRatio')::FLOAT, 2) +
      power((target_embedding->>'eyeNoseRatio')::FLOAT - 
            (c.face_embedding->'embedding'->>'eyeNoseRatio')::FLOAT, 2) +
      power((target_embedding->>'noseMouthRatio')::FLOAT - 
            (c.face_embedding->'embedding'->>'noseMouthRatio')::FLOAT, 2) +
      power((target_embedding->>'symmetryScore')::FLOAT - 
            (c.face_embedding->'embedding'->>'symmetryScore')::FLOAT, 2)
    ) / 2.0) as similarity
  FROM customers c
  WHERE c.is_deleted = false 
    AND c.face_embedding IS NOT NULL
    AND c.face_embedding->'faceDetected' = 'true'
  HAVING similarity >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- 고객 검색 함수 (통합 검색)
CREATE OR REPLACE FUNCTION search_customers(
  search_term TEXT DEFAULT NULL,
  search_phone TEXT DEFAULT NULL,
  search_gender VARCHAR(10) DEFAULT NULL,
  include_deleted BOOLEAN DEFAULT false,
  page_size INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  customer_id VARCHAR(10),
  name VARCHAR(100),
  phone VARCHAR(20),
  gender VARCHAR(10),
  estimated_age INTEGER,
  consultation_count INTEGER,
  last_consultation_date DATE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.customer_id, c.name, c.phone, c.gender, 
    c.estimated_age, c.consultation_count, 
    c.last_consultation_date, c.created_at
  FROM customers c
  WHERE 
    (include_deleted = true OR c.is_deleted = false)
    AND (search_term IS NULL OR (
      c.name ILIKE '%' || search_term || '%' OR
      c.address ILIKE '%' || search_term || '%' OR
      c.special_notes ILIKE '%' || search_term || '%'
    ))
    AND (search_phone IS NULL OR c.phone ILIKE '%' || search_phone || '%')
    AND (search_gender IS NULL OR c.gender = search_gender)
  ORDER BY c.name
  LIMIT page_size OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- 데이터 검증 함수
CREATE OR REPLACE FUNCTION validate_customer_data()
RETURNS TABLE(
  issue_type VARCHAR,
  customer_id VARCHAR,
  issue_description TEXT
) AS $$
BEGIN
  -- 중복 customer_id 검사
  RETURN QUERY
  SELECT 
    'duplicate_customer_id'::VARCHAR,
    c.customer_id,
    'Duplicate customer_id found'::TEXT
  FROM customers c
  GROUP BY c.customer_id
  HAVING COUNT(*) > 1;
  
  -- 빈 이름 검사
  RETURN QUERY
  SELECT 
    'empty_name'::VARCHAR,
    c.customer_id,
    'Customer name is empty'::TEXT
  FROM customers c
  WHERE c.name IS NULL OR length(trim(c.name)) = 0;
  
  -- 잘못된 전화번호 형식 검사
  RETURN QUERY
  SELECT 
    'invalid_phone'::VARCHAR,
    c.customer_id,
    'Invalid phone number format'::TEXT
  FROM customers c
  WHERE c.phone IS NOT NULL 
    AND NOT (c.phone ~ '^[0-9\-+() ]+$')
    AND length(trim(c.phone)) > 0;
  
  -- 상담 관계 무결성 검사
  RETURN QUERY
  SELECT 
    'orphaned_consultations'::VARCHAR,
    con.consultation_id,
    'Consultation has no valid customer'::TEXT
  FROM consultations con
  LEFT JOIN customers c ON con.customer_id = c.id
  WHERE c.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
SELECT 'customers schema 적용 완료' AS message;
```

## 🖼️ 얼굴 인식 시스템

### 개선된 얼굴 임베딩 구조

```typescript
// app/lib/types/customer.ts
export interface FaceEmbeddingData {
  faceDetected: boolean;
  confidence: number;
  embedding: {
    eyeDistanceRatio: number;
    eyeNoseRatio: number;
    noseMouthRatio: number;
    symmetryScore: number;
    contourFeatures: string;
    faceWidth: number;
    faceHeight: number;
    jawlineAngle: number;
  };
  demographics: {
    gender: string;
    ageRange: string;
    ethnicity?: string;
  };
  distinctiveFeatures: string[];
  imageMetadata: {
    quality: number;
    lighting: string;
    angle: string;
    resolution: string;
  };
  processingInfo: {
    model: string;
    version: string;
    timestamp: string;
  };
}

// Supabase 저장용 고객 데이터
export interface CustomerData {
  id?: string;
  customer_id: string;
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: FaceEmbeddingData;
  face_image_url?: string;
  drive_folder_id?: string;
  storage_folder_path?: string;
  is_deleted?: boolean;
}
```

### 향상된 얼굴 매칭 알고리즘

```typescript
// app/lib/customer-face-matching.ts
export class FaceMatchingService {
  
  async findSimilarCustomers(
    targetEmbedding: FaceEmbeddingData,
    threshold: number = 0.8
  ): Promise<CustomerMatch[]> {
    const { data, error } = await supabase
      .rpc('find_similar_faces', {
        target_embedding: targetEmbedding.embedding,
        similarity_threshold: threshold,
        max_results: 10
      });
    
    if (error) throw error;
    return data;
  }
  
  calculateSimilarity(
    embedding1: FaceEmbeddingData,
    embedding2: FaceEmbeddingData
  ): number {
    const e1 = embedding1.embedding;
    const e2 = embedding2.embedding;
    
    // 가중치가 적용된 유클리드 거리
    const weights = {
      eyeDistanceRatio: 0.25,
      eyeNoseRatio: 0.20,
      noseMouthRatio: 0.20,
      symmetryScore: 0.15,
      faceWidth: 0.10,
      faceHeight: 0.10
    };
    
    let weightedDistance = 0;
    let totalWeight = 0;
    
    Object.entries(weights).forEach(([key, weight]) => {
      if (e1[key] !== undefined && e2[key] !== undefined) {
        weightedDistance += weight * Math.pow(e1[key] - e2[key], 2);
        totalWeight += weight;
      }
    });
    
    const normalizedDistance = Math.sqrt(weightedDistance / totalWeight);
    return Math.max(0, 1 - normalizedDistance);
  }
  
  async updateFaceEmbedding(
    customerId: string,
    imageFile: File
  ): Promise<FaceEmbeddingData> {
    // 1. 얼굴 분석
    const analysisResult = await this.analyzeFace(imageFile);
    
    // 2. 이미지 저장
    const imageUrl = await this.saveCustomerImage(customerId, imageFile);
    
    // 3. 데이터베이스 업데이트
    await supabase
      .from('customers')
      .update({
        face_embedding: analysisResult,
        face_image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('customer_id', customerId);
    
    return analysisResult;
  }
}
```

## 🔧 API 변경 계획

### 새로운 Supabase 기반 API

#### **고객 관리 API v2**
```typescript
// app/api/customer-v2/route.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 고객 검색 및 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search');
  const phone = searchParams.get('phone');
  const gender = searchParams.get('gender');
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  try {
    const { data, error } = await supabase
      .rpc('search_customers', {
        search_term: search,
        search_phone: phone,
        search_gender: gender,
        include_deleted: includeDeleted,
        page_size: limit,
        page_offset: (page - 1) * limit
      });

    if (error) throw error;

    // 기존 Notion API 응답 형식과 호환
    const customers = data.map(customer => ({
      id: customer.id,
      properties: {
        id: {
          title: [{ text: { content: customer.customer_id } }]
        },
        고객명: {
          rich_text: [{ text: { content: customer.name } }]
        },
        전화번호: {
          phone_number: customer.phone
        },
        성별: {
          select: customer.gender ? { name: customer.gender } : null
        },
        // ... 다른 필드들 매핑
      }
    }));

    return NextResponse.json({
      success: true,
      customers,
      totalCount: data.length
    });

  } catch (error) {
    console.error('고객 조회 오류:', error);
    return NextResponse.json(
      { error: '고객 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 고객 등록
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json(
        { error: '이름은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 다음 고객 ID 생성
    const { data: nextId, error: idError } = await supabase
      .rpc('generate_next_customer_id');

    if (idError) throw idError;

    // 고객 데이터 삽입
    const customerData = {
      customer_id: nextId,
      name: data.name,
      phone: data.phone,
      gender: data.gender,
      birth_date: data.birth,
      estimated_age: data.estimatedAge ? parseInt(data.estimatedAge) : null,
      address: data.address,
      special_notes: data.specialNote,
      face_embedding: data.faceEmbedding
    };

    const { data: customer, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw error;

    // 프로필 폴더 생성
    if (customer) {
      await createCustomerStorageFolder(customer.customer_id);
    }

    // 기존 API 응답 형식 유지
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        customId: customer.customer_id,
        name: customer.name
      }
    });

  } catch (error) {
    console.error('고객 등록 오류:', error);
    return NextResponse.json(
      { error: '고객 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

### 얼굴 인식 API 개선

```typescript
// app/api/face-recognition/route.ts
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const customerId = formData.get('customerId') as string;

    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 얼굴 분석
    const faceAnalysis = await analyzeFaceWithGemini(imageFile);

    // 2. 기존 고객과 매칭 (customerId가 없는 경우)
    let matchedCustomers = [];
    if (!customerId && faceAnalysis.faceDetected) {
      const { data: matches, error } = await supabase
        .rpc('find_similar_faces', {
          target_embedding: faceAnalysis.embedding,
          similarity_threshold: 0.7,
          max_results: 5
        });

      if (!error && matches) {
        matchedCustomers = matches;
      }
    }

    // 3. 고객 이미지 저장 (customerId가 있는 경우)
    let imageUrl = null;
    if (customerId) {
      imageUrl = await saveCustomerFaceImage(customerId, imageFile);
      
      // 고객 데이터 업데이트
      await supabase
        .from('customers')
        .update({
          face_embedding: faceAnalysis,
          face_image_url: imageUrl
        })
        .eq('customer_id', customerId);
    }

    return NextResponse.json({
      success: true,
      data: {
        faceAnalysis,
        matchedCustomers,
        imageUrl
      }
    });

  } catch (error) {
    console.error('얼굴 인식 처리 오류:', error);
    return NextResponse.json(
      { error: '얼굴 인식 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

## 📦 데이터 마이그레이션 전략

### 고객 데이터 마이그레이션 스크립트

```typescript
// scripts/migrate-customers.ts
import { createClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';

export async function migrateCustomersToSupabase(): Promise<void> {
  console.log('👥 고객 데이터 마이그레이션 시작...');

  try {
    // 1. Notion에서 모든 고객 데이터 추출
    const notionCustomers = await extractAllCustomersFromNotion();
    console.log(`📊 총 ${notionCustomers.length}개의 고객 데이터 발견`);

    // 2. 고객 데이터 변환 및 검증
    const validCustomers = [];
    const invalidCustomers = [];

    for (const notionCustomer of notionCustomers) {
      try {
        const transformedCustomer = await transformNotionCustomer(notionCustomer);
        validCustomers.push(transformedCustomer);
      } catch (error) {
        console.error(`고객 변환 실패 (${notionCustomer.id}):`, error);
        invalidCustomers.push({ notionCustomer, error });
      }
    }

    console.log(`✅ 유효한 고객: ${validCustomers.length}개`);
    console.log(`❌ 무효한 고객: ${invalidCustomers.length}개`);

    // 3. 배치 단위로 삽입
    const batchSize = 50;
    const batches = chunkArray(validCustomers, batchSize);
    
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      try {
        const { data, error } = await supabase
          .from('customers')
          .insert(batch)
          .select();

        if (error) throw error;

        insertedCount += data.length;
        console.log(`✅ 배치 ${i + 1} 완료: ${data.length}개 삽입`);

        // 삽입된 고객의 스토리지 폴더 생성
        for (const customer of data) {
          await createCustomerStorageFolder(customer.customer_id);
        }

      } catch (error) {
        console.error(`배치 ${i + 1} 삽입 실패:`, error);
        errorCount += batch.length;
      }

      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 고객 마이그레이션 완료: 성공 ${insertedCount}개, 실패 ${errorCount}개`);

    // 4. 상담 데이터와의 관계 업데이트
    await updateCustomerConsultationStats();

    // 5. 데이터 검증
    await validateMigratedCustomerData();

  } catch (error) {
    console.error('💥 고객 마이그레이션 실패:', error);
    throw error;
  }
}

async function transformNotionCustomer(notionCustomer: any): Promise<CustomerData> {
  const properties = notionCustomer.properties;

  // 얼굴 임베딩 데이터 파싱
  let faceEmbedding = null;
  const embeddingText = getNotionPropertyValue(properties.얼굴_임베딩, 'rich_text');
  if (embeddingText) {
    try {
      faceEmbedding = JSON.parse(embeddingText);
    } catch (error) {
      console.warn(`얼굴 임베딩 파싱 실패: ${notionCustomer.id}`);
    }
  }

  return {
    customer_id: getNotionPropertyValue(properties.id, 'title'),
    notion_id: notionCustomer.id,
    name: getNotionPropertyValue(properties.고객명, 'rich_text'),
    phone: getNotionPropertyValue(properties.전화번호, 'phone_number'),
    gender: getNotionPropertyValue(properties.성별, 'select'),
    birth_date: getNotionPropertyValue(properties.생년월일, 'date'),
    estimated_age: getNotionPropertyValue(properties.추정나이, 'number'),
    address: getNotionPropertyValue(properties.주소, 'rich_text'),
    special_notes: getNotionPropertyValue(properties.특이사항, 'rich_text'),
    face_embedding: faceEmbedding,
    drive_folder_id: getNotionPropertyValue(properties.customerFolderId, 'rich_text'),
    is_deleted: getNotionPropertyValue(properties.삭제됨, 'checkbox') || false,
    storage_folder_path: generateStoragePath(getNotionPropertyValue(properties.id, 'title'))
  };
}

async function createCustomerStorageFolder(customerId: string): Promise<void> {
  const folderPath = `${customerId}/`;
  
  // 빈 파일을 업로드하여 폴더 구조 생성
  const { error } = await supabase.storage
    .from('customer-profiles')
    .upload(`${folderPath}.keep`, new Blob([''], { type: 'text/plain' }));

  if (error && !error.message.includes('already exists')) {
    console.warn(`폴더 생성 실패 (${customerId}):`, error);
  }
}

async function updateCustomerConsultationStats(): Promise<void> {
  console.log('📊 고객 상담 통계 업데이트 중...');

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id');

  if (error) throw error;

  for (const customer of customers) {
    await supabase.rpc('update_customer_consultation_stats', {
      customer_uuid: customer.id
    });
  }

  console.log('✅ 고객 상담 통계 업데이트 완료');
}
```

## 🔗 통합 마이그레이션 전략

### 상담 + 고객 시스템 통합 마이그레이션

#### **Phase 순서 재조정**
```
Phase 1: 고객 시스템 마이그레이션 (2일)
├── 고객 테이블 생성 및 데이터 마이그레이션
├── 고객 ID 매핑 테이블 생성
└── 기본 고객 API 개발

Phase 2: 상담 시스템 마이그레이션 (3일)  
├── 상담 테이블 생성
├── 고객-상담 관계 설정
└── 상담 데이터 마이그레이션

Phase 3: 통합 테스트 및 최적화 (2일)
├── 관계 무결성 검증
├── 성능 최적화
└── 통합 API 개발

Phase 4: 배포 및 모니터링 (1일)
├── 프로덕션 배포
├── 모니터링 설정
└── 사용자 교육
```

#### **데이터 관계 무결성 보장**
```sql
-- 마이그레이션 후 관계 검증
DO $$
DECLARE
  orphaned_consultations INTEGER;
  missing_customers INTEGER;
BEGIN
  -- 고아 상담 데이터 확인
  SELECT COUNT(*) INTO orphaned_consultations
  FROM consultations con
  LEFT JOIN customers c ON con.customer_id = c.id
  WHERE c.id IS NULL;
  
  -- 상담이 없는 고객 확인  
  SELECT COUNT(*) INTO missing_customers
  FROM customers c
  LEFT JOIN consultations con ON c.id = con.customer_id
  WHERE con.customer_id IS NULL AND c.is_deleted = false;
  
  RAISE NOTICE '고아 상담 데이터: %개', orphaned_consultations;
  RAISE NOTICE '상담 기록이 없는 고객: %개', missing_customers;
  
  IF orphaned_consultations > 0 THEN
    RAISE EXCEPTION '데이터 무결성 오류: 고아 상담 데이터가 존재합니다.';
  END IF;
END $$;
```

#### **통합 검색 기능**
```typescript
// app/api/integrated-search/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const type = searchParams.get('type') || 'all'; // customer, consultation, all

  try {
    const results = {
      customers: [],
      consultations: [],
      total: 0
    };

    if (type === 'all' || type === 'customer') {
      const { data: customers } = await supabase
        .rpc('search_customers', {
          search_term: query,
          page_size: 10
        });
      
      results.customers = customers || [];
    }

    if (type === 'all' || type === 'consultation') {
      const { data: consultations } = await supabase
        .from('consultations')
        .select(`
          *,
          customers:customer_id (
            customer_id,
            name,
            phone
          )
        `)
        .or(`symptoms.ilike.%${query}%,prescription.ilike.%${query}%`)
        .limit(10);
      
      results.consultations = consultations || [];
    }

    results.total = results.customers.length + results.consultations.length;

    return NextResponse.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('통합 검색 오류:', error);
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

#### **실시간 동기화**
```typescript
// app/lib/realtime-sync.ts
export class RealtimeSync {
  
  setupCustomerSync() {
    const channel = supabase
      .channel('customer-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'customers' 
        }, 
        (payload) => {
          this.handleCustomerChange(payload);
        }
      )
      .subscribe();
    
    return channel;
  }
  
  setupConsultationSync() {
    const channel = supabase
      .channel('consultation-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'consultations' 
        }, 
        (payload) => {
          this.handleConsultationChange(payload);
        }
      )
      .subscribe();
    
    return channel;
  }
  
  private handleCustomerChange(payload: any) {
    // 고객 데이터 변경 시 처리
    console.log('고객 데이터 변경:', payload);
    
    // 클라이언트 UI 업데이트
    window.dispatchEvent(new CustomEvent('customer-updated', {
      detail: payload
    }));
  }
  
  private handleConsultationChange(payload: any) {
    // 상담 데이터 변경 시 처리
    console.log('상담 데이터 변경:', payload);
    
    // 관련 고객의 통계 업데이트
    if (payload.new?.customer_id) {
      this.updateCustomerStats(payload.new.customer_id);
    }
    
    window.dispatchEvent(new CustomEvent('consultation-updated', {
      detail: payload
    }));
  }
}
```

### 마이그레이션 완료 체크리스트

#### **고객 시스템**
- [ ] customers 테이블 생성 및 인덱스 적용
- [ ] 고객 데이터 마이그레이션 (Notion → Supabase)
- [ ] 얼굴 임베딩 데이터 변환 및 저장
- [ ] customer-profiles 스토리지 버킷 생성
- [ ] 고객 관련 이미지 마이그레이션
- [ ] 고객 CRUD API 개발 (v2)
- [ ] 얼굴 인식 및 매칭 API 개발

#### **상담 시스템**  
- [ ] consultations 테이블 생성 및 인덱스 적용
- [ ] 상담 데이터 마이그레이션 (Notion → Supabase)
- [ ] consultation-images 스토리지 버킷 생성
- [ ] 상담 관련 이미지 마이그레이션
- [ ] 상담 CRUD API 개발 (v2)
- [ ] 고객-상담 관계 무결성 보장

#### **통합 기능**
- [ ] 고객-상담 외래키 관계 설정
- [ ] 통합 검색 기능 개발
- [ ] 실시간 동기화 설정
- [ ] 통계 및 리포트 API 개발
- [ ] 성능 테스트 및 최적화

#### **배포 및 운영**
- [ ] 기존 API 호환성 유지
- [ ] 점진적 마이그레이션 환경 변수 설정
- [ ] 모니터링 및 알림 설정
- [ ] 백업 및 복구 절차 수립
- [ ] 사용자 교육 및 문서 업데이트

---

**예상 일정**: 총 11일 (고객 시스템 5일 + 상담 시스템 4일 + 통합 2일)  
**위험도**: 중간 (기존 시스템과 동시 운영으로 위험 완화)  
**효과**: 높음 (성능 향상, 데이터 일관성, 확장성 대폭 개선)

**다음 단계**: 고객 관리 시스템 마이그레이션부터 시작하여 상담 시스템과 순차적 통합
