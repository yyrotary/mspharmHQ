-- PIN 통합 시 중복 오류 해결 스크립트

-- 1. 먼저 customers 테이블에 PIN 컬럼들 추가 (유니크 제약 없이)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS pin_code VARCHAR(6),
ADD COLUMN IF NOT EXISTS is_initial_pin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. 중복을 방지하기 위해 각 고객에게 고유한 PIN 할당
-- 첫 번째 고객은 000000, 나머지는 순차적으로 할당
WITH numbered_customers AS (
    SELECT 
        id,
        customer_code,
        ROW_NUMBER() OVER (ORDER BY customer_code) - 1 as row_num
    FROM customers 
    WHERE is_deleted = FALSE
)
UPDATE customers 
SET 
    pin_code = LPAD((row_num)::TEXT, 6, '0'),
    is_initial_pin = TRUE,
    pin_updated_at = now()
FROM numbered_customers 
WHERE customers.id = numbered_customers.id;

-- 3. PIN 형식 제약 조건 추가
ALTER TABLE customers 
ADD CONSTRAINT customers_pin_code_format 
    CHECK (pin_code ~ '^[0-9]{6}$');

-- 4. 유니크 제약 조건 추가 (이제 중복이 없으므로 성공할 것)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_pin_code_unique 
    ON customers(pin_code) 
    WHERE is_deleted = FALSE;

-- 5. 기존 PIN 관련 함수들 삭제
DROP FUNCTION IF EXISTS authenticate_customer_by_pin(character varying);
DROP FUNCTION IF EXISTS generate_customer_pin();
DROP FUNCTION IF EXISTS create_customer_pin(UUID);
DROP FUNCTION IF EXISTS change_customer_pin(UUID, character varying);

-- 6. 새로운 PIN 인증 함수
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
    TRUE as is_valid,
    c.is_initial_pin
  FROM customers c
  WHERE c.pin_code = $1 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. PIN 변경 함수
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

-- 8. PIN 초기화 함수 (사용 가능한 PIN 찾아서 할당)
CREATE OR REPLACE FUNCTION reset_customer_pin(customer_uuid UUID)
RETURNS VARCHAR(6) AS $$
DECLARE
  new_pin VARCHAR(6);
  pin_counter INTEGER := 0;
BEGIN
  -- 사용 가능한 PIN 찾기 (000000부터 시작)
  LOOP
    new_pin := LPAD(pin_counter::TEXT, 6, '0');
    
    -- 해당 PIN이 사용중인지 확인
    IF NOT EXISTS(
      SELECT 1 FROM customers 
      WHERE pin_code = new_pin 
        AND id != customer_uuid 
        AND is_deleted = FALSE
    ) THEN
      EXIT; -- 사용 가능한 PIN 발견
    END IF;
    
    pin_counter := pin_counter + 1;
    
    -- 안전장치: 999999까지 다 찾아봤는데 없으면 에러
    IF pin_counter > 999999 THEN
      RAISE EXCEPTION 'No available PIN found';
    END IF;
  END LOOP;
  
  -- PIN 할당
  UPDATE customers 
  SET 
    pin_code = new_pin,
    is_initial_pin = TRUE,
    pin_updated_at = now(),
    updated_at = now()
  WHERE id = customer_uuid 
    AND is_deleted = FALSE;
    
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- 9. 할당된 PIN 확인
SELECT 
    '=== 할당된 PIN 현황 ===' as info,
    customer_code,
    name,
    pin_code,
    is_initial_pin,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY pin_code::INTEGER;

-- 10. PIN 통계
SELECT 
    '=== PIN 할당 통계 ===' as info,
    COUNT(*) as total_customers,
    MIN(pin_code) as min_pin,
    MAX(pin_code) as max_pin,
    COUNT(CASE WHEN is_initial_pin = TRUE THEN 1 END) as initial_pin_count
FROM customers 
WHERE is_deleted = FALSE;

-- 11. customer_pins 테이블 정리 (존재한다면)
DROP TABLE IF EXISTS customer_pins CASCADE;
