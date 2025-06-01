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

async function detailedConsultationComparison(): Promise<void> {
  console.log('🔍 상담 데이터 상세 비교 분석 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 상담 데이터 로드
    console.log('📥 Notion 상담 데이터 로드 중...');
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const notionConsultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    
    console.log(`📊 Notion 상담 데이터: ${notionConsultations.length}개`);

    // 2. Supabase 상담 데이터 조회 (전체 정보)
    console.log('📋 Supabase 상담 데이터 조회 중...');
    const { data: supabaseConsultations, error } = await supabase
      .from('consultations')
      .select('consultation_id, customer_id, consult_date, created_at')
      .order('consultation_id');

    if (error) {
      console.error('❌ Supabase 상담 데이터 조회 실패:', error);
      return;
    }

    console.log(`📋 Supabase 상담 데이터: ${supabaseConsultations?.length || 0}개`);

    // 3. Notion 데이터를 consultation_id로 정렬
    const sortedNotionConsultations = notionConsultations.sort((a, b) => 
      a.consultation_id.localeCompare(b.consultation_id)
    );

    // 4. 고객별 상담 수 계산 (Notion)
    const notionCustomerCounts = new Map<string, string[]>();
    sortedNotionConsultations.forEach(consultation => {
      const customerCode = consultation.consultation_id.split('_')[0];
      if (!notionCustomerCounts.has(customerCode)) {
        notionCustomerCounts.set(customerCode, []);
      }
      notionCustomerCounts.get(customerCode)!.push(consultation.consultation_id);
    });

    // 5. 고객별 상담 수 계산 (Supabase)
    const supabaseCustomerCounts = new Map<string, string[]>();
    supabaseConsultations?.forEach(consultation => {
      const customerCode = consultation.consultation_id.split('_')[0];
      if (!supabaseCustomerCounts.has(customerCode)) {
        supabaseCustomerCounts.set(customerCode, []);
      }
      supabaseCustomerCounts.get(customerCode)!.push(consultation.consultation_id);
    });

    // 6. 불일치 고객들 상세 분석
    console.log('\\n🔍 불일치 고객들 상세 분석...');
    console.log('-' .repeat(80));

    const mismatchCustomers = ['00068', '00066', '00001', '00010', '00041', '00050'];

    for (const customerCode of mismatchCustomers) {
      console.log(`\\n👤 고객 ${customerCode}:`);
      
      const notionIds = notionCustomerCounts.get(customerCode) || [];
      const supabaseIds = supabaseCustomerCounts.get(customerCode) || [];
      
      console.log(`   Notion 상담 (${notionIds.length}개): ${notionIds.join(', ')}`);
      console.log(`   Supabase 상담 (${supabaseIds.length}개): ${supabaseIds.join(', ')}`);
      
      // 누락된 상담 ID 찾기
      const missingIds = notionIds.filter(id => !supabaseIds.includes(id));
      const extraIds = supabaseIds.filter(id => !notionIds.includes(id));
      
      if (missingIds.length > 0) {
        console.log(`   ❌ 누락된 상담: ${missingIds.join(', ')}`);
        
        // 누락된 상담의 상세 정보
        missingIds.forEach(missingId => {
          const notionData = notionConsultations.find(c => c.consultation_id === missingId);
          if (notionData) {
            console.log(`      ${missingId}: ${notionData.consult_date} - ${notionData.symptoms?.substring(0, 30)}...`);
          }
        });
      }
      
      if (extraIds.length > 0) {
        console.log(`   ⚠️ 추가된 상담: ${extraIds.join(', ')}`);
      }
    }

    // 7. 전체 consultation_id 비교
    console.log('\\n🔍 전체 consultation_id 비교...');
    console.log('-' .repeat(80));

    const notionIds = new Set(notionConsultations.map(c => c.consultation_id));
    const supabaseIds = new Set(supabaseConsultations?.map(c => c.consultation_id) || []);

    const missingInSupabase = Array.from(notionIds).filter(id => !supabaseIds.has(id));
    const extraInSupabase = Array.from(supabaseIds).filter(id => !notionIds.has(id));

    console.log(`📊 Notion에만 있는 상담: ${missingInSupabase.length}개`);
    if (missingInSupabase.length > 0) {
      console.log(`   ${missingInSupabase.slice(0, 10).join(', ')}${missingInSupabase.length > 10 ? '...' : ''}`);
    }

    console.log(`📊 Supabase에만 있는 상담: ${extraInSupabase.length}개`);
    if (extraInSupabase.length > 0) {
      console.log(`   ${extraInSupabase.slice(0, 10).join(', ')}${extraInSupabase.length > 10 ? '...' : ''}`);
    }

    // 8. 중복 데이터 확인
    console.log('\\n🔍 중복 데이터 확인...');
    console.log('-' .repeat(80));

    // Notion 중복 확인
    const notionIdCounts = new Map<string, number>();
    notionConsultations.forEach(c => {
      notionIdCounts.set(c.consultation_id, (notionIdCounts.get(c.consultation_id) || 0) + 1);
    });

    const notionDuplicates = Array.from(notionIdCounts.entries()).filter(([_, count]) => count > 1);
    console.log(`📊 Notion 중복 상담: ${notionDuplicates.length}개`);
    notionDuplicates.forEach(([id, count]) => {
      console.log(`   ${id}: ${count}번 중복`);
    });

    // Supabase 중복 확인
    const supabaseIdCounts = new Map<string, number>();
    supabaseConsultations?.forEach(c => {
      supabaseIdCounts.set(c.consultation_id, (supabaseIdCounts.get(c.consultation_id) || 0) + 1);
    });

    const supabaseDuplicates = Array.from(supabaseIdCounts.entries()).filter(([_, count]) => count > 1);
    console.log(`📊 Supabase 중복 상담: ${supabaseDuplicates.length}개`);
    supabaseDuplicates.forEach(([id, count]) => {
      console.log(`   ${id}: ${count}번 중복`);
    });

    // 9. 최종 요약
    console.log('\\n📊 상세 비교 결과 요약');
    console.log('=' .repeat(80));
    console.log(`📥 Notion 총 상담: ${notionConsultations.length}개`);
    console.log(`📋 Supabase 총 상담: ${supabaseConsultations?.length || 0}개`);
    console.log(`❌ Supabase 누락: ${missingInSupabase.length}개`);
    console.log(`➕ Supabase 추가: ${extraInSupabase.length}개`);
    console.log(`🔄 Notion 중복: ${notionDuplicates.length}개`);
    console.log(`🔄 Supabase 중복: ${supabaseDuplicates.length}개`);

    // 10. 실제 차이 계산
    const actualDifference = notionConsultations.length - (supabaseConsultations?.length || 0);
    console.log(`\\n📈 실제 차이: ${actualDifference}개 (Notion - Supabase)`);

    if (actualDifference !== missingInSupabase.length - extraInSupabase.length) {
      console.log('⚠️ 계산 불일치 발견! 중복 데이터나 다른 문제가 있을 수 있습니다.');
    }

  } catch (error) {
    console.error('💥 상세 비교 실패:', error);
  }
}

// 실행
if (require.main === module) {
  detailedConsultationComparison()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 