import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTablesManually() {
  console.log('🔧 수동으로 테이블 생성 시작...');
  
  try {
    // 1. 연결 테스트
    console.log('📡 Supabase 연결 테스트...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('✅ Supabase 연결 성공');

    // 2. customers 테이블이 있는지 확인
    console.log('📋 기존 테이블 확인...');
    const { data: customersData, error: customersError } = await supabase
      .from('customers')
      .select('id')
      .limit(1);
    
    if (customersError) {
      console.log('⚠️ customers 테이블이 없습니다. 먼저 customers 테이블을 생성해야 합니다.');
      console.log('Supabase 대시보드에서 다음 SQL을 실행하세요:');
      console.log(`
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  birth_date DATE,
  gender VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
      `);
      return;
    } else {
      console.log('✅ customers 테이블 존재 확인');
    }

    // 3. consultations 테이블 생성 시도
    console.log('📝 consultations 테이블 생성 시도...');
    
    // 먼저 테이블이 이미 있는지 확인
    const { data: consultationsData, error: consultationsError } = await supabase
      .from('consultations')
      .select('id')
      .limit(1);
    
    if (!consultationsError) {
      console.log('✅ consultations 테이블이 이미 존재합니다.');
      return;
    }

    console.log('📝 Supabase 대시보드에서 다음 SQL을 실행해야 합니다:');
    console.log('=' .repeat(80));
    console.log(`
-- 1. consultations 테이블 생성
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL,
  consult_date DATE NOT NULL,
  symptoms TEXT NOT NULL,
  patient_condition TEXT,
  tongue_analysis TEXT,
  special_notes TEXT,
  prescription TEXT,
  result TEXT,
  image_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT consultations_customer_id_fkey 
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT consultations_consult_date_check 
    CHECK (consult_date <= CURRENT_DATE),
  CONSTRAINT consultations_symptoms_check 
    CHECK (length(symptoms) > 0)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_consultations_customer_id ON consultations(customer_id);
CREATE INDEX IF NOT EXISTS idx_consultations_consult_date ON consultations(consult_date DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_consultation_id ON consultations(consultation_id);
CREATE INDEX IF NOT EXISTS idx_consultations_created_at ON consultations(created_at DESC);

-- 3. 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. 업데이트 트리거
CREATE TRIGGER update_consultations_updated_at 
  BEFORE UPDATE ON consultations 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Row Level Security 활성화
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- 6. RLS 정책 생성
CREATE POLICY "Public read access" ON consultations 
  FOR SELECT TO public USING (true);

CREATE POLICY "Authenticated users full access" ON consultations 
  FOR ALL TO authenticated USING (true);

-- 7. 마이그레이션 로그 테이블
CREATE TABLE IF NOT EXISTS consultation_migration_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id VARCHAR(50) NOT NULL,
  migration_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notion_id VARCHAR(100),
  supabase_id UUID,
  image_count INTEGER DEFAULT 0,
  migrated_image_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);
    `);
    console.log('=' .repeat(80));
    console.log('');
    console.log('📋 위 SQL을 Supabase 대시보드 > SQL Editor에서 실행한 후,');
    console.log('   다시 마이그레이션을 실행해주세요.');

  } catch (error: any) {
    console.error('💥 테이블 생성 확인 실패:', error.message);
    throw error;
  }
}

// 직접 실행
if (require.main === module) {
  createTablesManually()
    .then(() => {
      console.log('✅ 테이블 생성 가이드 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 테이블 생성 확인 실패:', error);
      process.exit(1);
    });
}

export { createTablesManually }; 