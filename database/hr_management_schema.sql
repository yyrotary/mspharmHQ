-- HR Management System Database Schema for Supabase
-- Version: 1.0.0
-- Date: 2025-01-10
-- 근태관리, 급여관리, 휴가관리, 인사평가 시스템

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================
-- 1. EMPLOYEES TABLE EXTENSION
-- ======================================
-- 기존 employees 테이블에 HR 관련 컬럼 추가
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position VARCHAR(100); -- 직책 (약사, 약무보조원, 관리자 등)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS department VARCHAR(100); -- 부서
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'full_time' 
  CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'intern'));
ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE; -- 입사일
ALTER TABLE employees ADD COLUMN IF NOT EXISTS resignation_date DATE; -- 퇴사일
ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE; -- 생년월일
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT; -- 주소
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(20); -- 비상연락처
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100); -- 비상연락처 이름

-- ======================================
-- 2. SALARY CONFIGURATION (급여 기본 정보)
-- ======================================
CREATE TABLE IF NOT EXISTS salaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  base_salary DECIMAL(12, 2) NOT NULL CHECK (base_salary >= 0), -- 기본급
  hourly_rate DECIMAL(10, 2), -- 시급 (파트타임용)
  effective_from DATE NOT NULL, -- 적용 시작일
  effective_to DATE, -- 적용 종료일
  overtime_rate DECIMAL(10, 2) DEFAULT 1.5, -- 초과근무 배율
  night_shift_rate DECIMAL(10, 2) DEFAULT 1.5, -- 야간근무 배율
  holiday_rate DECIMAL(10, 2) DEFAULT 2.0, -- 휴일근무 배율
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_effective_period CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_salaries_employee_id ON salaries(employee_id);
CREATE INDEX idx_salaries_effective_from ON salaries(effective_from DESC);

-- ======================================
-- 3. ATTENDANCE (근태 기록)
-- ======================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL, -- 근무일
  check_in_time TIMESTAMP WITH TIME ZONE, -- 출근 시간
  check_out_time TIMESTAMP WITH TIME ZONE, -- 퇴근 시간
  status VARCHAR(20) NOT NULL DEFAULT 'present' 
    CHECK (status IN ('present', 'absent', 'late', 'early_leave', 'sick', 'vacation', 'holiday')),
  work_hours DECIMAL(5, 2), -- 실제 근무 시간
  overtime_hours DECIMAL(5, 2) DEFAULT 0, -- 초과근무 시간
  night_hours DECIMAL(5, 2) DEFAULT 0, -- 야간근무 시간
  is_holiday BOOLEAN DEFAULT false, -- 휴일 근무 여부
  location VARCHAR(100), -- 근무 지점
  notes TEXT, -- 특이사항
  approved_by UUID REFERENCES employees(id), -- 승인자
  approved_at TIMESTAMP WITH TIME ZONE, -- 승인 시간
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_attendance_employee_id ON attendance(employee_id);
CREATE INDEX idx_attendance_work_date ON attendance(work_date DESC);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_check_in ON attendance(check_in_time);

-- ======================================
-- 4. LEAVE TYPES (휴가 종류)
-- ======================================
CREATE TABLE IF NOT EXISTS leave_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE, -- 연차, 병가, 경조사, 공가 등
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  is_paid BOOLEAN DEFAULT true, -- 유급 여부
  max_days_per_year INTEGER, -- 연간 최대 일수
  requires_approval BOOLEAN DEFAULT true, -- 승인 필요 여부
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 기본 휴가 종류 삽입
INSERT INTO leave_types (name, code, is_paid, max_days_per_year, requires_approval) VALUES
  ('연차', 'ANNUAL', true, 15, true),
  ('반차', 'HALF_DAY', true, NULL, true),
  ('병가', 'SICK', true, 10, true),
  ('경조사', 'FAMILY_EVENT', true, 5, true),
  ('공가', 'PUBLIC', true, NULL, true),
  ('무급휴가', 'UNPAID', false, NULL, true),
  ('출산휴가', 'MATERNITY', true, 90, true),
  ('육아휴직', 'PARENTAL', true, 365, true)
ON CONFLICT (code) DO NOTHING;

