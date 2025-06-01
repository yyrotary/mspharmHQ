import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSpecificConsultation() {
  try {
    console.log('🔍 김분옥 고객의 상담 데이터 상세 확인...');
    
    // 김분옥 고객의 상담 데이터 조회
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          name,
          customer_code
        )
      `)
      .eq('consultation_id', '00071_001');
    
    if (error) throw error;
    
    if (consultations.length === 0) {
      console.log('❌ 00071_001 상담을 찾을 수 없습니다.');
      return;
    }

    const consultation = consultations[0];
    
    console.log('\n📋 상담 상세 정보:');
    console.log(`상담 ID: ${consultation.consultation_id}`);
    console.log(`고객: ${consultation.customers?.name} (${consultation.customers?.customer_code})`);
    console.log(`상담일: ${consultation.consult_date}`);
    console.log(`증상: ${consultation.symptoms}`);
    console.log(`이미지 URLs:`, consultation.image_urls);
    console.log(`이미지 타입:`, typeof consultation.image_urls);
    console.log(`이미지 배열 여부:`, Array.isArray(consultation.image_urls));
    
    if (consultation.image_urls && Array.isArray(consultation.image_urls)) {
      console.log(`\n📸 이미지 URL 목록 (${consultation.image_urls.length}개):`);
      consultation.image_urls.forEach((url, index) => {
        console.log(`  ${index + 1}. ${url}`);
      });
      
      // 각 이미지 URL 접근 테스트
      console.log('\n🌐 이미지 URL 접근 테스트:');
      for (let i = 0; i < consultation.image_urls.length; i++) {
        const url = consultation.image_urls[i];
        try {
          const response = await fetch(url, { method: 'HEAD' });
          console.log(`  ${i + 1}. ${url} - 상태: ${response.status} ${response.statusText}`);
        } catch (error) {
          console.log(`  ${i + 1}. ${url} - 오류: ${error.message}`);
        }
      }
    } else {
      console.log('\n❌ 이미지 URL이 배열이 아니거나 null입니다.');
    }

    // Storage에서 실제 파일 확인
    console.log('\n🗂️ Storage에서 00071 폴더 확인:');
    const { data: files, error: storageError } = await supabase.storage
      .from('consultation-images')
      .list('00071', { limit: 100 });

    if (storageError) {
      console.error('Storage 오류:', storageError);
    } else {
      console.log('00071 폴더 내용:');
      files.forEach(file => {
        console.log(`  - ${file.name}`);
      });
      
      // 00071_001 하위 폴더 확인
      if (files.some(f => f.name === '00071_001')) {
        const { data: subFiles, error: subError } = await supabase.storage
          .from('consultation-images')
          .list('00071/00071_001', { limit: 100 });
        
        if (!subError) {
          console.log('\n00071_001 폴더 내용:');
          subFiles.forEach(file => {
            console.log(`  - ${file.name}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('💥 오류:', error);
  }
}

// 실행
if (require.main === module) {
  checkSpecificConsultation()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 