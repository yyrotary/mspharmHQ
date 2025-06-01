import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData, SupabaseConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function insertConsultationData(): Promise<void> {
  console.log('📊 Supabase 상담 데이터 삽입 시작...');

  try {
    // 마이그레이션 데이터 로드
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');

    const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    const imageUrlMapping: Record<string, string[]> = JSON.parse(readFileSync(imageUrlMappingPath, 'utf-8'));

    console.log(`📥 로드된 상담 데이터: ${consultations.length}개`);

    // 1. 먼저 고객 데이터 마이그레이션
    console.log('👥 고객 데이터 마이그레이션 시작...');
    const customerIdMapping = await migrateCustomersAndCreateMapping(consultations);

    // 2. 상담 데이터 마이그레이션
    console.log('📋 상담 데이터 마이그레이션 시작...');
    
    // 배치 단위로 삽입
    const batchSize = 50;
    const batches = chunkArray(consultations, batchSize);
    
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`배치 ${i + 1}/${batches.length} 처리 중... (${batch.length}개)`);

      const insertData: SupabaseConsultationData[] = batch.map(consultation => {
        const mappedCustomerId = customerIdMapping.get(consultation.customer_id);
        
        if (!mappedCustomerId) {
          console.warn(`고객 ID 매핑 실패: ${consultation.customer_id}`);
          return null;
        }

        return {
          consultation_id: consultation.consultation_id,
          customer_id: mappedCustomerId,
          consult_date: normalizeDate(consultation.consult_date),
          symptoms: consultation.symptoms,
          patient_condition: consultation.patient_condition,
          tongue_analysis: consultation.tongue_analysis,
          special_notes: consultation.special_notes,
          prescription: consultation.prescription,
          result: consultation.result,
          image_urls: imageUrlMapping[consultation.consultation_id] || [],
          created_at: normalizeDate(consultation.created_at)
        };
      }).filter(data => data !== null) as SupabaseConsultationData[];

      console.log(`배치 ${i + 1} 유효한 데이터: ${insertData.length}개`);
      
      if (insertData.length === 0) {
        console.warn(`배치 ${i + 1} 건너뛰기: 유효한 데이터 없음`);
        errorCount += batch.length;
        continue;
      }

      // 배치 삽입
      const { data, error } = await supabase
        .from('consultations')
        .insert(insertData)
        .select();

      if (error) {
        console.error(`배치 ${i + 1} 삽입 실패:`, error);
        console.error('오류 코드:', error.code);
        console.error('오류 메시지:', error.message);
        console.error('오류 상세:', error.details);
        console.error('삽입 시도한 데이터 샘플:', JSON.stringify(insertData[0], null, 2));
        
        // 개별 삽입 시도
        console.log(`🔄 배치 ${i + 1} 개별 삽입 시도...`);
        let individualSuccessCount = 0;
        for (const item of insertData) {
          try {
            const { data: individualData, error: individualError } = await supabase
              .from('consultations')
              .insert(item)
              .select();
            
            if (individualError) {
              console.error(`개별 삽입 실패 (${item.consultation_id}):`, individualError.message);
            } else {
              individualSuccessCount++;
            }
          } catch (err) {
            console.error(`개별 삽입 예외 (${item.consultation_id}):`, err);
          }
        }
        console.log(`✅ 개별 삽입 결과: ${individualSuccessCount}/${insertData.length}개 성공`);
        insertedCount += individualSuccessCount;
        errorCount += (insertData.length - individualSuccessCount);
      } else {
        insertedCount += data.length;
        console.log(`✅ 배치 ${i + 1} 완료: ${data.length}개 삽입`);
      }

      // 마이그레이션 로그 기록
      await logMigrationProgress(batch, error);

      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`🎉 데이터 삽입 완료: 성공 ${insertedCount}개, 실패 ${errorCount}개`);

    // 데이터 검증
    await validateMigratedData();

  } catch (error) {
    console.error('💥 데이터 삽입 실패:', error);
    throw error;
  }
}

