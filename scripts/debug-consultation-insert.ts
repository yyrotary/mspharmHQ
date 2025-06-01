import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function debugConsultationInsert() {
  console.log('🔍 상담 데이터 삽입 디버깅...');

  try {
    // 실제 마이그레이션 데이터 로드
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    
    console.log(`📥 로드된 상담 데이터: ${consultations.length}개`);

    // 첫 번째 상담 데이터 가져오기
    const firstConsultation = consultations[0];
    console.log('첫 번째 상담 원본 데이터:', JSON.stringify(firstConsultation, null, 2));

    // 고객 ID 가져오기
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .limit(1);

    if (customerError) {
      console.error('고객 조회 실패:', customerError);
      return;
    }

    if (!customers || customers.length === 0) {
      console.error('고객 데이터가 없습니다.');
      return;
    }

    const customerId = customers[0].id;
    console.log('테스트용 고객 ID:', customerId);

    // 이미지 URL 매핑 로드
    const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
    const imageUrlMapping: Record<string, string[]> = JSON.parse(readFileSync(imageUrlMappingPath, 'utf-8'));

    // 상담 데이터 변환
    const consultationData = {
      consultation_id: firstConsultation.consultation_id,
      customer_id: customerId, // 테스트용 고객 ID 사용
      consult_date: normalizeDate(firstConsultation.consult_date),
      symptoms: firstConsultation.symptoms,
      patient_condition: firstConsultation.patient_condition,
      tongue_analysis: firstConsultation.tongue_analysis,
      special_notes: firstConsultation.special_notes,
      prescription: firstConsultation.prescription,
      result: firstConsultation.result,
      image_urls: imageUrlMapping[firstConsultation.consultation_id] || [],
      created_at: normalizeDate(firstConsultation.created_at)
    };

    console.log('변환된 상담 데이터:', JSON.stringify(consultationData, null, 2));

    // 삽입 시도
    console.log('🔄 삽입 시도 중...');
    const { data, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select();

    if (error) {
      console.error('❌ 삽입 실패:', error);
      console.error('오류 코드:', error.code);
      console.error('오류 메시지:', error.message);
      console.error('오류 상세:', error.details);
    } else {
      console.log('✅ 삽입 성공:', data);
    }

  } catch (error) {
    console.error('💥 디버깅 실패:', error);
  }
}

debugConsultationInsert(); 