-- ======================================
-- 5. LEAVE BALANCE (휴가 잔여)
-- ======================================
CREATE TABLE IF NOT EXISTS leave_balance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  year INTEGER NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL DEFAULT 0, -- 총 부여 일수
  used_days DECIMAL(5, 2) NOT NULL DEFAULT 0, -- 사용 일수
  remaining_days DECIMAL(5, 2) GENERATED ALWAYS AS (total_days - used_days) STORED, -- 잔여 일수
  carried_over_days DECIMAL(5, 2) DEFAULT 0, -- 이월 일수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, leave_type_id, year)
);

CREATE INDEX idx_leave_balance_employee_id ON leave_balance(employee_id);
CREATE INDEX idx_leave_balance_year ON leave_balance(year DESC);

-- ======================================
-- 6. LEAVE REQUESTS (휴가 신청)
-- ======================================
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5, 2) NOT NULL, -- 신청 일수
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX idx_leave_requests_status ON leave_requests(status);
CREATE INDEX idx_leave_requests_start_date ON leave_requests(start_date DESC);

-- ======================================
-- 7. PAYROLL (급여 명세)
-- ======================================
CREATE TABLE IF NOT EXISTS payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  pay_period_start DATE NOT NULL, -- 급여 기간 시작
  pay_period_end DATE NOT NULL, -- 급여 기간 종료
  payment_date DATE NOT NULL, -- 지급일
  
  -- 급여 구성
  base_salary DECIMAL(12, 2) NOT NULL DEFAULT 0, -- 기본급
  overtime_pay DECIMAL(12, 2) DEFAULT 0, -- 초과근무수당
  night_shift_pay DECIMAL(12, 2) DEFAULT 0, -- 야간근무수당
  holiday_pay DECIMAL(12, 2) DEFAULT 0, -- 휴일근무수당
  bonus DECIMAL(12, 2) DEFAULT 0, -- 보너스
  allowances DECIMAL(12, 2) DEFAULT 0, -- 수당 (식대, 교통비 등)
  
  -- 총 지급액
  gross_pay DECIMAL(12, 2) NOT NULL, -- 총 지급액 (세전)
  
  -- 공제 항목
  income_tax DECIMAL(12, 2) DEFAULT 0, -- 소득세
  resident_tax DECIMAL(12, 2) DEFAULT 0, -- 주민세
  national_pension DECIMAL(12, 2) DEFAULT 0, -- 국민연금
  health_insurance DECIMAL(12, 2) DEFAULT 0, -- 건강보험
  long_term_care DECIMAL(12, 2) DEFAULT 0, -- 장기요양보험
  employment_insurance DECIMAL(12, 2) DEFAULT 0, -- 고용보험
  other_deductions DECIMAL(12, 2) DEFAULT 0, -- 기타 공제
  
  -- 총 공제액 및 실수령액
  total_deductions DECIMAL(12, 2) NOT NULL, -- 총 공제액
  net_pay DECIMAL(12, 2) NOT NULL, -- 실수령액
  
  -- 근무 시간
  total_work_days INTEGER, -- 총 근무일수
  total_work_hours DECIMAL(6, 2), -- 총 근무시간
  total_overtime_hours DECIMAL(6, 2), -- 총 초과근무시간
  
  status VARCHAR(20) NOT NULL DEFAULT 'draft' 
    CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  
  notes TEXT,
  calculated_by UUID REFERENCES employees(id), -- 계산자
  approved_by UUID REFERENCES employees(id), -- 승인자
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, pay_period_start, pay_period_end)
);

CREATE INDEX idx_payroll_employee_id ON payroll(employee_id);
CREATE INDEX idx_payroll_pay_period ON payroll(pay_period_start DESC, pay_period_end DESC);
CREATE INDEX idx_payroll_payment_date ON payroll(payment_date DESC);
CREATE INDEX idx_payroll_status ON payroll(status);

