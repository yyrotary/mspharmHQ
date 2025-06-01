import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  console.log('🔍 customers 테이블 스키마 확인...');
  
  // 테이블 구조 확인
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('❌ 오류:', error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ customers 테이블 컬럼들:');
    console.log(Object.keys(data[0]));
  } else {
    console.log('⚠️ 테이블이 비어있습니다.');
    
    // 테이블 정보 조회
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_columns', { table_name: 'customers' });
      
    if (tableError) {
      console.log('테이블 정보 조회 실패:', tableError);
    } else {
      console.log('테이블 정보:', tableInfo);
    }
  }
}

checkSchema().catch(console.error); 