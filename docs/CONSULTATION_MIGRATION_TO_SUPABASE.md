# 상담 관리 시스템 Supabase 마이그레이션 계획서

> **문서 버전**: 1.0  
> **작성일**: 2025-05-31  
> **상태**: 설계 단계  

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [현재 구조 분석](#현재-구조-분석)
- [Supabase 목표 구조](#supabase-목표-구조)
- [마이그레이션 계획](#마이그레이션-계획)
- [데이터베이스 스키마](#데이터베이스-스키마)
- [스토리지 구조](#스토리지-구조)
- [API 변경 계획](#api-변경-계획)
- [데이터 마이그레이션 전략](#데이터-마이그레이션-전략)
- [구현 가이드](#구현-가이드)
- [테스트 계획](#테스트-계획)
- [롤백 계획](#롤백-계획)

## 🎯 프로젝트 개요

### 마이그레이션 목표
현재 **Notion API + Google Drive**로 구현된 상담 관리 시스템을 **Supabase (PostgreSQL + Storage)**로 마이그레이션하여 다음과 같은 이점을 얻습니다:

#### 📈 **기대 효과**
- **성능 향상**: PostgreSQL의 빠른 쿼리 성능
- **데이터 일관성**: ACID 트랜잭션 지원
- **확장성**: 관계형 데이터베이스의 유연한 쿼리
- **통합성**: 직원 구매 시스템과 동일한 인프라 사용
- **비용 효율성**: API 호출 제한 없음
- **개발 효율성**: SQL 기반 복잡한 쿼리 지원

#### 🔧 **기술적 이점**
- **Real-time 기능**: Supabase Realtime으로 실시간 업데이트
- **Row Level Security**: 세밀한 권한 제어
- **TypeScript 지원**: 자동 타입 생성
- **백업 & 복구**: 자동 백업 시스템
- **모니터링**: 내장 대시보드 및 로깅

## 📊 현재 구조 분석

### 1. Notion API 기반 상담 데이터

#### **상담일지 데이터베이스 스키마**
```typescript
interface NotionConsultation {
  id: string;                    // 상담 ID (title)
  상담일자: string;              // 상담 날짜 (date)
  고객: string;                  // 고객 DB 연결 (relation)
  호소증상: string;              // 주요 증상 (rich_text)
  환자상태: string;              // 환자 상태 분석 (rich_text)
  설진분석: string;              // 설진 분석 결과 (rich_text)
  특이사항: string;              // 특이사항 (rich_text)
  증상이미지: FileObject[];      // 이미지 파일들 (files)
  처방약: string;                // 처방약 정보 (rich_text)
  결과: string;                  // 상담 결과 (rich_text)
  생성일시: string;              // 자동 생성 시간 (created_time)
}
```

#### **데이터 특징**
- **ID 생성 규칙**: `{고객ID}_{상담순번:3자리}` (예: `CUST001_001`)
- **관계 설정**: Notion Relations로 고객과 연결
- **이미지 처리**: Google Drive 링크를 Files 필드에 저장

### 2. Google Drive 기반 이미지 저장

#### **폴더 구조**
```
📁 MSPharmHQ 메인 폴더/
├── 📁 고객별 폴더 (customerFolderId)/
│   ├── 🖼️ {상담ID}_1.jpg
│   ├── 🖼️ {상담ID}_2.jpg
│   └── 🖼️ {상담ID}_3.jpg
└── 📁 기타 파일들/
```

#### **파일명 규칙**
- **형식**: `{상담ID}_{이미지순번}.jpg`
- **예시**: `CUST001_001_1.jpg`, `CUST001_001_2.jpg`
- **권한**: 공개 읽기 권한 설정

### 3. 현재 API 엔드포인트

```typescript
// 상담 관리 API
GET  /api/consultation?customerId={id}  // 상담 내역 조회
POST /api/consultation                  // 상담 등록

// Google Drive API
POST /api/google-drive                  // 이미지 업로드
```

## 🎯 Supabase 목표 구조

### 1. PostgreSQL 테이블 설계

#### **consultations 테이블**
```sql
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,  -- CUST001_001 형식
  customer_id UUID NOT NULL REFERENCES customers(id),
  consult_date DATE NOT NULL,
  symptoms TEXT NOT NULL,                       -- 호소증상
  patient_condition TEXT,                       -- 환자상태
  tongue_analysis TEXT,                         -- 설진분석
  special_notes TEXT,                          -- 특이사항
  prescription TEXT,                           -- 처방약
  result TEXT,                                 -- 결과
  image_urls JSONB DEFAULT '[]'::jsonb,        -- 이미지 URL 배열
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### **고객-상담 관계**
```sql
-- 인덱스 생성
CREATE INDEX idx_consultations_customer_id ON consultations(customer_id);
CREATE INDEX idx_consultations_consult_date ON consultations(consult_date);
CREATE INDEX idx_consultations_consultation_id ON consultations(consultation_id);

-- 트리거: 업데이트 시간 자동 설정
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_consultations_updated_at 
  BEFORE UPDATE ON consultations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Supabase Storage 구조

#### **버킷 구성**
```
📦 Supabase Storage
├── 🗂️ consultation-images (버킷)
│   ├── 📁 {customer_id}/              -- 고객별 폴더
│   │   ├── 📁 {consultation_id}/      -- 상담별 폴더
│   │   │   ├── 🖼️ image_1.jpg
│   │   │   ├── 🖼️ image_2.jpg
│   │   │   └── 🖼️ image_3.jpg
│   │   └── 📁 {다른_상담_id}/
│   └── 📁 {다른_고객_id}/
└── 🗂️ employee-purchases (기존 버킷)
```

#### **스토리지 정책**
```sql
-- 공개 읽기 정책
CREATE POLICY "Public read access" ON storage.objects 
FOR SELECT TO public USING (bucket_id = 'consultation-images');

-- 인증된 사용자 업로드 정책  
CREATE POLICY "Authenticated upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'consultation-images');

-- 소유자 삭제 정책
CREATE POLICY "Owner delete" ON storage.objects 
FOR DELETE TO authenticated USING (bucket_id = 'consultation-images');
```

## 📋 마이그레이션 계획

### Phase 1: 인프라 준비 (3일)

#### **1단계: Supabase 설정**
- [x] Supabase 프로젝트 확인 (기존 프로젝트 사용)
- [ ] consultation-images 버킷 생성
- [ ] 스토리지 정책 설정
- [ ] 환경 변수 설정

#### **2단계: 데이터베이스 스키마 적용**
- [ ] consultations 테이블 생성
- [ ] 인덱스 및 트리거 설정
- [ ] customers 테이블과 관계 설정
- [ ] 데이터 검증 스크립트 작성

### Phase 2: 데이터 마이그레이션 (5일)

#### **1단계: 데이터 추출**
- [ ] Notion API에서 상담 데이터 추출
- [ ] Google Drive에서 이미지 파일 다운로드
- [ ] 데이터 검증 및 정제

#### **2단계: 데이터 변환**
- [ ] Notion 데이터를 PostgreSQL 형식으로 변환
- [ ] 이미지 파일을 Supabase Storage로 업로드
- [ ] URL 매핑 테이블 생성

#### **3단계: 데이터 검증**
- [ ] 마이그레이션된 데이터 무결성 확인
- [ ] 이미지 링크 유효성 검증
- [ ] 관계 데이터 일치성 확인

### Phase 3: API 개발 (4일)

#### **1단계: 새로운 API 개발**
- [ ] Supabase 기반 상담 조회 API
- [ ] Supabase 기반 상담 등록 API
- [ ] Supabase Storage 이미지 업로드 API
- [ ] TypeScript 타입 정의

#### **2단계: 기존 API 호환성 유지**
- [ ] 기존 API 엔드포인트 유지
- [ ] 응답 형식 호환성 보장
- [ ] 점진적 마이그레이션 지원

### Phase 4: 테스트 및 배포 (3일)

#### **1단계: 테스트**
- [ ] 단위 테스트
- [ ] 통합 테스트
- [ ] 성능 테스트
- [ ] 사용자 시나리오 테스트

#### **2단계: 배포**
- [ ] 스테이징 환경 배포
- [ ] 프로덕션 배포
- [ ] 모니터링 설정

## 💾 데이터베이스 스키마

### 테이블 생성 스크립트

```sql
-- consultations 테이블 생성
CREATE TABLE IF NOT EXISTS consultations (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- 관계 필드
  customer_id UUID NOT NULL,
  
  -- 상담 정보
  consult_date DATE NOT NULL,
  symptoms TEXT NOT NULL,
  patient_condition TEXT,
  tongue_analysis TEXT,
  special_notes TEXT,
  prescription TEXT,
  result TEXT,
  
  -- 이미지 정보 (JSON 배열)
  image_urls JSONB DEFAULT '[]'::jsonb,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT consultations_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultations_customer_id 
  ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consult_date 
  ON consultations(consult_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_id 
  ON consultations(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at 
  ON consultations(created_at DESC);

-- 전체 텍스트 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_symptoms_fts 
  ON consultations USING gin(to_tsvector('korean', symptoms));

-- JSON 배열 인덱스 (이미지 개수 조회용)
CREATE INDEX IF NOT EXISTS idx_consultations_image_count 
  ON consultations USING gin(image_urls);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 업데이트 트리거
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at 
  BEFORE UPDATE ON consultations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- RLS 정책 (필요시)
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 모든 사용자 읽기 권한 (상담 데이터는 공개)
CREATE POLICY "Public read access" ON consultations 
  FOR SELECT TO public USING (true);

-- 인증된 사용자만 CUD 권한
CREATE POLICY "Authenticated users full access" ON consultations 
  FOR ALL TO authenticated USING (true);
```

### TypeScript 타입 정의

```typescript
// app/lib/supabase-types.ts
export interface Consultation {
  id: string;
  consultation_id: string;
  customer_id: string;
  consult_date: string;
  symptoms: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface ConsultationCreateInput {
  consultation_id: string;
  customer_id: string;
  consult_date: string;
  symptoms: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_urls?: string[];
}

export interface ConsultationUpdateInput {
  symptoms?: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_urls?: string[];
}
```

## 🗄️ 스토리지 구조

### 버킷 생성 및 설정

```javascript
// Supabase Console 또는 스크립트로 실행
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 1. 버킷 생성
async function createConsultationBucket() {
  const { data, error } = await supabase.storage.createBucket('consultation-images', {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    fileSizeLimit: 10485760 // 10MB
  });
  
  if (error) {
    console.error('버킷 생성 실패:', error);
  } else {
    console.log('버킷 생성 성공:', data);
  }
}

// 2. 스토리지 정책 설정
async function setupStoragePolicies() {
  // 공개 읽기 정책
  await supabase.storage.createPolicy('consultation-images', 'public-read', {
    operation: 'SELECT',
    definition: 'true'
  });
  
  // 인증된 사용자 업로드 정책
  await supabase.storage.createPolicy('consultation-images', 'authenticated-upload', {
    operation: 'INSERT',
    definition: 'auth.role() = "authenticated"'
  });
}
```

### 파일 경로 규칙

```typescript
// 파일 경로 생성 함수
export function generateConsultationImagePath(
  customerId: string,
  consultationId: string,
  imageIndex: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerId}/${consultationId}/image_${imageIndex}.${fileExtension}`;
}

// 예시 경로
// customers/uuid-123/CUST001_001/image_1.jpg
// customers/uuid-456/CUST002_003/image_2.png
```

## 🔧 API 변경 계획

### 새로운 Supabase API 엔드포인트

#### **상담 조회 API**
```typescript
// app/api/consultation-v2/route.ts
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    let query = supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          id,
          name,
          phone
        )
      `)
      .order('consult_date', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    
    const { data, error, count } = await query;
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      consultations: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('상담 조회 오류:', error);
    return NextResponse.json(
      { error: '상담 조회 중 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}
```

#### **상담 등록 API**
```typescript
// app/api/consultation-v2/route.ts
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.symptoms) {
      return NextResponse.json(
        { error: '호소증상은 필수 입력 항목입니다.' }, 
        { status: 400 }
      );
    }
    
    // 상담 ID 생성
    const consultationId = await generateNextConsultationId(data.customer_id);
    
    // 이미지 업로드 처리
    let imageUrls: string[] = [];
    if (data.imageDataArray && Array.isArray(data.imageDataArray)) {
      imageUrls = await uploadConsultationImages(
        data.customer_id,
        consultationId,
        data.imageDataArray
      );
    }
    
    // 상담 데이터 삽입
    const consultationData = {
      consultation_id: consultationId,
      customer_id: data.customer_id,
      consult_date: data.consultDate,
      symptoms: data.symptoms,
      patient_condition: data.patientCondition,
      tongue_analysis: data.tongueAnalysis,
      special_notes: data.specialNotes,
      prescription: data.prescription,
      result: data.result,
      image_urls: imageUrls
    };
    
    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      consultation,
      consultationId
    });
  } catch (error) {
    console.error('상담 등록 오류:', error);
    return NextResponse.json(
      { error: '상담 등록 중 오류가 발생했습니다.' }, 
      { status: 500 }
    );
  }
}
```

#### **이미지 업로드 함수**
```typescript
// app/lib/consultation-utils.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadConsultationImages(
  customerId: string,
  consultationId: string,
  imageDataArray: string[]
): Promise<string[]> {
  const uploadPromises = imageDataArray.map(async (imageData, index) => {
    try {
      // Base64 데이터 처리
      const base64Data = imageData.includes(';base64,') 
        ? imageData.split(';base64,')[1] 
        : imageData;
      
      const buffer = Buffer.from(base64Data, 'base64');
      
      // 파일 경로 생성
      const filePath = generateConsultationImagePath(
        customerId,
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
    } catch (error) {
      console.error(`이미지 ${index + 1} 업로드 실패:`, error);
      return null;
    }
  });
  
  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null) as string[];
}

export async function generateNextConsultationId(customerId: string): Promise<string> {
  // 고객의 마지막 상담 번호 조회
  const { data, error } = await supabase
    .from('consultations')
    .select('consultation_id')
    .eq('customer_id', customerId)
    .order('consultation_id', { ascending: false })
    .limit(1);
  
  if (error) throw error;
  
  let nextNumber = 1;
  if (data && data.length > 0) {
    const lastId = data[0].consultation_id;
    const lastNumber = parseInt(lastId.split('_')[1] || '0');
    nextNumber = lastNumber + 1;
  }
  
  // 고객 정보에서 실제 고객 ID 조회
  const { data: customer } = await supabase
    .from('customers')
    .select('customer_id')
    .eq('id', customerId)
    .single();
  
  const realCustomerId = customer?.customer_id || customerId;
  
  return `${realCustomerId}_${String(nextNumber).padStart(3, '0')}`;
}
```

### 기존 API 호환성 유지

```typescript
// app/api/consultation/route.ts (기존 API 수정)
export async function GET(request: Request) {
  // 환경 변수로 마이그레이션 모드 확인
  const useSupabase = process.env.USE_SUPABASE_CONSULTATION === 'true';
  
  if (useSupabase) {
    // 새로운 Supabase API 호출
    return getConsultationsFromSupabase(request);
  } else {
    // 기존 Notion API 유지
    return getConsultationsFromNotion(request);
  }
}
```

## 📦 데이터 마이그레이션 전략

### 마이그레이션 스크립트

```typescript
// scripts/migrate-consultations.ts
import { createClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationOptions {
  batchSize: number;
  skipExisting: boolean;
  validateData: boolean;
  dryRun: boolean;
}

export async function migrateConsultationsToSupabase(
  options: MigrationOptions = {
    batchSize: 50,
    skipExisting: true,
    validateData: true,
    dryRun: false
  }
) {
  console.log('🚀 상담 데이터 마이그레이션 시작...');
  
  try {
    // 1. Notion에서 모든 상담 데이터 조회
    const consultations = await fetchAllConsultationsFromNotion();
    console.log(`📊 총 ${consultations.length}개의 상담 데이터 발견`);
    
    // 2. 배치 단위로 마이그레이션
    const batches = chunk(consultations, options.batchSize);
    let migrated = 0;
    let errors = 0;
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`🔄 배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);
      
      const results = await Promise.allSettled(
        batch.map(consultation => migrateSingleConsultation(consultation, options))
      );
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          migrated++;
          console.log(`✅ ${batch[index].consultation_id} 마이그레이션 완료`);
        } else {
          errors++;
          console.error(`❌ ${batch[index].consultation_id} 마이그레이션 실패:`, result.reason);
        }
      });
      
      // 배치 간 잠시 대기 (API 부하 방지)
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`🎉 마이그레이션 완료: 성공 ${migrated}개, 실패 ${errors}개`);
    
    // 3. 데이터 검증
    if (options.validateData) {
      await validateMigratedData();
    }
    
  } catch (error) {
    console.error('💥 마이그레이션 실패:', error);
    throw error;
  }
}

async function migrateSingleConsultation(
  notionConsultation: any,
  options: MigrationOptions
): Promise<void> {
  const consultationId = getNotionPropertyValue(notionConsultation.properties.id, 'title');
  
  // 기존 데이터 확인
  if (options.skipExisting) {
    const { data: existing } = await supabase
      .from('consultations')
      .select('id')
      .eq('consultation_id', consultationId)
      .single();
    
    if (existing) {
      console.log(`⏭️ ${consultationId} 이미 존재함, 건너뛰기`);
      return;
    }
  }
  
  // Notion 데이터 변환
  const consultationData = await transformNotionToSupabase(notionConsultation);
  
  // 이미지 마이그레이션
  const imageUrls = await migrateImages(notionConsultation, consultationData.customer_id, consultationId);
  consultationData.image_urls = imageUrls;
  
  // 데이터 검증
  if (options.validateData) {
    validateConsultationData(consultationData);
  }
  
  // Supabase에 삽입
  if (!options.dryRun) {
    const { error } = await supabase
      .from('consultations')
      .insert(consultationData);
    
    if (error) throw error;
  }
}

async function migrateImages(
  notionConsultation: any,
  customerId: string,
  consultationId: string
): Promise<string[]> {
  const imageFiles = getNotionPropertyValue(notionConsultation.properties.증상이미지, 'files');
  
  if (!imageFiles || !Array.isArray(imageFiles)) {
    return [];
  }
  
  const migratedUrls: string[] = [];
  
  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    const imageUrl = imageFile.external?.url || imageFile.file?.url;
    
    if (imageUrl) {
      try {
        // Google Drive에서 이미지 다운로드
        const imageBuffer = await downloadImageFromUrl(imageUrl);
        
        // Supabase Storage에 업로드
        const filePath = generateConsultationImagePath(customerId, consultationId, i + 1);
        
        const { data, error } = await supabase.storage
          .from('consultation-images')
          .upload(filePath, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });
        
        if (error) throw error;
        
        // 공개 URL 생성
        const { data: publicUrl } = supabase.storage
          .from('consultation-images')
          .getPublicUrl(filePath);
        
        migratedUrls.push(publicUrl.publicUrl);
        
      } catch (error) {
        console.error(`이미지 마이그레이션 실패 (${consultationId}_${i + 1}):`, error);
      }
    }
  }
  
  return migratedUrls;
}

