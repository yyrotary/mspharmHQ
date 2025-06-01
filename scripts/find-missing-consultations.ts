import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: 'D:\\devel\\msp_yai_link\\mspharmHQ\\.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findAndAddMissingConsultations(): Promise<void> {
  console.log('🔍 누락된 상담일지 찾기 및 추가 중...');

  try {
    // 1. 원본 Notion 데이터 로드
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const notionConsultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    console.log(`📥 원본 Notion 상담일지: ${notionConsultations.length}개`);

    // 2. 현재 Supabase 데이터 조회
    const { data: supabaseConsultations, error } = await supabase
      .from('consultations')
      .select('consultation_id');

    if (error) {
      throw new Error(`Supabase 데이터 조회 실패: ${error.message}`);
    }

    const existingIds = new Set(supabaseConsultations.map(c => c.consultation_id));
    console.log(`📊 현재 Supabase 상담일지: ${existingIds.size}개`);

    // 3. 00068 고객의 중복 문제 해결
    console.log('\n🔧 00068 고객 중복 문제 해결 중...');
    const customer00068Consultations = notionConsultations.filter(c => c.consultation_id.startsWith('00068_'));
    
    if (customer00068Consultations.length > 1) {
      console.log(`발견된 00068 상담일지: ${customer00068Consultations.length}개`);
      
      // 첫 번째는 00068_001, 두 번째는 00068_002로 변경
      for (let i = 0; i < customer00068Consultations.length; i++) {
        const newConsultationId = `00068_${String(i + 1).padStart(3, '0')}`;
        customer00068Consultations[i].consultation_id = newConsultationId;
        console.log(`✏️ 상담 ID 변경: ${customer00068Consultations[i].id} -> ${newConsultationId}`);
      }
    }

    // 4. 누락된 상담일지 찾기
    const missingConsultations = notionConsultations.filter(consultation => {
      return !existingIds.has(consultation.consultation_id);
    });

    console.log(`\n📋 누락된 상담일지: ${missingConsultations.length}개`);
    
    if (missingConsultations.length === 0) {
      console.log('✅ 누락된 상담일지가 없습니다.');
      return;
    }

    // 5. 고객 ID 매핑 생성
    const customerIdMapping = await createCustomerIdMapping(missingConsultations);

    // 6. 누락된 상담일지의 이미지 마이그레이션
    console.log('\n🖼️ 누락된 상담일지 이미지 마이그레이션 중...');
    const imageUrlMapping: Record<string, string[]> = {};
    
    for (const consultation of missingConsultations) {
      const customerCode = consultation.consultation_id.split('_')[0];
      const migratedUrls = await migrateConsultationImageFiles(
        consultation.consultation_id,
        customerCode,
        consultation.image_files
      );
      imageUrlMapping[consultation.consultation_id] = migratedUrls;
      console.log(`✅ 이미지 마이그레이션 완료: ${consultation.consultation_id} (${migratedUrls.length}개)`);
    }

    // 7. 누락된 상담일지 데이터 삽입
    console.log('\n💾 누락된 상담일지 데이터 삽입 중...');
    let successCount = 0;
    let errorCount = 0;

    for (const consultation of missingConsultations) {
      try {
        const customerCode = consultation.consultation_id.split('_')[0];
        const customerId = customerIdMapping.get(customerCode);
        
        if (!customerId) {
          console.error(`❌ 고객 ID를 찾을 수 없습니다: ${customerCode}`);
          errorCount++;
          continue;
        }

        const insertData = {
          consultation_id: consultation.consultation_id,
          customer_id: customerId,
          consult_date: consultation.consult_date,
          symptoms: consultation.symptoms,
          patient_condition: consultation.patient_condition,
          tongue_analysis: consultation.tongue_analysis,
          special_notes: consultation.special_notes,
          prescription: consultation.prescription,
          result: consultation.result,
          image_urls: imageUrlMapping[consultation.consultation_id] || []
        };

        const { error: insertError } = await supabase
          .from('consultations')
          .insert([insertData]);

        if (insertError) {
          console.error(`❌ 상담일지 삽입 실패 (${consultation.consultation_id}):`, insertError);
          errorCount++;
        } else {
          console.log(`✅ 상담일지 삽입 성공: ${consultation.consultation_id}`);
          successCount++;
        }

        // 마이그레이션 로그 기록
        const logData = {
          consultation_id: consultation.consultation_id,
          migration_status: 'completed',
          supabase_id: customerId,
          image_count: consultation.image_files?.length || 0,
          migrated_image_count: imageUrlMapping[consultation.consultation_id]?.length || 0,
          error_message: null,
          completed_at: new Date().toISOString()
        };

        await supabase
          .from('consultation_migration_log')
          .insert([logData]);

      } catch (error) {
        console.error(`❌ 처리 실패 (${consultation.consultation_id}):`, error);
        errorCount++;
      }
    }

    // 8. 최종 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📋 누락된 상담일지 추가 완료');
    console.log('='.repeat(60));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log(`📊 총 처리: ${missingConsultations.length}개`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 누락된 상담일지 추가 실패:', error);
    throw error;
  }
}