-- ======================================
-- 8. EVALUATIONS (인사평가)
-- ======================================
CREATE TABLE IF NOT EXISTS evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES employees(id), -- 평가자
  evaluation_period_start DATE NOT NULL,
  evaluation_period_end DATE NOT NULL,
  evaluation_date DATE NOT NULL,
  
  -- 평가 항목 (1-5점)
  work_quality INTEGER CHECK (work_quality BETWEEN 1 AND 5), -- 업무 품질
  work_speed INTEGER CHECK (work_speed BETWEEN 1 AND 5), -- 업무 속도
  responsibility INTEGER CHECK (responsibility BETWEEN 1 AND 5), -- 책임감
  communication INTEGER CHECK (communication BETWEEN 1 AND 5), -- 의사소통
  teamwork INTEGER CHECK (teamwork BETWEEN 1 AND 5), -- 팀워크
  attitude INTEGER CHECK (attitude BETWEEN 1 AND 5), -- 근무 태도
  initiative INTEGER CHECK (initiative BETWEEN 1 AND 5), -- 적극성
  
  total_score INTEGER, -- 총점
  average_score DECIMAL(3, 2), -- 평균 점수
  
  rating VARCHAR(20) CHECK (rating IN ('excellent', 'good', 'average', 'below_average', 'poor')), -- 종합 평가
  
  strengths TEXT, -- 강점
  weaknesses TEXT, -- 약점
  improvement_plan TEXT, -- 개선 계획
  comments TEXT, -- 평가자 코멘트
  
  employee_comments TEXT, -- 피평가자 의견
  acknowledged_at TIMESTAMP WITH TIME ZONE, -- 피평가자 확인 시간
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evaluations_employee_id ON evaluations(employee_id);
CREATE INDEX idx_evaluations_evaluator_id ON evaluations(evaluator_id);
CREATE INDEX idx_evaluations_date ON evaluations(evaluation_date DESC);

-- ======================================
-- 9. WORK SCHEDULE (근무 일정)
-- ======================================
CREATE TABLE IF NOT EXISTS work_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('day', 'night', 'evening', 'flexible')),
  scheduled_start_time TIME NOT NULL, -- 예정 출근 시간
  scheduled_end_time TIME NOT NULL, -- 예정 퇴근 시간
  location VARCHAR(100), -- 근무 지점
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, work_date)
);

CREATE INDEX idx_work_schedules_employee_id ON work_schedules(employee_id);
CREATE INDEX idx_work_schedules_work_date ON work_schedules(work_date);

-- ======================================
-- TRIGGERS
-- ======================================
-- Update timestamp triggers
CREATE TRIGGER update_salaries_updated_at BEFORE UPDATE ON salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_balance_updated_at BEFORE UPDATE ON leave_balance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leave_requests_updated_at BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ======================================
-- VIEWS FOR REPORTING
-- ======================================

-- 직원별 월간 근태 요약
CREATE OR REPLACE VIEW monthly_attendance_summary AS
SELECT 
  a.employee_id,
  e.name as employee_name,
  DATE_TRUNC('month', a.work_date) as month,
  COUNT(*) as total_days,
  COUNT(*) FILTER (WHERE a.status = 'present') as present_days,
  COUNT(*) FILTER (WHERE a.status = 'absent') as absent_days,
  COUNT(*) FILTER (WHERE a.status = 'late') as late_days,
  COUNT(*) FILTER (WHERE a.status = 'vacation') as vacation_days,
  SUM(a.work_hours) as total_work_hours,
  SUM(a.overtime_hours) as total_overtime_hours,
  AVG(a.work_hours) as avg_daily_hours
FROM attendance a
JOIN employees e ON a.employee_id = e.id
GROUP BY a.employee_id, e.name, DATE_TRUNC('month', a.work_date);

-- 휴가 사용 현황
CREATE OR REPLACE VIEW leave_usage_summary AS
SELECT 
  lb.employee_id,
  e.name as employee_name,
  lt.name as leave_type,
  lb.year,
  lb.total_days,
  lb.used_days,
  lb.remaining_days,
  lb.carried_over_days
FROM leave_balance lb
JOIN employees e ON lb.employee_id = e.id
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE e.is_active = true
ORDER BY lb.year DESC, e.name, lt.name;

-- 급여 지급 내역
CREATE OR REPLACE VIEW payroll_summary AS
SELECT 
  p.id,
  p.employee_id,
  e.name as employee_name,
  e.role,
  p.pay_period_start,
  p.pay_period_end,
  p.payment_date,
  p.gross_pay,
  p.total_deductions,
  p.net_pay,
  p.status,
  p.total_work_days,
  p.total_work_hours
FROM payroll p
JOIN employees e ON p.employee_id = e.id
ORDER BY p.payment_date DESC;

-- ======================================
-- UTILITY FUNCTIONS
-- ======================================

