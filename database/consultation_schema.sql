-- 상담 관리 시스템 테이블 생성

-- 1. consultations 테이블 생성
CREATE TABLE IF NOT EXISTS consultations (
  -- 기본 식별자
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- 관계 필드 (customers 테이블과 연결)
  customer_id UUID NOT NULL,
  
  -- 상담 정보
  consult_date TIMESTAMP WITH TIME ZONE NOT NULL,
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
    CHECK (consult_date <= now()),
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