-- 소득세 계산 정확성 검증
-- 사용자 제공 이미지 기준: 과세소득 2,536,699원, 공제대상 1명

-- 1. 간이세액표에서 해당 구간 조회
SELECT 
    income_from,
    income_to,
    dependent_count,
    tax_amount,
    '2,536,699원이 이 구간에 포함됨' as note
FROM income_tax_brackets_2026
WHERE dependent_count = 1
  AND income_from <= 2536699
  AND (income_to IS NULL OR income_to > 2536699)
ORDER BY income_from DESC
LIMIT 1;

-- 2. 근처 구간들도 확인 (2,530,000 ~ 2,540,000)
SELECT 
    income_from,
    income_to,
    dependent_count,
    tax_amount,
    CASE 
        WHEN income_from <= 2536699 AND (income_to IS NULL OR income_to > 2536699) 
        THEN '✓ 해당 구간'
        ELSE ''
    END as is_match
FROM income_tax_brackets_2026
WHERE dependent_count = 1
  AND income_from >= 2530000
  AND income_from <= 2540000
ORDER BY income_from;

-- 3. 함수로 계산한 값 확인
SELECT calculate_income_tax_2026(2536699, 1) as calculated_tax;

-- 4. 사용자 이미지 기준 전체 계산 검증
-- 과세소득: 2,536,699원 (기본급 2,512,654 + 휴일수당 24,045)
-- 예상 소득세: 117,440원 (이미지 기준)
SELECT 
    '과세소득' as 항목,
    2536699 as 금액
UNION ALL
SELECT 
    '계산된 소득세',
    calculate_income_tax_2026(2536699, 1)::integer
UNION ALL
SELECT 
    '이미지 기준 소득세',
    117440
UNION ALL
SELECT 
    '차이',
    (calculate_income_tax_2026(2536699, 1)::integer - 117440);

-- 5. 4대보험 계산도 확인
SELECT 
    '국민연금' as 항목,
    calculate_national_pension_2026(2536699)::integer as 금액,
    163243 as 이미지_기준,
    (calculate_national_pension_2026(2536699)::integer - 163243) as 차이
UNION ALL
SELECT 
    '건강보험',
    calculate_health_insurance_2026(2536699)::integer,
    123549,
    (calculate_health_insurance_2026(2536699)::integer - 123549)
UNION ALL
SELECT 
    '장기요양',
    calculate_long_term_care_2026(2536699)::integer,
    16000,
    (calculate_long_term_care_2026(2536699)::integer - 16000)
UNION ALL
SELECT 
    '고용보험',
    calculate_employment_insurance_2026(2536699)::integer,
    30930,
    (calculate_employment_insurance_2026(2536699)::integer - 30930);

-- 6. 테이블 존재 및 레코드 수 확인
SELECT 
    COUNT(*) as total_records,
    MIN(dependent_count) as min_dependent,
    MAX(dependent_count) as max_dependent,
    MIN(income_from) as min_income,
    MAX(income_from) as max_income
FROM income_tax_brackets_2026;

-- 7. 공제대상 1명 기준 레코드 수
SELECT 
    dependent_count,
    COUNT(*) as record_count
FROM income_tax_brackets_2026
WHERE dependent_count = 1
GROUP BY dependent_count;
