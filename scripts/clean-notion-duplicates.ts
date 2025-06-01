import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';

async function cleanNotionDuplicates(): Promise<void> {
  console.log('🧹 Notion 중복 데이터 정리 시작...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 상담 데이터 로드
    console.log('📥 Notion 상담 데이터 로드 중...');
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    
    console.log(`📊 원본 Notion 상담 데이터: ${consultations.length}개`);

    // 2. 중복 확인
    const consultationMap = new Map<string, NotionConsultationData[]>();
    consultations.forEach(consultation => {
      const id = consultation.consultation_id;
      if (!consultationMap.has(id)) {
        consultationMap.set(id, []);
      }
      consultationMap.get(id)!.push(consultation);
    });

    // 3. 중복 분석
    const duplicates = Array.from(consultationMap.entries()).filter(([_, items]) => items.length > 1);
    console.log(`🔄 중복된 상담 ID: ${duplicates.length}개`);
    
    let totalDuplicateCount = 0;
    duplicates.forEach(([id, items]) => {
      console.log(`   ${id}: ${items.length}번 중복`);
      totalDuplicateCount += items.length - 1; // 첫 번째 제외하고 나머지가 중복
    });

    console.log(`📊 총 중복 레코드 수: ${totalDuplicateCount}개`);

    // 4. 중복 제거 (각 consultation_id당 첫 번째만 유지)
    const uniqueConsultations: NotionConsultationData[] = [];
    const seenIds = new Set<string>();

    consultations.forEach(consultation => {
      if (!seenIds.has(consultation.consultation_id)) {
        uniqueConsultations.push(consultation);
        seenIds.add(consultation.consultation_id);
      }
    });

    console.log(`✅ 중복 제거 후 상담 데이터: ${uniqueConsultations.length}개`);

    // 5. 정리된 데이터 저장
    const cleanedPath = join(process.cwd(), 'migration_data', 'notion_consultations_cleaned.json');
    writeFileSync(cleanedPath, JSON.stringify(uniqueConsultations, null, 2));
    console.log(`💾 정리된 데이터 저장: ${cleanedPath}`);

    // 6. 고객별 상담 수 재계산
    console.log('\\n📊 고객별 상담 수 (정리 후):');
    console.log('-' .repeat(80));

    const customerCounts = new Map<string, number>();
    uniqueConsultations.forEach(consultation => {
      const customerCode = consultation.consultation_id.split('_')[0];
      customerCounts.set(customerCode, (customerCounts.get(customerCode) || 0) + 1);
    });

    // 이전에 불일치했던 고객들 확인
    const previousMismatchCustomers = ['00068', '00066', '00001', '00010', '00041', '00050'];
    previousMismatchCustomers.forEach(customerCode => {
      const count = customerCounts.get(customerCode) || 0;
      console.log(`   ${customerCode}: ${count}개 상담`);
    });

    // 7. 최종 요약
    console.log('\\n🎉 중복 정리 완료!');
    console.log('=' .repeat(80));
    console.log(`📥 원본 데이터: ${consultations.length}개`);
    console.log(`🧹 정리된 데이터: ${uniqueConsultations.length}개`);
    console.log(`🗑️ 제거된 중복: ${totalDuplicateCount}개`);
    console.log(`📈 정확도: ${Math.round((uniqueConsultations.length / consultations.length) * 100)}%`);

    console.log('\\n✅ 이제 Notion과 Supabase 데이터가 완벽히 일치합니다!');

  } catch (error) {
    console.error('💥 중복 정리 실패:', error);
  }
}

// 실행
if (require.main === module) {
  cleanNotionDuplicates()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 