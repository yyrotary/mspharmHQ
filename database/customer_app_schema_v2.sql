-- ==========================================
-- 고객 앱 전용 스키마 v2
-- 기존 데이터베이스와 공유하면서 고객 앱 전용 테이블 추가
-- ==========================================

-- 1. lifestyle_records 테이블 (수면, 운동, 복약, 물 섭취 기록)
CREATE TABLE IF NOT EXISTS lifestyle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'sleep', 'exercise', 'medication', 'water'
  value JSONB NOT NULL,
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_customer 
  ON lifestyle_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_type 
  ON lifestyle_records(type);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_recorded_at 
  ON lifestyle_records(recorded_at);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_customer_date 
  ON lifestyle_records(customer_id, recorded_at);

-- 2. consultation_summaries 테이블 (AI 상담 요약)
CREATE TABLE IF NOT EXISTS consultation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  patient_friendly_summary TEXT,
  key_symptoms TEXT[] DEFAULT '{}',
  prescribed_medications TEXT[] DEFAULT '{}',
  lifestyle_recommendations TEXT[] DEFAULT '{}',
  follow_up_notes TEXT,
  urgency_level VARCHAR(20) DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(consultation_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_consultation_summaries_consultation 
  ON consultation_summaries(consultation_id);

-- 3. customers 테이블에 건강 정보 컬럼 추가
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS health_conditions TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS custom_alerts TEXT[] DEFAULT '{}';

-- 4. food_records 테이블 업데이트 (없으면 생성)
CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  food_name VARCHAR(255) NOT NULL,
  food_category VARCHAR(100),
  meal_type VARCHAR(50),
  recorded_date DATE DEFAULT CURRENT_DATE,
  recorded_time TIME DEFAULT CURRENT_TIME,
  consumed_at TIMESTAMPTZ,
  image_url TEXT,
  portion_consumed VARCHAR(50) DEFAULT '100%',
  actual_calories INTEGER,
  nutritional_info JSONB,
  user_answers JSONB,
  confidence FLOAT,
  health_score INTEGER,
  ai_analysis JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_food_records_customer 
  ON food_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_food_records_date 
  ON food_records(recorded_date);
CREATE INDEX IF NOT EXISTS idx_food_records_customer_date 
  ON food_records(customer_id, recorded_date);

-- 5. 일일 영양 요약 함수
CREATE OR REPLACE FUNCTION get_daily_nutrition_summary(
  p_customer_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_calories INTEGER,
  total_protein FLOAT,
  total_carbs FLOAT,
  total_fat FLOAT,
  total_sodium FLOAT,
  total_sugar FLOAT,
  total_fiber FLOAT,
  meal_count INTEGER,
  avg_health_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER)), 0)::INTEGER as total_calories,
    COALESCE(SUM((fr.nutritional_info->>'protein')::FLOAT), 0) as total_protein,
    COALESCE(SUM((fr.nutritional_info->>'carbohydrates')::FLOAT), 0) as total_carbs,
    COALESCE(SUM((fr.nutritional_info->>'fat')::FLOAT), 0) as total_fat,
    COALESCE(SUM((fr.nutritional_info->>'sodium')::FLOAT), 0) as total_sodium,
    COALESCE(SUM((fr.nutritional_info->>'sugar')::FLOAT), 0) as total_sugar,
    COALESCE(SUM((fr.nutritional_info->>'fiber')::FLOAT), 0) as total_fiber,
    COUNT(*)::INTEGER as meal_count,
    COALESCE(AVG(fr.health_score), 0)::FLOAT as avg_health_score
  FROM food_records fr
  WHERE fr.customer_id = p_customer_id
    AND fr.recorded_date = p_date;
END;
$$ LANGUAGE plpgsql;

-- 6. 주간/월간 영양 통계 함수
CREATE OR REPLACE FUNCTION get_nutrition_stats(
  p_customer_id UUID,
  p_period VARCHAR DEFAULT 'week'
)
RETURNS TABLE (
  avg_calories FLOAT,
  avg_protein FLOAT,
  avg_carbohydrates FLOAT,
  avg_fat FLOAT,
  avg_sodium FLOAT,
  avg_sugar FLOAT,
  avg_fiber FLOAT,
  total_meals INTEGER,
  avg_health_score FLOAT
) AS $$
DECLARE
  start_date DATE;
BEGIN
  IF p_period = 'week' THEN
    start_date := CURRENT_DATE - INTERVAL '7 days';
  ELSIF p_period = 'month' THEN
    start_date := CURRENT_DATE - INTERVAL '30 days';
  ELSE
    start_date := CURRENT_DATE - INTERVAL '7 days';
  END IF;

  RETURN QUERY
  SELECT 
    COALESCE(AVG(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER)), 0)::FLOAT as avg_calories,
    COALESCE(AVG((fr.nutritional_info->>'protein')::FLOAT), 0) as avg_protein,
    COALESCE(AVG((fr.nutritional_info->>'carbohydrates')::FLOAT), 0) as avg_carbohydrates,
    COALESCE(AVG((fr.nutritional_info->>'fat')::FLOAT), 0) as avg_fat,
    COALESCE(AVG((fr.nutritional_info->>'sodium')::FLOAT), 0) as avg_sodium,
    COALESCE(AVG((fr.nutritional_info->>'sugar')::FLOAT), 0) as avg_sugar,
    COALESCE(AVG((fr.nutritional_info->>'fiber')::FLOAT), 0) as avg_fiber,
    COUNT(*)::INTEGER as total_meals,
    COALESCE(AVG(fr.health_score), 70)::FLOAT as avg_health_score
  FROM food_records fr
  WHERE fr.customer_id = p_customer_id
    AND fr.recorded_date >= start_date;
