import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkExistingConsultations() {
  console.log('🔍 기존 상담 데이터 확인...');

  try {
    const { data, error } = await supabase
      .from('consultations')
      .select('consultation_id, customer_id, consult_date')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('조회 실패:', error);
      return;
    }

    console.log(`📊 기존 상담 데이터: ${data?.length || 0}개`);
    
    if (data && data.length > 0) {
      console.log('최근 상담 데이터:');
      data.slice(0, 10).forEach((consultation, index) => {
        console.log(`${index + 1}. ${consultation.consultation_id} - ${consultation.consult_date}`);
      });
    }

  } catch (error) {
    console.error('💥 확인 실패:', error);
  }
}

checkExistingConsultations(); 