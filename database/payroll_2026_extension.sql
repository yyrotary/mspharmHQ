-- 2026년형 약국 맞춤 급여 시스템 확장 스키마
-- Version: 2026.1.0
-- Date: 2026-01-11
-- 핵심: Net/Gross 역산, 2026년 세법 적용, 세무사 리포팅

-- ======================================
-- 1. EMPLOYEES 테이블 확장 (급여 계약 형태 추가)
-- ======================================
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'gross' 
  CHECK (salary_type IN ('gross', 'net'));  -- gross: 세전, net: 세후

ALTER TABLE employees ADD COLUMN IF NOT EXISTS dependent_count INTEGER DEFAULT 0; -- 부양가족 수
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resident_number VARCHAR(14); -- 주민번호 (암호화 저장 권장)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(50); -- 은행명
ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50); -- 계좌번호
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_foreign BOOLEAN DEFAULT false; -- 외국인 여부

-- ======================================
-- 2. SALARIES 테이블 확장 (비과세 항목 추가)
-- ======================================
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS meal_allowance DECIMAL(10, 2) DEFAULT 200000; -- 식대 (월 20만원 비과세)
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS car_allowance DECIMAL(10, 2) DEFAULT 0; -- 자가운전보조금 (월 20만원 비과세)
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS childcare_allowance DECIMAL(10, 2) DEFAULT 0; -- 보육수당 (월 10만원 비과세)
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS research_allowance DECIMAL(10, 2) DEFAULT 0; -- 연구보조비
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS fixed_overtime_hours INTEGER DEFAULT 0; -- 고정 연장근로 시간
ALTER TABLE salaries ADD COLUMN IF NOT EXISTS fixed_overtime_pay DECIMAL(10, 2) DEFAULT 0; -- 고정 연장근로수당

COMMENT ON COLUMN salaries.fixed_overtime_hours IS '포괄임금제: 고정 연장근로 시간 (명시 필요)';
COMMENT ON COLUMN salaries.fixed_overtime_pay IS '포괄임금제: 고정 연장근로수당 (명시 필요)';

-- ======================================
-- 3. PAYROLL 테이블 확장 (2026년 세법 적용)
-- ======================================
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS meal_allowance DECIMAL(10, 2) DEFAULT 0; -- 식대 (비과세)
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS car_allowance DECIMAL(10, 2) DEFAULT 0; -- 자가운전보조금 (비과세)
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS childcare_allowance DECIMAL(10, 2) DEFAULT 0; -- 보육수당 (비과세)
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS total_non_taxable DECIMAL(12, 2) DEFAULT 0; -- 비과세 총액
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS taxable_income DECIMAL(12, 2); -- 과세 소득 (세금 계산 기준)

-- 세전/세후 구분
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS salary_type VARCHAR(20) DEFAULT 'gross'; -- gross: 세전 입력, net: 세후 입력
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS net_target DECIMAL(12, 2); -- Net 계약 시 목표 실수령액
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS gross_calculated DECIMAL(12, 2); -- Net에서 역산된 세전 금액

-- 2026년 최저임금 체크
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS minimum_wage_check BOOLEAN DEFAULT true; -- 최저임금 충족 여부
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS minimum_wage_month DECIMAL(10, 2) DEFAULT 2156880; -- 2026년 월 최저임금

-- ======================================
-- 4. 승인 시스템 (근무 기록 승인)
-- ======================================
CREATE TABLE IF NOT EXISTS attendance_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('overtime', 'night', 'holiday', 'modification')),
  requested_hours DECIMAL(5, 2),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attendance_approvals_status ON attendance_approvals(status);
CREATE INDEX idx_attendance_approvals_employee ON attendance_approvals(employee_id);

-- ======================================
-- 5. 세무사 리포팅 이력
-- ======================================
CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_year INTEGER NOT NULL,
  report_month INTEGER NOT NULL CHECK (report_month BETWEEN 1 AND 12),
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('monthly_payroll', 'annual_settlement', 'quarterly')),
  
  -- 집계 정보
  total_employees INTEGER,
  total_gross_pay DECIMAL(15, 2),
  total_taxable_income DECIMAL(15, 2),
  total_non_taxable DECIMAL(15, 2),
  total_income_tax DECIMAL(15, 2),
  total_resident_tax DECIMAL(15, 2),
  total_national_pension DECIMAL(15, 2),
  total_health_insurance DECIMAL(15, 2),
  total_long_term_care DECIMAL(15, 2),
  total_employment_insurance DECIMAL(15, 2),
  
  -- 파일 정보
  file_path TEXT,
  file_name VARCHAR(255),
  
  -- 발송 정보
  sent_to_email VARCHAR(255), -- 세무사 이메일
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_status VARCHAR(20) DEFAULT 'pending' CHECK (sent_status IN ('pending', 'sent', 'failed')),
  
  generated_by UUID REFERENCES employees(id),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  notes TEXT,
  
  UNIQUE(report_year, report_month, report_type)
);

