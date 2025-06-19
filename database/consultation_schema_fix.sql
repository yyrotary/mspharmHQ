-- 상담일지 날짜 제약조건 수정 (한국시간 기준)
-- 미래 날짜도 허용하도록 변경 (상담 예약 등을 고려)

-- 1. 기존 제약조건 제거
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;

-- 2. 한국시간 기준 새로운 제약조건 추가
-- 1900년 이후, 현재 한국시간으로부터 1년 이내까지 허용
ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::timestamp with time zone AND 
    consult_date <= (NOW() AT TIME ZONE 'Asia/Seoul' + INTERVAL '1 year')
  );

-- 3. 인덱스 재생성 (성능 최적화)
DROP INDEX IF EXISTS idx_consultations_consult_date;
CREATE INDEX idx_consultations_consult_date 
  ON consultations(consult_date DESC);

-- 4. 검증 함수 업데이트
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
  
  -- 날짜 범위 검사 (1900년 이후, 한국시간 기준 1년 이내)
  RETURN QUERY
  SELECT 
    'invalid_date_range'::VARCHAR,
    c.consultation_id,
    'Consultation date is outside valid range (1900 ~ KST current+1year)'::TEXT
  FROM consultations c
  WHERE c.consult_date < '1900-01-01'::timestamp with time zone
     OR c.consult_date > (NOW() AT TIME ZONE 'Asia/Seoul' + INTERVAL '1 year');
END;
$$ LANGUAGE plpgsql;

-- 5. 현재 데이터 검증
SELECT 
  '제약조건 수정 완료' as status,
  COUNT(*) as total_consultations,
  MIN(consult_date) as earliest_date,
  MAX(consult_date) as latest_date
FROM consultations;

-- 완료 메시지
SELECT 'consultation_schema_fix.sql 적용 완료 - 미래 날짜 허용됨' AS message; 