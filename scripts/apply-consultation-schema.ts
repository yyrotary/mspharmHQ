import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export async function applyConsultationSchema() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    console.log('📊 상담 관리 시스템 스키마 적용 시작...');

    // SQL 파일 읽기
    const schemaPath = join(process.cwd(), 'database', 'consultation_schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');

    // SQL 실행 (세미콜론으로 분리하여 개별 실행)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`실행 중 (${i + 1}/${statements.length}): ${statement.substring(0, 50)}...`);

      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error && !error.message.includes('already exists')) {
        console.error(`SQL 실행 실패: ${statement.substring(0, 100)}...`);
        console.error('오류:', error);
        throw error;
      }
    }

    // 스키마 검증
    console.log('🔍 스키마 검증 중...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'consultations');

    if (tableError || !tables || tables.length === 0) {
      throw new Error('consultations 테이블이 생성되지 않았습니다.');
    }

    console.log('✅ 스키마 적용 완료');
    return true;

  } catch (error) {
    console.error('💥 스키마 적용 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  applyConsultationSchema()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 