// 유틸리티 함수들
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

### 실행 스크립트

```bash
# package.json scripts 추가
{
  "scripts": {
    "migrate:consultations": "npx tsx scripts/migrate-consultations.ts",
    "migrate:dry-run": "npx tsx scripts/migrate-consultations.ts --dry-run",
    "migrate:validate": "npx tsx scripts/validate-migration.ts"
  }
}
```

## 🧪 테스트 계획

### 1. 단위 테스트

```typescript
// __tests__/consultation-migration.test.ts
import { migrateConsultationsToSupabase } from '../scripts/migrate-consultations';
import { createClient } from '@supabase/supabase-js';

describe('상담 데이터 마이그레이션', () => {
  beforeEach(async () => {
    // 테스트 데이터베이스 초기화
  });
  
  test('Notion 데이터가 올바르게 변환되는지 확인', async () => {
    const notionData = createMockNotionConsultation();
    const supabaseData = await transformNotionToSupabase(notionData);
    
    expect(supabaseData.consultation_id).toBe('CUST001_001');
    expect(supabaseData.symptoms).toBe('두통, 어지러움');
  });
  
  test('이미지 URL이 올바르게 마이그레이션되는지 확인', async () => {
    const imageUrls = await migrateImages(mockNotionConsultation, 'uuid-123', 'CUST001_001');
    
    expect(imageUrls).toHaveLength(2);
    expect(imageUrls[0]).toContain('consultation-images');
  });
  
  test('배치 처리가 올바르게 작동하는지 확인', async () => {
    const options = { batchSize: 2, skipExisting: false, validateData: true, dryRun: true };
    
    await expect(migrateConsultationsToSupabase(options)).resolves.not.toThrow();
  });
});
```

