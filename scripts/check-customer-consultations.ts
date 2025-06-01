import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCustomerConsultations() {
  try {
    console.log('🔍 김분옥 고객 데이터 확인 중...');
    
    // 1. 고객 정보 조회
    const { data: customers, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', '%김분옥%');
    
    if (customerError) throw customerError;
    
    console.log('\n👤 김분옥 고객 정보:');
    customers.forEach(customer => {
      console.log(`  ID: ${customer.id}`);
      console.log(`  이름: ${customer.name}`);
      console.log(`  고객 코드: ${customer.customer_code}`);
      console.log(`  전화번호: ${customer.phone || '없음'}`);
      console.log('---');
    });

    if (customers.length === 0) {
      console.log('❌ 김분옥 고객을 찾을 수 없습니다.');
      return;
    }

    // 2. 각 고객의 상담 내역 조회
    for (const customer of customers) {
      console.log(`\n📋 ${customer.name} (${customer.customer_code})의 상담 내역:`);
      
      const { data: consultations, error: consultationError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_id', customer.id)
        .order('consult_date', { ascending: false });
      
      if (consultationError) {
        console.error(`상담 조회 오류:`, consultationError);
        continue;
      }
      
      if (consultations.length === 0) {
        console.log('  상담 내역이 없습니다.');
      } else {
        consultations.forEach(consultation => {
          console.log(`  - ${consultation.consultation_id}: ${consultation.consult_date}`);
          console.log(`    증상: ${consultation.symptoms.substring(0, 50)}...`);
          console.log(`    이미지: ${consultation.image_urls?.length || 0}개`);
        });
      }
    }

    // 3. 전체 상담 통계
    console.log('\n📊 전체 상담 통계:');
    const { count: totalConsultations } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  총 상담 수: ${totalConsultations}개`);

    // 4. 고객 코드별 상담 수
    const { data: consultationStats } = await supabase
      .from('consultations')
      .select(`
        customer_id,
        customers:customer_id (
          name,
          customer_code
        )
      `);

    const statsByCustomer = consultationStats?.reduce((acc: any, consultation: any) => {
      const customerCode = consultation.customers?.customer_code;
      const customerName = consultation.customers?.name;
      if (customerCode) {
        acc[customerCode] = acc[customerCode] || { name: customerName, count: 0 };
        acc[customerCode].count++;
      }
      return acc;
    }, {});

    console.log('\n📈 고객별 상담 수:');
    Object.entries(statsByCustomer || {}).forEach(([code, stats]: [string, any]) => {
      console.log(`  ${code} (${stats.name}): ${stats.count}개`);
    });

  } catch (error) {
    console.error('💥 오류:', error);
  }
}

// 실행
if (require.main === module) {
  checkCustomerConsultations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 