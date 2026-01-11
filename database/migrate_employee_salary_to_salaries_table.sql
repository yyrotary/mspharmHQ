-- ===================================
-- employees 테이블의 급여 정보를 salaries 테이블로 마이그레이션
-- ===================================

DO $$ 
DECLARE
  emp_record RECORD;
  existing_count INTEGER;
BEGIN
  -- employees 테이블의 모든 직원 조회
  FOR emp_record IN 
    SELECT 
      id,
      name,
      base_salary,
      hourly_rate,
      salary_type,
      fixed_overtime_hours,
      fixed_overtime_pay,
      dependent_count,
      hire_date
    FROM employees
    WHERE (base_salary IS NOT NULL AND base_salary > 0) 
       OR (hourly_rate IS NOT NULL AND hourly_rate > 0)
  LOOP
    -- 이미 salaries 테이블에 해당 직원의 급여 정보가 있는지 확인
    SELECT COUNT(*) INTO existing_count
    FROM salaries
    WHERE employee_id = emp_record.id;
    
    IF existing_count = 0 THEN
      -- salaries 테이블에 정보가 없으면 삽입
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
        effective_to,
        created_at,
        updated_at
      ) VALUES (
        emp_record.id,
        COALESCE(emp_record.base_salary, emp_record.hourly_rate * 209),
        COALESCE(emp_record.hourly_rate, emp_record.base_salary / 209.0),
        200000, -- 기본 식대
        0,      -- 차량 수당
        0,      -- 보육 수당
        1.5,    -- 연장근무 배율
        1.5,    -- 야간근무 배율
        2.0,    -- 휴일근무 배율
        COALESCE(emp_record.fixed_overtime_hours, 0),
        COALESCE(emp_record.fixed_overtime_pay, 0),
        COALESCE(emp_record.hire_date, '2020-01-01'), -- 입사일 또는 기본값
        NULL,   -- effective_to: NULL이면 계속 유효
        NOW(),
        NOW()
      );
      
      RAISE NOTICE '급여 정보 마이그레이션 완료: % (ID: %)', emp_record.name, emp_record.id;
    ELSE
      RAISE NOTICE '급여 정보 이미 존재: % (ID: %)', emp_record.name, emp_record.id;
    END IF;
  END LOOP;
  
  RAISE NOTICE '=== 마이그레이션 완료 ===';
END $$;

-- 확인
SELECT 
  e.id,
  e.name,
  e.base_salary AS emp_base_salary,
  s.base_salary AS salary_base_salary,
  s.effective_from,
  s.effective_to
FROM employees e
LEFT JOIN salaries s ON e.id = s.employee_id
WHERE (e.base_salary IS NOT NULL AND e.base_salary > 0) 
   OR (e.hourly_rate IS NOT NULL AND e.hourly_rate > 0)
ORDER BY e.name;
