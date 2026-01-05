-- 음식 분석 질문 시스템을 위한 데이터베이스 스키마 업데이트

-- 1. 기존 food_records 테이블에 새로운 필드 추가
ALTER TABLE food_records 
ADD COLUMN IF NOT EXISTS portion_consumed INTEGER DEFAULT 100, -- 섭취량 퍼센트 (0-100)
ADD COLUMN IF NOT EXISTS actual_calories INTEGER DEFAULT 0, -- 실제 섭취 칼로리
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE, -- 실제 섭취 시간
ADD COLUMN IF NOT EXISTS user_answers JSONB, -- 사용자 답변 저장
ADD COLUMN IF NOT EXISTS nutritional_info JSONB; -- 상세 영양 정보

-- 2. 음식 분석 세션 테이블 생성 (질문-답변 프로세스 관리)
CREATE TABLE IF NOT EXISTS food_analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    image_url TEXT,
    analysis_result JSONB NOT NULL, -- Gemini AI 분석 결과
    questions JSONB NOT NULL, -- 생성된 질문들
    user_answers JSONB, -- 사용자 답변
    status VARCHAR(20) DEFAULT 'pending_questions', -- pending_questions, completed, expired
    final_record_id UUID REFERENCES food_records(id), -- 최종 생성된 음식 기록 ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '1 hour') -- 1시간 후 만료
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_food_analysis_sessions_customer_id 
    ON food_analysis_sessions(customer_id);

CREATE INDEX IF NOT EXISTS idx_food_analysis_sessions_status 
    ON food_analysis_sessions(status);

CREATE INDEX IF NOT EXISTS idx_food_analysis_sessions_expires_at 
    ON food_analysis_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_food_records_consumed_at 
    ON food_records(consumed_at);

CREATE INDEX IF NOT EXISTS idx_food_records_portion_consumed 
    ON food_records(portion_consumed);

-- 4. 만료된 세션 정리 함수
CREATE OR REPLACE FUNCTION cleanup_expired_food_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM food_analysis_sessions 
    WHERE status = 'pending_questions' 
    AND expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 5. 음식 기록 통계 함수 (일일 칼로리 및 영양소 합계)
CREATE OR REPLACE FUNCTION get_daily_nutrition_summary(
    input_customer_id UUID,
    target_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    total_calories INTEGER,
    total_carbohydrates INTEGER,
    total_protein INTEGER,
    total_fat INTEGER,
    meal_count INTEGER,
    meals_by_type JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(fr.actual_calories), 0)::INTEGER as total_calories,
        COALESCE(SUM((fr.nutritional_info->>'carbohydrates')::INTEGER), 0)::INTEGER as total_carbohydrates,
        COALESCE(SUM((fr.nutritional_info->>'protein')::INTEGER), 0)::INTEGER as total_protein,
        COALESCE(SUM((fr.nutritional_info->>'fat')::INTEGER), 0)::INTEGER as total_fat,
        COUNT(fr.id)::INTEGER as meal_count,
        COALESCE(
            jsonb_object_agg(
                fr.meal_type, 
                jsonb_build_object(
                    'count', COUNT(*),
                    'calories', SUM(fr.actual_calories)
                )
            ), 
            '{}'::jsonb
        ) as meals_by_type
    FROM food_records fr
    WHERE fr.customer_id = input_customer_id
    AND fr.recorded_date = target_date
    AND fr.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 6. 혈당 흐름 분석을 위한 시간대별 음식 조회 함수
