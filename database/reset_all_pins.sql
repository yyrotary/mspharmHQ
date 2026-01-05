-- 모든 고객의 PIN을 000000으로 초기화

-- 1. 모든 고객의 PIN을 000000으로 리셋
UPDATE customers 
SET 
    pin_code = '000000',
    is_initial_pin = TRUE,
    pin_updated_at = now(),
    updated_at = now()
WHERE is_deleted = FALSE;

-- 2. 결과 확인
SELECT 
    '=== PIN 초기화 완료 ===' as status,
    COUNT(*) as updated_customers,
    COUNT(CASE WHEN pin_code = '000000' THEN 1 END) as pin_000000_count,
    COUNT(CASE WHEN is_initial_pin = TRUE THEN 1 END) as initial_pin_count
FROM customers 
WHERE is_deleted = FALSE;

-- 3. 고객별 PIN 상태 확인 (처음 10명)
SELECT 
    customer_code,
    name,
    pin_code,
    is_initial_pin,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY customer_code
LIMIT 10;
