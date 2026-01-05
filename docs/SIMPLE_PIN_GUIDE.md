# 간단한 PIN 시스템 사용 가이드

## 🔑 PIN 시스템 개요

### 로그인 방식
- **고객명 + PIN 조합**으로 로그인
- 모든 고객의 **초기 PIN: 000000**
- 고객명으로 구분하므로 PIN 중복 가능

### 장점
- ✅ 모든 고객이 동일한 초기 PIN 사용
- ✅ 고객명으로 구분하여 관리 편의성 증대
- ✅ PIN 분실 시 쉽게 초기화
- ✅ 중복 PIN 허용으로 제약 없음

## 👥 약사 사용법

### 1. 신규 고객 안내
```
"고객님의 로그인 정보입니다:
- 고객명: [등록한 이름]  
- 초기 PIN: 000000
첫 로그인 시 개인 PIN으로 변경하시면 됩니다."
```

### 2. PIN 분실 시 초기화
```sql
-- Supabase SQL Editor에서 실행
SELECT reset_customer_pin(
    (SELECT id FROM customers WHERE name = '김영희' AND is_deleted = FALSE)
) as reset_success;
```

### 3. 고객 현황 확인
```sql
-- 초기 PIN 사용 고객
SELECT name, customer_code, pin_code, is_initial_pin
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = TRUE
ORDER BY name;

-- 개인 PIN 사용 고객
SELECT name, customer_code, '개인PIN' as pin_status
FROM customers 
WHERE is_deleted = FALSE AND is_initial_pin = FALSE
ORDER BY name;
```

## 📱 고객 사용법

### 1. 최초 로그인
1. 웹사이트 `/customer` 접속
2. **고객명**: 등록된 이름 입력
3. **PIN**: 000000 입력
4. 자동으로 PIN 변경 페이지 이동
5. 새로운 6자리 PIN 설정

### 2. 이후 로그인
1. **고객명**: 등록된 이름 입력
2. **PIN**: 설정한 개인 PIN 입력

### 3. PIN 변경
- 대시보드에서 "PIN 변경" 메뉴 이용
- 언제든지 PIN 변경 가능

## 🛠️ 데이터베이스 설정

### 스키마 적용
```sql
-- Supabase SQL Editor에서 실행
-- database/simple_pin_system.sql 전체 실행
```

### 결과 확인
```sql
-- 모든 고객 PIN 상태 확인
SELECT 
    customer_code,
    name,
    pin_code,
    CASE 
        WHEN is_initial_pin THEN '초기PIN(000000)'
        ELSE '개인PIN'
    END as pin_status
FROM customers 
WHERE is_deleted = FALSE
ORDER BY name;
```

## 🔧 관리 시나리오

### 시나리오 1: 신규 고객
1. 약사가 고객 등록 → 자동으로 PIN 000000 설정
2. 고객에게 "이름과 000000으로 로그인하세요" 안내
3. 고객 첫 로그인 → PIN 변경

### 시나리오 2: PIN 분실
1. 고객: "PIN을 까먹었어요"
2. 약사: SQL로 PIN 초기화 (000000으로 리셋)
3. 고객에게 "000000으로 다시 로그인하세요" 안내

### 시나리오 3: 동명이인
- **문제**: 같은 이름의 고객 2명
- **해결**: 
  ```sql
  -- 한 명의 이름에 구분자 추가
  UPDATE customers 
  SET name = '김영희(강남점)' 
  WHERE id = 'specific_customer_uuid';
  ```

## 📊 PIN 사용 통계

### 일일 체크 쿼리
```sql
SELECT 
    '총 고객 수' as metric,
    COUNT(*) as count
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

## ⚠️ 주의사항

### 보안
- 고객에게 PIN 변경 권장
- 000000 사용자를 주기적으로 확인
- 안전한 방법으로 PIN 전달

### 관리
- 동명이인 처리 방안 준비
- 정확한 고객명 등록 중요
- 고객명 변경 시 로그인 영향 안내

---

**🔐 간단하고 실용적인 PIN 시스템으로 편리한 고객 서비스 제공**