CREATE OR REPLACE FUNCTION get_foods_by_time_range(
    input_customer_id UUID,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE(
    id UUID,
    food_name VARCHAR,
    food_category VARCHAR,
    consumed_at TIMESTAMP WITH TIME ZONE,
    actual_calories INTEGER,
    portion_consumed INTEGER,
    carbohydrates INTEGER,
    protein INTEGER,
    fat INTEGER,
    meal_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fr.id,
        fr.food_name,
        fr.food_category,
        fr.consumed_at,
        fr.actual_calories,
        fr.portion_consumed,
        COALESCE((fr.nutritional_info->>'carbohydrates')::INTEGER, 0) as carbohydrates,
        COALESCE((fr.nutritional_info->>'protein')::INTEGER, 0) as protein,
        COALESCE((fr.nutritional_info->>'fat')::INTEGER, 0) as fat,
        fr.meal_type
    FROM food_records fr
    WHERE fr.customer_id = input_customer_id
    AND fr.consumed_at BETWEEN start_time AND end_time
    AND fr.is_deleted = FALSE
    ORDER BY fr.consumed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. 주간 음식 패턴 분석 함수
CREATE OR REPLACE FUNCTION get_weekly_food_pattern(
    input_customer_id UUID,
    week_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '6 days')::DATE
)
RETURNS TABLE(
    day_of_week TEXT,
    date DATE,
    total_calories INTEGER,
    meal_count INTEGER,
    most_common_category TEXT,
    avg_portion INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_stats AS (
        SELECT 
            TO_CHAR(fr.consumed_at, 'Day') as day_name,
            fr.consumed_at::DATE as record_date,
            SUM(fr.actual_calories) as day_calories,
            COUNT(*) as day_meal_count,
            MODE() WITHIN GROUP (ORDER BY fr.food_category) as popular_category,
            AVG(fr.portion_consumed)::INTEGER as avg_portion_consumed
        FROM food_records fr
        WHERE fr.customer_id = input_customer_id
        AND fr.consumed_at::DATE BETWEEN week_start_date AND (week_start_date + INTERVAL '6 days')::DATE
        AND fr.is_deleted = FALSE
        GROUP BY TO_CHAR(fr.consumed_at, 'Day'), fr.consumed_at::DATE
    )
    SELECT 
        ds.day_name,
        ds.record_date,
        ds.day_calories::INTEGER,
        ds.day_meal_count::INTEGER,
        ds.popular_category,
        ds.avg_portion_consumed
    FROM daily_stats ds
    ORDER BY ds.record_date;
END;
$$ LANGUAGE plpgsql;

-- 8. RLS (Row Level Security) 정책 설정
ALTER TABLE food_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- 고객은 자신의 분석 세션만 접근 가능
CREATE POLICY food_analysis_sessions_customer_policy ON food_analysis_sessions
    FOR ALL TO authenticated
    USING (customer_id = auth.uid());

-- 9. 정리용 스케줄러 함수 (optional, 수동 실행용)
CREATE OR REPLACE FUNCTION schedule_cleanup_expired_sessions()
RETURNS VOID AS $$
BEGIN
    -- 만료된 세션 정리
    PERFORM cleanup_expired_food_sessions();
    
    -- 7일 이상 된 완료된 세션 정리 (선택적)
    DELETE FROM food_analysis_sessions 
    WHERE status = 'completed' 
    AND completed_at < (now() - INTERVAL '7 days');
END;
$$ LANGUAGE plpgsql;

-- 10. 유용한 뷰 생성
CREATE OR REPLACE VIEW food_records_with_nutrition AS
SELECT 
    fr.*,
    (fr.nutritional_info->>'carbohydrates')::INTEGER as carbohydrates,
    (fr.nutritional_info->>'protein')::INTEGER as protein,
    (fr.nutritional_info->>'fat')::INTEGER as fat,
    (fr.nutritional_info->>'estimated_weight_grams')::INTEGER as estimated_weight_grams
FROM food_records fr
WHERE fr.is_deleted = FALSE;

-- 11. 코멘트 추가
COMMENT ON TABLE food_analysis_sessions IS '음식 분석 질문-답변 세션 관리 테이블';
COMMENT ON COLUMN food_records.portion_consumed IS '실제 섭취량 (퍼센트, 0-100)';
COMMENT ON COLUMN food_records.actual_calories IS '실제 섭취한 칼로리 (portion_consumed 적용)';
COMMENT ON COLUMN food_records.consumed_at IS '실제 음식을 섭취한 시간';
COMMENT ON COLUMN food_records.user_answers IS '사용자가 질문에 대해 제공한 답변들';
COMMENT ON COLUMN food_records.nutritional_info IS '상세 영양 정보 (탄수화물, 단백질, 지방, 예상 중량 등)';

-- 완료 메시지
SELECT 'Food Question System Schema Update Completed!' as status;
