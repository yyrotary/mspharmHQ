-- salaries 테이블에 누락된 수당 및 고정 OT 컬럼 추가
-- 이 파일은 기존에 코드로만 구현되고 SQL로 문서화되지 않은 컬럼들을 추가/확인합니다.

DO $$ 
BEGIN
    -- 1. fixed_overtime_pay (포괄임금제 고정 OT 수당)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'fixed_overtime_pay'
    ) THEN
        ALTER TABLE salaries ADD COLUMN fixed_overtime_pay DECIMAL(12, 2) DEFAULT 0;
        RAISE NOTICE 'fixed_overtime_pay added';
    END IF;

    -- 2. fixed_overtime_hours (포괄임금제 고정 OT 시간)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'fixed_overtime_hours'
    ) THEN
        ALTER TABLE salaries ADD COLUMN fixed_overtime_hours DECIMAL(5, 2) DEFAULT 0;
        RAISE NOTICE 'fixed_overtime_hours added';
    END IF;

    -- 3. meal_allowance (식대)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'meal_allowance'
    ) THEN
        ALTER TABLE salaries ADD COLUMN meal_allowance DECIMAL(12, 2) DEFAULT 0;
        RAISE NOTICE 'meal_allowance added';
    END IF;

    -- 4. car_allowance (차량유지비)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'car_allowance'
    ) THEN
        ALTER TABLE salaries ADD COLUMN car_allowance DECIMAL(12, 2) DEFAULT 0;
        RAISE NOTICE 'car_allowance added';
    END IF;

    -- 5. childcare_allowance (육아수당)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'salaries' AND column_name = 'childcare_allowance'
    ) THEN
        ALTER TABLE salaries ADD COLUMN childcare_allowance DECIMAL(12, 2) DEFAULT 0;
        RAISE NOTICE 'childcare_allowance added';
    END IF;

END $$;

-- 코멘트 추가
COMMENT ON COLUMN salaries.fixed_overtime_pay IS '포괄임금제 고정 초과근무 수당';
COMMENT ON COLUMN salaries.fixed_overtime_hours IS '포괄임금제 고정 초과근무 시간 (시간)';
COMMENT ON COLUMN salaries.meal_allowance IS '식대 (비과세)';
COMMENT ON COLUMN salaries.car_allowance IS '차량유지비 (비과세)';
COMMENT ON COLUMN salaries.childcare_allowance IS '육아수당 (비과세)';
