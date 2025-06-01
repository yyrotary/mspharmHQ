import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createCompleteSchemaFixed() {
  console.log('🔧 수정된 상담 관리 시스템 스키마 생성 가이드...');
  
  try {
    console.log('📝 한국어 텍스트 검색 오류를 수정한 SQL:');
    console.log('=' .repeat(80));
    console.log(`
-- ========================================
-- 상담 관리 시스템 완전한 스키마 (수정됨)
-- ========================================

-- 1. UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. customers 테이블 생성 (고객 정보)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(20) UNIQUE NOT NULL,     -- 고객 코드 (CUST001)
  name VARCHAR(100) NOT NULL,                    -- 고객명
  phone VARCHAR(20),                             -- 전화번호
  address TEXT,                                  -- 주소
  birth_date DATE,                               -- 생년월일
  gender VARCHAR(10),                            -- 성별
  estimated_age INTEGER,                         -- 추정나이
  special_notes TEXT,                            -- 특이사항
  face_embedding JSONB,                          -- 얼굴 인식 데이터
  google_drive_folder_id TEXT,                   -- Google Drive 폴더 ID
  consultation_count INTEGER DEFAULT 0,          -- 상담 수
  is_deleted BOOLEAN DEFAULT FALSE,              -- 삭제 여부
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- customers 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_customers_customer_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted);

-- 3. consultations 테이블 생성 (상담 정보)
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,   -- 상담 ID (CUST001_001)
  customer_id UUID NOT NULL,                     -- 고객 FK
  consult_date DATE NOT NULL,                    -- 상담일자
  symptoms TEXT NOT NULL,                        -- 호소증상
  patient_condition TEXT,                        -- 환자상태
  tongue_analysis TEXT,                          -- 설진분석
  special_notes TEXT,                            -- 특이사항
  prescription TEXT,                             -- 처방약
  result TEXT,                                   -- 상담결과
  image_urls JSONB DEFAULT '[]'::jsonb,          -- 이미지 URL 배열
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

-- consultations 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_consultations_customer_id ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consult_date ON consultations(consult_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_id ON consultations(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- 전체 텍스트 검색 인덱스 (기본 영어 설정 사용)
CREATE INDEX IF NOT EXISTS idx_consultations_symptoms_fts 
  ON consultations USING gin(to_tsvector('english', symptoms));
CREATE INDEX IF NOT EXISTS idx_consultations_prescription_fts 
  ON consultations USING gin(to_tsvector('english', coalesce(prescription, '')));

-- JSON 배열 인덱스 (이미지 개수 조회용)
CREATE INDEX IF NOT EXISTS idx_consultations_image_count 
  ON consultations USING gin(image_urls);

-- 복합 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_consultations_customer_date 
  ON consultations(customer_id, consult_date DESC);

-- 4. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. 업데이트 트리거 적용
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultations_updated_at ON consultations;
CREATE TRIGGER update_consultations_updated_at 
  BEFORE UPDATE ON consultations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Row Level Security 활성화
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 7. RLS 정책 생성
-- customers 테이블 정책
DROP POLICY IF EXISTS "Public read access" ON customers;
CREATE POLICY "Public read access" ON customers 
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users full access" ON customers;
CREATE POLICY "Authenticated users full access" ON customers 
  FOR ALL TO authenticated USING (true);

-- consultations 테이블 정책
DROP POLICY IF EXISTS "Public read access" ON consultations;
CREATE POLICY "Public read access" ON consultations 
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users full access" ON consultations;
CREATE POLICY "Authenticated users full access" ON consultations 
  FOR ALL TO authenticated USING (true);

-- 8. 마이그레이션 로그 테이블
CREATE TABLE IF NOT EXISTS consultation_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) NOT NULL,
  migration_status VARCHAR(20) NOT NULL DEFAULT 'pending',
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

-- 9. 유용한 함수들
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

-- 10. 데이터 검증 함수
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

-- ========================================
-- 스키마 생성 완료
-- ========================================
    `);
    console.log('=' .repeat(80));
    console.log('');
    console.log('🔧 수정 사항:');
    console.log('- 한국어 텍스트 검색 설정을 영어 설정으로 변경');
    console.log('- to_tsvector(\'korean\', ...) → to_tsvector(\'english\', ...)');
    console.log('');
    console.log('📋 위 SQL을 Supabase 대시보드 > SQL Editor에서 실행하세요.');

  } catch (error: any) {
    console.error('💥 스키마 확인 실패:', error.message);
    throw error;
  }
}

// 직접 실행
if (require.main === module) {
  createCompleteSchemaFixed()
    .then(() => {
      console.log('✅ 수정된 스키마 생성 가이드 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스키마 확인 실패:', error);
      process.exit(1);
    });
}

export { createCompleteSchemaFixed }; 