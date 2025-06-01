import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CustomerVerificationResult {
  notionCustomerId: string;
  customerCode: string;
  supabaseCustomerId?: string;
  consultationCount: {
    notion: number;
    supabase: number;
  };
  status: 'match' | 'mismatch' | 'missing_in_supabase' | 'missing_in_notion';
  issues: string[];
}

async function verifyCustomerMigration(): Promise<void> {
  console.log('🔍 고객 데이터 마이그레이션 무결성 검증 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 데이터에서 고객 정보 추출
    console.log('📥 Notion 상담 데이터 로드 중...');
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    
    console.log(`📊 로드된 상담 데이터: ${consultations.length}개`);

    // 2. Notion에서 고유 고객 정보 추출
    const notionCustomers = new Map<string, {
      customerCode: string;
      consultationCount: number;
      consultationIds: string[];
    }>();

    consultations.forEach(consultation => {
      const customerCode = consultation.consultation_id.split('_')[0];
      const customerId = consultation.customer_id;

      if (!notionCustomers.has(customerId)) {
        notionCustomers.set(customerId, {
          customerCode,
          consultationCount: 0,
          consultationIds: []
        });
      }

      const customer = notionCustomers.get(customerId)!;
      customer.consultationCount++;
      customer.consultationIds.push(consultation.consultation_id);
    });

    console.log(`👥 Notion 고유 고객 수: ${notionCustomers.size}개`);

    // 3. Supabase 고객 데이터 조회
    console.log('📊 Supabase 고객 데이터 조회 중...');
    const { data: supabaseCustomers, error: customerError } = await supabase
      .from('customers')
      .select('*');

    if (customerError) {
      console.error('❌ Supabase 고객 데이터 조회 실패:', customerError);
      return;
    }

    console.log(`👥 Supabase 고객 수: ${supabaseCustomers?.length || 0}개`);

    // 4. Supabase 상담 데이터 조회 (고객별 상담 수 계산용)
    console.log('📋 Supabase 상담 데이터 조회 중...');
    const { data: supabaseConsultations, error: consultationError } = await supabase
      .from('consultations')
      .select('consultation_id, customer_id');

    if (consultationError) {
      console.error('❌ Supabase 상담 데이터 조회 실패:', consultationError);
      return;
    }

    console.log(`📋 Supabase 상담 수: ${supabaseConsultations?.length || 0}개`);

    // 5. 고객별 상담 수 계산
    const supabaseCustomerConsultationCount = new Map<string, number>();
    supabaseConsultations?.forEach(consultation => {
      const count = supabaseCustomerConsultationCount.get(consultation.customer_id) || 0;
      supabaseCustomerConsultationCount.set(consultation.customer_id, count + 1);
    });

    // 6. One by One 검증
    console.log('\\n🔍 One by One 무결성 검증 시작...');
    console.log('-' .repeat(80));

    const verificationResults: CustomerVerificationResult[] = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let missingCount = 0;

    for (const [notionCustomerId, notionCustomer] of notionCustomers) {
      const result: CustomerVerificationResult = {
        notionCustomerId,
        customerCode: notionCustomer.customerCode,
        consultationCount: {
          notion: notionCustomer.consultationCount,
          supabase: 0
        },
        status: 'missing_in_supabase',
        issues: []
      };

      // Supabase에서 해당 고객 찾기
      const supabaseCustomer = supabaseCustomers?.find(c => c.customer_code === notionCustomer.customerCode);

      if (supabaseCustomer) {
        result.supabaseCustomerId = supabaseCustomer.id;
        result.consultationCount.supabase = supabaseCustomerConsultationCount.get(supabaseCustomer.id) || 0;

        // 상담 수 비교
        if (result.consultationCount.notion === result.consultationCount.supabase) {
          result.status = 'match';
          matchCount++;
        } else {
          result.status = 'mismatch';
          result.issues.push(`상담 수 불일치: Notion ${result.consultationCount.notion}개 vs Supabase ${result.consultationCount.supabase}개`);
          mismatchCount++;
        }

        // 고객 정보 검증
        if (supabaseCustomer.name !== `고객_${notionCustomer.customerCode}`) {
          result.issues.push(`고객명 불일치: 예상 "고객_${notionCustomer.customerCode}" vs 실제 "${supabaseCustomer.name}"`);
        }

      } else {
        result.issues.push('Supabase에 고객 데이터 없음');
        missingCount++;
      }

      verificationResults.push(result);

      // 실시간 진행 상황 출력
      const status = result.status === 'match' ? '✅' : 
                    result.status === 'mismatch' ? '⚠️' : '❌';
      console.log(`${status} ${result.customerCode}: Notion ${result.consultationCount.notion}개 → Supabase ${result.consultationCount.supabase}개`);
      
      if (result.issues.length > 0) {
        result.issues.forEach(issue => {
          console.log(`   └─ ${issue}`);
        });
      }
    }

    // 7. Supabase에만 있는 고객 확인
    console.log('\\n🔍 Supabase 전용 고객 확인...');
    const supabaseOnlyCustomers = supabaseCustomers?.filter(supabaseCustomer => {
      return !Array.from(notionCustomers.values()).some(notionCustomer => 
        notionCustomer.customerCode === supabaseCustomer.customer_code
      );
    }) || [];

    if (supabaseOnlyCustomers.length > 0) {
      console.log(`⚠️ Supabase에만 존재하는 고객: ${supabaseOnlyCustomers.length}개`);
      supabaseOnlyCustomers.forEach(customer => {
        console.log(`   - ${customer.customer_code}: ${customer.name}`);
      });
    }

    // 8. 최종 결과 요약
    console.log('\\n📊 무결성 검증 결과 요약');
    console.log('=' .repeat(80));
    console.log(`✅ 완벽 일치: ${matchCount}개`);
    console.log(`⚠️ 불일치: ${mismatchCount}개`);
    console.log(`❌ 누락: ${missingCount}개`);
    console.log(`🔍 Supabase 전용: ${supabaseOnlyCustomers.length}개`);
    console.log('-' .repeat(80));
    console.log(`📈 일치율: ${Math.round((matchCount / notionCustomers.size) * 100)}%`);

    // 9. 불일치 상세 보고서
    if (mismatchCount > 0 || missingCount > 0) {
      console.log('\\n❌ 불일치 상세 보고서:');
      console.log('-' .repeat(80));
      
      verificationResults
        .filter(r => r.status !== 'match')
        .forEach(result => {
          console.log(`\\n🔍 ${result.customerCode} (${result.notionCustomerId})`);
          console.log(`   상태: ${result.status}`);
          console.log(`   Notion 상담 수: ${result.consultationCount.notion}개`);
          console.log(`   Supabase 상담 수: ${result.consultationCount.supabase}개`);
          if (result.supabaseCustomerId) {
            console.log(`   Supabase ID: ${result.supabaseCustomerId}`);
          }
          result.issues.forEach(issue => {
            console.log(`   ❌ ${issue}`);
          });
        });
    }

    // 10. 마이그레이션 완료 여부 판단
    const isComplete = matchCount === notionCustomers.size && 
                      mismatchCount === 0 && 
                      missingCount === 0;

    console.log('\\n🎯 마이그레이션 완료 상태');
    console.log('=' .repeat(80));
    if (isComplete) {
      console.log('🎉 ✅ 고객 데이터 마이그레이션 100% 완료!');
    } else {
      console.log('❌ 고객 데이터 마이그레이션 미완료');
      console.log('📋 해결해야 할 문제:');
      if (mismatchCount > 0) console.log(`   - ${mismatchCount}개 고객의 상담 수 불일치`);
      if (missingCount > 0) console.log(`   - ${missingCount}개 고객 누락`);
      if (supabaseOnlyCustomers.length > 0) console.log(`   - ${supabaseOnlyCustomers.length}개 불필요한 고객 데이터`);
    }

  } catch (error) {
    console.error('💥 검증 실패:', error);
  }
}

// 실행
if (require.main === module) {
  verifyCustomerMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 