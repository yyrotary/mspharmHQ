-- ===================================
-- 급여 시스템 설정 테이블 생성
-- ===================================

DO $$ 
BEGIN
  -- payroll_settings 테이블 생성
  CREATE TABLE IF NOT EXISTS payroll_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    accountant_email VARCHAR(255),
    company_name VARCHAR(255),
    company_registration_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT single_settings_row CHECK (id = 1)
  );

  -- 초기 레코드 삽입
  INSERT INTO payroll_settings (id) 
  VALUES (1) 
  ON CONFLICT (id) DO NOTHING;

  -- RLS 비활성화
  ALTER TABLE payroll_settings DISABLE ROW LEVEL SECURITY;

  -- 테이블 설명
  EXECUTE 'COMMENT ON TABLE payroll_settings IS ''급여 시스템 설정 (세무사 이메일 등)''';
  EXECUTE 'COMMENT ON COLUMN payroll_settings.accountant_email IS ''세무사 이메일 주소''';
  EXECUTE 'COMMENT ON COLUMN payroll_settings.company_name IS ''회사명''';
  EXECUTE 'COMMENT ON COLUMN payroll_settings.company_registration_number IS ''사업자등록번호''';

  RAISE NOTICE 'payroll_settings 테이블이 생성되었습니다';
END $$;
