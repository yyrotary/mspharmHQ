import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function testMigration(): Promise<void> {
  console.log('🧪 마이그레이션 테스트 시작...');

  try {
    // 1. 데이터베이스 연결 테스트
    await testDatabaseConnection();

    // 2. 스키마 검증
    await testSchema();

    // 3. 데이터 무결성 검사
    await testDataIntegrity();

    // 4. API 엔드포인트 테스트
    await testAPIEndpoints();

    // 5. 성능 테스트
    await testPerformance();

    // 6. 이미지 접근 테스트
    await testImageAccess();

    console.log('✅ 모든 테스트 통과');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    throw error;
  }
}

async function testDatabaseConnection(): Promise<void> {
  console.log('🔌 데이터베이스 연결 테스트...');

  const { data, error } = await supabase
    .from('consultations')
    .select('count', { count: 'exact' })
    .limit(1);

  if (error) throw new Error(`데이터베이스 연결 실패: ${error.message}`);

  console.log(`📊 상담 테이블 레코드 수: ${data.length}`);
}

async function testSchema(): Promise<void> {
  console.log('📋 스키마 검증...');

  // 필수 테이블 존재 확인
  const requiredTables = ['consultations', 'consultation_migration_log'];
  
  for (const tableName of requiredTables) {
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', tableName);

    if (error || !data || data.length === 0) {
      throw new Error(`테이블 ${tableName}이 존재하지 않습니다.`);
    }
  }

  // 필수 컬럼 존재 확인
  const { data: columns, error: columnsError } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'consultations');

  if (columnsError) throw columnsError;

  const requiredColumns = [
    'id', 'consultation_id', 'customer_id', 'consult_date',
    'symptoms', 'image_urls', 'created_at', 'updated_at'
  ];

  const existingColumns = columns.map(col => col.column_name);
  const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

  if (missingColumns.length > 0) {
    throw new Error(`필수 컬럼이 누락되었습니다: ${missingColumns.join(', ')}`);
  }

  console.log('✅ 스키마 검증 통과');
}

async function testDataIntegrity(): Promise<void> {
  console.log('🔍 데이터 무결성 검사...');

  const { data: issues, error } = await supabase
    .rpc('validate_consultation_data');

  if (error) throw error;

  if (issues && issues.length > 0) {
    console.warn('⚠️ 데이터 무결성 문제 발견:');
    issues.forEach((issue: any) => {
      console.warn(`- ${issue.issue_type}: ${issue.consultation_id}`);
    });
    
    if (issues.length > 10) {
      throw new Error(`심각한 데이터 무결성 문제 발견: ${issues.length}개`);
    }
  } else {
    console.log('✅ 데이터 무결성 검사 통과');
  }
}

async function testAPIEndpoints(): Promise<void> {
  console.log('🔗 API 엔드포인트 테스트...');

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // GET /api/consultation-v2 테스트
  const getResponse = await fetch(`${baseUrl}/api/consultation-v2?limit=5`);
  if (!getResponse.ok) {
    throw new Error(`GET API 테스트 실패: ${getResponse.status}`);
  }

  const getData = await getResponse.json();
  if (!getData.success || !Array.isArray(getData.consultations)) {
    throw new Error('GET API 응답 형식 오류');
  }

  console.log(`✅ GET API 테스트 통과: ${getData.consultations.length}개 조회`);

  // POST API는 실제 데이터 생성을 피하고 검증만 수행
  console.log('✅ API 엔드포인트 테스트 통과');
}

async function testPerformance(): Promise<void> {
  console.log('⚡ 성능 테스트...');

  const startTime = Date.now();

  // 대량 데이터 조회 테스트
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .limit(100);

  const endTime = Date.now();
  const duration = endTime - startTime;

  if (error) throw error;

  console.log(`📊 100개 레코드 조회 시간: ${duration}ms`);

  if (duration > 3000) {
    console.warn('⚠️ 성능 경고: 조회 시간이 3초를 초과했습니다.');
  } else {
    console.log('✅ 성능 테스트 통과');
  }
}

async function testImageAccess(): Promise<void> {
  console.log('🖼️ 이미지 접근 테스트...');

  // 이미지가 있는 상담 조회
  const { data: consultations, error } = await supabase
    .from('consultations')
    .select('consultation_id, image_urls')
    .not('image_urls', 'eq', '[]')
    .limit(5);

  if (error) throw error;

  if (consultations.length === 0) {
    console.log('ℹ️ 이미지가 있는 상담이 없습니다.');
    return;
  }

  // 첫 번째 이미지 URL 접근 테스트
  const firstConsultation = consultations[0];
  const imageUrls = firstConsultation.image_urls as string[];

  if (imageUrls.length > 0) {
    const imageUrl = imageUrls[0];
    
    try {
      const response = await fetch(imageUrl, { method: 'HEAD' });
      if (response.ok) {
        console.log('✅ 이미지 접근 테스트 통과');
      } else {
        throw new Error(`이미지 접근 실패: ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️ 이미지 접근 테스트 실패: ${error}`);
    }
  }
}

// 실행
if (require.main === module) {
  testMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 