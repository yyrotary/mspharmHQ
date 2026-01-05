-- 영양 분석 시스템 데이터베이스 스키마 업데이트
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. food_records 테이블에 추가 영양소 필드 확인 및 추가
ALTER TABLE food_records 
ADD COLUMN IF NOT EXISTS portion_consumed INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS actual_calories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_answers JSONB,
ADD COLUMN IF NOT EXISTS nutritional_info JSONB,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 2. nutritional_info JSONB 필드 구조 예시:
-- {
--   "calories": 350,
--   "carbohydrates": 45,
--   "protein": 20,
--   "fat": 12,
--   "fiber": 5,
--   "sodium": 800,
--   "sugar": 8,
--   "cholesterol": 50,
--   "saturated_fat": 3,
--   "vitamins": {"a": 100, "c": 15, "d": 2},
--   "minerals": {"calcium": 80, "iron": 3, "potassium": 350},
--   "gi_index": "중",
--   "health_benefits": ["단백질 풍부", "포만감 유지"],
--   "health_warnings": ["나트륨 주의"],
--   "patient_specific_warnings": ["당뇨 환자: 탄수화물 주의"],
--   "diabetes_friendly": true,
--   "hypertension_friendly": false,
--   "heart_friendly": true,
--   "kidney_friendly": false
-- }

-- 3. 음식 분석 세션 테이블 (이미 존재하면 스킵)
CREATE TABLE IF NOT EXISTS food_analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    image_url TEXT,
    analysis_result JSONB NOT NULL,
    questions JSONB NOT NULL,
    user_answers JSONB,
    status VARCHAR(20) DEFAULT 'pending_questions',
    final_record_id UUID REFERENCES food_records(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '1 hour')
);

-- 4. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_food_records_customer_date 
    ON food_records(customer_id, recorded_date DESC);

CREATE INDEX IF NOT EXISTS idx_food_records_nutritional_info 
    ON food_records USING GIN(nutritional_info);

CREATE INDEX IF NOT EXISTS idx_food_analysis_sessions_customer_id 
    ON food_analysis_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_food_analysis_sessions_status 
    ON food_analysis_sessions(status);

-- 5. 일일 영양 통계 함수
CREATE OR REPLACE FUNCTION get_daily_nutrition_stats(
    input_customer_id UUID,
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    total_calories INTEGER,
    total_carbohydrates INTEGER,
    total_protein INTEGER,
    total_fat INTEGER,
    total_fiber INTEGER,
    total_sodium INTEGER,
    total_sugar INTEGER,
    meal_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER, 0)), 0)::INTEGER as total_calories,
        COALESCE(SUM((fr.nutritional_info->>'carbohydrates')::INTEGER), 0)::INTEGER as total_carbohydrates,
        COALESCE(SUM((fr.nutritional_info->>'protein')::INTEGER), 0)::INTEGER as total_protein,
        COALESCE(SUM((fr.nutritional_info->>'fat')::INTEGER), 0)::INTEGER as total_fat,
        COALESCE(SUM((fr.nutritional_info->>'fiber')::INTEGER), 0)::INTEGER as total_fiber,
        COALESCE(SUM((fr.nutritional_info->>'sodium')::INTEGER), 0)::INTEGER as total_sodium,
        COALESCE(SUM((fr.nutritional_info->>'sugar')::INTEGER), 0)::INTEGER as total_sugar,
        COUNT(fr.id)::INTEGER as meal_count
    FROM food_records fr
    WHERE fr.customer_id = input_customer_id
    AND fr.recorded_date = target_date
    AND (fr.is_deleted IS NULL OR fr.is_deleted = FALSE);
END;
$$ LANGUAGE plpgsql;

-- 6. 주간 영양 통계 함수
CREATE OR REPLACE FUNCTION get_weekly_nutrition_stats(
    input_customer_id UUID,
    week_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    avg_calories INTEGER,
    avg_carbohydrates INTEGER,
    avg_protein INTEGER,
    avg_fat INTEGER,
    avg_sodium INTEGER,
    avg_fiber INTEGER,
    avg_sugar INTEGER,
    total_meals INTEGER,
    days_recorded INTEGER
) AS $$
DECLARE
    week_start_date DATE;
BEGIN
    week_start_date := week_end_date - INTERVAL '6 days';
    
    RETURN QUERY
    WITH daily_stats AS (
        SELECT 
            fr.recorded_date,
            SUM(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER, 0)) as day_calories,
            SUM(COALESCE((fr.nutritional_info->>'carbohydrates')::INTEGER, 0)) as day_carbs,
            SUM(COALESCE((fr.nutritional_info->>'protein')::INTEGER, 0)) as day_protein,
            SUM(COALESCE((fr.nutritional_info->>'fat')::INTEGER, 0)) as day_fat,
            SUM(COALESCE((fr.nutritional_info->>'sodium')::INTEGER, 0)) as day_sodium,
            SUM(COALESCE((fr.nutritional_info->>'fiber')::INTEGER, 0)) as day_fiber,
            SUM(COALESCE((fr.nutritional_info->>'sugar')::INTEGER, 0)) as day_sugar,
            COUNT(*) as meal_count
        FROM food_records fr
        WHERE fr.customer_id = input_customer_id
        AND fr.recorded_date BETWEEN week_start_date AND week_end_date
        AND (fr.is_deleted IS NULL OR fr.is_deleted = FALSE)
        GROUP BY fr.recorded_date
    )
    SELECT 
        COALESCE(AVG(day_calories), 0)::INTEGER as avg_calories,
        COALESCE(AVG(day_carbs), 0)::INTEGER as avg_carbohydrates,
        COALESCE(AVG(day_protein), 0)::INTEGER as avg_protein,
        COALESCE(AVG(day_fat), 0)::INTEGER as avg_fat,
        COALESCE(AVG(day_sodium), 0)::INTEGER as avg_sodium,
        COALESCE(AVG(day_fiber), 0)::INTEGER as avg_fiber,
        COALESCE(AVG(day_sugar), 0)::INTEGER as avg_sugar,
        COALESCE(SUM(meal_count), 0)::INTEGER as total_meals,
        COUNT(recorded_date)::INTEGER as days_recorded
    FROM daily_stats;
