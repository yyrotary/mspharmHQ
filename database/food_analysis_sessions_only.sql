-- 음식 분석 세션 테이블 생성 (SQL Editor 실행용)
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 기존 food_records 테이블에 새로운 필드 추가
ALTER TABLE food_records 
ADD COLUMN IF NOT EXISTS portion_consumed INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS actual_calories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS consumed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS user_answers JSONB,
ADD COLUMN IF NOT EXISTS nutritional_info JSONB;

-- 2. 음식 분석 세션 테이블 생성
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

-- 5. RLS (Row Level Security) 정책 설정
ALTER TABLE food_analysis_sessions ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있다면 삭제
DROP POLICY IF EXISTS food_analysis_sessions_customer_policy ON food_analysis_sessions;

-- 고객은 자신의 분석 세션만 접근 가능
CREATE POLICY food_analysis_sessions_customer_policy ON food_analysis_sessions
    FOR ALL TO authenticated
    USING (customer_id = auth.uid());

-- 6. 코멘트 추가
COMMENT ON TABLE food_analysis_sessions IS '음식 분석 질문-답변 세션 관리 테이블';
COMMENT ON COLUMN food_records.portion_consumed IS '실제 섭취량 (퍼센트, 0-100)';
COMMENT ON COLUMN food_records.actual_calories IS '실제 섭취한 칼로리 (portion_consumed 적용)';
COMMENT ON COLUMN food_records.consumed_at IS '실제 음식을 섭취한 시간';
COMMENT ON COLUMN food_records.user_answers IS '사용자가 질문에 대해 제공한 답변들';
COMMENT ON COLUMN food_records.nutritional_info IS '상세 영양 정보 (탄수화물, 단백질, 지방, 예상 중량 등)';

-- 완료 메시지
SELECT 'Food Analysis Sessions 테이블 생성 완료!' as status;
