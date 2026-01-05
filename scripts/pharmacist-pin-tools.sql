-- 약사용 PIN 관리 도구

-- === 1. 모든 고객 PIN 현황 조회 ===
SELECT 
    '=== 전체 고객 PIN 현황 ===' as title,
    customer_code,
    name,
    phone,
    pin_code,
    CASE 
        WHEN is_initial_pin THEN '초기PIN'
        ELSE '개인PIN'
    END as pin_status,
    pin_updated_at
FROM customers 
WHERE is_deleted = FALSE
ORDER BY 
    is_initial_pin DESC,  -- 초기PIN 사용자를 먼저 표시
    customer_code;

-- === 2. 초기 PIN 사용 고객 (PIN 변경 필요) ===
SELECT 
    '=== 초기 PIN 사용 고객 (변경 필요) ===' as title,
    customer_code,
    name,
    phone,
    '안내: 첫 로그인 시 PIN 변경하도록 안내하세요' as action
FROM customers 
WHERE is_deleted = FALSE 
    AND is_initial_pin = TRUE
ORDER BY customer_code;

-- === 3. 특정 고객 PIN 초기화 (예시) ===
-- 사용법: 고객코드를 실제 값으로 변경 후 실행
/*
SELECT 
    '=== PIN 초기화 실행 ===' as title,
    reset_customer_pin(
        (SELECT id FROM customers WHERE customer_code = '00001')
    ) as result,
    '고객에게 "PIN이 000000으로 초기화되었습니다"라고 안내하세요' as instruction;
*/

-- === 4. PIN 중복 확인 ===
SELECT 
    '=== PIN 중복 사용 확인 ===' as title,
    pin_code,
    COUNT(*) as usage_count,
    STRING_AGG(customer_code || '(' || name || ')', ', ') as customers
FROM customers 
WHERE is_deleted = FALSE
GROUP BY pin_code
HAVING COUNT(*) > 1;

-- === 5. 최근 PIN 변경 이력 ===
SELECT 
    '=== 최근 PIN 변경 이력 ===' as title,
    customer_code,
    name,
    pin_code,
    pin_updated_at,
    CASE 
        WHEN is_initial_pin THEN '초기화됨'
        ELSE 'PIN 변경됨'
    END as action_type
FROM customers 
WHERE is_deleted = FALSE
ORDER BY pin_updated_at DESC
LIMIT 10;

-- === 약사 사용 가이드 ===
/*
=== 약사용 PIN 관리 가이드 ===

1. 신규 고객 등록 시:
   - 자동으로 PIN 000000 생성됨
   - 고객에게 "초기 PIN은 000000입니다. 첫 로그인 시 변경하시면 됩니다" 안내

2. 고객이 PIN을 잊었을 때:
   -- 특정 고객 PIN 초기화
   SELECT reset_customer_pin(
       (SELECT id FROM customers WHERE customer_code = '고객코드')
   );
   -- 고객에게 "PIN이 000000으로 초기화되었습니다" 안내

3. PIN 현황 확인:
   -- 위의 조회 쿼리들 사용

4. 고객 안내 문구:
   - 신규: "초기 PIN은 000000(영영영영영영)입니다"
   - 초기화: "PIN이 000000으로 초기화되었습니다"
   - 변경 안내: "보안을 위해 개인 PIN으로 변경해주세요"
*/
