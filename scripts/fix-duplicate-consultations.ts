import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixDuplicateConsultations(): Promise<void> {
  console.log('🔧 중복 상담 ID 문제 해결 중...');

  try {
    // 1. 중복된 상담 ID 찾기
    const { data: duplicates, error: duplicateError } = await supabase
      .from('consultations')
      .select('consultation_id, id, created_at')
      .order('consultation_id')
      .order('created_at');

    if (duplicateError) {
      throw new Error(`중복 조회 실패: ${duplicateError.message}`);
    }

    // 중복 그룹 찾기
    const duplicateGroups = new Map<string, any[]>();
    
    duplicates.forEach(consultation => {
      const consultationId = consultation.consultation_id;
      if (!duplicateGroups.has(consultationId)) {
        duplicateGroups.set(consultationId, []);
      }
      duplicateGroups.get(consultationId)!.push(consultation);
    });

    // 중복이 있는 그룹만 필터링
    const actualDuplicates = Array.from(duplicateGroups.entries())
      .filter(([_, group]) => group.length > 1);

    console.log(`발견된 중복 상담 ID: ${actualDuplicates.length}개`);

    if (actualDuplicates.length === 0) {
      console.log('✅ 중복된 상담 ID가 없습니다.');
      return;
    }

    // 2. 중복 제거 (가장 최근 것만 유지)
    let removedCount = 0;

    for (const [consultationId, group] of actualDuplicates) {
      console.log(`처리 중: ${consultationId} (${group.length}개 중복)`);
      
      // 가장 최근 것을 제외하고 나머지 삭제
      const sortedGroup = group.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const toKeep = sortedGroup[0]; // 가장 최근 것
      const toRemove = sortedGroup.slice(1); // 나머지

      console.log(`  유지: ${toKeep.id} (${toKeep.created_at})`);
      
      for (const item of toRemove) {
        console.log(`  삭제: ${item.id} (${item.created_at})`);
        
        const { error: deleteError } = await supabase
          .from('consultations')
          .delete()
          .eq('id', item.id);

        if (deleteError) {
          console.error(`  삭제 실패 (${item.id}):`, deleteError);
        } else {
          removedCount++;
        }
      }
    }

    console.log(`✅ 중복 제거 완료: ${removedCount}개 삭제`);

    // 3. 결과 확인
    const { data: finalCheck, error: finalError } = await supabase
      .from('consultations')
      .select('consultation_id, count(*)', { count: 'exact' });

    if (!finalError) {
      console.log(`📊 최종 상담 수: ${finalCheck?.length || 0}개`);
    }

  } catch (error) {
    console.error('❌ 중복 제거 실패:', error);
    throw error;
  }
}

// 실행
if (require.main === module) {
  fixDuplicateConsultations()
    .then(() => {
      console.log('🎉 중복 제거 작업 완료!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 작업 실패:', error);
      process.exit(1);
    });
} 