-- payroll 테이블에 weekly_holiday_pay 컬럼 추가
-- 주휴 수당 필드 (파트타임 직원용)

-- 컬럼이 이미 존재하는지 확인하고 없으면 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payroll' 
        AND column_name = 'weekly_holiday_pay'
    ) THEN
        ALTER TABLE payroll 
        ADD COLUMN weekly_holiday_pay NUMERIC(12,2) DEFAULT 0;
        
        RAISE NOTICE 'weekly_holiday_pay 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'weekly_holiday_pay 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 기존 레코드에 대해 기본값 설정
UPDATE payroll 
SET weekly_holiday_pay = 0 
WHERE weekly_holiday_pay IS NULL;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN payroll.weekly_holiday_pay IS '주휴 수당 (파트타임 직원, 주 15시간 이상 근무 시 지급)';