CREATE INDEX idx_tax_reports_date ON tax_reports(report_year DESC, report_month DESC);

-- ======================================
-- 6. 2026년 세율 및 요율 설정 테이블
-- ======================================
CREATE TABLE IF NOT EXISTS tax_rates_2026 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_type VARCHAR(50) NOT NULL, -- 'national_pension', 'health_insurance', 'income_tax', etc.
  rate_value DECIMAL(10, 6) NOT NULL, -- 요율 (0.045 = 4.5%)
  min_amount DECIMAL(15, 2), -- 최소 금액
  max_amount DECIMAL(15, 2), -- 최대 금액 (상한액)
  effective_from DATE NOT NULL,
  effective_to DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2026년 기본 요율 삽입
INSERT INTO tax_rates_2026 (rate_type, rate_value, min_amount, max_amount, effective_from, description) VALUES
  ('national_pension', 0.045, NULL, 6370000, '2026-01-01', '국민연금 4.5% (상한 637만원)'),
  ('health_insurance', 0.03545, NULL, NULL, '2026-01-01', '건강보험 3.545%'),
  ('long_term_care', 0.1281, NULL, NULL, '2026-01-01', '장기요양보험 12.81% (건강보험료의)'),
  ('employment_insurance', 0.009, NULL, NULL, '2026-01-01', '고용보험 0.9%'),
  ('minimum_wage_hourly', 0, 10030, NULL, '2026-01-01', '2026년 시간급 최저임금 10,030원'),
  ('minimum_wage_monthly', 0, 2156880, NULL, '2026-01-01', '2026년 월급 최저임금 2,156,880원 (주 40시간)')
ON CONFLICT DO NOTHING;

-- ======================================
-- 7. 간이세액표 2026 (구간별)
-- ======================================
CREATE TABLE IF NOT EXISTS income_tax_brackets_2026 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dependent_count INTEGER NOT NULL, -- 부양가족 수 (1인, 2인, 3인 등)
  income_from DECIMAL(15, 2) NOT NULL, -- 과세소득 시작
  income_to DECIMAL(15, 2), -- 과세소득 종료 (NULL = 이상)
  tax_amount DECIMAL(15, 2) NOT NULL, -- 해당 구간 세액
  tax_rate DECIMAL(5, 4), -- 세율 (참고용)
  year INTEGER DEFAULT 2026,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2026년 간이세액표 (부양가족 1인 기준 - 예시)
INSERT INTO income_tax_brackets_2026 (dependent_count, income_from, income_to, tax_amount, tax_rate) VALUES
  (1, 0, 1060000, 0, 0),
  (1, 1060000, 1500000, 6000, 0.06),
  (1, 1500000, 2000000, 32400, 0.15),
  (1, 2000000, 4500000, 107400, 0.24),
  (1, 4500000, 8800000, 707400, 0.35),
  (1, 8800000, NULL, 2212400, 0.38)
ON CONFLICT DO NOTHING;

-- ======================================
-- 8. VIEWS (리포팅용)
-- ======================================

-- 월별 인건비 집계 뷰
CREATE OR REPLACE VIEW monthly_labor_cost AS
SELECT 
  DATE_TRUNC('month', p.pay_period_start) as month,
  COUNT(DISTINCT p.employee_id) as employee_count,
  SUM(p.gross_pay) as total_gross,
  SUM(p.total_non_taxable) as total_non_taxable,
  SUM(p.taxable_income) as total_taxable,
  SUM(p.net_pay) as total_net_pay,
  SUM(p.national_pension) as total_pension,
  SUM(p.health_insurance) as total_health,
  SUM(p.income_tax) as total_income_tax,
  SUM(p.resident_tax) as total_resident_tax
FROM payroll p
WHERE p.status IN ('approved', 'paid')
GROUP BY DATE_TRUNC('month', p.pay_period_start)
ORDER BY month DESC;

