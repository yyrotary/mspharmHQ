# PIN 할당 및 관리 가이드

## 🔑 PIN 할당 방식

### 자동 할당 시스템

중복을 방지하기 위해 각 고객에게 고유한 PIN을 순차적으로 할당합니다:

- **첫 번째 고객**: `000000`
- **두 번째 고객**: `000001` 
- **세 번째 고객**: `000002`
- **...계속 순차적으로**

### PIN 확인 방법

```sql
-- 모든 고객의 PIN 확인
SELECT 
    customer_code,
    name,
    pin_code,
    CASE 
        WHEN is_initial_pin THEN '초기PIN (변경필요)'
        ELSE '개인PIN'
    END as pin_status
FROM customers 
WHERE is_deleted = FALSE
ORDER BY customer_code;
```

## 👥 약사 고객 안내법

### 신규 고객 등록 시

1. **PIN 확인**: 
   ```sql
   SELECT pin_code FROM customers WHERE customer_code = '00001';
   ```

2. **고객 안내**:
   ```
   "고객님의 초기 PIN은 [확인된 PIN]입니다.
   첫 로그인 시 보안을 위해 개인 PIN으로 변경하시면 됩니다."
   ```

### PIN 분실 시

1. **PIN 초기화**:
   ```sql
   SELECT reset_customer_pin(
       (SELECT id FROM customers WHERE customer_code = '00001')
   ) as new_pin;
   ```

2. **새 PIN 안내**:
   ```
   "PIN이 [새로운 PIN]으로 초기화되었습니다.
   로그인 후 개인 PIN으로 변경해주세요."
   ```

## 📱 고객 사용 플로우

### 최초 로그인
1. 약사가 알려준 PIN 입력
2. 자동으로 PIN 변경 페이지 이동
3. 새로운 6자리 PIN 설정
4. 개인 PIN으로 로그인 완료

### PIN 변경 후
- 설정한 개인 PIN으로 로그인
- 대시보드에서 언제든 PIN 변경 가능

## 🛠️ 관리 도구

### 1. PIN 현황 조회
```sql
-- 초기 PIN 사용 고객
SELECT customer_code, name, pin_code
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = TRUE
ORDER BY customer_code;

-- 개인 PIN 사용 고객  
SELECT customer_code, name, '개인PIN' as pin_status
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = FALSE
ORDER BY customer_code;
```

### 2. PIN 초기화 (일괄)
```sql
-- 여러 고객 PIN 초기화 (필요시)
DO $$
DECLARE
    customer_record RECORD;
    new_pin VARCHAR(6);
BEGIN
    FOR customer_record IN 
        SELECT id, customer_code, name 
        FROM customers 
        WHERE customer_code IN ('00001', '00002', '00003')
    LOOP
        new_pin := reset_customer_pin(customer_record.id);
        RAISE NOTICE '고객: % (%) - 새 PIN: %', 
            customer_record.name, 
            customer_record.customer_code, 
            new_pin;
    END LOOP;
END $$;
```

## ⚠️ 주의사항

### PIN 보안
- 고객에게 PIN을 안전하게 전달 (직접 전달, SMS, 전화 등)
- PIN 변경을 권장하여 보안 강화
- 초기 PIN 사용 고객을 주기적으로 확인

### 시스템 관리
- PIN은 6자리 숫자만 사용
- 중복 PIN 자동 방지
- 삭제된 고객의 PIN은 재사용 가능

## 📊 PIN 현황 대시보드

### 일일 체크 쿼리
```sql
-- 오늘의 PIN 현황
SELECT 
    '총 고객 수' as metric,
    COUNT(*) as value
FROM customers WHERE is_deleted = FALSE

UNION ALL

SELECT 
    '초기 PIN 사용자',
    COUNT(*)
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = TRUE

UNION ALL

SELECT 
    '개인 PIN 사용자',
    COUNT(*)
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = FALSE;
```

---

**🔐 체계적인 PIN 관리로 안전한 고객 서비스 제공**