END;
$$ LANGUAGE plpgsql;

-- 7. 환자별 영양 경고 확인 함수
CREATE OR REPLACE FUNCTION check_nutrition_warnings(
    input_customer_id UUID,
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    warning_type VARCHAR,
    warning_message TEXT,
    severity VARCHAR
) AS $$
DECLARE
    customer_notes TEXT;
    daily_calories INTEGER;
    daily_sodium INTEGER;
    daily_sugar INTEGER;
    daily_protein INTEGER;
BEGIN
    -- 고객 특이사항 조회
    SELECT special_notes INTO customer_notes
    FROM customers WHERE id = input_customer_id;
    
    -- 일일 영양 통계 조회
    SELECT 
        COALESCE(SUM(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER, 0)), 0),
        COALESCE(SUM((fr.nutritional_info->>'sodium')::INTEGER), 0),
        COALESCE(SUM((fr.nutritional_info->>'sugar')::INTEGER), 0),
        COALESCE(SUM((fr.nutritional_info->>'protein')::INTEGER), 0)
    INTO daily_calories, daily_sodium, daily_sugar, daily_protein
    FROM food_records fr
    WHERE fr.customer_id = input_customer_id
    AND fr.recorded_date = target_date
    AND (fr.is_deleted IS NULL OR fr.is_deleted = FALSE);
    
    -- 당뇨 환자 경고
    IF customer_notes ILIKE '%당뇨%' OR customer_notes ILIKE '%혈당%' THEN
        IF daily_sugar > 30 THEN
            RETURN QUERY SELECT 'diabetes'::VARCHAR, '당뇨 환자: 당류 섭취량이 높습니다'::TEXT, 'high'::VARCHAR;
        END IF;
    END IF;
    
    -- 고혈압 환자 경고
    IF customer_notes ILIKE '%고혈압%' OR customer_notes ILIKE '%혈압%' THEN
        IF daily_sodium > 2000 THEN
            RETURN QUERY SELECT 'hypertension'::VARCHAR, '고혈압 환자: 나트륨 섭취가 과다합니다'::TEXT, 'high'::VARCHAR;
        END IF;
    END IF;
    
    -- 신장질환 환자 경고
    IF customer_notes ILIKE '%신장%' OR customer_notes ILIKE '%신부전%' THEN
        IF daily_protein > 60 THEN
            RETURN QUERY SELECT 'kidney'::VARCHAR, '신장질환 환자: 단백질 섭취 주의 필요'::TEXT, 'medium'::VARCHAR;
        END IF;
        IF daily_sodium > 1500 THEN
            RETURN QUERY SELECT 'kidney'::VARCHAR, '신장질환 환자: 나트륨 제한 필요'::TEXT, 'high'::VARCHAR;
        END IF;
    END IF;
    
    -- 일반 경고
    IF daily_calories > 2500 THEN
        RETURN QUERY SELECT 'general'::VARCHAR, '칼로리 섭취가 과다합니다'::TEXT, 'medium'::VARCHAR;
    END IF;
    
    IF daily_sodium > 2300 THEN
        RETURN QUERY SELECT 'general'::VARCHAR, '나트륨 섭취가 권장량을 초과했습니다'::TEXT, 'medium'::VARCHAR;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 8. RLS 정책 (Row Level Security)
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 정책 (이미 존재할 수 있으므로 DROP 후 생성)
DROP POLICY IF EXISTS "food_records_public_read" ON food_records;
CREATE POLICY "food_records_public_read" ON food_records 
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "food_records_authenticated_all" ON food_records;
CREATE POLICY "food_records_authenticated_all" ON food_records 
    FOR ALL TO authenticated USING (true);

-- 9. 코멘트 추가
COMMENT ON COLUMN food_records.nutritional_info IS '상세 영양 정보 (탄수화물, 단백질, 지방, 나트륨, 당류, 식이섬유, 비타민, 미네랄 등)';
COMMENT ON COLUMN food_records.actual_calories IS '실제 섭취한 칼로리 (portion_consumed 적용)';
COMMENT ON COLUMN food_records.portion_consumed IS '실제 섭취량 (퍼센트, 0-100)';

COMMENT ON FUNCTION get_daily_nutrition_stats IS '특정 날짜의 일일 영양 통계를 반환합니다';
COMMENT ON FUNCTION get_weekly_nutrition_stats IS '최근 7일간의 평균 영양 통계를 반환합니다';
COMMENT ON FUNCTION check_nutrition_warnings IS '환자의 질환에 따른 영양 경고를 확인합니다';

-- 완료 메시지
SELECT 'Nutrition Analysis Schema Update Completed!' as status;