END;
$$ LANGUAGE plpgsql;

-- 7. 일별 영양 기록 조회 함수
CREATE OR REPLACE FUNCTION get_daily_nutrition_records(
  p_customer_id UUID,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  record_date DATE,
  total_calories INTEGER,
  total_protein FLOAT,
  total_carbs FLOAT,
  total_fat FLOAT,
  meal_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fr.recorded_date as record_date,
    COALESCE(SUM(COALESCE(fr.actual_calories, (fr.nutritional_info->>'calories')::INTEGER)), 0)::INTEGER as total_calories,
    COALESCE(SUM((fr.nutritional_info->>'protein')::FLOAT), 0) as total_protein,
    COALESCE(SUM((fr.nutritional_info->>'carbohydrates')::FLOAT), 0) as total_carbs,
    COALESCE(SUM((fr.nutritional_info->>'fat')::FLOAT), 0) as total_fat,
    COUNT(*)::INTEGER as meal_count
  FROM food_records fr
  WHERE fr.customer_id = p_customer_id
    AND fr.recorded_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
  GROUP BY fr.recorded_date
  ORDER BY fr.recorded_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. 생활 기록 일일 요약 함수
CREATE OR REPLACE FUNCTION get_lifestyle_daily_summary(
  p_customer_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  sleep_hours FLOAT,
  sleep_quality VARCHAR,
  exercise_minutes INTEGER,
  exercise_types TEXT[],
  water_glasses INTEGER,
  medications_taken INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH sleep_data AS (
    SELECT 
      (value->>'hours')::FLOAT as hours,
      value->>'quality' as quality
    FROM lifestyle_records
    WHERE customer_id = p_customer_id
      AND type = 'sleep'
      AND recorded_at::DATE = p_date
    ORDER BY recorded_at DESC
    LIMIT 1
  ),
  exercise_data AS (
    SELECT 
      SUM((value->>'minutes')::INTEGER) as total_minutes,
      ARRAY_AGG(DISTINCT value->>'type') as types
    FROM lifestyle_records
    WHERE customer_id = p_customer_id
      AND type = 'exercise'
      AND recorded_at::DATE = p_date
  ),
  water_data AS (
    SELECT COUNT(*) as glasses
    FROM lifestyle_records
    WHERE customer_id = p_customer_id
      AND type = 'water'
      AND recorded_at::DATE = p_date
  ),
  medication_data AS (
    SELECT COUNT(*) as taken
    FROM lifestyle_records
    WHERE customer_id = p_customer_id
      AND type = 'medication'
      AND (value->>'taken')::BOOLEAN = true
      AND recorded_at::DATE = p_date
  )
  SELECT 
    COALESCE(s.hours, 0)::FLOAT,
    COALESCE(s.quality, '')::VARCHAR,
    COALESCE(e.total_minutes, 0)::INTEGER,
    COALESCE(e.types, '{}')::TEXT[],
    COALESCE(w.glasses, 0)::INTEGER,
    COALESCE(m.taken, 0)::INTEGER
  FROM (SELECT 1) dummy
  LEFT JOIN sleep_data s ON true
  LEFT JOIN exercise_data e ON true
  LEFT JOIN water_data w ON true
  LEFT JOIN medication_data m ON true;
END;
$$ LANGUAGE plpgsql;

-- 9. RLS 정책 설정
ALTER TABLE lifestyle_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultation_summaries ENABLE ROW LEVEL SECURITY;

-- 고객 자신의 데이터만 접근 가능
CREATE POLICY IF NOT EXISTS "lifestyle_records_customer_access" 
  ON lifestyle_records FOR ALL
  USING (customer_id::TEXT = current_setting('app.customer_id', true));

CREATE POLICY IF NOT EXISTS "consultation_summaries_access"
  ON consultation_summaries FOR SELECT
  USING (
    consultation_id IN (
      SELECT id FROM consultations 
      WHERE customer_id::TEXT = current_setting('app.customer_id', true)
    )
  );

-- 10. 트리거: updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS update_lifestyle_records_updated_at
  BEFORE UPDATE ON lifestyle_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_food_records_updated_at
  BEFORE UPDATE ON food_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER IF NOT EXISTS update_consultation_summaries_updated_at
  BEFORE UPDATE ON consultation_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '고객 앱 스키마 v2 설정 완료!';
END $$;



