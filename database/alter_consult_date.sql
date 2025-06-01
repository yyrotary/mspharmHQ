-- consult_date 컬럼을 DATE에서 TIMESTAMP WITH TIME ZONE으로 변경
-- 기존 데이터의 시간 정보는 00:00:00으로 설정됨

-- 1. 제약 조건 삭제
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;

-- 2. 컬럼 타입 변경
ALTER TABLE consultations 
ALTER COLUMN consult_date TYPE TIMESTAMP WITH TIME ZONE 
USING consult_date::timestamp with time zone;

-- 3. 새로운 제약 조건 추가
ALTER TABLE consultations 
ADD CONSTRAINT consultations_consult_date_check 
CHECK (consult_date <= now());

-- 4. 인덱스 재생성 (필요시)
DROP INDEX IF EXISTS idx_consultations_consult_date;
CREATE INDEX idx_consultations_consult_date 
  ON consultations(consult_date DESC);

-- 5. 복합 인덱스 재생성
DROP INDEX IF EXISTS idx_consultations_customer_date;
CREATE INDEX idx_consultations_customer_date 
  ON consultations(customer_id, consult_date DESC);

-- 완료 메시지
SELECT 'consult_date 컬럼 타입 변경 완료' AS message; 