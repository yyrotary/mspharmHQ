-- 고객용 앱 데이터베이스 스키마
-- 생성일: 2024-12-19
-- 설명: 고객 PIN 인증 및 음식 기록 시스템

-- 1. UUID 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. 고객 PIN 인증 테이블
CREATE TABLE IF NOT EXISTS customer_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  pin_code VARCHAR(6) UNIQUE NOT NULL,     -- 6자리 PIN 코드
  is_active BOOLEAN DEFAULT TRUE,          -- 활성 상태
  expires_at TIMESTAMP WITH TIME ZONE,     -- 만료일 (선택사항)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT customer_pins_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT customer_pins_pin_format 
    CHECK (pin_code ~ '^[0-9]{6}$')
);

-- 3. 음식 기록 테이블
CREATE TABLE IF NOT EXISTS food_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  food_name VARCHAR(200) NOT NULL,         -- 음식 이름
  food_description TEXT,                   -- 음식 설명
  food_category VARCHAR(100),              -- 음식 카테고리 (한식, 양식, 중식 등)
  image_url TEXT,                         -- 음식 이미지 URL
  confidence_score DECIMAL(3,2),          -- AI 분석 신뢰도 (0.00-1.00)
  gemini_analysis JSONB,                  -- Gemini API 분석 결과 전체
  recorded_date DATE NOT NULL,            -- 기록 날짜
  recorded_time TIME,                     -- 기록 시간
  meal_type VARCHAR(20),                  -- 식사 종류 (아침, 점심, 저녁, 간식)
  notes TEXT,                             -- 고객 메모
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT food_records_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT food_records_confidence_check 
    CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  CONSTRAINT food_records_meal_type_check 
    CHECK (meal_type IN ('아침', '점심', '저녁', '간식', '기타'))
);

-- 4. 생활 기록 테이블 (수면, 운동 등)
CREATE TABLE IF NOT EXISTS lifestyle_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  record_type VARCHAR(50) NOT NULL,       -- 기록 타입 (수면, 운동, 복약, 기타)
  record_date DATE NOT NULL,              -- 기록 날짜
  
  -- 수면 관련
  sleep_bedtime TIME,                     -- 취침 시간
  sleep_waketime TIME,                    -- 기상 시간
  sleep_quality INTEGER,                  -- 수면 질 (1-5점)
  sleep_notes TEXT,                       -- 수면 메모
  
  -- 운동 관련
  exercise_type VARCHAR(100),             -- 운동 종류
  exercise_duration INTEGER,              -- 운동 시간 (분)
  exercise_intensity VARCHAR(20),         -- 운동 강도 (낮음, 보통, 높음)
  exercise_notes TEXT,                    -- 운동 메모
  
  -- 복약 관련
  medication_name VARCHAR(200),           -- 약물명
  medication_time TIME,                   -- 복용 시간
  medication_taken BOOLEAN,               -- 복용 여부
  medication_notes TEXT,                  -- 복약 메모
  
  -- 기타
  general_notes TEXT,                     -- 일반 메모
  mood_rating INTEGER,                    -- 기분 평점 (1-5점)
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- 제약 조건
  CONSTRAINT lifestyle_records_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT lifestyle_records_type_check 
    CHECK (record_type IN ('수면', '운동', '복약', '기타')),
  CONSTRAINT lifestyle_records_sleep_quality_check 
    CHECK (sleep_quality IS NULL OR (sleep_quality >= 1 AND sleep_quality <= 5)),
  CONSTRAINT lifestyle_records_mood_rating_check 
    CHECK (mood_rating IS NULL OR (mood_rating >= 1 AND mood_rating <= 5)),
  CONSTRAINT lifestyle_records_exercise_intensity_check 
    CHECK (exercise_intensity IS NULL OR exercise_intensity IN ('낮음', '보통', '높음'))
);

