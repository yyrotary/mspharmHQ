-- customers 테이블에 PIN 필드 통합
-- customer_pins 테이블을 제거하고 customers 테이블에 PIN 관련 필드 추가

-- 1. customers 테이블에 PIN 관련 필드 추가
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS pin_code VARCHAR(6) DEFAULT '000000',
ADD COLUMN IF NOT EXISTS is_initial_pin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. 모든 기존 고객의 PIN을 000000으로 초기화
UPDATE customers 
SET 
    pin_code = '000000',
    is_initial_pin = TRUE,
    pin_updated_at = now()
WHERE is_deleted = FALSE 
    AND (pin_code IS NULL OR pin_code = '');

-- 3. PIN 관련 제약 조건 추가
ALTER TABLE customers 
ADD CONSTRAINT customers_pin_code_format 
    CHECK (pin_code ~ '^[0-9]{6}$');

-- 4. PIN 중복 방지를 위한 유니크 인덱스 (부분 인덱스)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_pin_code_unique 
    ON customers(pin_code) 
    WHERE is_deleted = FALSE;

-- 5. 기존 PIN 관련 함수들 삭제
DROP FUNCTION IF EXISTS authenticate_customer_by_pin(character varying);
DROP FUNCTION IF EXISTS generate_customer_pin();
DROP FUNCTION IF EXISTS create_customer_pin(UUID);
DROP FUNCTION IF EXISTS change_customer_pin(UUID, character varying);

-- 6. 새로운 PIN 인증 함수 (customers 테이블 기반)
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
    TRUE as is_valid,  -- 고객이 존재하고 삭제되지 않았으면 유효
    c.is_initial_pin
  FROM customers c
  WHERE c.pin_code = $1 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. PIN 변경 함수 (customers 테이블 기반)
CREATE OR REPLACE FUNCTION change_customer_pin(customer_uuid UUID, new_pin VARCHAR(6))
RETURNS BOOLEAN AS $$
DECLARE
  pin_exists BOOLEAN;
BEGIN
  -- 새 PIN이 이미 다른 고객이 사용중인지 확인
  SELECT EXISTS(
    SELECT 1 FROM customers 
    WHERE pin_code = new_pin 
      AND id != customer_uuid 
      AND is_deleted = FALSE
  ) INTO pin_exists;
  
  IF pin_exists THEN
    RETURN FALSE;  -- PIN이 이미 사용중
  END IF;
  
  -- PIN 변경
  UPDATE customers 
  SET 
    pin_code = new_pin,
    is_initial_pin = FALSE,
    pin_updated_at = now(),
    updated_at = now()
  WHERE id = customer_uuid 
    AND is_deleted = FALSE;
  
  RETURN TRUE;  -- 성공
END;
$$ LANGUAGE plpgsql;

-- 8. PIN 초기화 함수 (000000으로 리셋)
CREATE OR REPLACE FUNCTION reset_customer_pin(customer_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE customers 
  SET 
    pin_code = '000000',
    is_initial_pin = TRUE,
    pin_updated_at = now(),
    updated_at = now()
  WHERE id = customer_uuid 
    AND is_deleted = FALSE;
    
  RETURN FOUND;  -- 업데이트된 행이 있으면 TRUE
END;
$$ LANGUAGE plpgsql;

-- 9. customer_pins 테이블 삭제 (데이터 백업 후)
-- 혹시 기존 데이터가 중요하다면 주석 해제 전에 백업
/*
-- 기존 customer_pins 데이터 백업 (선택사항)
CREATE TABLE customer_pins_backup AS 
SELECT * FROM customer_pins;

-- customer_pins 테이블 삭제
DROP TABLE IF EXISTS customer_pins CASCADE;
*/

-- 10. 결과 확인
SELECT 
    '=== PIN 설정 결과 ===' as info,
    customer_code,
    name,
    pin_code,
    is_initial_pin,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY customer_code
LIMIT 10;

-- 11. PIN 통계 확인
SELECT 
    '=== PIN 통계 ===' as info,
    COUNT(*) as total_customers,
    COUNT(CASE WHEN pin_code = '000000' THEN 1 END) as initial_pin_count,
    COUNT(CASE WHEN is_initial_pin = FALSE THEN 1 END) as changed_pin_count
FROM customers 
WHERE is_deleted = FALSE;
