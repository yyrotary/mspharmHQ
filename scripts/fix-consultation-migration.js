const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixConsultationMigration() {
  console.log('🔧 상담 데이터 마이그레이션 수정...');
  console.log('=' .repeat(80));

  try {
    // 1. 현재 상담 수 확인
    console.log('📊 현재 상담 수 확인...');
    const { count: currentCount, error: countError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ 상담 수 조회 실패:', countError);
      return;
    }

    console.log(`현재 Supabase 상담 수: ${currentCount}개`);

    // 2. 고객 코드 변경 매핑 확인
    console.log('\n🔍 고객 코드 변경 매핑 확인...');
    
    // 새로 추가된 고객들 확인
    const { data: customer73, error: error73 } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_code', '00073')
      .single();

    const { data: customer74, error: error74 } = await supabase
      .from('customers')
      .select('*')
      .eq('customer_code', '00074')
      .single();

    if (error73 || error74) {
      console.error('❌ 새 고객 조회 실패:', error73 || error74);
      return;
    }

    console.log(`00073: ${customer73.name}`);
    console.log(`00074: ${customer74.name}`);

    // 3. 올바른 매핑 설정
    const correctMapping = new Map();
    if (customer73.name === '송정숙') {
      correctMapping.set('00028', '00073'); // 송정숙
    }
    if (customer74.name === '박귀화') {
      correctMapping.set('00027', '00074'); // 박귀화
    }

    console.log('\n올바른 매핑:');
    for (const [oldCode, newCode] of correctMapping) {
      const customer = oldCode === '00028' ? customer73 : customer74;
      console.log(`  ${oldCode} → ${newCode}: ${customer.name}`);
    }

    // 4. 원래 코드로 된 상담들을 새 코드로 업데이트
    console.log('\n🔄 상담 데이터 고객 코드 업데이트...');
    
    let updatedCount = 0;
    
    for (const [oldCode, newCode] of correctMapping) {
      // 원래 코드로 된 상담들 조회
      const { data: oldConsultations, error: selectError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', oldCode);

      if (selectError) {
        console.error(`❌ ${oldCode} 상담 조회 실패:`, selectError);
        continue;
      }

      console.log(`${oldCode} 코드의 상담: ${oldConsultations?.length || 0}개`);

      if (oldConsultations && oldConsultations.length > 0) {
        // 각 상담의 고객 코드를 새 코드로 업데이트
        for (const consultation of oldConsultations) {
          const { error: updateError } = await supabase
            .from('consultations')
            .update({ customer_code: newCode })
            .eq('id', consultation.id);

          if (updateError) {
            console.error(`❌ 상담 ${consultation.id} 업데이트 실패:`, updateError);
          } else {
            updatedCount++;
          }
        }

        const customerName = oldCode === '00028' ? customer73.name : customer74.name;
        console.log(`✅ ${oldCode} → ${newCode} (${customerName}): ${oldConsultations.length}개 상담 업데이트 완료`);
      }
    }

    console.log(`\n📊 총 업데이트된 상담: ${updatedCount}개`);

    // 5. 최종 검증
    console.log('\n🔍 최종 검증...');
    console.log('-' .repeat(80));

    const { count: finalCount, error: finalCountError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    if (finalCountError) {
      console.error('❌ 최종 카운트 조회 실패:', finalCountError);
    } else {
      console.log(`최종 Supabase 상담 수: ${finalCount}개`);
    }

    // 6. 새 고객들의 상담 확인
    console.log('\n📋 새 고객들의 상담 확인...');
    
    for (const [oldCode, newCode] of correctMapping) {
      const { data: consultations, error: consultError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', newCode)
        .order('consultation_date', { ascending: false });

      if (consultError) {
        console.error(`❌ ${newCode} 상담 조회 실패:`, consultError);
      } else {
        const customerName = oldCode === '00028' ? customer73.name : customer74.name;
        console.log(`\n${newCode} (${customerName}): ${consultations?.length || 0}개 상담`);
        
        if (consultations && consultations.length > 0) {
          consultations.slice(0, 3).forEach((consultation, index) => {
            console.log(`  ${index + 1}. ${consultation.consultation_date}: ${consultation.content?.substring(0, 40) || 'N/A'}...`);
          });
        }
      }

      // 원래 코드로 남은 상담이 있는지 확인
      const { data: remainingConsultations, error: remainingError } = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_code', oldCode);

      if (!remainingError && remainingConsultations && remainingConsultations.length > 0) {
        console.log(`⚠️ ${oldCode} 코드로 남은 상담: ${remainingConsultations.length}개`);
      }
    }

    // 7. 전체 상담 수 비교
    console.log('\n📊 전체 상담 수 비교');
    console.log('-' .repeat(80));
    console.log(`Notion 예상 상담 수: 107개`);
    console.log(`현재 Supabase 상담 수: ${finalCount}개`);
    console.log(`차이: ${107 - finalCount}개`);

    if (107 - finalCount === 0) {
      console.log('\n🎉 ✅ 상담 데이터 마이그레이션 완료!');
      console.log('모든 상담 데이터가 올바른 고객 코드로 업데이트되었습니다.');
    } else if (107 - finalCount > 0) {
      console.log('\n⚠️ 여전히 누락된 상담이 있습니다.');
      console.log('추가 조사가 필요합니다.');
    } else {
      console.log('\n⚠️ Supabase에 더 많은 상담이 있습니다.');
      console.log('중복 데이터가 있을 수 있습니다.');
    }

  } catch (error) {
    console.error('💥 상담 마이그레이션 수정 실패:', error);
  }
}

// 실행
if (require.main === module) {
  fixConsultationMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 