-- 근무시간 자동 계산
CREATE OR REPLACE FUNCTION calculate_work_hours(
  p_check_in TIMESTAMP WITH TIME ZONE,
  p_check_out TIMESTAMP WITH TIME ZONE
) RETURNS DECIMAL AS $$
DECLARE
  hours DECIMAL;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL THEN
    RETURN 0;
  END IF;
  
  hours := EXTRACT(EPOCH FROM (p_check_out - p_check_in)) / 3600;
  
  -- 최소 0, 최대 24시간
  hours := GREATEST(0, LEAST(24, hours));
  
  RETURN ROUND(hours, 2);
END;
$$ LANGUAGE plpgsql;

-- 초과근무 시간 계산 (8시간 초과분)
CREATE OR REPLACE FUNCTION calculate_overtime_hours(
  p_work_hours DECIMAL
) RETURNS DECIMAL AS $$
BEGIN
  IF p_work_hours > 8 THEN
    RETURN ROUND(p_work_hours - 8, 2);
  END IF;
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 야간근무 시간 계산 (22:00-06:00)
CREATE OR REPLACE FUNCTION calculate_night_hours(
  p_check_in TIMESTAMP WITH TIME ZONE,
  p_check_out TIMESTAMP WITH TIME ZONE
) RETURNS DECIMAL AS $$
DECLARE
  night_start TIME := '22:00:00';
  night_end TIME := '06:00:00';
  night_hours DECIMAL := 0;
  work_time TIME;
  work_duration INTERVAL;
BEGIN
  IF p_check_in IS NULL OR p_check_out IS NULL THEN
    RETURN 0;
  END IF;
  
  -- 간단한 계산: 실제로는 더 복잡한 로직 필요
  work_duration := p_check_out - p_check_in;
  work_time := p_check_in::TIME;
  
  -- 22시 이후 출근 또는 6시 이전 퇴근
  IF work_time >= night_start OR work_time < night_end THEN
    night_hours := LEAST(EXTRACT(EPOCH FROM work_duration) / 3600, 8);
  END IF;
  
  RETURN ROUND(night_hours, 2);
END;
$$ LANGUAGE plpgsql;

-- 연차 자동 부여 함수 (입사일 기준)
CREATE OR REPLACE FUNCTION grant_annual_leave(
  p_employee_id UUID,
  p_year INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_hire_date DATE;
  v_years_of_service INTEGER;
  v_annual_days DECIMAL;
  v_leave_type_id UUID;
BEGIN
  -- 직원 입사일 확인
  SELECT hire_date INTO v_hire_date
  FROM employees
  WHERE id = p_employee_id;
  
  IF v_hire_date IS NULL THEN
    RETURN false;
  END IF;
  
  -- 근속년수 계산
  v_years_of_service := DATE_PART('year', AGE(DATE(p_year || '-12-31'), v_hire_date));
  
  -- 연차 일수 계산 (근로기준법)
  -- 1년 미만: 월 1일, 1년: 15일, 3년마다 +1일 (최대 25일)
  IF v_years_of_service < 1 THEN
    v_annual_days := LEAST(11, DATE_PART('month', AGE(DATE(p_year || '-12-31'), v_hire_date)));
  ELSE
    v_annual_days := LEAST(25, 15 + FLOOR((v_years_of_service - 1) / 2));
  END IF;
  
  -- 연차 leave_type_id 가져오기
  SELECT id INTO v_leave_type_id
  FROM leave_types
  WHERE code = 'ANNUAL';
  
  -- leave_balance에 삽입 또는 업데이트
  INSERT INTO leave_balance (employee_id, leave_type_id, year, total_days, used_days)
  VALUES (p_employee_id, v_leave_type_id, p_year, v_annual_days, 0)
  ON CONFLICT (employee_id, leave_type_id, year)
  DO UPDATE SET total_days = v_annual_days;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- RLS 비활성화 (API에서 권한 관리)
ALTER TABLE salaries DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balance DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll DISABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules DISABLE ROW LEVEL SECURITY;

-- ======================================
-- SAMPLE DATA (테스트용)
-- ======================================
-- 실제 운영 환경에서는 주석 처리하고 사용하지 않기

-- 직원 정보 업데이트 (예시)
-- UPDATE employees 
-- SET 
--   email = name || '@pharmacy.com',
--   phone = '010-0000-0000',
--   position = CASE role
--     WHEN 'owner' THEN '약국장'
--     WHEN 'manager' THEN '관리자'
--     ELSE '약무보조원'
--   END,
--   hire_date = CURRENT_DATE - INTERVAL '2 years',
--   employment_type = 'full_time'
-- WHERE id IN (SELECT id FROM employees LIMIT 4);
