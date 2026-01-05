-- PIN 함수 오류 수정 스크립트
-- 기존 함수를 삭제하고 새로운 버전으로 재생성

-- 1. 기존 함수들 삭제
DROP FUNCTION IF EXISTS authenticate_customer_by_pin(character varying);
DROP FUNCTION IF EXISTS generate_customer_pin();
DROP FUNCTION IF EXISTS create_customer_pin(UUID);
DROP FUNCTION IF EXISTS change_customer_pin(UUID, character varying);

-- 2. customer_pins 테이블에 is_initial_pin 컬럼 추가 (이미 있으면 무시)
ALTER TABLE customer_pins 
ADD COLUMN IF NOT EXISTS is_initial_pin BOOLEAN DEFAULT FALSE;

-- 3. PIN 생성 함수 (초기값 000000)
CREATE OR REPLACE FUNCTION create_customer_pin(customer_uuid UUID)
RETURNS VARCHAR(6) AS $$
DECLARE
  initial_pin VARCHAR(6) := '000000';
BEGIN
  -- 기존 PIN 비활성화
  UPDATE customer_pins 
  SET is_active = FALSE, updated_at = now() 
  WHERE customer_id = customer_uuid;
  
  -- 초기 PIN 등록 (000000)
  INSERT INTO customer_pins (customer_id, pin_code, is_active, is_initial_pin)
  VALUES (customer_uuid, initial_pin, TRUE, TRUE)
  ON CONFLICT (pin_code) DO NOTHING;  -- 중복 시 무시
  
  RETURN initial_pin;
END;
$$ LANGUAGE plpgsql;

-- 4. PIN 변경 함수
CREATE OR REPLACE FUNCTION change_customer_pin(customer_uuid UUID, new_pin VARCHAR(6))
RETURNS BOOLEAN AS $$
DECLARE
  pin_exists BOOLEAN;
BEGIN
  -- 새 PIN이 이미 사용중인지 확인
  SELECT EXISTS(
    SELECT 1 FROM customer_pins 
    WHERE pin_code = new_pin AND is_active = TRUE AND customer_id != customer_uuid
  ) INTO pin_exists;
  
  IF pin_exists THEN
    RETURN FALSE;  -- PIN이 이미 사용중
  END IF;
  
  -- 기존 PIN 비활성화
  UPDATE customer_pins 
  SET is_active = FALSE, updated_at = now() 
  WHERE customer_id = customer_uuid;
  
  -- 새 PIN 등록
  INSERT INTO customer_pins (customer_id, pin_code, is_active, is_initial_pin)
  VALUES (customer_uuid, new_pin, TRUE, FALSE);
  
  RETURN TRUE;  -- 성공
END;
$$ LANGUAGE plpgsql;

-- 5. PIN으로 고객 정보 조회 (새로운 시그니처)
CREATE OR REPLACE FUNCTION authenticate_customer_by_pin(pin VARCHAR(6))
RETURNS TABLE(
  customer_id UUID,
  customer_code VARCHAR,
  customer_name VARCHAR,
  is_valid BOOLEAN,
  is_initial_pin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_code,
    c.name,
    (cp.is_active AND (cp.expires_at IS NULL OR cp.expires_at > now())) as is_valid,
    COALESCE(cp.is_initial_pin, FALSE) as is_initial_pin
  FROM customer_pins cp
  JOIN customers c ON cp.customer_id = c.id
  WHERE cp.pin_code = $1 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. 테스트: 함수가 정상 작동하는지 확인
SELECT 
    '=== 함수 생성 확인 ===' as info,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_name IN ('create_customer_pin', 'change_customer_pin', 'authenticate_customer_by_pin')
ORDER BY routine_name;

-- 7. 기존 고객들의 PIN을 초기화 (선택 실행)
-- 아래 주석을 해제하고 실행하면 모든 고객에게 000000 PIN 생성
/*
DO $$
DECLARE
    customer_record RECORD;
    result_pin VARCHAR(6);
BEGIN
    RAISE NOTICE '=== 모든 고객 PIN 초기화 시작 ===';
    
    FOR customer_record IN 
        SELECT id, name, customer_code 
        FROM customers 
        WHERE is_deleted = FALSE
    LOOP
        result_pin := create_customer_pin(customer_record.id);
        RAISE NOTICE '고객: % (%) - 초기 PIN: %', 
            customer_record.name, 
            customer_record.customer_code, 
            result_pin;
    END LOOP;
    
    RAISE NOTICE '=== PIN 초기화 완료 ===';
END $$;
*/

-- 8. 생성된 PIN 확인
SELECT 
    '=== 생성된 PIN 목록 ===' as info,
    c.customer_code,
    c.name,
    cp.pin_code,
    cp.is_initial_pin,
    cp.is_active,
    cp.created_at
FROM customer_pins cp
JOIN customers c ON cp.customer_id = c.id
WHERE cp.is_active = TRUE
ORDER BY c.customer_code;
