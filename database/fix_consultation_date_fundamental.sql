-- 상담 날짜 근본적 해결 스크립트
-- TIMESTAMP WITH TIME ZONE을 DATE로 변경하여 타임존 문제 완전 해결
-- 2024-12-19 작성

-- 1. 기존 제약조건과 인덱스 제거
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;
DROP INDEX IF EXISTS idx_consultations_consult_date;
DROP INDEX IF EXISTS idx_consultations_customer_date;

-- 2. consult_date 컬럼을 DATE 타입으로 변경
-- 기존 TIMESTAMP 데이터에서 날짜 부분만 추출하여 변환
ALTER TABLE consultations 
ALTER COLUMN consult_date TYPE DATE 
USING consult_date::date;

-- 3. 새로운 제약조건 추가 (DATE 타입용)
ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::date AND 
    consult_date <= (CURRENT_DATE + INTERVAL '2 years')::date
  );

-- 4. 새로운 인덱스 생성 (DATE 타입용)
CREATE INDEX idx_consultations_consult_date 
  ON consultations(consult_date DESC);
CREATE INDEX idx_consultations_customer_date 
  ON consultations(customer_id, consult_date DESC);

-- 5. 검증 쿼리
SELECT 
  'consult_date 컬럼이 DATE 타입으로 변경되었습니다' as message,
  COUNT(*) as total_consultations,
  MIN(consult_date) as earliest_date,
  MAX(consult_date) as latest_date
FROM consultations;

-- 6. 데이터 타입 확인
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'consultations' 
  AND column_name = 'consult_date';

-- 완료 메시지
SELECT '상담 날짜 타임존 문제 근본적 해결 완료!' as status;