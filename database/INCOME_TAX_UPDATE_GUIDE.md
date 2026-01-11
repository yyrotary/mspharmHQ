# 2024년 근로소득 간이세액표 업데이트 가이드

## 개요
정확한 2024년 근로소득 간이세액표 데이터로 데이터베이스를 업데이트합니다.

## 생성된 파일
1. **fix_income_tax_2026_from_excel.sql** (7,106개 레코드)
   - 엑셀 파일에서 자동 생성된 정확한 간이세액표 데이터
   - 770천원 ~ 10,000천원 구간 (5천원 단위)
   - 공제대상 가족 수 1~11명

2. **update_income_tax_function_2026.sql**
   - 10,000천원 초과 구간 계산을 위한 함수 업데이트
   - 정확한 계산식 적용

## 실행 순서

### 1단계: 간이세액표 데이터 업데이트
```bash
Supabase SQL Editor에서 실행:
database/fix_income_tax_2026_from_excel.sql
```

**예상 소요 시간**: 약 30초 ~ 1분

**확인 방법**:
```sql
SELECT COUNT(*) FROM income_tax_brackets_2026;
-- 결과: 7106개 레코드

-- 샘플 데이터 확인
SELECT * FROM income_tax_brackets_2026 
WHERE income_from = 1060000 AND income_to = 1065000 AND dependent_count = 1;
-- 결과: tax_amount = 1040
```

### 2단계: 소득세 계산 함수 업데이트
```bash
Supabase SQL Editor에서 실행:
database/update_income_tax_function_2026.sql
```

**확인 방법**:
```sql
-- 10,000천원 이하 테스트
SELECT calculate_income_tax_2026(3000000, 1);  -- 3,000천원, 공제대상 1명
-- 예상 결과: 74,350원 정도

-- 10,000천원 초과 테스트
SELECT calculate_income_tax_2026(15000000, 1); -- 15,000천원, 공제대상 1명
-- 예상 결과: 약 3,100,000원 (10,000천원 구간 세액 + 초과분 계산)
```

## 간이세액표 데이터 검증

### 주요 구간 확인
```sql
-- 1,060~1,065천원 구간 (세액 발생 시작)
SELECT * FROM income_tax_brackets_2026 
WHERE income_from = 1060000 AND income_to = 1065000;

-- 5,000천원 구간
SELECT * FROM income_tax_brackets_2026 
WHERE income_from = 5000000 AND income_to = 5020000;

-- 9,980~10,000천원 구간 (마지막 구간)
SELECT * FROM income_tax_brackets_2026 
WHERE income_from = 9980000 AND income_to = 10000000;
```

### 예상 결과
| 소득 구간 | 공제대상 1명 | 공제대상 2명 | 공제대상 3명 |
|----------|-------------|-------------|-------------|
| 1,060~1,065천원 | 1,040 | 0 | 0 |
| 5,000~5,020천원 | 335,470 | 306,710 | 237,850 |
| 9,980~10,000천원 | 1,503,990 | 1,428,170 | 1,198,650 |

## 10,000천원 초과 구간 계산식

### 구간별 세액 계산 공식
1. **10,000 ~ 14,000천원**
   ```
   세액 = (10,000천원 세액) + (초과금액 × 0.98 × 0.35) + 25,000
   ```

2. **14,000 ~ 28,000천원**
   ```
   세액 = (10,000천원 세액) + 1,397,000 + (14,000초과 × 0.98 × 0.38)
   ```

3. **28,000 ~ 30,000천원**
   ```
   세액 = (10,000천원 세액) + 6,610,600 + (28,000초과 × 0.98 × 0.40)
   ```

4. **30,000 ~ 45,000천원**
   ```
   세액 = (10,000천원 세액) + 7,394,600 + (30,000초과 × 0.40)
   ```

5. **45,000 ~ 87,000천원**
   ```
   세액 = (10,000천원 세액) + 13,394,600 + (45,000초과 × 0.42)
   ```

6. **87,000천원 초과**
   ```
   세액 = (10,000천원 세액) + 31,034,600 + (87,000초과 × 0.45)
   ```

## 문제 해결

### 오류: "relation income_tax_brackets_2026 does not exist"
```sql
-- 테이블 생성 (payroll_2026_extension.sql의 테이블 생성 부분만 실행)
CREATE TABLE IF NOT EXISTS income_tax_brackets_2026 (
  id BIGSERIAL PRIMARY KEY,
  income_from DECIMAL NOT NULL,
  income_to DECIMAL,
  dependent_count INTEGER NOT NULL,
  tax_amount DECIMAL NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 계산 결과 확인
```sql
-- Net-to-Gross 계산기 테스트
SELECT calculate_gross_from_net_2026(3000000, 0, 1);
-- 실수령액 3,000,000원을 목표로 세전 급여 계산

-- 4대보험 + 소득세 계산 전체 테스트
SELECT 
  calculate_national_pension_2026(5000000) as 국민연금,
  calculate_health_insurance_2026(5000000) as 건강보험,
  calculate_long_term_care_2026(5000000) as 장기요양,
  calculate_employment_insurance_2026(5000000) as 고용보험,
  calculate_income_tax_2026(5000000, 1) as 소득세,
  calculate_income_tax_2026(5000000, 1) * 0.1 as 주민세;
```

## 데이터 출처
- **파일명**: 근로소득_간이세액표(조견표).xlsx
- **법령**: 2024년 근로소득에 대한 간이세액표(제189조 관련)
- **총 레코드**: 7,106개 (646개 소득 구간 × 11개 공제대상 가족 수)

## 변경 사항 요약
1. ✅ 간이세액표 데이터: 정확한 공식 데이터로 전면 교체
2. ✅ 소득세 계산 함수: 10,000천원 초과 구간 계산식 추가
3. ✅ 4대보험 계산: 이미 정확한 근로자 부담률 적용 완료 (이전 작업)

## 완료 후 테스트
1. 월급 계산 메뉴에서 직원 선택
2. Step 3 자동 계산 실행
3. 계산 결과가 정확한지 확인
4. Net-to-Gross 계산기로 역산 테스트

---

**작성일**: 2026-01-11  
**작성자**: AI Assistant  
**데이터 출처**: 2024년 근로소득 간이세액표 (제189조 관련)
