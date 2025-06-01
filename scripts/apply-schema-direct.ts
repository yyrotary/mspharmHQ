import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applySchemaDirectly() {
  console.log('🔧 Supabase에 직접 스키마 적용 시작...');
  
  try {
    // 1. 연결 테스트
    console.log('📡 Supabase 연결 테스트...');
    const { data: testData, error: testError } = await supabase
      .from('customers')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.log('⚠️ customers 테이블이 없거나 연결 문제:', testError.message);
    } else {
      console.log('✅ Supabase 연결 성공');
    }

    // 2. 스키마 파일 읽기
    const schemaPath = join(process.cwd(), 'database', 'consultation_schema.sql');
    const schemaSQL = readFileSync(schemaPath, 'utf-8');
    
    // 3. SQL을 개별 명령으로 분할
    const sqlCommands = schemaSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(`📝 ${sqlCommands.length}개의 SQL 명령을 실행합니다...`);

    // 4. 각 명령을 순차적으로 실행
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i];
      if (command.length < 10) continue; // 너무 짧은 명령 스킵
      
      console.log(`실행 중 (${i + 1}/${sqlCommands.length}): ${command.substring(0, 50)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { sql: command });
        
        if (error) {
          console.log(`❌ 명령 실행 실패: ${error.message}`);
          // 일부 오류는 무시하고 계속 진행 (이미 존재하는 객체 등)
          if (!error.message.includes('already exists') && 
              !error.message.includes('does not exist')) {
            throw error;
          }
        } else {
          console.log(`✅ 명령 실행 성공`);
        }
      } catch (err: any) {
        console.log(`⚠️ 명령 실행 중 오류 (계속 진행): ${err.message}`);
      }
    }

    console.log('🎉 스키마 적용 완료');
    
    // 5. 테이블 생성 확인
    console.log('📋 생성된 테이블 확인...');
    const { data: tables, error: tablesError } = await supabase
      .from('consultations')
      .select('count')
      .limit(1);
    
    if (tablesError) {
      console.log('❌ consultations 테이블 확인 실패:', tablesError.message);
    } else {
      console.log('✅ consultations 테이블 생성 확인됨');
    }

  } catch (error: any) {
    console.error('💥 스키마 적용 실패:', error.message);
    throw error;
  }
}

// 직접 실행
if (require.main === module) {
  applySchemaDirectly()
    .then(() => {
      console.log('✅ 스키마 적용 성공');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 스키마 적용 실패:', error);
      process.exit(1);
    });
}

export { applySchemaDirectly }; 