### 2. 통합 테스트

```typescript
// __tests__/integration/consultation-api.test.ts
describe('상담 API 통합 테스트', () => {
  test('새로운 Supabase API가 올바르게 작동하는지 확인', async () => {
    const response = await fetch('/api/consultation-v2?customerId=uuid-123');
    const data = await response.json();
    
    expect(data.success).toBe(true);
    expect(data.consultations).toBeInstanceOf(Array);
  });
  
  test('이미지 업로드가 올바르게 작동하는지 확인', async () => {
    const consultationData = {
      customer_id: 'uuid-123',
      symptoms: '테스트 증상',
      consultDate: '2025-05-31',
      imageDataArray: [mockBase64Image]
    };
    
    const response = await fetch('/api/consultation-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultationData)
    });
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.consultation.image_urls).toHaveLength(1);
  });
});
```

### 3. 성능 테스트

```typescript
// __tests__/performance/consultation-performance.test.ts
describe('상담 API 성능 테스트', () => {
  test('대량 데이터 조회 성능', async () => {
    const startTime = Date.now();
    
    const response = await fetch('/api/consultation-v2?limit=100');
    const data = await response.json();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(2000); // 2초 이내
    expect(data.consultations).toHaveLength(100);
  });
  
  test('이미지 업로드 성능', async () => {
    const largeImageData = generateLargeBase64Image(); // 5MB 이미지
    
    const startTime = Date.now();
    
    const consultationData = {
      customer_id: 'uuid-123',
      symptoms: '성능 테스트',
      consultDate: '2025-05-31',
      imageDataArray: [largeImageData]
    };
    
    const response = await fetch('/api/consultation-v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(consultationData)
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(10000); // 10초 이내
    expect(response.ok).toBe(true);
  });
});
```

