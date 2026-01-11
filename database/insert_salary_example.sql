-- ===================================
-- 직원 급여 정보 입력 (예시)
-- ===================================

-- 먼저 현재 직원 목록 확인
SELECT id, name, role, hire_date FROM employees ORDER BY name;

-- 위 결과에서 employee_id를 확인한 후 아래 SQL 실행
-- employee_id를 실제 값으로 변경해주세요

-- 예시 1: 월급 직원 (이정노)
INSERT INTO salaries (
  employee_id,
  base_salary,
  hourly_rate,
  meal_allowance,
  car_allowance,
  childcare_allowance,
  overtime_rate,
  night_shift_rate,
  holiday_rate,
  fixed_overtime_hours,
  fixed_overtime_pay,
  effective_from,
  effective_to
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- ⚠️ 실제 employee_id로 변경
  3000000,  -- 월 기본급 300만원
  14354,    -- 시급 (3,000,000 / 209시간)
  200000,   -- 식대 20만원 (비과세)
  0,        -- 차량수당
  0,        -- 보육수당
  1.5,      -- 연장근무 1.5배
  1.5,      -- 야간근무 1.5배
  2.0,      -- 휴일근무 2배
  0,        -- 포괄임금제 시간
  0,        -- 포괄임금제 수당
  '2020-01-01',  -- 적용 시작일 (입사일 또는 임의 날짜)
  NULL      -- 적용 종료일 (NULL = 계속 유효)
)
ON CONFLICT DO NOTHING;

-- 예시 2: 시급 직원 (파트타임)
INSERT INTO salaries (
  employee_id,
  base_salary,
  hourly_rate,
  meal_allowance,
  car_allowance,
  childcare_allowance,
  overtime_rate,
  night_shift_rate,
  holiday_rate,
  fixed_overtime_hours,
  fixed_overtime_pay,
  effective_from,
  effective_to
) VALUES (
  '00000000-0000-0000-0000-000000000002', -- ⚠️ 실제 employee_id로 변경
  0,        -- 시급제는 base_salary = 0 또는 시급*209
  12000,    -- 시급 12,000원
  100000,   -- 식대 10만원
  0,
  0,
  1.5,
  1.5,
  2.0,
  0,
  0,
  '2021-01-01',
  NULL
)
ON CONFLICT DO NOTHING;

-- 확인
SELECT 
  e.name,
  s.base_salary,
  s.hourly_rate,
  s.meal_allowance,
  s.effective_from,
  s.effective_to
FROM salaries s
JOIN employees e ON s.employee_id = e.id
ORDER BY e.name;