async function createCustomerIdMapping(consultations: NotionConsultationData[]): Promise<Map<string, string>> {
  console.log('🔍 고객 ID 매핑 생성 중...');

  const uniqueCustomerCodes = [...new Set(consultations.map(c => c.consultation_id.split('_')[0]))];
  console.log(`발견된 고유 고객 코드 수: ${uniqueCustomerCodes.length}개`);

  const customerIdMapping = new Map<string, string>();

  // 기존 고객들 조회
  const { data: existingCustomers, error } = await supabase
    .from('customers')
    .select('id, customer_code')
    .in('customer_code', uniqueCustomerCodes);

  if (error) {
    throw new Error(`고객 조회 실패: ${error.message}`);
  }

  // 기존 고객들 매핑에 추가
  existingCustomers?.forEach(customer => {
    customerIdMapping.set(customer.customer_code, customer.id);
  });

  // 누락된 고객들 생성
  const existingCodes = new Set(existingCustomers?.map(c => c.customer_code) || []);
  const missingCodes = uniqueCustomerCodes.filter(code => !existingCodes.has(code));

  if (missingCodes.length > 0) {
    console.log(`누락된 고객 ${missingCodes.length}명 생성 중...`);
    
    for (const customerCode of missingCodes) {
      const customerData = {
        customer_code: customerCode,
        name: `고객_${customerCode}`,
        phone: null,
        address: null,
        birth_date: null,
        estimated_age: null,
        special_notes: null,
        face_embedding: null,
        google_drive_folder_id: null,
        consultation_count: 0,
        is_deleted: false
      };

      const { data: newCustomer, error: insertError } = await supabase
        .from('customers')
        .insert([customerData])
        .select('id, customer_code')
        .single();

      if (insertError) {
        throw new Error(`고객 생성 실패 (${customerCode}): ${insertError.message}`);
      }

      if (newCustomer) {
        customerIdMapping.set(newCustomer.customer_code, newCustomer.id);
        console.log(`✅ 고객 생성: ${customerCode} -> ${newCustomer.id}`);
      }
    }
  }

  console.log(`✅ 고객 ID 매핑 완료: ${customerIdMapping.size}개`);
  return customerIdMapping;
}

async function migrateConsultationImageFiles(
  consultationId: string,
  customerCode: string,
  imageFiles: any[]
): Promise<string[]> {
  if (!imageFiles || imageFiles.length === 0) {
    return [];
  }

  const migratedUrls: string[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    const imageFile = imageFiles[i];
    const imageUrl = imageFile.external?.url || imageFile.file?.url;

    if (!imageUrl) {
      console.warn(`이미지 URL 없음: ${consultationId}_${i + 1}`);
      continue;
    }

    try {
      // Google Drive에서 이미지 다운로드
      const imageBuffer = await downloadImageFromUrl(imageUrl);

      // 고객 코드 기반 파일 경로 생성
      const filePath = `${customerCode}/${consultationId}/image_${i + 1}.jpg`;

      const { data, error } = await supabase.storage
        .from('consultation-images')
        .upload(filePath, imageBuffer, {
          contentType: getContentTypeFromUrl(imageUrl),
          upsert: true
        });

      if (error) throw error;

      // 공개 URL 생성
      const { data: publicUrl } = supabase.storage
        .from('consultation-images')
        .getPublicUrl(filePath);

      migratedUrls.push(publicUrl.publicUrl);

      console.log(`✅ 이미지 업로드 성공: ${filePath}`);

    } catch (error) {
      console.error(`이미지 업로드 실패 (${consultationId}_${i + 1}):`, error);
    }
  }

  return migratedUrls;
}

async function downloadImageFromUrl(url: string): Promise<Buffer> {
  try {
    const axios = require('axios');
    
    // Google Drive URL 처리
    const downloadUrl = convertGoogleDriveUrl(url);

    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    return Buffer.from(response.data);

  } catch (error) {
    console.error(`이미지 다운로드 실패 (${url}):`, error);
    throw error;
  }
}

function convertGoogleDriveUrl(url: string): string {
  // Google Drive 공유 링크를 다운로드 링크로 변환
  if (url.includes('drive.google.com/file/d/')) {
    const fileId = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return url;
}

function getContentTypeFromUrl(url: string): string {
  if (url.includes('.png')) return 'image/png';
  if (url.includes('.gif')) return 'image/gif';
  if (url.includes('.webp')) return 'image/webp';
  return 'image/jpeg'; // 기본값
}

// 실행
if (require.main === module) {
  findAndAddMissingConsultations()
    .then(() => {
      console.log('🎉 누락된 상담일지 추가 완료!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 작업 실패:', error);
      process.exit(1);
    });
} 