-- 직원별 연간 급여 집계
CREATE OR REPLACE VIEW employee_annual_summary AS
SELECT 
  e.id as employee_id,
  e.name,
  e.position,
  e.salary_type,
  EXTRACT(YEAR FROM p.pay_period_start) as year,
  COUNT(*) as payment_count,
  SUM(p.gross_pay) as annual_gross,
  SUM(p.net_pay) as annual_net,
  SUM(p.income_tax + p.resident_tax) as annual_tax,
  SUM(p.national_pension + p.health_insurance + p.long_term_care + p.employment_insurance) as annual_insurance
FROM employees e
JOIN payroll p ON e.id = p.employee_id
WHERE p.status IN ('approved', 'paid')
GROUP BY e.id, e.name, e.position, e.salary_type, EXTRACT(YEAR FROM p.pay_period_start);

-- ======================================
-- 9. FUNCTIONS (계산 엔진)
-- ======================================

-- 2026년 국민연금 계산 (상한 637만원 적용)
CREATE OR REPLACE FUNCTION calculate_national_pension_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  max_income DECIMAL := 6370000;
  rate DECIMAL := 0.0475; -- 4.75% (직원 부담분만)
  base_income DECIMAL;
BEGIN
  base_income := LEAST(p_taxable_income, max_income);
  RETURN ROUND(base_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 2026년 건강보험 계산
CREATE OR REPLACE FUNCTION calculate_health_insurance_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.03595; -- 3.595% (직원 부담분만)
BEGIN
  RETURN ROUND(p_taxable_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 2026년 장기요양보험 계산 (건강보험료의 12.81%)
CREATE OR REPLACE FUNCTION calculate_long_term_care_2026(
  p_health_insurance DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.1295; -- 12.95%
BEGIN
  RETURN ROUND(p_health_insurance * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 2026년 고용보험 계산
CREATE OR REPLACE FUNCTION calculate_employment_insurance_2026(
  p_taxable_income DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  rate DECIMAL := 0.009;
BEGIN
  RETURN ROUND(p_taxable_income * rate, 0);
END;
$$ LANGUAGE plpgsql;

-- 2026년 소득세 계산 (간이세액표 기반)
CREATE OR REPLACE FUNCTION calculate_income_tax_2026(
  p_taxable_income DECIMAL,
  p_dependent_count INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
DECLARE
  tax_amount DECIMAL := 0;
BEGIN
  -- 간이세액표에서 해당 구간 찾기
  SELECT itb.tax_amount INTO tax_amount
  FROM income_tax_brackets_2026 itb
  WHERE itb.dependent_count = p_dependent_count
    AND itb.income_from <= p_taxable_income
    AND (itb.income_to IS NULL OR itb.income_to > p_taxable_income)
  ORDER BY itb.income_from DESC
  LIMIT 1;
  
  RETURN COALESCE(tax_amount, 0);
END;
$$ LANGUAGE plpgsql;

-- Net-to-Gross 역산 함수 (핵심!)
CREATE OR REPLACE FUNCTION calculate_gross_from_net_2026(
  p_net_target DECIMAL,
  p_non_taxable DECIMAL DEFAULT 0,
  p_dependent_count INTEGER DEFAULT 1
) RETURNS DECIMAL AS $$
DECLARE
  gross_estimate DECIMAL;
  taxable_income DECIMAL;
  national_pension DECIMAL;
  health_insurance DECIMAL;
  long_term_care DECIMAL;
  employment_insurance DECIMAL;
  income_tax DECIMAL;
  resident_tax DECIMAL;
  total_deductions DECIMAL;
  net_calculated DECIMAL;
  iteration INTEGER := 0;
  tolerance DECIMAL := 100; -- 오차 허용 범위 100원
BEGIN
  -- 초기 추정값 (실수령액 * 1.35 정도에서 시작)
  gross_estimate := p_net_target * 1.35;
  
  -- 반복 계산 (최대 50회)
  WHILE iteration < 50 LOOP
    -- 과세소득 계산
    taxable_income := gross_estimate - p_non_taxable;
    
    -- 4대보험 계산
    national_pension := calculate_national_pension_2026(taxable_income);
    health_insurance := calculate_health_insurance_2026(taxable_income);
    long_term_care := calculate_long_term_care_2026(health_insurance);
    employment_insurance := calculate_employment_insurance_2026(taxable_income);
    
    -- 소득세 계산
    income_tax := calculate_income_tax_2026(taxable_income, p_dependent_count);
    resident_tax := ROUND(income_tax * 0.1, 0);
    
    -- 총 공제액
    total_deductions := national_pension + health_insurance + long_term_care + 
                       employment_insurance + income_tax + resident_tax;
    
    -- 실수령액 계산
    net_calculated := gross_estimate - total_deductions;
    
    -- 목표 실수령액과 비교
    IF ABS(net_calculated - p_net_target) <= tolerance THEN
      RETURN ROUND(gross_estimate, 0);
    END IF;
    
    -- 조정
    IF net_calculated < p_net_target THEN
      gross_estimate := gross_estimate + (p_net_target - net_calculated) * 1.2;
    ELSE
      gross_estimate := gross_estimate - (net_calculated - p_net_target) * 1.2;
    END IF;
    
    iteration := iteration + 1;
  END LOOP;
  
  -- 최대 반복 횟수 도달 시 현재 추정값 반환
  RETURN ROUND(gross_estimate, 0);
END;
$$ LANGUAGE plpgsql;

-- 최저임금 체크 함수 (2026년 동적 조회)
CREATE OR REPLACE FUNCTION check_minimum_wage_2026(
  p_total_pay DECIMAL,
  p_work_hours DECIMAL DEFAULT 209 -- 월 209시간 (주 40시간 + 유급 주휴)
) RETURNS BOOLEAN AS $$
DECLARE
  minimum_monthly DECIMAL;
  minimum_hourly DECIMAL;
  hourly_rate DECIMAL;
BEGIN
  -- 2026년 최저임금 조회
  SELECT min_amount INTO minimum_monthly
  FROM tax_rates_2026
  WHERE rate_type = 'minimum_wage_monthly'
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  LIMIT 1;
  
  SELECT min_amount INTO minimum_hourly
  FROM tax_rates_2026
  WHERE rate_type = 'minimum_wage_hourly'
    AND effective_from <= CURRENT_DATE
    AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
  LIMIT 1;
  
  -- 기본값 설정 (조회 실패 시)
  minimum_monthly := COALESCE(minimum_monthly, 2156880);
  minimum_hourly := COALESCE(minimum_hourly, 10030);
  
  -- 월급제: 최저임금 이상인지 체크
  IF p_total_pay >= minimum_monthly THEN
    RETURN true;
  END IF;
  
  -- 시급 계산
  hourly_rate := p_total_pay / p_work_hours;
  
  RETURN hourly_rate >= minimum_hourly;
END;
$$ LANGUAGE plpgsql;

-- ======================================
-- TRIGGERS
-- ======================================
CREATE TRIGGER update_attendance_approvals_updated_at BEFORE UPDATE ON attendance_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 비활성화
ALTER TABLE attendance_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates_2026 DISABLE ROW LEVEL SECURITY;
ALTER TABLE income_tax_brackets_2026 DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE attendance_approvals IS '근무 기록 승인 시스템 (초과근무, 야간근무 등)';
COMMENT ON TABLE tax_reports IS '세무사 리포팅 이력 (급여대장 발송)';
COMMENT ON TABLE tax_rates_2026 IS '2026년 세율 및 요율 마스터';
COMMENT ON TABLE income_tax_brackets_2026 IS '2026년 간이세액표';

-- ===================================
-- 급여 시스템 설정 테이블
-- ===================================

-- payroll_settings 테이블 생성 (없는 경우만)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payroll_settings') THEN
    CREATE TABLE payroll_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      accountant_email VARCHAR(255),
      company_name VARCHAR(255),
      company_registration_number VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT single_settings_row CHECK (id = 1)
    );

    -- 초기 레코드 삽입
    INSERT INTO payroll_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'payroll_settings 테이블이 생성되었습니다';
  ELSE
    -- 테이블이 이미 존재하면 accountant_email 컬럼만 추가 (없는 경우)
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'payroll_settings' AND column_name = 'accountant_email'
    ) THEN
      ALTER TABLE payroll_settings ADD COLUMN accountant_email VARCHAR(255);
      RAISE NOTICE 'payroll_settings 테이블에 accountant_email 컬럼이 추가되었습니다';
    END IF;
  END IF;
END $$;

ALTER TABLE payroll_settings DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE payroll_settings IS '급여 시스템 설정 (세무사 이메일 등)';