## 🔄 롤백 계획

### 롤백 시나리오

1. **데이터 손실 발생**
2. **성능 문제 발생**
3. **API 호환성 문제**
4. **이미지 접근 불가**

### 롤백 스크립트

```typescript
// scripts/rollback-to-notion.ts
export async function rollbackToNotion() {
  console.log('🔄 Notion API로 롤백 시작...');
  
  // 1. 환경 변수 변경
  await updateEnvironmentVariable('USE_SUPABASE_CONSULTATION', 'false');
  
  // 2. API 라우팅 복원
  await restoreNotionAPIRoutes();
  
  // 3. 데이터 무결성 확인
  await validateNotionData();
  
  console.log('✅ 롤백 완료');
}
```

### 백업 전략

```bash
# 1. 마이그레이션 전 Notion 데이터 백업
npm run backup:notion

# 2. Supabase 데이터 백업
npm run backup:supabase

# 3. 이미지 파일 백업
npm run backup:images
```

## 📋 체크리스트

### 마이그레이션 전 확인사항
- [ ] Supabase 프로젝트 준비 완료
- [ ] 환경 변수 설정 완료
- [ ] 데이터베이스 스키마 적용 완료
- [ ] 스토리지 버킷 생성 완료
- [ ] 백업 스크립트 준비 완료
- [ ] 테스트 환경 구축 완료

### 마이그레이션 중 확인사항
- [ ] 데이터 추출 완료
- [ ] 데이터 변환 검증 완료
- [ ] 이미지 마이그레이션 완료
- [ ] 데이터 무결성 확인 완료
- [ ] API 테스트 통과

### 마이그레이션 후 확인사항
- [ ] 기능 테스트 통과
- [ ] 성능 테스트 통과
- [ ] 사용자 테스트 완료
- [ ] 모니터링 설정 완료
- [ ] 문서 업데이트 완료

---

**문서 관리**: 이 문서는 마이그레이션 진행에 따라 지속적으로 업데이트됩니다.  
**최종 업데이트**: 2025-05-31  
**담당자**: [개발팀]  
**검토자**: [아키텍트]
