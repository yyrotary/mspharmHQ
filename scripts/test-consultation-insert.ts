import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testConsultationInsert() {
  console.log('🧪 상담 데이터 삽입 테스트...');

  try {
    // 첫 번째 고객 ID 가져오기
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

    // 테스트 상담 데이터
    const testConsultation = {
      consultation_id: 'TEST_001',
      customer_id: customerId,
      consult_date: '2025-05-31',
      symptoms: '테스트 증상',
      patient_condition: '테스트 환자 상태',
      tongue_analysis: null,
      special_notes: null,
      prescription: '테스트 처방',
      result: '테스트 결과',
      image_urls: [],
      created_at: new Date().toISOString()
    };

    console.log('삽입할 테스트 데이터:', JSON.stringify(testConsultation, null, 2));

    // 삽입 시도
    const { data, error } = await supabase
      .from('consultations')
      .insert(testConsultation)
      .select();

    if (error) {
      console.error('❌ 삽입 실패:', error);
    } else {
      console.log('✅ 삽입 성공:', data);
    }

  } catch (error) {
    console.error('💥 테스트 실패:', error);
  }
}

testConsultationInsert(); 