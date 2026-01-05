import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function setupCustomerApp() {
  console.log('🚀 고객용 앱 설정을 시작합니다...\n');

  try {
    // 1. 데이터베이스 스키마 적용
    console.log('📋 1. 데이터베이스 스키마 적용...');
    const schemaPath = path.join(process.cwd(), 'database', 'customer_app_schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      
      // SQL을 세미콜론으로 분할하여 개별 실행
      const statements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.includes('SELECT ') && statement.includes("status")) {
          // 상태 메시지는 건너뛰기
          continue;
        }
        
        try {
          const { error } = await supabase.rpc('execute_sql', { sql_query: statement });
          if (error) {
            console.warn(`⚠️  SQL 실행 경고: ${error.message}`);
          }
        } catch (err: any) {
          console.warn(`⚠️  SQL 실행 경고: ${err.message}`);
        }
      }
      console.log('✅ 데이터베이스 스키마가 적용되었습니다.');
    } else {
      console.log('⚠️  스키마 파일을 찾을 수 없습니다. 수동으로 적용해주세요.');
    }

    // 2. Supabase Storage 버킷 생성
    console.log('\n📁 2. Storage 버킷 생성...');
    
    // food-images 버킷 생성
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('food-images', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      fileSizeLimit: 10485760 // 10MB
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      console.error('Storage 버킷 생성 오류:', bucketError);
    } else {
      console.log('✅ food-images 버킷이 생성되었습니다.');
    }

    // 3. 테스트 고객 PIN 생성
    console.log('\n🔑 3. 테스트 고객 PIN 생성...');
    
    // 첫 번째 고객 조회
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id, name, customer_code')
      .eq('is_deleted', false)
      .limit(3);

    if (customerError) {
      console.error('고객 조회 오류:', customerError);
    } else if (customers && customers.length > 0) {
      for (const customer of customers) {
        try {
          // PIN 생성 함수 호출
          const { data: pinData, error: pinError } = await supabase
            .rpc('create_customer_pin', { customer_uuid: customer.id });

          if (pinError) {
            console.error(`${customer.name} PIN 생성 오류:`, pinError);
          } else {
            console.log(`✅ ${customer.name} (${customer.customer_code}): PIN ${pinData}`);
          }
        } catch (err: any) {
          console.error(`${customer.name} PIN 생성 오류:`, err.message);
        }
      }
    } else {
      console.log('⚠️  테스트할 고객이 없습니다.');
    }

    // 4. 설정 완료 안내
    console.log('\n🎉 고객용 앱 설정이 완료되었습니다!');
    console.log('\n📱 다음 단계:');
    console.log('1. 웹 브라우저에서 /customer 경로로 접속');
    console.log('2. 위에 출력된 PIN 코드로 로그인 테스트');
    console.log('3. 스마트폰에서 카메라 기능 테스트 (HTTPS 필요)');
    console.log('\n⚠️  참고사항:');
    console.log('- 카메라 기능은 HTTPS 환경에서만 작동합니다');
    console.log('- 모바일 환경에서 최적화되어 있습니다');
    console.log('- Gemini API 키가 설정되어 있어야 음식 분석이 가능합니다');

  } catch (error) {
    console.error('❌ 설정 중 오류가 발생했습니다:', error);
    process.exit(1);
  }
}

// SQL 실행을 위한 RPC 함수 확인
async function checkRPCFunction() {
  const { data, error } = await supabase.rpc('execute_sql', { 
    sql_query: 'SELECT version();' 
  });
  
  if (error) {
    console.log('ℹ️  RPC 함수가 없어 수동 스키마 적용이 필요할 수 있습니다.');
    return false;
  }
  return true;
}

if (require.main === module) {
  setupCustomerApp()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export default setupCustomerApp;
