-- PIN 관리 함수 업데이트
-- 초기 PIN을 000000으로 설정하고 변경 기능 추가

-- 1. 기존 PIN 생성 함수 수정 (초기값 000000)
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

-- 2. PIN 변경 함수 생성
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

-- 3. PIN으로 고객 정보 조회 (초기 PIN 여부 포함)
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
    cp.is_initial_pin
  FROM customer_pins cp
  JOIN customers c ON cp.customer_id = c.id
  WHERE cp.pin_code = pin 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 4. customer_pins 테이블에 is_initial_pin 컬럼 추가
ALTER TABLE customer_pins 
ADD COLUMN IF NOT EXISTS is_initial_pin BOOLEAN DEFAULT FALSE;

-- 5. 모든 고객에게 초기 PIN 생성
DO $$
DECLARE
    customer_record RECORD;
    result_pin VARCHAR(6);
BEGIN
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
END $$;

-- 6. 초기 PIN 상태 확인
SELECT 
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
