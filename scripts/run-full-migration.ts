import { createClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MigrationReport {
  phase: string;
  status: 'success' | 'failed' | 'warning';
  message: string;
  details?: any;
  timestamp: string;
}

export async function runFullConsultationMigration(): Promise<void> {
  const startTime = Date.now();
  const report: MigrationReport[] = [];

  console.log('🚀 상담일지 완전 재마이그레이션 시작...');
  console.log('============================================================');

  try {
    // 1단계: 환경 확인
    await checkEnvironment(report);

    // 2단계: 기존 데이터 삭제
    await clearExistingData(report);

    // 3단계: 디렉토리 구조 생성
    await createDirectoryStructure(report);

    // 4단계: Notion 데이터 추출
    await extractNotionConsultations(report);

    // 5단계: 고객 ID 매핑 생성 (새로운 방식)
    const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    const consultations = JSON.parse(readFileSync(consultationsPath, 'utf-8'));
    const customerIdMapping = await createCustomerIdMapping(consultations);

    // 6단계: 이미지 마이그레이션
    await migrateConsultationImages(consultations, customerIdMapping, report);

    // 7단계: 데이터 삽입
    await insertConsultationData(consultations, customerIdMapping, report);

    // 8단계: 무결성 체크
    await performIntegrityCheck(report);

    // 최종 보고서 생성
    await generateFinalReport(report, startTime);

  } catch (error) {
    console.error('💥 마이그레이션 실패:', error);
    
    report.push({
      phase: 'MIGRATION_ERROR',
      status: 'failed',
      message: `마이그레이션 중단: ${error}`,
      timestamp: new Date().toISOString()
    });

    await generateFinalReport(report, startTime);
    throw error;
  }
}

async function checkEnvironment(report: MigrationReport[]): Promise<void> {
  console.log('🔍 환경 변수 확인 중...');

  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NOTION_API_KEY',
    'NOTION_CONSULTATION_DB_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(`필수 환경 변수가 누락되었습니다: ${missingVars.join(', ')}`);
  }

  // Supabase 연결 테스트
  const { data, error } = await supabase.from('customers').select('count', { count: 'exact' }).limit(1);
  
  if (error) {
    throw new Error(`Supabase 연결 실패: ${error.message}`);
  }

  report.push({
    phase: 'ENVIRONMENT_CHECK',
    status: 'success',
    message: '환경 변수 및 연결 확인 완료',
    details: { customerCount: data?.length || 0 },
    timestamp: new Date().toISOString()
  });

  console.log('✅ 환경 확인 완료');
}

