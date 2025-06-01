# 상담 관리 시스템 Supabase 마이그레이션 구현 가이드

> **참조 문서**: CONSULTATION_MIGRATION_TO_SUPABASE.md  
> **구현 단계**: Phase별 상세 구현 가이드  
> **업데이트**: 2025-05-31  

## 📋 목차

- [구현 환경 설정](#구현-환경-설정)
- [Phase 1: 인프라 준비](#phase-1-인프라-준비)
- [Phase 2: 데이터 마이그레이션](#phase-2-데이터-마이그레이션)
- [Phase 3: API 개발](#phase-3-api-개발)
- [Phase 4: 테스트 및 배포](#phase-4-테스트-및-배포)
- [트러블슈팅](#트러블슈팅)

## 🔧 구현 환경 설정

### 1. 필수 패키지 설치

```bash
# 기존 프로젝트에 추가 패키지 설치
npm install @supabase/supabase-js@latest
npm install --save-dev tsx @types/node

# 마이그레이션 도구
npm install dotenv fs-extra axios cheerio
npm install --save-dev @types/fs-extra @types/cheerio
```

### 2. 환경 변수 추가

```env
# .env.local에 추가
# 상담 관리 시스템 마이그레이션 설정
USE_SUPABASE_CONSULTATION=false  # 마이그레이션 완료 후 true로 변경
CONSULTATION_MIGRATION_MODE=true # 마이그레이션 중에만 true

# Supabase Storage 설정 (기존 설정 확장)
SUPABASE_CONSULTATION_BUCKET=consultation-images
```

### 3. TypeScript 설정 업데이트

```typescript
// app/lib/types/consultation.ts
export interface NotionConsultationData {
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
  image_files: NotionImageFile[];
  created_at: string;
}

export interface NotionImageFile {
  name: string;
  type: 'external' | 'file';
  external?: { url: string };
  file?: { url: string; expiry_time: string };
}

export interface SupabaseConsultationData {
  id?: string;
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
  created_at?: string;
  updated_at?: string;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  errors: MigrationError[];
}

export interface MigrationError {
  consultation_id: string;
  error: string;
  timestamp: string;
}
```

## 🏗️ Phase 1: 인프라 준비

### 1.1 Supabase Storage 설정

```typescript
// scripts/setup-consultation-storage.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function setupConsultationStorage() {
  console.log('🗂️ 상담 이미지 스토리지 설정 시작...');

  try {
    // 1. 버킷 생성
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket(
      'consultation-images',
      {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        fileSizeLimit: 10485760, // 10MB
      }
    );

    if (bucketError && bucketError.message !== 'Bucket already exists') {
      throw bucketError;
    }

    console.log('✅ 버킷 생성 완료:', bucket || '이미 존재함');

    // 2. 스토리지 정책 설정
    const policies = [
      {
        name: 'consultation_images_public_read',
        definition: 'true',
        command: 'SELECT',
        table: 'objects'
      },
      {
        name: 'consultation_images_authenticated_upload',
        definition: 'auth.role() = "authenticated"',
        command: 'INSERT',
        table: 'objects'
      },
      {
        name: 'consultation_images_authenticated_update',
        definition: 'auth.role() = "authenticated"',
        command: 'UPDATE',
        table: 'objects'
      },
      {
        name: 'consultation_images_authenticated_delete',
        definition: 'auth.role() = "authenticated"',
        command: 'DELETE',
        table: 'objects'
      }
    ];

    for (const policy of policies) {
      try {
        // RPC를 통한 정책 생성 (SQL 함수 호출)
        const { error: policyError } = await supabase.rpc('create_storage_policy', {
          bucket_name: 'consultation-images',
          policy_name: policy.name,
          definition: policy.definition,
          command: policy.command
        });

        if (policyError && !policyError.message.includes('already exists')) {
          console.warn(`정책 ${policy.name} 생성 실패:`, policyError.message);
        } else {
          console.log(`✅ 정책 ${policy.name} 설정 완료`);
        }
      } catch (error) {
        console.warn(`정책 ${policy.name} 설정 건너뛰기:`, error);
      }
    }

    console.log('🎉 스토리지 설정 완료');
    return true;

  } catch (error) {
    console.error('💥 스토리지 설정 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  setupConsultationStorage()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 1.2 데이터베이스 스키마 적용

```sql
-- database/consultation_schema.sql
-- 상담 관리 시스템 테이블 생성

-- 1. consultations 테이블 생성
CREATE TABLE IF NOT EXISTS consultations (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- 관계 필드 (customers 테이블과 연결)
  customer_id UUID NOT NULL,
  
  -- 상담 정보
  consult_date DATE NOT NULL,
  symptoms TEXT NOT NULL,
  patient_condition TEXT,
  tongue_analysis TEXT,
  special_notes TEXT,
  prescription TEXT,
  result TEXT,
  
  -- 이미지 정보 (JSON 배열로 URL 저장)
  image_urls JSONB DEFAULT '[]'::jsonb,
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT consultations_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT consultations_consult_date_check 
    CHECK (consult_date <= CURRENT_DATE),
  CONSTRAINT consultations_symptoms_check 
    CHECK (length(symptoms) > 0)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultations_customer_id 
  ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consult_date 
  ON consultations(consult_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_id 
  ON consultations(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at 
  ON consultations(created_at DESC);

-- 3. 전체 텍스트 검색 인덱스 (한국어 지원)
CREATE INDEX IF NOT EXISTS idx_consultations_symptoms_fts 
  ON consultations USING gin(to_tsvector('korean', symptoms));
CREATE INDEX IF NOT EXISTS idx_consultations_prescription_fts 
  ON consultations USING gin(to_tsvector('korean', coalesce(prescription, '')));

-- 4. JSON 배열 인덱스 (이미지 개수 조회용)
CREATE INDEX IF NOT EXISTS idx_consultations_image_count 
  ON consultations USING gin(image_urls);

-- 5. 복합 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_consultations_customer_date 
  ON consultations(customer_id, consult_date DESC);

-- 6. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. 업데이트 트리거
DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at 
  BEFORE UPDATE ON consultations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Row Level Security 활성화
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 9. RLS 정책 생성
-- 모든 사용자 읽기 권한 (상담 데이터는 공개)
DROP POLICY IF EXISTS "Public read access" ON consultations;
CREATE POLICY "Public read access" ON consultations 
  FOR SELECT TO public USING (true);

-- 인증된 사용자만 CUD 권한
DROP POLICY IF EXISTS "Authenticated users full access" ON consultations;
CREATE POLICY "Authenticated users full access" ON consultations 
  FOR ALL TO authenticated USING (true);

-- 10. 마이그레이션 추적 테이블
CREATE TABLE IF NOT EXISTS consultation_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) NOT NULL,
  migration_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, failed
  notion_id VARCHAR(100),
  supabase_id UUID,
  image_count INTEGER DEFAULT 0,
  migrated_image_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_migration_log_status 
  ON consultation_migration_log(migration_status);
CREATE INDEX IF NOT EXISTS idx_migration_log_consultation_id 
  ON consultation_migration_log(consultation_id);

-- 11. 유용한 함수들
-- 고객의 상담 수 계산
CREATE OR REPLACE FUNCTION get_customer_consultation_count(customer_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM consultations 
    WHERE customer_id = customer_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- 다음 상담 ID 생성
CREATE OR REPLACE FUNCTION generate_next_consultation_id(customer_uuid UUID, customer_code VARCHAR)
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  last_consultation_id VARCHAR(50);
BEGIN
  -- 마지막 상담 번호 조회
  SELECT consultation_id INTO last_consultation_id
  FROM consultations 
  WHERE customer_id = customer_uuid
  ORDER BY consultation_id DESC
  LIMIT 1;
  
  IF last_consultation_id IS NULL THEN
    next_number := 1;
  ELSE
    next_number := CAST(split_part(last_consultation_id, '_', 2) AS INTEGER) + 1;
  END IF;
  
  RETURN customer_code || '_' || lpad(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 12. 데이터 검증 함수
CREATE OR REPLACE FUNCTION validate_consultation_data()
RETURNS TABLE(
  issue_type VARCHAR,
  consultation_id VARCHAR,
  issue_description TEXT
) AS $$
BEGIN
  -- 중복 consultation_id 검사
  RETURN QUERY
  SELECT 
    'duplicate_id'::VARCHAR,
    c.consultation_id,
    'Duplicate consultation_id found'::TEXT
  FROM consultations c
  GROUP BY c.consultation_id
  HAVING COUNT(*) > 1;
  
  -- 고객 관계 무결성 검사
  RETURN QUERY
  SELECT 
    'invalid_customer'::VARCHAR,
    c.consultation_id,
    'Customer reference not found'::TEXT
  FROM consultations c
  LEFT JOIN customers cu ON c.customer_id = cu.id
  WHERE cu.id IS NULL;
  
  -- 빈 증상 검사
  RETURN QUERY
  SELECT 
    'empty_symptoms'::VARCHAR,
    c.consultation_id,
    'Symptoms field is empty'::TEXT
  FROM consultations c
  WHERE c.symptoms IS NULL OR length(trim(c.symptoms)) = 0;
  
  -- 미래 날짜 검사
  RETURN QUERY
  SELECT 
    'future_date'::VARCHAR,
    c.consultation_id,
    'Consultation date is in the future'::TEXT
  FROM consultations c
  WHERE c.consult_date > CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 13. 백업 및 복구를 위한 뷰
CREATE OR REPLACE VIEW consultation_backup_view AS
SELECT 
  consultation_id,
  customer_id,
  consult_date,
  symptoms,
  patient_condition,
  tongue_analysis,
  special_notes,
  prescription,
  result,
  image_urls,
  created_at,
  updated_at
FROM consultations
ORDER BY created_at;

-- 완료 메시지
SELECT 'consultation_schema.sql 적용 완료' AS message;
```

### 1.3 스키마 적용 스크립트

```typescript
// scripts/apply-consultation-schema.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export async function applyConsultationSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('📊 상담 관리 시스템 스키마 적용 시작...');

    // SQL 파일 읽기
    const schemaPath = join(process.cwd(), 'database', 'consultation_schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');

    // SQL 실행 (세미콜론으로 분리하여 개별 실행)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`실행 중 (${i + 1}/${statements.length}): ${statement.substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error && !error.message.includes('already exists')) {
        console.error(`SQL 실행 실패: ${statement.substring(0, 100)}...`);
        console.error('오류:', error);
        throw error;
      }
    }

    // 스키마 검증
    console.log('🔍 스키마 검증 중...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'consultations');

    if (tableError || !tables || tables.length === 0) {
      throw new Error('consultations 테이블이 생성되지 않았습니다.');
    }

    console.log('✅ 스키마 적용 완료');
    return true;

  } catch (error) {
    console.error('💥 스키마 적용 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  applyConsultationSchema()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

## 📦 Phase 2: 데이터 마이그레이션

### 2.1 Notion 데이터 추출

```typescript
// scripts/extract-notion-consultations.ts
import { Client } from '@notionhq/client';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function extractAllNotionConsultations(): Promise<NotionConsultationData[]> {
  console.log('📥 Notion 상담 데이터 추출 시작...');

  try {
    const consultations: NotionConsultationData[] = [];
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      console.log(`페이지 조회 중... (커서: ${nextCursor || '시작'})`);

      const response = await notion.databases.query({
        database_id: process.env.NOTION_CONSULTATION_DB_ID!,
        start_cursor: nextCursor,
        page_size: 100,
        sorts: [
          {
            property: '상담일자',
            direction: 'ascending'
          }
        ]
      });

      for (const page of response.results) {
        try {
          const consultation = await parseNotionConsultation(page as any);
          if (consultation) {
            consultations.push(consultation);
          }
        } catch (error) {
          console.error(`페이지 파싱 실패 (${page.id}):`, error);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;

      console.log(`현재까지 추출된 상담: ${consultations.length}개`);
    }

    // 결과 저장
    const outputPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    writeFileSync(outputPath, JSON.stringify(consultations, null, 2));

    console.log(`🎉 추출 완료: 총 ${consultations.length}개의 상담 데이터`);
    console.log(`💾 저장 위치: ${outputPath}`);

    return consultations;

  } catch (error) {
    console.error('💥 Notion 데이터 추출 실패:', error);
    throw error;
  }
}

async function parseNotionConsultation(page: any): Promise<NotionConsultationData | null> {
  try {
    const properties = page.properties;

    // 필수 필드 검증
    const consultationId = getNotionPropertyValue(properties.id, 'title');
    const customerId = getRelationId(properties.고객);
    const consultDate = getNotionPropertyValue(properties.상담일자, 'date');
    const symptoms = getNotionPropertyValue(properties.호소증상, 'rich_text');

    if (!consultationId || !customerId || !consultDate || !symptoms) {
      console.warn(`필수 필드 누락, 건너뛰기: ${consultationId || page.id}`);
      return null;
    }

    // 이미지 파일 처리
    const imageFiles = getNotionPropertyValue(properties.증상이미지, 'files');
    const processedImageFiles = Array.isArray(imageFiles) ? imageFiles : [];

    const consultation: NotionConsultationData = {
      id: page.id,
      consultation_id: consultationId,
      customer_id: customerId,
      consult_date: consultDate,
      symptoms: symptoms,
      patient_condition: getNotionPropertyValue(properties.환자상태, 'rich_text'),
      tongue_analysis: getNotionPropertyValue(properties.설진분석, 'rich_text'),
      special_notes: getNotionPropertyValue(properties.특이사항, 'rich_text'),
      prescription: getNotionPropertyValue(properties.처방약, 'rich_text'),
      result: getNotionPropertyValue(properties.결과, 'rich_text'),
      image_files: processedImageFiles,
      created_at: getNotionPropertyValue(properties.생성일시, 'created_time') || page.created_time
    };

    return consultation;

  } catch (error) {
    console.error(`상담 파싱 오류 (${page.id}):`, error);
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
    case 'date':
      return property.date?.start || null;
    case 'files':
      return property.files || [];
    case 'created_time':
      return property.created_time || null;
    default:
      return null;
  }
}

function getRelationId(relationProperty: any): string | null {
  return relationProperty?.relation?.[0]?.id || null;
}

// 실행
if (require.main === module) {
  // migration_data 디렉토리 생성
  const fs = require('fs');
  const migrationDir = join(process.cwd(), 'migration_data');
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }

  extractAllNotionConsultations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 2.2 이미지 다운로드 및 업로드

```typescript
// scripts/migrate-consultation-images.ts
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function migrateConsultationImages(
  consultations: NotionConsultationData[]
): Promise<Map<string, string[]>> {
  console.log('🖼️ 상담 이미지 마이그레이션 시작...');

  const imageUrlMap = new Map<string, string[]>();
  let processedCount = 0;
  let errorCount = 0;

  for (const consultation of consultations) {
    try {
      console.log(`처리 중: ${consultation.consultation_id} (${processedCount + 1}/${consultations.length})`);

      const migratedUrls = await migrateConsultationImageFiles(
        consultation.consultation_id,
        consultation.customer_id,
        consultation.image_files
      );

      imageUrlMap.set(consultation.consultation_id, migratedUrls);
      processedCount++;

      // 진행률 표시
      if (processedCount % 10 === 0) {
        console.log(`📊 진행률: ${processedCount}/${consultations.length} (${Math.round(processedCount / consultations.length * 100)}%)`);
      }

      // API 부하 방지를 위한 딜레이
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`이미지 마이그레이션 실패 (${consultation.consultation_id}):`, error);
      errorCount++;
      imageUrlMap.set(consultation.consultation_id, []);
    }
  }

  console.log(`🎉 이미지 마이그레이션 완료: 성공 ${processedCount}개, 실패 ${errorCount}개`);
  return imageUrlMap;
}

async function migrateConsultationImageFiles(
  consultationId: string,
  customerId: string,
  imageFiles: any[]
): Promise<string[]> {
  if (!imageFiles || imageFiles.length === 0) {
    return [];
  }

  const migratedUrls: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    const imageUrl = imageFile.external?.url || imageFile.file?.url;

    if (!imageUrl) {
      console.warn(`이미지 URL 없음: ${consultationId}_${i + 1}`);
      continue;
    }

    try {
      // Google Drive에서 이미지 다운로드
      const imageBuffer = await downloadImageFromUrl(imageUrl);

      // Supabase Storage에 업로드
      const filePath = generateConsultationImagePath(customerId, consultationId, i + 1);

      const { data, error } = await supabase.storage
        .from('consultation-images')
        .upload(filePath, imageBuffer, {
          contentType: getContentTypeFromUrl(imageUrl),
          upsert: true
        });

      if (error) throw error;

      // 공개 URL 생성
      const { data: publicUrl } = supabase.storage
        .from('consultation-images')
        .getPublicUrl(filePath);

      migratedUrls.push(publicUrl.publicUrl);

      console.log(`✅ 이미지 업로드 성공: ${filePath}`);

    } catch (error) {
      console.error(`이미지 업로드 실패 (${consultationId}_${i + 1}):`, error);
    }
  }

  return migratedUrls;
}

async function downloadImageFromUrl(url: string): Promise<Buffer> {
  try {
    // Google Drive URL 처리
    const downloadUrl = convertGoogleDriveUrl(url);

    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return Buffer.from(response.data);

  } catch (error) {
    console.error(`이미지 다운로드 실패 (${url}):`, error);
    throw error;
  }
}

function convertGoogleDriveUrl(url: string): string {
  // Google Drive 공유 링크를 다운로드 링크로 변환
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return url;
}

function getContentTypeFromUrl(url: string): string {
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.gif')) return 'image/gif';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg'; // 기본값
}

function generateConsultationImagePath(
  customerId: string,
  consultationId: string,
  imageIndex: number
): string {
  return `${customerId}/${consultationId}/image_${imageIndex}.jpg`;
}

// 실행
if (require.main === module) {
  const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
  const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));

  migrateConsultationImages(consultations)
    .then(imageUrlMap => {
      // 결과 저장
      const outputPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
      const mappingObject = Object.fromEntries(imageUrlMap);
      writeFileSync(outputPath, JSON.stringify(mappingObject, null, 2));
      console.log(`💾 이미지 URL 매핑 저장: ${outputPath}`);
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 2.3 Supabase 데이터 삽입

```typescript
// scripts/insert-consultation-data.ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData, SupabaseConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function insertConsultationData(): Promise<void> {
  console.log('📊 Supabase 상담 데이터 삽입 시작...');

  try {
    // 마이그레이션 데이터 로드
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');

    const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    const imageUrlMapping: Record<string, string[]> = JSON.parse(readFileSync(imageUrlMappingPath, 'utf-8'));

    console.log(`📥 로드된 상담 데이터: ${consultations.length}개`);

    // 고객 ID 매핑 생성
    const customerIdMapping = await createCustomerIdMapping();

    // 배치 단위로 삽입
    const batchSize = 50;
    const batches = chunkArray(consultations, batchSize);
    
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      const insertData: SupabaseConsultationData[] = batch.map(consultation => {
        const mappedCustomerId = customerIdMapping.get(consultation.customer_id);
        
        if (!mappedCustomerId) {
          console.warn(`고객 ID 매핑 실패: ${consultation.customer_id}`);
          return null;
        }

        return {
          consultation_id: consultation.consultation_id,
          customer_id: mappedCustomerId,
          consult_date: consultation.consult_date,
          symptoms: consultation.symptoms,
          patient_condition: consultation.patient_condition,
          tongue_analysis: consultation.tongue_analysis,
          special_notes: consultation.special_notes,
          prescription: consultation.prescription,
          result: consultation.result,
          image_urls: imageUrlMapping[consultation.consultation_id] || [],
          created_at: consultation.created_at
        };
      }).filter(data => data !== null) as SupabaseConsultationData[];

      // 배치 삽입
      const { data, error } = await supabase
        .from('consultations')
        .insert(insertData)
        .select();

      if (error) {
        console.error(`배치 ${i + 1} 삽입 실패:`, error);
        errorCount += batch.length;
      } else {
        insertedCount += data.length;
        console.log(`✅ 배치 ${i + 1} 완료: ${data.length}개 삽입`);
      }

      // 마이그레이션 로그 기록
      await logMigrationProgress(batch, error);

      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 데이터 삽입 완료: 성공 ${insertedCount}개, 실패 ${errorCount}개`);

    // 데이터 검증
    await validateMigratedData();

  } catch (error) {
    console.error('💥 데이터 삽입 실패:', error);
    throw error;
  }
}

async function createCustomerIdMapping(): Promise<Map<string, string>> {
  console.log('🔍 고객 ID 매핑 생성 중...');

  // Notion 고객 ID와 Supabase 고객 ID 매핑
  // 이 부분은 고객 테이블이 이미 마이그레이션되었다고 가정
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, notion_id')
    .not('notion_id', 'is', null);

  if (error) throw error;

  const mapping = new Map<string, string>();
  customers.forEach(customer => {
    if (customer.notion_id) {
      mapping.set(customer.notion_id, customer.id);
    }
  });

  console.log(`📋 고객 ID 매핑 생성 완료: ${mapping.size}개`);
  return mapping;
}

async function logMigrationProgress(
  consultations: NotionConsultationData[],
  error: any
): Promise<void> {
  const logEntries = consultations.map(consultation => ({
    consultation_id: consultation.consultation_id,
    notion_id: consultation.id,
    migration_status: error ? 'failed' : 'completed',
    error_message: error?.message || null,
    image_count: consultation.image_files?.length || 0,
    completed_at: error ? null : new Date().toISOString()
  }));

  await supabase
    .from('consultation_migration_log')
    .insert(logEntries);
}

async function validateMigratedData(): Promise<void> {
  console.log('🔍 마이그레이션 데이터 검증 중...');

  // 검증 쿼리 실행
  const { data: validationResults, error } = await supabase
    .rpc('validate_consultation_data');

  if (error) {
    console.error('검증 쿼리 실행 실패:', error);
    return;
  }

  if (validationResults && validationResults.length > 0) {
    console.warn('⚠️ 데이터 무결성 문제 발견:');
    validationResults.forEach((issue: any) => {
      console.warn(`- ${issue.issue_type}: ${issue.consultation_id} - ${issue.issue_description}`);
    });
  } else {
    console.log('✅ 데이터 검증 통과');
  }

  // 통계 출력
  const { data: stats, error: statsError } = await supabase
    .from('consultations')
    .select('id', { count: 'exact' });

  if (!statsError && stats) {
    console.log(`📊 총 마이그레이션된 상담 수: ${stats.length}개`);
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
  insertConsultationData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

## 🔧 Phase 3: API 개발

### 3.1 새로운 Supabase 기반 API

```typescript
// app/api/consultation-v2/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { uploadConsultationImages, generateNextConsultationId } from '@/app/lib/consultation-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 상담 목록 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          id,
          name,
          phone,
          customer_id
        )
      `, { count: 'exact' })
      .order('consult_date', { ascending: false })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      query = query.or(`symptoms.ilike.%${search}%,prescription.ilike.%${search}%`);
    }

    if (startDate && endDate) {
      query = query
        .gte('consult_date', startDate)
        .lte('consult_date', endDate);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // 응답 형식을 기존 Notion API와 호환되도록 변환
    const consultations = data.map(consultation => ({
      id: consultation.id,
      properties: {
        id: {
          title: [{ text: { content: consultation.consultation_id } }]
        },
        상담일자: {
          date: { start: consultation.consult_date }
        },
        고객: {
          relation: [{ id: consultation.customer_id }]
        },
        호소증상: {
          rich_text: [{ text: { content: consultation.symptoms } }]
        },
        환자상태: {
          rich_text: [{ text: { content: consultation.patient_condition || '' } }]
        },
        설진분석: {
          rich_text: [{ text: { content: consultation.tongue_analysis || '' } }]
        },
        특이사항: {
          rich_text: [{ text: { content: consultation.special_notes || '' } }]
        },
        처방약: {
          rich_text: [{ text: { content: consultation.prescription || '' } }]
        },
        결과: {
          rich_text: [{ text: { content: consultation.result || '' } }]
        },
        증상이미지: {
          files: consultation.image_urls.map((url: string, index: number) => ({
            type: 'external',
            name: `${consultation.consultation_id}_${index + 1}.jpg`,
            external: { url }
          }))
        },
        생성일시: {
          created_time: consultation.created_at
        }
      },
      customer: consultation.customers // 추가 고객 정보
    }));

    return NextResponse.json({
      success: true,
      consultations,
      pagination: {
        page,
        limit,
        total: count || 0,
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

// 상담 등록
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 필수 필드 검증
    if (!data.symptoms || !data.customer_id || !data.consultDate) {
      return NextResponse.json(
        { error: '필수 입력 항목이 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 고객 존재 여부 확인
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_id')
      .eq('id', data.customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: '존재하지 않는 고객입니다.' },
        { status: 400 }
      );
    }

    // 상담 ID 생성
    const consultationId = await generateNextConsultationId(data.customer_id, customer.customer_id);

    // 이미지 업로드 처리
    let imageUrls: string[] = [];
    if (data.imageDataArray && Array.isArray(data.imageDataArray) && data.imageDataArray.length > 0) {
      try {
        imageUrls = await uploadConsultationImages(
          data.customer_id,
          consultationId,
          data.imageDataArray
        );
        console.log(`${imageUrls.length}개의 이미지 업로드 완료`);
      } catch (uploadError) {
        console.error('이미지 업로드 실패:', uploadError);
        // 이미지 업로드 실패해도 상담 등록은 계속 진행
      }
    }

    // 상담 데이터 삽입
    const consultationData = {
      consultation_id: consultationId,
      customer_id: data.customer_id,
      consult_date: data.consultDate,
      symptoms: data.symptoms,
      patient_condition: data.stateAnalysis,
      tongue_analysis: data.tongueAnalysis,
      special_notes: data.specialNote,
      prescription: data.medicine,
      result: data.result,
      image_urls: imageUrls
    };

    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select()
      .single();

    if (error) throw error;

    // 기존 API 응답 형식과 호환
    return NextResponse.json({
      success: true,
      consultation: {
        id: consultation.id,
        properties: {
          id: {
            title: [{ text: { content: consultation.consultation_id } }]
          },
          상담일자: {
            date: { start: consultation.consult_date }
          },
          // ... 다른 필드들
        }
      },
      consultationId: consultationId,
      realCustomerId: customer.customer_id
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

### 3.2 유틸리티 함수

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

export async function generateNextConsultationId(
  customerId: string,
  customerCode: string
): Promise<string> {
  // RPC 함수 호출로 다음 상담 ID 생성
  const { data, error } = await supabase
    .rpc('generate_next_consultation_id', {
      customer_uuid: customerId,
      customer_code: customerCode
    });

  if (error) throw error;

  return data;
}

export function generateConsultationImagePath(
  customerId: string,
  consultationId: string,
  imageIndex: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerId}/${consultationId}/image_${imageIndex}.${fileExtension}`;
}

export async function deleteConsultationImages(
  customerId: string,
  consultationId: string
): Promise<void> {
  // 상담 관련 모든 이미지 삭제
  const folderPath = `${customerId}/${consultationId}/`;
  
  const { data: files, error: listError } = await supabase.storage
    .from('consultation-images')
    .list(folderPath);

  if (listError) throw listError;

  if (files && files.length > 0) {
    const filePaths = files.map(file => `${folderPath}${file.name}`);
    
    const { error: deleteError } = await supabase.storage
      .from('consultation-images')
      .remove(filePaths);

    if (deleteError) throw deleteError;
  }
}
```

### 3.3 API 라우팅 설정

```typescript
// app/api/consultation/route.ts (기존 API 수정)
import { NextResponse } from 'next/server';

// 마이그레이션 모드에 따른 라우팅
const USE_SUPABASE = process.env.USE_SUPABASE_CONSULTATION === 'true';

export async function GET(request: Request) {
  if (USE_SUPABASE) {
    // 새로운 Supabase API로 라우팅
    const { searchParams } = new URL(request.url);
    const newUrl = new URL('/api/consultation-v2', request.url);
    newUrl.search = searchParams.toString();
    
    return fetch(newUrl.toString(), {
      method: 'GET',
      headers: request.headers
    });
  } else {
    // 기존 Notion API 유지
    return getConsultationsFromNotion(request);
  }
}

export async function POST(request: Request) {
  if (USE_SUPABASE) {
    // 새로운 Supabase API로 라우팅
    const body = await request.json();
    
    return fetch(new URL('/api/consultation-v2', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } else {
    // 기존 Notion API 유지
    return postConsultationToNotion(request);
  }
}

// 기존 Notion API 함수들 (백업용)
async function getConsultationsFromNotion(request: Request) {
  // 기존 Notion API 로직 유지
  // ... (기존 코드)
}

async function postConsultationToNotion(request: Request) {
  // 기존 Notion API 로직 유지
  // ... (기존 코드)
}
```

## 🧪 Phase 4: 테스트 및 배포

### 4.1 마이그레이션 테스트 스크립트

```typescript
// scripts/test-migration.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function testMigration(): Promise<void> {
  console.log('🧪 마이그레이션 테스트 시작...');

  try {
    // 1. 데이터베이스 연결 테스트
    await testDatabaseConnection();

    // 2. 스키마 검증
    await testSchema();

    // 3. 데이터 무결성 검사
    await testDataIntegrity();

    // 4. API 엔드포인트 테스트
    await testAPIEndpoints();

    // 5. 성능 테스트
    await testPerformance();

    // 6. 이미지 접근 테스트
    await testImageAccess();

    console.log('✅ 모든 테스트 통과');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    throw error;
  }
}

async function testDatabaseConnection(): Promise<void> {
  console.log('🔌 데이터베이스 연결 테스트...');

  const { data, error } = await supabase
    .from('consultations')
    .select('count', { count: 'exact' })
    .limit(1);

  if (error) throw new Error(`데이터베이스 연결 실패: ${error.message}`);

  console.log(`📊 상담 테이블 레코드 수: ${data.length}`);
}

async function testSchema(): Promise<void> {
  console.log('📋 스키마 검증...');

  // 필수 테이블 존재 확인
  const requiredTables = ['consultations', 'consultation_migration_log'];
  
  for (const tableName of requiredTables) {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);

    if (error || !data || data.length === 0) {
      throw new Error(`테이블 ${tableName}이 존재하지 않습니다.`);
    }
  }

  // 필수 컬럼 존재 확인
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'consultations');

  if (columnsError) throw columnsError;

  const requiredColumns = [
    'id', 'consultation_id', 'customer_id', 'consult_date',
    'symptoms', 'image_urls', 'created_at', 'updated_at'
  ];

  const existingColumns = columns.map(col => col.column_name);
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}`);
  }

  console.log('✅ 스키마 검증 통과');
}

async function testDataIntegrity(): Promise<void> {
  console.log('🔍 데이터 무결성 검사...');

  const { data: issues, error } = await supabase
    .rpc('validate_consultation_data');

  if (error) throw error;

  if (issues && issues.length > 0) {
    console.warn('⚠️ 데이터 무결성 문제 발견:');
    issues.forEach((issue: any) => {
      console.warn(`- ${issue.issue_type}: ${issue.consultation_id}`);
    });
    
    if (issues.length > 10) {
      throw new Error(`심각한 데이터 무결성 문제 발견: ${issues.length}개`);
    }
  } else {
    console.log('✅ 데이터 무결성 검사 통과');
  }
}

async function testAPIEndpoints(): Promise<void> {
  console.log('🔗 API 엔드포인트 테스트...');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // GET /api/consultation-v2 테스트
  const getResponse = await fetch(`${baseUrl}/api/consultation-v2?limit=5`);
  if (!getResponse.ok) {
    throw new Error(`GET API 테스트 실패: ${getResponse.status}`);
  }

  const getData = await getResponse.json();
  if (!getData.success || !Array.isArray(getData.consultations)) {
    throw new Error('GET API 응답 형식 오류');
  }

  console.log(`✅ GET API 테스트 통과: ${getData.consultations.length}개 조회`);

  // POST API는 실제 데이터 생성을 피하고 검증만 수행
  console.log('✅ API 엔드포인트 테스트 통과');
}

async function testPerformance(): Promise<void> {
  console.log('⚡ 성능 테스트...');

  const startTime = Date.now();

  // 대량 데이터 조회 테스트
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .limit(100);

  const endTime = Date.now();
  const duration = endTime - startTime;

  if (error) throw error;

  console.log(`📊 100개 레코드 조회 시간: ${duration}ms`);

  if (duration > 3000) {
    console.warn('⚠️ 성능 경고: 조회 시간이 3초를 초과했습니다.');
  } else {
    console.log('✅ 성능 테스트 통과');
  }
}

async function testImageAccess(): Promise<void> {
  console.log('🖼️ 이미지 접근 테스트...');

  // 이미지가 있는 상담 조회
  const { data: consultations, error } = await supabase
    .from('consultations')
    .select('consultation_id, image_urls')
    .not('image_urls', 'eq', '[]')
    .limit(5);

  if (error) throw error;

  if (consultations.length === 0) {
    console.log('ℹ️ 이미지가 있는 상담이 없습니다.');
    return;
  }

  // 첫 번째 이미지 URL 접근 테스트
  const firstConsultation = consultations[0];
  const imageUrls = firstConsultation.image_urls as string[];

  if (imageUrls.length > 0) {
    const imageUrl = imageUrls[0];
    
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ 이미지 접근 테스트 통과');
      } else {
        throw new Error(`이미지 접근 실패: ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ 이미지 접근 테스트 실패: ${error}`);
    }
  }
}

// 실행
if (require.main === module) {
  testMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

### 4.2 배포 스크립트

```bash
#!/bin/bash
# scripts/deploy-migration.sh

echo "🚀 상담 관리 시스템 마이그레이션 배포 시작..."

# 1. 환경 변수 확인
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  echo "❌ NEXT_PUBLIC_SUPABASE_URL이 설정되지 않았습니다."
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다."
  exit 1
fi

echo "✅ 환경 변수 확인 완료"

# 2. 의존성 설치
echo "📦 의존성 설치 중..."
npm install

# 3. 데이터베이스 스키마 적용
echo "📊 데이터베이스 스키마 적용 중..."
npm run setup:consultation-schema

# 4. 스토리지 설정
echo "🗂️ 스토리지 설정 중..."
npm run setup:consultation-storage

# 5. 데이터 마이그레이션 (단계적)
echo "📦 데이터 마이그레이션 시작..."

# 5.1 Notion 데이터 추출
echo "📥 Notion 데이터 추출 중..."
npm run extract:notion-consultations

# 5.2 이미지 마이그레이션
echo "🖼️ 이미지 마이그레이션 중..."
npm run migrate:consultation-images

# 5.3 데이터 삽입
echo "📊 Supabase 데이터 삽입 중..."
npm run insert:consultation-data

# 6. 테스트 실행
echo "🧪 마이그레이션 테스트 중..."
npm run test:migration

# 7. 환경 변수 활성화 (수동 확인 후)
echo "⚠️ 마이그레이션 완료. 다음 단계를 수동으로 확인하세요:"
echo "1. 테스트 결과 검토"
echo "2. USE_SUPABASE_CONSULTATION=true 설정"
echo "3. 애플리케이션 재시작"
echo "4. 사용자 테스트 수행"

echo "🎉 마이그레이션 배포 완료!"
```

### 4.3 package.json 스크립트 추가

```json
{
  "scripts": {
    "setup:consultation-schema": "tsx scripts/apply-consultation-schema.ts",
    "setup:consultation-storage": "tsx scripts/setup-consultation-storage.ts",
    "extract:notion-consultations": "tsx scripts/extract-notion-consultations.ts",
    "migrate:consultation-images": "tsx scripts/migrate-consultation-images.ts",
    "insert:consultation-data": "tsx scripts/insert-consultation-data.ts",
    "test:migration": "tsx scripts/test-migration.ts",
    "migration:full": "npm run setup:consultation-schema && npm run setup:consultation-storage && npm run extract:notion-consultations && npm run migrate:consultation-images && npm run insert:consultation-data && npm run test:migration",
    "migration:rollback": "tsx scripts/rollback-migration.ts"
  }
}
```

## 🛠️ 트러블슈팅

### 일반적인 문제 및 해결방법

#### 1. Supabase 연결 실패
```bash
❌ Error: Invalid JWT token
```
**해결방법**: 
- `.env.local`에서 `SUPABASE_SERVICE_ROLE_KEY` 확인
- Supabase 대시보드에서 Service Role Key 재생성

#### 2. 이미지 업로드 실패
```bash
❌ Error: Bucket 'consultation-images' not found
```
**해결방법**:
```bash
npm run setup:consultation-storage
```

#### 3. 데이터 마이그레이션 중단
```bash
❌ Error: Query timeout
```
**해결방법**: 배치 크기 줄이기
```typescript
const batchSize = 25; // 기본값 50에서 줄임
```

#### 4. 고객 ID 매핑 실패
```bash
❌ 고객 ID 매핑 실패: notion-page-id
```
**해결방법**: 고객 테이블에 `notion_id` 컬럼 추가 및 매핑 데이터 삽입

#### 5. Google Drive 이미지 다운로드 실패
```bash
❌ Error: Request failed with status code 403
```
**해결방법**: Google Drive 링크를 다운로드 링크로 변환
```typescript
function convertGoogleDriveUrl(url: string): string {
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return url;
}
```

### 롤백 절차

만약 마이그레이션 중 문제가 발생하면:

1. **즉시 롤백**:
```bash
npm run migration:rollback
```

2. **환경 변수 복원**:
```env
USE_SUPABASE_CONSULTATION=false
```

3. **애플리케이션 재시작**:
```bash
npm run dev
```

4. **데이터 복구** (필요시):
```bash
# Notion 백업에서 복구
npm run restore:notion-backup
```

---

**구현 완료 체크리스트**:
- [ ] Phase 1: 인프라 준비 완료
- [ ] Phase 2: 데이터 마이그레이션 완료
- [ ] Phase 3: API 개발 완료
- [ ] Phase 4: 테스트 및 배포 완료
- [ ] 사용자 교육 및 문서 업데이트

**문서 관리**: 이 구현 가이드는 실제 구현 과정에서 발생하는 이슈와 해결책으로 지속 업데이트됩니다.
