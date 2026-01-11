-- ===================================
-- 2026년 4대보험 요율 수정
-- 직원 부담분만 계산 (사업자 부담분 제외)
-- ===================================

-- 국민연금: 4.5% → 4.75%
CREATE OR REPLACE FUNCTION calculate_national_pension_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  max_income DECIMAL := 6370000; -- 기준소득월액 상한액
  rate DECIMAL := 0.0475; -- 4.75% (직원 부담분만)
  base_income DECIMAL;
BEGIN
  base_income := LEAST(p_taxable_income, max_income);
  RETURN ROUND(base_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 건강보험: 3.545% → 3.595%
CREATE OR REPLACE FUNCTION calculate_health_insurance_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.03595; -- 3.595% (직원 부담분만)
BEGIN
  RETURN ROUND(p_taxable_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 장기요양: 12.81% → 12.95%
CREATE OR REPLACE FUNCTION calculate_long_term_care_2026(
  p_health_insurance DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.1295; -- 12.95%
BEGIN
  RETURN ROUND(p_health_insurance * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 고용보험: 0.9% (이미 정확, 재확인용)
CREATE OR REPLACE FUNCTION calculate_employment_insurance_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.009; -- 0.9% (직원 부담분만)
BEGIN
  RETURN ROUND(p_taxable_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 확인 쿼리
SELECT 
  '국민연금 (4.75%)' AS 항목,
  calculate_national_pension_2026(9230000) AS 계산값,
  302575 AS 기대값,
  CASE 
    WHEN ABS(calculate_national_pension_2026(9230000) - 302575) <= 10 THEN '✓ 정확'
    ELSE '✗ 오차'
  END AS 결과
UNION ALL
SELECT 
  '건강보험 (3.595%)',
  calculate_health_insurance_2026(9230000),
  331819,
  CASE 
    WHEN ABS(calculate_health_insurance_2026(9230000) - 331819) <= 10 THEN '✓ 정확'
    ELSE '✗ 오차'
  END
UNION ALL
SELECT 
  '장기요양 (12.95%)',
  calculate_long_term_care_2026(331819),
  42970,
  CASE 
    WHEN ABS(calculate_long_term_care_2026(331819) - 42970) <= 10 THEN '✓ 정확'
    ELSE '✗ 오차'
  END
UNION ALL
SELECT 
  '고용보험 (0.9%)',
  calculate_employment_insurance_2026(9230000),
  83070,
  CASE 
    WHEN ABS(calculate_employment_insurance_2026(9230000) - 83070) <= 10 THEN '✓ 정확'
    ELSE '✗ 오차'
  END;

-- 2026년 4대보험 요율 수정 완료
SELECT '✅ 2026년 4대보험 요율이 수정되었습니다 (직원 부담분만)' AS 메시지;