async function clearExistingData(report: MigrationReport[]): Promise<void> {
  console.log('🗑️ 기존 상담 데이터 삭제 중...');

  try {
    // 1. 기존 상담 데이터 삭제
    const { error: deleteConsultationsError } = await supabase
      .from('consultations')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 데이터 삭제

    if (deleteConsultationsError) {
      console.warn('상담 데이터 삭제 중 오류:', deleteConsultationsError);
    }

    // 2. 마이그레이션 로그 삭제
    const { error: deleteLogError } = await supabase
      .from('consultation_migration_log')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteLogError) {
      console.warn('마이그레이션 로그 삭제 중 오류:', deleteLogError);
    }

    // 3. Supabase Storage 이미지 삭제
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (!bucketsError && buckets) {
      const consultationBucket = buckets.find(bucket => bucket.name === 'consultation-images');
      
      if (consultationBucket) {
        const { data: files, error: listError } = await supabase.storage
          .from('consultation-images')
          .list('', { limit: 1000 });

        if (!listError && files && files.length > 0) {
          const filePaths = files.map(file => file.name);
          const { error: removeError } = await supabase.storage
            .from('consultation-images')
            .remove(filePaths);

          if (removeError) {
            console.warn('Storage 파일 삭제 중 오류:', removeError);
          }
        }
      }
    }

    report.push({
      phase: 'CLEAR_EXISTING_DATA',
      status: 'success',
      message: '기존 데이터 삭제 완료',
      timestamp: new Date().toISOString()
    });

    console.log('✅ 기존 데이터 삭제 완료');

  } catch (error) {
    report.push({
      phase: 'CLEAR_EXISTING_DATA',
      status: 'failed',
      message: `데이터 삭제 실패: ${error}`,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

async function createDirectoryStructure(report: MigrationReport[]): Promise<void> {
  console.log('📁 디렉토리 구조 생성 중...');

  const directories = [
    'migration_data',
    'migration_data/images',
    'migration_data/reports'
  ];

  directories.forEach(dir => {
    const fullPath = join(process.cwd(), dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  });

  report.push({
    phase: 'DIRECTORY_STRUCTURE',
    status: 'success',
    message: '디렉토리 구조 생성 완료',
    timestamp: new Date().toISOString()
  });

  console.log('✅ 디렉토리 구조 생성 완료');
}

async function extractNotionConsultations(report: MigrationReport[]): Promise<void> {
  console.log('📥 Notion 상담 데이터 추출 중...');

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    const consultations: any[] = [];
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      console.log(`페이지 조회 중... (커서: ${nextCursor || '시작'})`);

      const response = await notion.databases.query({
        database_id: process.env.NOTION_CONSULTATION_DB_ID!,
        start_cursor: nextCursor,
        page_size: 100,
        sorts: [
          {
            property: '상담일자',
            direction: 'ascending'
          }
        ]
      });

      for (const page of response.results) {
        try {
          const consultation = await parseNotionConsultation(page as any);
          if (consultation) {
            consultations.push(consultation);
          }
        } catch (error) {
          console.error(`페이지 파싱 실패 (${page.id}):`, error);
        }
      }

      hasMore = response.has_more;
      nextCursor = response.next_cursor || undefined;

      console.log(`현재까지 추출된 상담: ${consultations.length}개`);
    }

    // 결과 저장
    const outputPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
    writeFileSync(outputPath, JSON.stringify(consultations, null, 2));

    report.push({
      phase: 'EXTRACT_NOTION_DATA',
      status: 'success',
      message: `Notion 데이터 추출 완료: ${consultations.length}개`,
      details: { totalConsultations: consultations.length },
      timestamp: new Date().toISOString()
    });

    console.log(`✅ Notion 데이터 추출 완료: ${consultations.length}개`);

  } catch (error) {
    report.push({
      phase: 'EXTRACT_NOTION_DATA',
      status: 'failed',
      message: `Notion 데이터 추출 실패: ${error}`,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

async function parseNotionConsultation(page: any): Promise<any | null> {
  try {
    const properties = page.properties;

    // 필수 필드 검증
    const consultationId = getNotionPropertyValue(properties.id, 'title');
    const customerId = getRelationId(properties.고객);
    const consultDate = getNotionPropertyValue(properties.상담일자, 'date');
    const symptoms = getNotionPropertyValue(properties.호소증상, 'rich_text');

    if (!consultationId || !customerId || !consultDate || !symptoms) {
      console.warn(`필수 필드 누락, 건너뛰기: ${consultationId || page.id}`);
      return null;
    }

    // 이미지 파일 처리
    const imageFiles = getNotionPropertyValue(properties.증상이미지, 'files');
    const processedImageFiles = Array.isArray(imageFiles) ? imageFiles : [];

    const consultation = {
      id: page.id,
      consultation_id: consultationId,
      customer_id: customerId,
      consult_date: consultDate,
      symptoms: symptoms,
      patient_condition: getNotionPropertyValue(properties.환자상태, 'rich_text'),
      tongue_analysis: getNotionPropertyValue(properties.설진분석, 'rich_text'),
      special_notes: getNotionPropertyValue(properties.특이사항, 'rich_text'),
      prescription: getNotionPropertyValue(properties.처방약, 'rich_text'),
      result: getNotionPropertyValue(properties.결과, 'rich_text'),
      image_files: processedImageFiles,
      created_at: getNotionPropertyValue(properties.생성일시, 'created_time') || page.created_time
    };

    return consultation;

  } catch (error) {
    console.error(`상담 파싱 오류 (${page.id}):`, error);
    return null;
  }
}

function getNotionPropertyValue(property: any, type: string): any {
  if (!property) return null;

  switch (type) {
    case 'title':
      return property.title?.[0]?.text?.content || null;
    case 'rich_text':
      return property.rich_text?.[0]?.text?.content || null;
    case 'date':
      return property.date?.start || null;
    case 'files':
      return property.files || [];
    case 'created_time':
      return property.created_time || null;
    default:
      return null;
  }
}

function getRelationId(relationProperty: any): string | null {
  return relationProperty?.relation?.[0]?.id || null;
}

async function createCustomerIdMapping(consultations: NotionConsultationData[]): Promise<Map<string, string>> {
  console.log('🔍 고객 ID 매핑 생성 중...');

  // 상담 데이터에서 고유한 고객 코드들 추출
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

async function migrateConsultationImages(consultations: NotionConsultationData[], customerIdMapping: Map<string, string>, report: MigrationReport[]): Promise<void> {
  console.log('🖼️ 상담 이미지 마이그레이션 중...');

  try {
    const imageUrlMapping: Record<string, string[]> = {};
    let processedCount = 0;
    let errorCount = 0;

    for (const consultation of consultations) {
      try {
        console.log(`이미지 처리 중: ${consultation.consultation_id} (${processedCount + 1}/${consultations.length})`);

        const customerCode = consultation.consultation_id.split('_')[0];
        const customerId = customerIdMapping.get(customerCode);
        
        if (!customerId) {
          console.warn(`고객 매핑 없음: ${consultation.consultation_id}`);
          imageUrlMapping[consultation.consultation_id] = [];
          continue;
        }

        const migratedUrls = await migrateConsultationImageFiles(
          consultation.consultation_id,
          customerCode,
          consultation.image_files
        );

        imageUrlMapping[consultation.consultation_id] = migratedUrls;
        processedCount++;

        // 진행률 표시
        if (processedCount % 10 === 0) {
          console.log(`📊 진행률: ${processedCount}/${consultations.length} (${Math.round(processedCount / consultations.length * 100)}%)`);
        }

        // API 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`이미지 마이그레이션 실패 (${consultation.consultation_id}):`, error);
        errorCount++;
        imageUrlMapping[consultation.consultation_id] = [];
      }
    }

    // 결과 저장
    const outputPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
    writeFileSync(outputPath, JSON.stringify(imageUrlMapping, null, 2));

    report.push({
      phase: 'MIGRATE_IMAGES',
      status: errorCount > 0 ? 'warning' : 'success',
      message: `이미지 마이그레이션 완료: 성공 ${processedCount}개, 실패 ${errorCount}개`,
      details: { successCount: processedCount, errorCount },
      timestamp: new Date().toISOString()
    });

    console.log(`✅ 이미지 마이그레이션 완료: 성공 ${processedCount}개, 실패 ${errorCount}개`);

  } catch (error) {
    report.push({
      phase: 'MIGRATE_IMAGES',
      status: 'failed',
      message: `이미지 마이그레이션 실패: ${error}`,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
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

async function insertConsultationData(
  consultations: NotionConsultationData[], 
  customerIdMapping: Map<string, string>,
  report: MigrationReport[]
): Promise<void> {
  console.log('💾 상담 데이터 Supabase 삽입 중...');

  const BATCH_SIZE = 10;
  let successCount = 0;
  let errorCount = 0;

  // 이미지 URL 매핑 로드
  const imageUrlMappingPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
  let imageUrlMapping: Record<string, string[]> = {};
  
  try {
    if (existsSync(imageUrlMappingPath)) {
      imageUrlMapping = JSON.parse(readFileSync(imageUrlMappingPath, 'utf-8'));
    }
  } catch (error) {
    console.warn('이미지 URL 매핑 로드 실패:', error);
  }

  for (let i = 0; i < consultations.length; i += BATCH_SIZE) {
    const batch = consultations.slice(i, i + BATCH_SIZE);
    
    try {
      const insertData = batch.map(consultation => {
        const customerCode = consultation.consultation_id.split('_')[0];
        const customerId = customerIdMapping.get(customerCode);
        
        if (!customerId) {
          throw new Error(`고객 ID를 찾을 수 없습니다: ${customerCode}`);
        }

        return {
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
      });

      const { error } = await supabase
        .from('consultations')
        .insert(insertData);

      if (error) {
        console.error(`배치 ${Math.floor(i / BATCH_SIZE) + 1} 삽입 실패:`, error);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✅ 배치 ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(consultations.length / BATCH_SIZE)} 완료 (${successCount}/${consultations.length})`);
      }

      // API 부하 방지
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`배치 ${Math.floor(i / BATCH_SIZE) + 1} 처리 중 오류:`, error);
      errorCount += batch.length;
    }
  }

  // 마이그레이션 로그 기록
  for (const consultation of consultations) {
    const customerCode = consultation.consultation_id.split('_')[0];
    const customerId = customerIdMapping.get(customerCode);
    
    const logData = {
      consultation_id: consultation.consultation_id,
      migration_status: customerId ? 'completed' : 'failed',
      supabase_id: customerId || null,
      image_count: consultation.image_files?.length || 0,
      migrated_image_count: imageUrlMapping[consultation.consultation_id]?.length || 0,
      error_message: customerId ? null : `고객 ID 없음: ${customerCode}`,
      completed_at: new Date().toISOString()
    };

    await supabase
      .from('consultation_migration_log')
      .insert([logData]);
  }

  report.push({
    phase: 'INSERT_CONSULTATION_DATA',
    status: errorCount > 0 ? 'warning' : 'success',
    message: `데이터 삽입 완료: 성공 ${successCount}개, 실패 ${errorCount}개`,
    details: { successCount, errorCount },
    timestamp: new Date().toISOString()
  });

  console.log(`✅ 상담 데이터 삽입 완료: 성공 ${successCount}개, 실패 ${errorCount}개`);
}

async function performIntegrityCheck(report: MigrationReport[]): Promise<void> {
  console.log('🔍 무결성 체크 수행 중...');

  try {
    const issues: any[] = [];

    // 1. 데이터베이스 무결성 검사
    const { data: dbIssues, error: dbError } = await supabase
      .rpc('validate_consultation_data');

    if (dbError) {
      console.error('DB 검증 쿼리 실행 실패:', dbError);
    } else if (dbIssues && dbIssues.length > 0) {
      issues.push(...dbIssues.map((issue: any) => ({
        type: 'database',
        ...issue
      })));
    }

    // 2. 이미지 파일 무결성 검사
    const imageIssues = await checkImageIntegrity();
    issues.push(...imageIssues);

    // 3. 상담 ID 형식 검사
    const idFormatIssues = await checkConsultationIdFormat();
    issues.push(...idFormatIssues);

    // 4. 고객-상담 관계 검사
    const relationIssues = await checkCustomerConsultationRelation();
    issues.push(...relationIssues);

    // 결과 저장
    const integrityReportPath = join(process.cwd(), 'migration_data', 'reports', 'integrity_check.json');
    writeFileSync(integrityReportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalIssues: issues.length,
      issues: issues
    }, null, 2));

    const status = issues.length === 0 ? 'success' : (issues.length > 10 ? 'failed' : 'warning');

    report.push({
      phase: 'INTEGRITY_CHECK',
      status,
      message: `무결성 체크 완료: ${issues.length}개 이슈 발견`,
      details: { 
        totalIssues: issues.length,
        issueTypes: issues.reduce((acc: any, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        }, {})
      },
      timestamp: new Date().toISOString()
    });

    if (issues.length > 0) {
      console.warn(`⚠️ 무결성 체크 완료: ${issues.length}개 이슈 발견`);
      issues.slice(0, 5).forEach(issue => {
        console.warn(`- ${issue.type}: ${issue.consultation_id || issue.issue_description}`);
      });
      if (issues.length > 5) {
        console.warn(`... 및 ${issues.length - 5}개 추가 이슈`);
      }
    } else {
      console.log('✅ 무결성 체크 통과: 이슈 없음');
    }

  } catch (error) {
    report.push({
      phase: 'INTEGRITY_CHECK',
      status: 'failed',
      message: `무결성 체크 실패: ${error}`,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

async function checkImageIntegrity(): Promise<any[]> {
  const issues: any[] = [];

  try {
    // Supabase에서 이미지 URL이 있는 상담 조회
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('consultation_id, image_urls')
      .not('image_urls', 'eq', '[]');

    if (error) throw error;

    for (const consultation of consultations) {
      const imageUrls = consultation.image_urls as string[];
      
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        try {
          const axios = require('axios');
          const response = await axios.head(imageUrl, { timeout: 5000 });
          
          if (response.status !== 200) {
            issues.push({
              type: 'image_access',
              consultation_id: consultation.consultation_id,
              issue_description: `이미지 접근 불가: ${imageUrl} (Status: ${response.status})`
            });
          }
        } catch (error) {
          issues.push({
            type: 'image_access',
            consultation_id: consultation.consultation_id,
            issue_description: `이미지 접근 실패: ${imageUrl} (${error.message})`
          });
        }
      }
    }

  } catch (error) {
    issues.push({
      type: 'image_check_error',
      issue_description: `이미지 무결성 검사 실패: ${error.message}`
    });
  }

  return issues;
}

async function checkConsultationIdFormat(): Promise<any[]> {
  const issues: any[] = [];

  try {
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('consultation_id');

    if (error) throw error;

    const idPattern = /^\d{5}_\d{3}$/; // 00074_001 형식

    consultations.forEach(consultation => {
      if (!idPattern.test(consultation.consultation_id)) {
        issues.push({
          type: 'id_format',
          consultation_id: consultation.consultation_id,
          issue_description: '상담 ID 형식이 올바르지 않음 (예상: 00074_001)'
        });
      }
    });

  } catch (error) {
    issues.push({
      type: 'id_format_check_error',
      issue_description: `상담 ID 형식 검사 실패: ${error.message}`
    });
  }

  return issues;
}

async function checkCustomerConsultationRelation(): Promise<any[]> {
  const issues: any[] = [];

  try {
    // 고객 코드와 상담 ID의 일치성 검사
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select(`
        consultation_id,
        customers:customer_id (
          customer_code
        )
      `);

    if (error) throw error;

    consultations.forEach(consultation => {
      const consultationCustomerCode = consultation.consultation_id.split('_')[0];
      const actualCustomerCode = consultation.customers?.customer_code;

      if (consultationCustomerCode !== actualCustomerCode) {
        issues.push({
          type: 'customer_relation',
          consultation_id: consultation.consultation_id,
          issue_description: `고객 코드 불일치: 상담ID(${consultationCustomerCode}) vs 실제(${actualCustomerCode})`
        });
      }
    });

  } catch (error) {
    issues.push({
      type: 'relation_check_error',
      issue_description: `고객-상담 관계 검사 실패: ${error.message}`
    });
  }

  return issues;
}

async function generateFinalReport(report: MigrationReport[], startTime: number): Promise<void> {
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  const finalReport = {
    migration_summary: {
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      duration_seconds: duration,
      total_phases: report.length,
      success_phases: report.filter(r => r.status === 'success').length,
      warning_phases: report.filter(r => r.status === 'warning').length,
      failed_phases: report.filter(r => r.status === 'failed').length
    },
    phases: report,
    recommendations: generateRecommendations(report)
  };

  // 보고서 저장
  const reportPath = join(process.cwd(), 'migration_data', 'reports', 'final_migration_report.json');
  writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

  // 콘솔 요약 출력
  console.log('\n' + '='.repeat(60));
  console.log('📋 마이그레이션 최종 보고서');
  console.log('='.repeat(60));
  console.log(`⏱️ 총 소요 시간: ${Math.floor(duration / 60)}분 ${duration % 60}초`);
  console.log(`✅ 성공: ${finalReport.migration_summary.success_phases}개`);
  console.log(`⚠️ 경고: ${finalReport.migration_summary.warning_phases}개`);
  console.log(`❌ 실패: ${finalReport.migration_summary.failed_phases}개`);
  console.log(`📄 상세 보고서: ${reportPath}`);
  console.log('='.repeat(60));

  if (finalReport.recommendations.length > 0) {
    console.log('\n🔧 권장사항:');
    finalReport.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }
}

function generateRecommendations(report: MigrationReport[]): string[] {
  const recommendations: string[] = [];

  const failedPhases = report.filter(r => r.status === 'failed');
  const warningPhases = report.filter(r => r.status === 'warning');

  if (failedPhases.length > 0) {
    recommendations.push('실패한 단계가 있습니다. 로그를 확인하고 문제를 해결한 후 해당 단계를 다시 실행하세요.');
  }

  if (warningPhases.length > 0) {
    recommendations.push('경고가 발생한 단계가 있습니다. 데이터 품질을 확인하고 필요시 수동으로 수정하세요.');
  }

  const integrityCheck = report.find(r => r.phase === 'INTEGRITY_CHECK');
  if (integrityCheck && integrityCheck.details?.totalIssues > 0) {
    recommendations.push('무결성 체크에서 이슈가 발견되었습니다. integrity_check.json 파일을 확인하여 문제를 해결하세요.');
  }

  if (report.every(r => r.status === 'success')) {
    recommendations.push('모든 단계가 성공적으로 완료되었습니다. USE_SUPABASE_CONSULTATION=true로 설정하여 새로운 시스템을 활성화할 수 있습니다.');
  }

  return recommendations;
}

// 실행
if (require.main === module) {
  runFullConsultationMigration()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 