-- 통합된 PIN 시스템 테스트

-- 1. 모든 고객의 PIN 상태 확인
SELECT 
    '=== 전체 고객 PIN 상태 ===' as test_name,
    customer_code,
    name,
    pin_code,
    is_initial_pin,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY customer_code;

-- 2. PIN 인증 테스트 (000000으로)
SELECT 
    '=== PIN 인증 테스트 (000000) ===' as test_name,
    customer_id,
    customer_code,
    customer_name,
    is_valid,
    is_initial_pin
FROM authenticate_customer_by_pin('000000');

-- 3. 특정 고객의 PIN 변경 테스트
SELECT 
    '=== PIN 변경 테스트 ===' as test_name,
    change_customer_pin(
        (SELECT id FROM customers WHERE is_deleted = FALSE LIMIT 1),
        '123456'
    ) as change_result;

-- 4. 변경된 PIN으로 인증 테스트
SELECT 
    '=== 변경된 PIN 인증 테스트 (123456) ===' as test_name,
    customer_id,
    customer_code,
    customer_name,
    is_valid,
    is_initial_pin
FROM authenticate_customer_by_pin('123456');

-- 5. PIN 초기화 테스트
SELECT 
    '=== PIN 초기화 테스트 ===' as test_name,
    reset_customer_pin(
        (SELECT id FROM customers WHERE pin_code = '123456' LIMIT 1)
    ) as reset_result;

-- 6. 최종 PIN 상태 확인
SELECT 
    '=== 최종 PIN 상태 ===' as test_name,
    customer_code,
    name,
    pin_code,
    is_initial_pin,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY pin_updated_at DESC
LIMIT 5;