async function migrateCustomersAndCreateMapping(consultations: NotionConsultationData[]): Promise<Map<string, string>> {
  console.log('👥 고객 데이터 추출 및 생성 중...');

  // 상담 데이터에서 고유한 고객 ID들 추출
  const uniqueCustomerIds = [...new Set(consultations.map(c => c.customer_id))];
  console.log(`발견된 고유 고객 수: ${uniqueCustomerIds.length}개`);

  const customerIdMapping = new Map<string, string>();

  // 각 고객 ID에 대해 고객 데이터 생성
  for (const notionCustomerId of uniqueCustomerIds) {
    try {
      // 해당 고객의 첫 번째 상담에서 고객 정보 추출
      const firstConsultation = consultations.find(c => c.customer_id === notionCustomerId);
      if (!firstConsultation) continue;

      // 고객 코드 추출 (상담 ID에서 고객 부분만)
      const customerCode = firstConsultation.consultation_id.split('_')[0];

      // 고객 데이터 생성
      const customerData = {
        customer_code: customerCode,
        name: `고객_${customerCode}`, // 실제 이름이 없으므로 임시 이름
        phone: null,
        address: null,
        birth_date: null,
        gender: null,
        estimated_age: null,
        special_notes: null,
        face_embedding: null,
        google_drive_folder_id: null,
        consultation_count: consultations.filter(c => c.customer_id === notionCustomerId).length,
        is_deleted: false
      };

      // 기존 고객 확인
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('customer_code', customerCode)
        .single();

      let supabaseCustomerId: string;

      if (existingCustomer) {
        // 기존 고객이 있으면 해당 ID 사용
        supabaseCustomerId = existingCustomer.id;
        console.log(`기존 고객 발견: ${customerCode} -> ${supabaseCustomerId}`);
      } else {
        // 새 고객 생성
        const { data: newCustomer, error } = await supabase
          .from('customers')
          .insert(customerData)
          .select('id')
          .single();

        if (error) {
          console.error(`고객 생성 실패 (${customerCode}):`, error);
          continue;
        }

        supabaseCustomerId = newCustomer.id;
        console.log(`새 고객 생성: ${customerCode} -> ${supabaseCustomerId}`);
      }

      customerIdMapping.set(notionCustomerId, supabaseCustomerId);

    } catch (error) {
      console.error(`고객 처리 실패 (${notionCustomerId}):`, error);
    }
  }

  console.log(`👥 고객 ID 매핑 완료: ${customerIdMapping.size}개`);
  return customerIdMapping;
}

async function logMigrationProgress(
  consultations: NotionConsultationData[],
  error: any
): Promise<void> {
  const logEntries = consultations.map(consultation => ({
    consultation_id: consultation.consultation_id,
    notion_id: consultation.id,
    migration_status: error ? 'failed' : 'completed',
    error_message: error?.message || null,
    image_count: consultation.image_files?.length || 0,
    completed_at: error ? null : new Date().toISOString()
  }));

  await supabase
    .from('consultation_migration_log')
    .insert(logEntries);
}

async function validateMigratedData(): Promise<void> {
  console.log('🔍 마이그레이션 데이터 검증 중...');

  // 검증 쿼리 실행
  const { data: validationResults, error } = await supabase
    .rpc('validate_consultation_data');

  if (error) {
    console.error('검증 쿼리 실행 실패:', error);
    return;
  }

  if (validationResults && validationResults.length > 0) {
    console.warn('⚠️ 데이터 무결성 문제 발견:');
    validationResults.forEach((issue: any) => {
      console.warn(`- ${issue.issue_type}: ${issue.consultation_id} - ${issue.issue_description}`);
    });
  } else {
    console.log('✅ 데이터 검증 통과');
  }

  // 통계 출력
  const { data: consultationStats } = await supabase
    .from('consultations')
    .select('id', { count: 'exact' });

  const { data: customerStats } = await supabase
    .from('customers')
    .select('id', { count: 'exact' });

  console.log(`📊 마이그레이션 통계:`);
  console.log(`   - 고객 수: ${customerStats?.length || 0}개`);
  console.log(`   - 상담 수: ${consultationStats?.length || 0}개`);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function normalizeDate(dateString: string): string {
  try {
    // 이미 ISO 형식인 경우 그대로 반환
    if (dateString.includes('T')) {
      return new Date(dateString).toISOString();
    }
    
    // YYYY-MM-DD 형식인 경우 시간 추가
    const date = new Date(dateString + 'T00:00:00.000Z');
    return date.toISOString();
  } catch (error) {
    console.warn(`날짜 변환 실패: ${dateString}, 현재 시간으로 대체`);
    return new Date().toISOString();
  }
}

// 실행
if (require.main === module) {
  insertConsultationData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 