-- 현재 consultations 테이블의 제약조건 상태 확인 및 수정

-- 1. 현재 제약조건 확인
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'consultations'::regclass 
  AND conname LIKE '%consult_date%';

-- 2. 현재 시간과 한국시간 확인
SELECT 
    NOW() as current_utc_time,
    NOW() AT TIME ZONE 'Asia/Seoul' as current_korea_time,
    (NOW() AT TIME ZONE 'Asia/Seoul' + INTERVAL '1 year') as max_allowed_korea_time;

-- 3. 문제가 되는 날짜 확인
SELECT 
    '2025-06-19 17:35:00+00'::timestamp with time zone as problematic_date,
    NOW() as current_utc,
    NOW() AT TIME ZONE 'Asia/Seoul' as current_korea,
    (NOW() AT TIME ZONE 'Asia/Seoul' + INTERVAL '1 year') as max_allowed,
    CASE 
        WHEN '2025-06-19 17:35:00+00'::timestamp with time zone <= (NOW() AT TIME ZONE 'Asia/Seoul' + INTERVAL '1 year')
        THEN 'VALID' 
        ELSE 'INVALID' 
    END as validation_result;

-- 4. 기존 제약조건 강제 제거 (존재하는 경우)
DO $$
BEGIN
    -- 모든 관련 제약조건 제거
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'consultations'::regclass 
          AND conname = 'consultations_consult_date_check'
    ) THEN
        ALTER TABLE consultations DROP CONSTRAINT consultations_consult_date_check;
        RAISE NOTICE 'Dropped existing consultations_consult_date_check constraint';
    END IF;
END $$;

-- 5. 새로운 제약조건 추가 (더 관대한 조건으로)
-- 1900년 이후, 현재로부터 2년 이내로 설정 (여유를 두어 테스트 가능하도록)
ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::timestamp with time zone AND 
    consult_date <= (NOW() + INTERVAL '2 years')
  );

-- 6. 새로운 제약조건 확인
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'consultations'::regclass 
  AND conname = 'consultations_consult_date_check';

-- 7. 테스트: 문제가 되었던 날짜가 이제 유효한지 확인
SELECT 
    '2025-06-19 17:35:00+00'::timestamp with time zone as test_date,
    CASE 
        WHEN '2025-06-19 17:35:00+00'::timestamp with time zone >= '1900-01-01'::timestamp with time zone
         AND '2025-06-19 17:35:00+00'::timestamp with time zone <= (NOW() + INTERVAL '2 years')
        THEN 'CONSTRAINT SATISFIED' 
        ELSE 'CONSTRAINT VIOLATED' 
    END as constraint_check;

-- 완료 메시지
SELECT 'Constraint update completed - allowing dates up to 2 years from now' AS message; 