-- 5. 인덱스 생성
-- customer_pins 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_customer_pins_customer_id ON customer_pins(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_pins_pin_code ON customer_pins(pin_code);
CREATE INDEX IF NOT EXISTS idx_customer_pins_active ON customer_pins(is_active) WHERE is_active = TRUE;

-- food_records 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_food_records_customer_id ON food_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_food_records_date ON food_records(recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_records_customer_date ON food_records(customer_id, recorded_date DESC);
CREATE INDEX IF NOT EXISTS idx_food_records_meal_type ON food_records(meal_type);
CREATE INDEX IF NOT EXISTS idx_food_records_category ON food_records(food_category);

-- lifestyle_records 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_customer_id ON lifestyle_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_date ON lifestyle_records(record_date DESC);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_type ON lifestyle_records(record_type);
CREATE INDEX IF NOT EXISTS idx_lifestyle_records_customer_type_date ON lifestyle_records(customer_id, record_type, record_date DESC);

-- 6. 업데이트 트리거 (updated_at 자동 갱신)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 적용
DROP TRIGGER IF EXISTS update_customer_pins_updated_at ON customer_pins;
CREATE TRIGGER update_customer_pins_updated_at 
  BEFORE UPDATE ON customer_pins 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_food_records_updated_at ON food_records;
CREATE TRIGGER update_food_records_updated_at 
  BEFORE UPDATE ON food_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lifestyle_records_updated_at ON lifestyle_records;
CREATE TRIGGER update_lifestyle_records_updated_at 
  BEFORE UPDATE ON lifestyle_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 7. Row Level Security 활성화
ALTER TABLE customer_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lifestyle_records ENABLE ROW LEVEL SECURITY;

-- 8. RLS 정책 생성 (공개 읽기, 인증된 사용자 모든 권한)
-- customer_pins 정책
DROP POLICY IF EXISTS "Public read access" ON customer_pins;
CREATE POLICY "Public read access" ON customer_pins 
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users full access" ON customer_pins;
CREATE POLICY "Authenticated users full access" ON customer_pins 
  FOR ALL TO authenticated USING (true);

-- food_records 정책
DROP POLICY IF EXISTS "Public read access" ON food_records;
CREATE POLICY "Public read access" ON food_records 
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users full access" ON food_records;
CREATE POLICY "Authenticated users full access" ON food_records 
  FOR ALL TO authenticated USING (true);

-- lifestyle_records 정책
DROP POLICY IF EXISTS "Public read access" ON lifestyle_records;
CREATE POLICY "Public read access" ON lifestyle_records 
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Authenticated users full access" ON lifestyle_records;
CREATE POLICY "Authenticated users full access" ON lifestyle_records 
  FOR ALL TO authenticated USING (true);

-- 9. 유용한 함수들
-- 고객의 PIN 코드 생성 (6자리 유니크)
CREATE OR REPLACE FUNCTION generate_customer_pin()
RETURNS VARCHAR(6) AS $$
DECLARE
  new_pin VARCHAR(6);
  pin_exists BOOLEAN;
BEGIN
  LOOP
    -- 6자리 랜덤 숫자 생성
    new_pin := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    
    -- 중복 확인
    SELECT EXISTS(SELECT 1 FROM customer_pins WHERE pin_code = new_pin AND is_active = TRUE) 
    INTO pin_exists;
    
    -- 중복이 없으면 종료
    IF NOT pin_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- 고객 PIN 생성 및 등록
CREATE OR REPLACE FUNCTION create_customer_pin(customer_uuid UUID)
RETURNS VARCHAR(6) AS $$
DECLARE
  new_pin VARCHAR(6);
BEGIN
  -- 기존 PIN 비활성화
  UPDATE customer_pins 
  SET is_active = FALSE, updated_at = now() 
  WHERE customer_id = customer_uuid;
  
  -- 새 PIN 생성
  new_pin := generate_customer_pin();
  
  -- PIN 등록
  INSERT INTO customer_pins (customer_id, pin_code, is_active)
  VALUES (customer_uuid, new_pin, TRUE);
  
  RETURN new_pin;
END;
$$ LANGUAGE plpgsql;

-- PIN으로 고객 정보 조회
CREATE OR REPLACE FUNCTION authenticate_customer_by_pin(pin VARCHAR(6))
RETURNS TABLE(
  customer_id UUID,
  customer_code VARCHAR,
  customer_name VARCHAR,
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.customer_code,
    c.name,
    (cp.is_active AND (cp.expires_at IS NULL OR cp.expires_at > now())) as is_valid
  FROM customer_pins cp
  JOIN customers c ON cp.customer_id = c.id
  WHERE cp.pin_code = pin 
    AND c.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql;

-- 월별 음식 기록 통계
CREATE OR REPLACE FUNCTION get_monthly_food_stats(customer_uuid UUID, target_month DATE)
RETURNS TABLE(
  total_records INTEGER,
  breakfast_count INTEGER,
  lunch_count INTEGER,
  dinner_count INTEGER,
  snack_count INTEGER,
  top_category VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT 
      meal_type,
      food_category
    FROM food_records 
    WHERE customer_id = customer_uuid 
      AND DATE_TRUNC('month', recorded_date) = DATE_TRUNC('month', target_month)
  ),
  category_counts AS (
    SELECT food_category, COUNT(*) as cnt
    FROM monthly_data 
    WHERE food_category IS NOT NULL
    GROUP BY food_category
    ORDER BY cnt DESC
    LIMIT 1
  )
  SELECT 
    COUNT(*)::INTEGER as total_records,
    COUNT(CASE WHEN meal_type = '아침' THEN 1 END)::INTEGER as breakfast_count,
    COUNT(CASE WHEN meal_type = '점심' THEN 1 END)::INTEGER as lunch_count,
    COUNT(CASE WHEN meal_type = '저녁' THEN 1 END)::INTEGER as dinner_count,
    COUNT(CASE WHEN meal_type = '간식' THEN 1 END)::INTEGER as snack_count,
    COALESCE((SELECT food_category FROM category_counts), '없음')::VARCHAR as top_category
  FROM monthly_data;
END;
$$ LANGUAGE plpgsql;

-- 완료 메시지
SELECT '고객용 앱 데이터베이스 스키마 생성 완료!' as status;
