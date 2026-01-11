-- 2024년 근로소득 간이세액표 기반 소득세 계산 함수 업데이트
-- 10,000천원 초과 구간에 대한 정확한 계산식 포함

BEGIN;

-- 기존 함수 삭제 후 재생성
DROP FUNCTION IF EXISTS calculate_income_tax_2026(DECIMAL, INTEGER);

CREATE OR REPLACE FUNCTION calculate_income_tax_2026(
  p_taxable_income DECIMAL,
  p_dependent_count INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
DECLARE
  tax_amount DECIMAL := 0;
  base_tax_10m DECIMAL := 0;
  excess_amount DECIMAL := 0;
BEGIN
  -- 공제대상 가족 수 범위 체크 (1~11명)
  IF p_dependent_count < 1 THEN
    p_dependent_count := 1;
  ELSIF p_dependent_count > 11 THEN
    p_dependent_count := 11;
  END IF;

  -- 과세소득이 0 이하인 경우
  IF p_taxable_income <= 0 THEN
    RETURN 0;
  END IF;

  -- 10,000천원 이하: 간이세액표에서 조회
  IF p_taxable_income <= 10000000 THEN
    SELECT itb.tax_amount INTO tax_amount
    FROM income_tax_brackets_2026 itb
    WHERE itb.dependent_count = p_dependent_count
      AND itb.income_from <= p_taxable_income
      AND itb.income_to > p_taxable_income
    ORDER BY itb.income_from DESC
    LIMIT 1;
    
    RETURN COALESCE(tax_amount, 0);
  END IF;

  -- 10,000천원 초과 구간: 10,000천원 시점의 세액 조회 + 추가 계산
  -- 10,000천원 시점의 세액 조회 (9,980,000 ~ 10,000,000 구간)
  SELECT itb.tax_amount INTO base_tax_10m
  FROM income_tax_brackets_2026 itb
  WHERE itb.dependent_count = p_dependent_count
    AND itb.income_from = 9980000
    AND itb.income_to = 10000000
  LIMIT 1;

  -- 기본값 설정 (조회 실패 시)
  base_tax_10m := COALESCE(base_tax_10m, 0);

  -- 10,000천원 초과 금액 계산
  excess_amount := p_taxable_income - 10000000;

  -- 구간별 세액 계산
  IF p_taxable_income <= 14000000 THEN
    -- 10,000~14,000천원: base + (초과 * 0.98 * 0.35) + 25,000
    tax_amount := base_tax_10m + (excess_amount * 0.98 * 0.35) + 25000;
    
  ELSIF p_taxable_income <= 28000000 THEN
    -- 14,000~28,000천원: base + 1,397,000 + ((소득-14,000천원) * 0.98 * 0.38)
    tax_amount := base_tax_10m + 1397000 + ((p_taxable_income - 14000000) * 0.98 * 0.38);
    
  ELSIF p_taxable_income <= 30000000 THEN
    -- 28,000~30,000천원: base + 6,610,600 + ((소득-28,000천원) * 0.98 * 0.40)
    tax_amount := base_tax_10m + 6610600 + ((p_taxable_income - 28000000) * 0.98 * 0.40);
    
  ELSIF p_taxable_income <= 45000000 THEN
    -- 30,000~45,000천원: base + 7,394,600 + ((소득-30,000천원) * 0.40)
    tax_amount := base_tax_10m + 7394600 + ((p_taxable_income - 30000000) * 0.40);
    
  ELSIF p_taxable_income <= 87000000 THEN
    -- 45,000~87,000천원: base + 13,394,600 + ((소득-45,000천원) * 0.42)
    tax_amount := base_tax_10m + 13394600 + ((p_taxable_income - 45000000) * 0.42);
    
  ELSE
    -- 87,000천원 초과: base + 31,034,600 + ((소득-87,000천원) * 0.45)
    tax_amount := base_tax_10m + 31034600 + ((p_taxable_income - 87000000) * 0.45);
  END IF;

  -- 소득세는 10원 단위 절사
  tax_amount := FLOOR(tax_amount / 10) * 10;

  RETURN tax_amount;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- 함수 테스트 예제
-- SELECT calculate_income_tax_2026(3000000, 1);  -- 3,000천원, 공제대상 1명
-- SELECT calculate_income_tax_2026(5000000, 2);  -- 5,000천원, 공제대상 2명
-- SELECT calculate_income_tax_2026(15000000, 1); -- 15,000천원 (10,000천원 초과), 공제대상 1명
