# 고객 관리 시스템 Supabase 마이그레이션 구현 가이드

> **참조 문서**: CUSTOMER_MIGRATION_TO_SUPABASE.md  
> **구현 단계**: Phase별 상세 구현 가이드  
> **업데이트**: 2025-05-31  

## 📋 목차

- [구현 환경 설정](#구현-환경-설정)
- [Phase 1: 인프라 준비](#phase-1-인프라-준비)
- [Phase 2: 데이터 마이그레이션](#phase-2-데이터-마이그레이션)
- [Phase 3: API 개발](#phase-3-api-개발)
- [Phase 4: 얼굴 인식 시스템](#phase-4-얼굴-인식-시스템)
- [Phase 5: 통합 테스트](#phase-5-통합-테스트)
- [트러블슈팅](#트러블슈팅)

## 🔧 구현 환경 설정

### 1. 환경 변수 추가

```env
# .env.local에 추가
# 고객 관리 시스템 마이그레이션 설정
USE_SUPABASE_CUSTOMER=false  # 마이그레이션 완료 후 true로 변경
CUSTOMER_MIGRATION_MODE=true # 마이그레이션 중에만 true

# Supabase Storage 설정 (기존 설정 확장)
SUPABASE_CUSTOMER_BUCKET=customer-profiles
```

### 2. TypeScript 타입 정의

```typescript
// app/lib/types/customer.ts
export interface NotionCustomerData {
  id: string;
  customer_id: string;
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string; // JSON 문자열
  drive_folder_id?: string;
  is_deleted: boolean;
  consultation_count: number;
  created_at: string;
}

export interface SupabaseCustomerData {
  id?: string;
  customer_id: string;
  notion_id?: string;
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
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;
  consultation_count?: number;
  last_consultation_date?: string;
}

export interface FaceEmbeddingData {
  faceDetected: boolean;
  confidence: number;
  embedding: {
    eyeDistanceRatio: number;
    eyeNoseRatio: number;
    noseMouthRatio: number;
    symmetryScore: number;
    contourFeatures: string;
    faceWidth?: number;
    faceHeight?: number;
  };
  demographics: {
    gender: string;
    ageRange: string;
  };
  distinctiveFeatures: string[];
  imageMetadata: {
    quality: number;
    lighting: string;
    angle: string;
  };
  processingInfo: {
    model: string;
    version: string;
    timestamp: string;
  };
}
```

## 🏗️ Phase 1: 인프라 준비

### 1.1 Supabase Storage 설정

```typescript
// scripts/setup-customer-storage.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function setupCustomerStorage() {
  console.log('👥 고객 프로필 스토리지 설정 시작...');

  try {
    // 1. 고객 프로필 버킷 생성
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket(
      'customer-profiles',
      {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 10485760, // 10MB
      }
    );

    if (bucketError && bucketError.message !== 'Bucket already exists') {
      throw bucketError;
    }

    console.log('✅ customer-profiles 버킷 생성:', bucket || '이미 존재함');

    // 2. 스토리지 정책 설정 (수동 설정 필요)
    console.log('ℹ️ 다음 스토리지 정책을 Supabase Dashboard에서 수동으로 설정하세요:');
    console.log(`
-- 고객 프로필 읽기 정책
CREATE POLICY "Customer profiles read access" ON storage.objects 
FOR SELECT TO public USING (bucket_id = 'customer-profiles');

-- 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated customer upload" ON storage.objects 
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'customer-profiles');

-- 인증된 사용자 업데이트 정책
CREATE POLICY "Customer profile update" ON storage.objects 
FOR UPDATE TO authenticated USING (bucket_id = 'customer-profiles');

-- 인증된 사용자 삭제 정책
CREATE POLICY "Customer profile delete" ON storage.objects 
FOR DELETE TO authenticated USING (bucket_id = 'customer-profiles');
    `);

    // 3. 테스트 폴더 생성
    await createTestCustomerFolder();

    console.log('🎉 고객 스토리지 설정 완료');
    return true;

  } catch (error) {
    console.error('💥 고객 스토리지 설정 실패:', error);
    throw error;
  }
}

async function createTestCustomerFolder() {
  const testFolderPath = 'test/';
  
  const { error } = await supabase.storage
    .from('customer-profiles')
    .upload(`${testFolderPath}.keep`, new Blob(['test'], { type: 'text/plain' }));

  if (error && !error.message.includes('already exists')) {
    console.warn('테스트 폴더 생성 실패:', error);
  } else {
    console.log('✅ 테스트 폴더 생성 완료');
  }
}

// 실행
if (require.main === module) {
  setupCustomerStorage()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 1.2 데이터베이스 스키마 적용

```sql
-- database/customer_schema.sql
-- 고객 관리 시스템 테이블 생성

-- 1. customers 테이블 생성
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
  face_last_updated TIMESTAMP WITH TIME ZONE,
  
  -- 폴더 관리
  drive_folder_id VARCHAR(100), -- 기존 Google Drive ID (호환용)
  storage_folder_path VARCHAR(200), -- Supabase Storage 경로
  
  -- 상태 관리
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100),
  
  -- 통계 정보
  consultation_count INTEGER DEFAULT 0,
  last_consultation_date DATE,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
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

-- 2. 기본 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_customer_id 
  ON customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name 
  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone 
  ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted 
  ON customers(is_deleted);
CREATE INDEX IF NOT EXISTS idx_customers_created_at 
  ON customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_notion_id 
  ON customers(notion_id) WHERE notion_id IS NOT NULL;

-- 3. 전체 텍스트 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_name_fts 
  ON customers USING gin(to_tsvector('korean', name));
CREATE INDEX IF NOT EXISTS idx_customers_address_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(address, '')));
CREATE INDEX IF NOT EXISTS idx_customers_notes_fts 
  ON customers USING gin(to_tsvector('korean', coalesce(special_notes, '')));

-- 4. 얼굴 임베딩 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_face_embedding 
  ON customers USING gin(face_embedding) 
  WHERE face_embedding IS NOT NULL;

-- 5. 업데이트 트리거
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_customers_updated_at();

-- 6. RLS 정책
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active customers" ON customers;
CREATE POLICY "Public read active customers" ON customers 
  FOR SELECT TO public USING (is_deleted = false);

DROP POLICY IF EXISTS "Authenticated full access" ON customers;
CREATE POLICY "Authenticated full access" ON customers 
  FOR ALL TO authenticated USING (true);

-- 7. 고객 번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_next_customer_id()
RETURNS VARCHAR(10) AS $$
DECLARE
  next_number INTEGER;
  max_id VARCHAR(10);
BEGIN
  -- 현재 최대 고객 번호 조회
  SELECT customer_id INTO max_id
  FROM customers 
  WHERE customer_id ~ '^[0-9]{5}$'
  ORDER BY CAST(customer_id AS INTEGER) DESC
  LIMIT 1;
  
  IF max_id IS NULL THEN
    next_number := 1;
  ELSE
    next_number := CAST(max_id AS INTEGER) + 1;
  END IF;
  
  RETURN lpad(next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- 8. 고객 통계 업데이트 함수
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
    ),
    updated_at = now()
  WHERE id = customer_uuid;
END;
$$ LANGUAGE plpgsql;

-- 9. 고객 검색 함수
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
  created_at TIMESTAMP WITH TIME ZONE,
  has_face_data BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.customer_id, c.name, c.phone, c.gender, 
    c.estimated_age, c.consultation_count, 
    c.last_consultation_date, c.created_at,
    (c.face_embedding IS NOT NULL) as has_face_data
  FROM customers c
  WHERE 
    (include_deleted = true OR c.is_deleted = false)
    AND (search_term IS NULL OR (
      c.name ILIKE '%' || search_term || '%' OR
      c.address ILIKE '%' || search_term || '%' OR
      c.special_notes ILIKE '%' || search_term || '%' OR
      c.customer_id ILIKE '%' || search_term || '%'
    ))
    AND (search_phone IS NULL OR c.phone ILIKE '%' || search_phone || '%')
    AND (search_gender IS NULL OR c.gender = search_gender)
  ORDER BY 
    CASE WHEN search_term IS NOT NULL AND c.name ILIKE search_term || '%' THEN 1 ELSE 2 END,
    c.consultation_count DESC,
    c.name
  LIMIT page_size OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
SELECT 'customer_schema.sql 적용 완료' AS message;
```

## 📦 Phase 2: 데이터 마이그레이션

### 2.1 Notion 고객 데이터 추출

```typescript
// scripts/extract-notion-customers.ts
import { Client } from '@notionhq/client';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { NotionCustomerData } from '../app/lib/types/customer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function extractAllNotionCustomers(): Promise<NotionCustomerData[]> {
  console.log('👥 Notion 고객 데이터 추출 시작...');

  try {
    const customers: NotionCustomerData[] = [];
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      console.log(`페이지 조회 중... (커서: ${nextCursor || '시작'})`);

      const response = await notion.databases.query({
        database_id: process.env.NOTION_CUSTOMER_DB_ID!,
        start_cursor: nextCursor,
        page_size: 100,
        sorts: [
          {
            property: 'id',
            direction: 'ascending'
          }
        ]
      });

      for (const page of response.results) {
        try {
          const customer = await parseNotionCustomer(page as any);
          if (customer) {
            customers.push(customer);
          }
        } catch (error) {
          console.error(`고객 페이지 파싱 실패 (${page.id}):`, error);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;

      console.log(`현재까지 추출된 고객: ${customers.length}개`);
    }

    // 결과 저장
    const migrationDir = join(process.cwd(), 'migration_data');
    if (!existsSync(migrationDir)) {
      mkdirSync(migrationDir, { recursive: true });
    }

    const outputPath = join(migrationDir, 'notion_customers.json');
    writeFileSync(outputPath, JSON.stringify(customers, null, 2));

    console.log(`🎉 고객 데이터 추출 완료: 총 ${customers.length}개의 고객`);
    console.log(`💾 저장 위치: ${outputPath}`);

    // 통계 출력
    printCustomerStatistics(customers);

    return customers;

  } catch (error) {
    console.error('💥 Notion 고객 데이터 추출 실패:', error);
    throw error;
  }
}

async function parseNotionCustomer(page: any): Promise<NotionCustomerData | null> {
  try {
    const properties = page.properties;

    // 필수 필드 검증
    const customerId = getNotionPropertyValue(properties.id, 'title');
    const name = getNotionPropertyValue(properties.고객명, 'rich_text');

    if (!customerId || !name) {
      console.warn(`필수 필드 누락, 건너뛰기: ${customerId || page.id}`);
      return null;
    }

    const customer: NotionCustomerData = {
      id: page.id,
      customer_id: customerId,
      name: name,
      phone: getNotionPropertyValue(properties.전화번호, 'phone_number'),
      gender: getNotionPropertyValue(properties.성별, 'select'),
      birth_date: getNotionPropertyValue(properties.생년월일, 'date'),
      estimated_age: getNotionPropertyValue(properties.추정나이, 'number'),
      address: getNotionPropertyValue(properties.주소, 'rich_text'),
      special_notes: getNotionPropertyValue(properties.특이사항, 'rich_text'),
      face_embedding: getNotionPropertyValue(properties.얼굴_임베딩, 'rich_text'),
      drive_folder_id: getNotionPropertyValue(properties.customerFolderId, 'rich_text'),
      is_deleted: getNotionPropertyValue(properties.삭제됨, 'checkbox') || false,
      consultation_count: getNotionPropertyValue(properties.상담수, 'formula') || 0,
      created_at: page.created_time
    };

    return customer;

  } catch (error) {
    console.error(`고객 파싱 오류 (${page.id}):`, error);
    return null;
  }
}

function getNotionPropertyValue(property: any, type: string): any {
  if (!property) return null;

  switch (type) {
    case 'title':
      return property.title?.[0]?.text?.content || null;
    case 'rich_text':
      return property.rich_text?.[0]?.text?.content || null;
    case 'phone_number':
      return property.phone_number || null;
    case 'select':
      return property.select?.name || null;
    case 'date':
      return property.date?.start || null;
    case 'number':
      return property.number || null;
    case 'checkbox':
      return property.checkbox || false;
    case 'formula':
      return property.formula?.number || 0;
    default:
      return null;
  }
}

function printCustomerStatistics(customers: NotionCustomerData[]) {
  console.log('\n📊 고객 데이터 통계:');
  
  const activeCustomers = customers.filter(c => !c.is_deleted);
  const deletedCustomers = customers.filter(c => c.is_deleted);
  
  console.log(`- 전체 고객: ${customers.length}개`);
  console.log(`- 활성 고객: ${activeCustomers.length}개`);
  console.log(`- 삭제된 고객: ${deletedCustomers.length}개`);
  
  // 성별 통계
  const genderStats = customers.reduce((acc, customer) => {
    const gender = customer.gender || '미지정';
    acc[gender] = (acc[gender] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('- 성별 분포:');
  Object.entries(genderStats).forEach(([gender, count]) => {
    console.log(`  ${gender}: ${count}명`);
  });
  
  // 얼굴 데이터 통계
  const withFaceData = customers.filter(c => c.face_embedding && c.face_embedding.length > 0);
  console.log(`- 얼굴 데이터 보유: ${withFaceData.length}개 (${Math.round(withFaceData.length / customers.length * 100)}%)`);
  
  // 상담 통계
  const totalConsultations = customers.reduce((sum, customer) => sum + customer.consultation_count, 0);
  const avgConsultations = totalConsultations / customers.length;
  console.log(`- 총 상담 수: ${totalConsultations}개`);
  console.log(`- 평균 상담 수: ${avgConsultations.toFixed(1)}개/고객`);
}

// 실행
if (require.main === module) {
  extractAllNotionCustomers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 2.2 Supabase 고객 데이터 삽입

```typescript
// scripts/insert-customer-data.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionCustomerData, SupabaseCustomerData } from '../app/lib/types/customer';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function insertCustomerData(): Promise<void> {
  console.log('👥 Supabase 고객 데이터 삽입 시작...');

  try {
    // 추출된 고객 데이터 로드
    const customersPath = join(process.cwd(), 'migration_data', 'notion_customers.json');
    const notionCustomers: NotionCustomerData[] = JSON.parse(readFileSync(customersPath, 'utf-8'));

    console.log(`📥 로드된 고객 데이터: ${notionCustomers.length}개`);

    // 고객 데이터 변환
    const transformedCustomers = notionCustomers.map(transformNotionCustomer);

    // 배치 단위로 삽입
    const batchSize = 25;
    const batches = chunkArray(transformedCustomers, batchSize);
    
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      try {
        // 각 고객의 스토리지 폴더 생성
        for (const customer of batch) {
          await createCustomerStorageFolder(customer.customer_id);
        }

        // 고객 데이터 삽입
        const { data, error } = await supabase
          .from('customers')
          .insert(batch)
          .select();

        if (error) throw error;

        insertedCount += data.length;
        console.log(`✅ 배치 ${i + 1} 완료: ${data.length}개 삽입`);

      } catch (error: any) {
        console.error(`배치 ${i + 1} 삽입 실패:`, error.message);
        errorCount += batch.length;
      }

      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 고객 데이터 삽입 완료: 성공 ${insertedCount}개, 실패 ${errorCount}개`);

    // 데이터 검증
    await validateInsertedData();

  } catch (error) {
    console.error('💥 고객 데이터 삽입 실패:', error);
    throw error;
  }
}

function transformNotionCustomer(notionCustomer: NotionCustomerData): SupabaseCustomerData {
  // 얼굴 임베딩 데이터 파싱
  let faceEmbedding = null;
  if (notionCustomer.face_embedding && notionCustomer.face_embedding.length > 0) {
    try {
      const oldEmbedding = JSON.parse(notionCustomer.face_embedding);
      faceEmbedding = convertFaceEmbedding(oldEmbedding);
    } catch (error) {
      console.warn(`얼굴 임베딩 파싱 실패 (${notionCustomer.customer_id}):`, error);
    }
  }

  return {
    customer_id: notionCustomer.customer_id,
    notion_id: notionCustomer.id,
    name: notionCustomer.name,
    phone: notionCustomer.phone,
    gender: notionCustomer.gender,
    birth_date: notionCustomer.birth_date,
    estimated_age: notionCustomer.estimated_age,
    address: notionCustomer.address,
    special_notes: notionCustomer.special_notes,
    face_embedding: faceEmbedding,
    drive_folder_id: notionCustomer.drive_folder_id,
    storage_folder_path: `${notionCustomer.customer_id}/`,
    is_deleted: notionCustomer.is_deleted,
    consultation_count: notionCustomer.consultation_count,
    created_at: notionCustomer.created_at
  };
}

function convertFaceEmbedding(oldEmbedding: any): any {
  // 기존 Notion 형식을 새로운 Supabase 형식으로 변환
  return {
    faceDetected: oldEmbedding.faceDetected || false,
    confidence: calculateConfidence(oldEmbedding),
    embedding: {
      eyeDistanceRatio: oldEmbedding.embedding?.eyeDistanceRatio || 0.45,
      eyeNoseRatio: oldEmbedding.embedding?.eyeNoseRatio || 0.35,
      noseMouthRatio: oldEmbedding.embedding?.noseMouthRatio || 0.25,
      symmetryScore: oldEmbedding.embedding?.symmetryScore || 0.8,
      contourFeatures: oldEmbedding.embedding?.contourFeatures || '타원형',
      faceWidth: oldEmbedding.embedding?.faceWidth || 1.0,
      faceHeight: oldEmbedding.embedding?.faceHeight || 1.0
    },
    demographics: {
      gender: oldEmbedding.gender || '불명',
      ageRange: calculateAgeRange(oldEmbedding.age || 30)
    },
    distinctiveFeatures: oldEmbedding.distinctiveFeatures || [],
    imageMetadata: {
      quality: oldEmbedding.imageQualityScore || 70,
      lighting: '보통',
      angle: '정면'
    },
    processingInfo: {
      model: 'gemini-1.5-flash',
      version: '2024',
      timestamp: new Date().toISOString()
    }
  };
}

function calculateConfidence(oldEmbedding: any): number {
  const qualityScore = oldEmbedding.imageQualityScore || 70;
  const faceDetected = oldEmbedding.faceDetected || false;
  
  if (!faceDetected) return 0.0;
  return Math.min(1.0, qualityScore / 100);
}

function calculateAgeRange(age: number): string {
  if (age < 20) return '10대';
  if (age < 30) return '20대';
  if (age < 40) return '30대';
  if (age < 50) return '40대';
  if (age < 60) return '50대';
  if (age < 70) return '60대';
  return '70대 이상';
}

async function createCustomerStorageFolder(customerId: string): Promise<void> {
  try {
    const folderPath = `${customerId}/`;
    
    const { error } = await supabase.storage
      .from('customer-profiles')
      .upload(`${folderPath}.keep`, new Blob([''], { type: 'text/plain' }), {
        upsert: true
      });

    if (error && !error.message.includes('already exists')) {
      console.warn(`폴더 생성 실패 (${customerId}):`, error.message);
    }

  } catch (error) {
    console.warn(`폴더 생성 오류 (${customerId}):`, error);
  }
}

async function validateInsertedData(): Promise<void> {
  console.log('🔍 삽입된 데이터 검증 중...');

  try {
    const { data: stats, error: statsError } = await supabase
      .from('customers')
      .select('id, is_deleted', { count: 'exact' });

    if (!statsError && stats) {
      const activeCount = stats.filter(c => !c.is_deleted).length;
      const deletedCount = stats.filter(c => c.is_deleted).length;
      
      console.log(`📊 고객 데이터 통계:`);
      console.log(`- 총 고객 수: ${stats.length}개`);
      console.log(`- 활성 고객: ${activeCount}개`);
      console.log(`- 삭제된 고객: ${deletedCount}개`);
    }

  } catch (error) {
    console.error('데이터 검증 중 오류:', error);
  }
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// 실행
if (require.main === module) {
  insertCustomerData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

## 🔧 Phase 3: API 개발

### 3.1 새로운 Supabase 기반 고객 API

```typescript
// app/api/customer-v2/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 고객 검색 및 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || searchParams.get('name');
  const phone = searchParams.get('phone');
  const gender = searchParams.get('gender');
  const customerId = searchParams.get('id');
  const includeDeleted = searchParams.get('includeDeleted') === 'true';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // 특정 고객 ID로 조회
  if (customerId) {
    return getCustomerById(customerId);
  }

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
        추정나이: {
          number: customer.estimated_age
        },
        상담수: {
          formula: { number: customer.consultation_count }
        },
        has_face_data: customer.has_face_data
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

async function getCustomerById(customerId: string) {
  try {
    let query = supabase
      .from('customers')
      .select('*')
      .single();

    // UUID 형식인지 확인
    if (customerId.includes('-')) {
      query = query.eq('id', customerId);
    } else {
      query = query.eq('customer_id', customerId);
    }

    const { data: customer, error } = await query;

    if (error) throw error;

    if (!customer) {
      return NextResponse.json(
        { error: '고객을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 기존 API 형식으로 변환
    const formattedCustomer = {
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
        생년월일: {
          date: customer.birth_date ? { start: customer.birth_date } : null
        },
        추정나이: {
          number: customer.estimated_age
        },
        주소: {
          rich_text: customer.address ? [{ text: { content: customer.address } }] : []
        },
        특이사항: {
          rich_text: customer.special_notes ? [{ text: { content: customer.special_notes } }] : []
        },
        얼굴_임베딩: {
          rich_text: customer.face_embedding ? [{ text: { content: JSON.stringify(customer.face_embedding) } }] : []
        },
        상담수: {
          formula: { number: customer.consultation_count }
        },
        삭제됨: {
          checkbox: customer.is_deleted
        }
      },
      created_time: customer.created_at,
      last_edited_time: customer.updated_at
    };

    return NextResponse.json({
      success: true,
      customers: [formattedCustomer]
    });

  } catch (error) {
    console.error('특정 고객 조회 오류:', error);
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

    // 얼굴 임베딩 데이터 처리
    let faceEmbedding = null;
    if (data.faceEmbedding) {
      if (typeof data.faceEmbedding === 'string') {
        try {
          faceEmbedding = JSON.parse(data.faceEmbedding);
        } catch (error) {
          console.warn('얼굴 임베딩 파싱 실패:', error);
        }
      } else {
        faceEmbedding = data.faceEmbedding;
      }
    }

    // 고객 데이터 생성
    const customerData = {
      customer_id: nextId,
      name: data.name,
      phone: data.phone,
      gender: data.gender,
      birth_date: data.birth,
      estimated_age: data.estimatedAge ? parseInt(data.estimatedAge) : null,
      address: data.address,
      special_notes: data.specialNote,
      face_embedding: faceEmbedding,
      storage_folder_path: `${nextId}/`
    };

    // 고객 데이터 삽입
    const { data: customer, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw error;

    // 프로필 폴더 생성
    await createCustomerStorageFolder(customer.customer_id);

    // 기존 API 응답 형식 유지
    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        customId: customer.customer_id,
        name: customer.name
      }
    });

  } catch (error: any) {
    console.error('고객 등록 오류:', error);
    return NextResponse.json(
      { error: `고객 등록 중 오류가 발생했습니다: ${error.message}` },
      { status: 500 }
    );
  }
}

async function createCustomerStorageFolder(customerId: string): Promise<void> {
  try {
    const folderPath = `${customerId}/`;
    
    const { error } = await supabase.storage
      .from('customer-profiles')
      .upload(`${folderPath}.keep`, new Blob([''], { type: 'text/plain' }), {
        upsert: true
      });

    if (error && !error.message.includes('already exists')) {
      console.warn(`폴더 생성 실패 (${customerId}):`, error.message);
    }

  } catch (error) {
    console.warn(`폴더 생성 오류 (${customerId}):`, error);
  }
}
```

### 3.2 기존 API 호환성 유지

```typescript
// app/api/customer/route.ts (기존 API 수정)
import { NextResponse } from 'next/server';

// 마이그레이션 모드에 따른 라우팅
const USE_SUPABASE = process.env.USE_SUPABASE_CUSTOMER === 'true';

export async function GET(request: Request) {
  if (USE_SUPABASE) {
    // 새로운 Supabase API로 라우팅
    const { searchParams } = new URL(request.url);
    const newUrl = new URL('/api/customer-v2', request.url);
    newUrl.search = searchParams.toString();
    
    return fetch(newUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
  } else {
    // 기존 Notion API 유지
    return getCustomersFromNotion(request);
  }
}

export async function POST(request: Request) {
  if (USE_SUPABASE) {
    // 새로운 Supabase API로 라우팅
    const body = await request.json();
    
    return fetch(new URL('/api/customer-v2', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } else {
    // 기존 Notion API 유지
    return postCustomerToNotion(request);
  }
}

// 기존 Notion API 함수들 (백업용)
async function getCustomersFromNotion(request: Request) {
  // 기존 코드 유지...
}

async function postCustomerToNotion(request: Request) {
  // 기존 코드 유지...
}
```

## 🎭 Phase 4: 얼굴 인식 시스템

### 4.1 향상된 얼굴 인식 API

```typescript
// app/api/face-recognition-v2/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const customerId = formData.get('customerId') as string;
    const updateCustomer = formData.get('updateCustomer') === 'true';

    if (!imageFile) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 1. 얼굴 분석 (기존 Gemini API 사용)
    const faceAnalysis = await analyzeFaceWithGemini(imageFile);

    // 2. 기존 고객과 매칭 (customerId가 없는 경우)
    let matchedCustomers = [];
    if (!customerId && faceAnalysis.faceDetected) {
      matchedCustomers = await findSimilarCustomers(faceAnalysis);
    }

    // 3. 고객 이미지 저장 및 데이터 업데이트
    let imageUrl = null;
    if (customerId && updateCustomer) {
      imageUrl = await saveCustomerFaceImage(customerId, imageFile);
      await updateCustomerFaceData(customerId, faceAnalysis, imageUrl);
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

async function findSimilarCustomers(faceAnalysis: any) {
  try {
    const { data, error } = await supabase
      .rpc('find_similar_faces', {
        target_embedding: faceAnalysis.embedding,
        similarity_threshold: 0.7,
        max_results: 5
      });

    if (error) throw error;
    return data || [];

  } catch (error) {
    console.error('유사 고객 검색 오류:', error);
    return [];
  }
}

async function saveCustomerFaceImage(customerId: string, imageFile: File): Promise<string> {
  try {
    const fileName = `profile_${Date.now()}.jpg`;
    const filePath = `${customerId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('customer-profiles')
      .upload(filePath, imageFile, {
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrl } = supabase.storage
      .from('customer-profiles')
      .getPublicUrl(filePath);

    return publicUrl.publicUrl;

  } catch (error) {
    console.error('이미지 저장 오류:', error);
    throw error;
  }
}

async function updateCustomerFaceData(
  customerId: string, 
  faceAnalysis: any, 
  imageUrl: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('customers')
      .update({
        face_embedding: faceAnalysis,
        face_image_url: imageUrl,
        face_last_updated: new Date().toISOString()
      })
      .eq('customer_id', customerId);

    if (error) throw error;

  } catch (error) {
    console.error('고객 얼굴 데이터 업데이트 오류:', error);
    throw error;
  }
}

async function analyzeFaceWithGemini(imageFile: File): Promise<any> {
  // 기존 Gemini 분석 로직 재사용
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await fetch('/api/face-embedding', {
    method: 'POST',
    body: formData
  });

  const result = await response.json();
  return result.data;
}
```

## 🧪 Phase 5: 통합 테스트

### 5.1 마이그레이션 테스트 스크립트

```typescript
// scripts/test-customer-migration.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function testCustomerMigration(): Promise<void> {
  console.log('🧪 고객 마이그레이션 테스트 시작...');

  try {
    // 1. 데이터베이스 연결 테스트
    await testDatabaseConnection();

    // 2. 스키마 검증
    await testSchema();

    // 3. 데이터 무결성 검사
    await testDataIntegrity();

    // 4. API 엔드포인트 테스트
    await testAPIEndpoints();

    // 5. 얼굴 인식 기능 테스트
    await testFaceRecognition();

    // 6. 성능 테스트
    await testPerformance();

    console.log('✅ 모든 테스트 통과');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    throw error;
  }
}

async function testDatabaseConnection(): Promise<void> {
  console.log('🔌 데이터베이스 연결 테스트...');

  const { data, error } = await supabase
    .from('customers')
    .select('count', { count: 'exact' })
    .limit(1);

  if (error) throw new Error(`데이터베이스 연결 실패: ${error.message}`);

  console.log(`📊 고객 테이블 레코드 수: ${data.length}`);
}

async function testSchema(): Promise<void> {
  console.log('📋 스키마 검증...');

  // 필수 테이블 존재 확인
  const { data: tables, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'customers');

  if (error || !tables || tables.length === 0) {
    throw new Error('customers 테이블이 존재하지 않습니다.');
  }

  // 필수 함수 테스트
  const { data: nextId, error: funcError } = await supabase
    .rpc('generate_next_customer_id');

  if (funcError) {
    throw new Error(`함수 테스트 실패: ${funcError.message}`);
  }

  console.log(`✅ 스키마 검증 통과, 다음 고객 ID: ${nextId}`);
}

async function testDataIntegrity(): Promise<void> {
  console.log('🔍 데이터 무결성 검사...');

  // 기본 통계 확인
  const { data: stats, error } = await supabase
    .from('customers')
    .select('customer_id, is_deleted, face_embedding');

  if (error) throw error;

  const activeCustomers = stats.filter(c => !c.is_deleted);
  const withFaceData = stats.filter(c => c.face_embedding !== null);

  console.log(`📊 데이터 통계:`);
  console.log(`- 총 고객: ${stats.length}개`);
  console.log(`- 활성 고객: ${activeCustomers.length}개`);
  console.log(`- 얼굴 데이터 보유: ${withFaceData.length}개`);

  // 중복 고객 ID 검사
  const customerIds = stats.map(c => c.customer_id);
  const uniqueIds = new Set(customerIds);
  
  if (customerIds.length !== uniqueIds.size) {
    throw new Error('중복된 고객 ID가 발견되었습니다.');
  }

  console.log('✅ 데이터 무결성 검사 통과');
}

async function testAPIEndpoints(): Promise<void> {
  console.log('🔗 API 엔드포인트 테스트...');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // GET /api/customer-v2 테스트
  const getResponse = await fetch(`${baseUrl}/api/customer-v2?limit=5`);
  if (!getResponse.ok) {
    throw new Error(`GET API 테스트 실패: ${getResponse.status}`);
  }

  const getData = await getResponse.json();
  if (!getData.success || !Array.isArray(getData.customers)) {
    throw new Error('GET API 응답 형식 오류');
  }

  console.log(`✅ GET API 테스트 통과: ${getData.customers.length}개 조회`);
}

async function testFaceRecognition(): Promise<void> {
  console.log('🎭 얼굴 인식 기능 테스트...');

  // 얼굴 데이터가 있는 고객 확인
  const { data: customersWithFaces, error } = await supabase
    .from('customers')
    .select('customer_id, face_embedding')
    .not('face_embedding', 'is', null)
    .limit(1);

  if (error) throw error;

  if (customersWithFaces.length === 0) {
    console.log('ℹ️ 얼굴 데이터가 있는 고객이 없어 기능 테스트를 건너뜁니다.');
    return;
  }

  // 유사도 검색 테스트
  const testCustomer = customersWithFaces[0];
  const { data: similarCustomers, error: searchError } = await supabase
    .rpc('find_similar_faces', {
      target_embedding: testCustomer.face_embedding.embedding,
      similarity_threshold: 0.5,
      max_results: 3
    });

  if (searchError) throw searchError;

  console.log(`✅ 얼굴 인식 테스트 통과: ${similarCustomers.length}개 유사 고객 발견`);
}

async function testPerformance(): Promise<void> {
  console.log('⚡ 성능 테스트...');

  const startTime = Date.now();

  // 대량 데이터 조회 테스트
  const { data, error } = await supabase
    .rpc('search_customers', {
      search_term: null,
      include_deleted: false,
      page_size: 100,
      page_offset: 0
    });

  const endTime = Date.now();
  const duration = endTime - startTime;

  if (error) throw error;

  console.log(`📊 100개 고객 검색 시간: ${duration}ms`);

  if (duration > 3000) {
    console.warn('⚠️ 성능 경고: 검색 시간이 3초를 초과했습니다.');
  } else {
    console.log('✅ 성능 테스트 통과');
  }
}

// 실행
if (require.main === module) {
  testCustomerMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 5.2 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy-customer-migration.sh

echo "👥 고객 관리 시스템 마이그레이션 배포 시작..."

# 1. 환경 변수 확인
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
  exit 1
fi

echo "✅ 환경 변수 확인 완료"

# 2. 의존성 설치
echo "📦 의존성 설치 중..."
npm install

# 3. 데이터베이스 스키마 적용
echo "📊 데이터베이스 스키마 적용 중..."
npm run setup:customer-schema

# 4. 스토리지 설정
echo "🗂️ 스토리지 설정 중..."
npm run setup:customer-storage

# 5. 데이터 마이그레이션
echo "📦 데이터 마이그레이션 시작..."

echo "📥 Notion 데이터 추출 중..."
npm run extract:notion-customers

echo "📊 Supabase 데이터 삽입 중..."
npm run insert:customer-data

# 6. 테스트 실행
echo "🧪 마이그레이션 테스트 중..."
npm run test:customer-migration

# 7. 완료 안내
echo "⚠️ 마이그레이션 완료. 다음 단계를 수동으로 확인하세요:"
echo "1. 테스트 결과 검토"
echo "2. USE_SUPABASE_CUSTOMER=true 설정"
echo "3. 애플리케이션 재시작"
echo "4. 사용자 테스트 수행"

echo "🎉 고객 관리 시스템 마이그레이션 배포 완료!"
```

### 5.3 package.json 스크립트 추가

```json
{
  "scripts": {
    "setup:customer-schema": "tsx scripts/apply-customer-schema.ts",
    "setup:customer-storage": "tsx scripts/setup-customer-storage.ts",
    "extract:notion-customers": "tsx scripts/extract-notion-customers.ts",
    "insert:customer-data": "tsx scripts/insert-customer-data.ts",
    "test:customer-migration": "tsx scripts/test-customer-migration.ts",
    "customer-migration:full": "npm run setup:customer-schema && npm run setup:customer-storage && npm run extract:notion-customers && npm run insert:customer-data && npm run test:customer-migration"
  }
}
```

## 🛠️ 트러블슈팅

### 일반적인 문제 및 해결방법

#### 1. 고객 ID 생성 함수 오류
```bash
❌ Error: function generate_next_customer_id() does not exist
```
**해결방법**: 
```bash
npm run setup:customer-schema
```

#### 2. 스토리지 버킷 접근 오류
```bash
❌ Error: Bucket 'customer-profiles' not found
```
**해결방법**:
```bash
npm run setup:customer-storage
```

#### 3. 얼굴 임베딩 파싱 실패
```bash
❌ JSON 파싱 오류: Unexpected token
```
**해결방법**: 손상된 데이터 건너뛰기
```typescript
try {
  faceEmbedding = JSON.parse(embeddingString);
} catch (error) {
  console.warn('얼굴 임베딩 파싱 실패, 건너뛰기');
  faceEmbedding = null;
}
```

#### 4. 중복 고객 ID 오류
```bash
❌ Error: duplicate key value violates unique constraint
```
**해결방법**: 중복 데이터 제거 후 재시도
```sql
DELETE FROM customers 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM customers 
  GROUP BY customer_id
);
```

### 마이그레이션 중단 시 복구 절차

1. **즉시 롤백**:
```bash
# 환경 변수 복원
USE_SUPABASE_CUSTOMER=false

# 애플리케이션 재시작
npm run dev
```

2. **데이터 복구** (필요시):
```sql
-- 마이그레이션 로그 확인
SELECT * FROM customer_migration_log 
WHERE migration_status = 'failed';

-- 실패한 데이터 재처리
UPDATE customer_migration_log 
SET migration_status = 'pending' 
WHERE migration_status = 'failed';
```

---

**구현 완료 체크리스트**:
- [ ] Phase 1: 인프라 준비 완료
- [ ] Phase 2: 데이터 마이그레이션 완료
- [ ] Phase 3: API 개발 완료
- [ ] Phase 4: 얼굴 인식 시스템 완료
- [ ] Phase 5: 통합 테스트 완료
- [ ] 사용자 교육 및 문서 업데이트

**예상 완료 시간**: 5일 (각 Phase당 1일)  
**위험도**: 낮음 (기존 시스템과 병렬 운영)  
**성공 기준**: 기존 기능 100% 호환 + 성능 향상

**문서 관리**: 이 구현 가이드는 실제 구현 과정에서 발생하는 이슈와 해결책으로 지속 업데이트됩니다.
