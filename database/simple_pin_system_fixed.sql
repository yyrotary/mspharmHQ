-- 간단한 PIN 시스템: 고객명 + PIN 조합 로그인 (수정됨)
-- 모든 고객이 동일한 초기 PIN 000000 사용

-- 1. customers 테이블에 PIN 필드 추가 (기본값 000000)
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS pin_code VARCHAR(6) DEFAULT '000000',
ADD COLUMN IF NOT EXISTS is_initial_pin BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 2. 기존 고객들의 PIN을 000000으로 초기화
UPDATE customers 
SET 
    pin_code = '000000',
    is_initial_pin = TRUE,
    pin_updated_at = now()
WHERE is_deleted = FALSE 
    AND (pin_code IS NULL OR pin_code = '');

-- 3. PIN 형식 제약 조건 (기존 제약이 있으면 삭제 후 추가)
DO $$
BEGIN
    -- 기존 제약 조건 삭제 (존재한다면)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'customers_pin_code_format'
    ) THEN
        ALTER TABLE customers DROP CONSTRAINT customers_pin_code_format;
    END IF;
    
    -- 새 제약 조건 추가
    ALTER TABLE customers 
    ADD CONSTRAINT customers_pin_code_format 
        CHECK (pin_code ~ '^[0-9]{6}$');
END $$;

-- 4. 기존 유니크 인덱스 제거 (PIN 중복 허용)
DROP INDEX IF EXISTS idx_customers_pin_code_unique;

-- 5. 기존 PIN 관련 함수들 삭제
DROP FUNCTION IF EXISTS authenticate_customer_by_pin(character varying);
DROP FUNCTION IF EXISTS authenticate_customer_by_name_and_pin(character varying, character varying);
DROP FUNCTION IF EXISTS generate_customer_pin();
DROP FUNCTION IF EXISTS create_customer_pin(UUID);
DROP FUNCTION IF EXISTS change_customer_pin(UUID, character varying);
DROP FUNCTION IF EXISTS reset_customer_pin(UUID);
DROP FUNCTION IF EXISTS search_customer_by_name(character varying);

-- 6. 고객명 + PIN 인증 함수
CREATE OR REPLACE FUNCTION authenticate_customer_by_name_and_pin(customer_name VARCHAR, pin VARCHAR(6))
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
  WHERE c.name = customer_name
    AND c.pin_code = pin 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 7. PIN 변경 함수 (고객 ID 기반)
CREATE OR REPLACE FUNCTION change_customer_pin(customer_uuid UUID, new_pin VARCHAR(6))
RETURNS BOOLEAN AS $$
BEGIN
  -- PIN 변경 (중복 체크 없음)
  UPDATE customers 
  SET 
    pin_code = new_pin,
    is_initial_pin = FALSE,
    pin_updated_at = now(),
    updated_at = now()
  WHERE id = customer_uuid 
    AND is_deleted = FALSE;
  
  RETURN FOUND;  -- 업데이트된 행이 있으면 TRUE
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
    
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- 9. 고객 이름으로 검색 함수 (PIN 입력 전 이름 확인용)
CREATE OR REPLACE FUNCTION search_customer_by_name(search_name VARCHAR)
RETURNS TABLE(
  customer_id UUID,
  customer_code VARCHAR,
  customer_name VARCHAR,
  phone VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_code,
    c.name,
    c.phone
  FROM customers c
  WHERE c.name ILIKE '%' || search_name || '%'
    AND c.is_deleted = FALSE
  ORDER BY c.name
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- 10. customer_pins 테이블 정리
DROP TABLE IF EXISTS customer_pins CASCADE;

-- 11. 결과 확인
SELECT 
    '=== 모든 고객 PIN 현황 ===' as info,
    customer_code,
    name,
    pin_code,
    is_initial_pin
FROM customers 
WHERE is_deleted = FALSE
ORDER BY customer_code
LIMIT 10;

-- 12. 테스트 - 첫 번째 고객으로 로그인 테스트
DO $$
DECLARE
    test_customer_name VARCHAR;
    test_result RECORD;
BEGIN
    -- 첫 번째 고객 이름 가져오기
    SELECT name INTO test_customer_name 
    FROM customers 
    WHERE is_deleted = FALSE 
    ORDER BY customer_code 
    LIMIT 1;
    
    IF test_customer_name IS NOT NULL THEN
        -- 로그인 테스트
        SELECT * INTO test_result
        FROM authenticate_customer_by_name_and_pin(test_customer_name, '000000');
        
        IF test_result.customer_id IS NOT NULL THEN
            RAISE NOTICE '=== 로그인 테스트 성공 ===';
            RAISE NOTICE '고객: % (%), 초기PIN: %', 
                test_result.customer_name, 
                test_result.customer_code, 
                test_result.is_initial_pin;
        ELSE
            RAISE NOTICE '=== 로그인 테스트 실패 ===';
        END IF;
    ELSE
        RAISE NOTICE '=== 테스트할 고객이 없습니다 ===';
    END IF;
END $$;

-- 13. PIN 통계
SELECT 
    '=== PIN 통계 ===' as info,
    COUNT(*) as total_customers,
    COUNT(CASE WHEN pin_code = '000000' THEN 1 END) as initial_pin_users,
    COUNT(CASE WHEN is_initial_pin = FALSE THEN 1 END) as custom_pin_users
FROM customers 
WHERE is_deleted = FALSE;
