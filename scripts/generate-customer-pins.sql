-- 고객 PIN 생성 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. 현재 고객 목록 확인
SELECT 
    '=== 현재 고객 목록 ===' as info,
    id,
    customer_code,
    name,
    phone
FROM customers 
WHERE is_deleted = false 
ORDER BY customer_code
LIMIT 10;

-- 2. 첫 번째 고객의 PIN 생성 (예시)
SELECT 
    '=== 첫 번째 고객 PIN 생성 ===' as info,
    create_customer_pin(
        (SELECT id FROM customers WHERE is_deleted = false ORDER BY customer_code LIMIT 1)
    ) as generated_pin;

-- 3. 특정 고객 코드로 PIN 생성 (00001 예시)
SELECT 
    '=== 고객코드 00001 PIN 생성 ===' as info,
    create_customer_pin(
        (SELECT id FROM customers WHERE customer_code = '00001' LIMIT 1)
    ) as generated_pin;

-- 4. 생성된 PIN 확인
SELECT 
    '=== 생성된 PIN 목록 ===' as info,
    cp.pin_code,
    c.customer_code,
    c.name,
    cp.created_at
FROM customer_pins cp
JOIN customers c ON cp.customer_id = c.id
WHERE cp.is_active = TRUE
ORDER BY cp.created_at DESC;

-- 5. 여러 고객 PIN 일괄 생성 (선택 실행)
/*
DO $$
DECLARE
    customer_record RECORD;
    generated_pin VARCHAR(6);
BEGIN
    RAISE NOTICE '=== 여러 고객 PIN 일괄 생성 ===';
    
    FOR customer_record IN 
        SELECT id, name, customer_code 
        FROM customers 
        WHERE is_deleted = FALSE 
        ORDER BY customer_code 
        LIMIT 3  -- 처음 3명만
    LOOP
        generated_pin := create_customer_pin(customer_record.id);
        RAISE NOTICE '고객: % (%) - PIN: %', 
            customer_record.name, 
            customer_record.customer_code, 
            generated_pin;
    END LOOP;
END $$;
*/
