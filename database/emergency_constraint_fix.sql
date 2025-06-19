-- 긴급 제약조건 수정 스크립트
-- 2025-06-19 에러 해결을 위한 임시 조치

-- 1. 기존 제약조건 제거
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;

-- 2. 새로운 제약조건 추가 (현재로부터 2년 이내)
ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::timestamp with time zone AND 
    consult_date <= (NOW() + INTERVAL '2 years')
  );

-- 3. 확인
SELECT 
    'Constraint updated successfully' as status,
    NOW() as current_time,
    (NOW() + INTERVAL '2 years') as max_allowed_date; 