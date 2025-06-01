import { createClient } from '@supabase/supabase-js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runIntegrityCheck(): Promise<void> {
  console.log('🔍 상담일지 무결성 체크 실행 중...');

  try {
    const issues: any[] = [];

    // 1. 데이터베이스 무결성 검사
    console.log('1️⃣ 데이터베이스 무결성 검사...');
    const { data: dbIssues, error: dbError } = await supabase
      .rpc('validate_consultation_data');

    if (dbError) {
      console.error('DB 검증 쿼리 실행 실패:', dbError);
      issues.push({
        type: 'db_check_error',
        issue_description: `DB 검증 실패: ${dbError.message}`
      });
    } else if (dbIssues && dbIssues.length > 0) {
      issues.push(...dbIssues.map((issue: any) => ({
        type: 'database',
        ...issue
      })));
      console.log(`   발견된 DB 이슈: ${dbIssues.length}개`);
    } else {
      console.log('   ✅ DB 무결성 검사 통과');
    }

    // 2. 이미지 파일 무결성 검사 (샘플링)
    console.log('2️⃣ 이미지 파일 무결성 검사...');
    const imageIssues = await checkImageIntegrity();
    issues.push(...imageIssues);
    console.log(`   발견된 이미지 이슈: ${imageIssues.length}개`);

    // 3. 상담 ID 형식 검사
    console.log('3️⃣ 상담 ID 형식 검사...');
    const idFormatIssues = await checkConsultationIdFormat();
    issues.push(...idFormatIssues);
    console.log(`   발견된 ID 형식 이슈: ${idFormatIssues.length}개`);

    // 4. 고객-상담 관계 검사
    console.log('4️⃣ 고객-상담 관계 검사...');
    const relationIssues = await checkCustomerConsultationRelation();
    issues.push(...relationIssues);
    console.log(`   발견된 관계 이슈: ${relationIssues.length}개`);

    // 5. 기본 통계 정보
    console.log('5️⃣ 기본 통계 정보 수집...');
    const stats = await collectBasicStats();

    // 결과 저장
    const reportsDir = join(process.cwd(), 'migration_data', 'reports');
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const integrityReportPath = join(reportsDir, 'integrity_check.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalIssues: issues.length,
      statistics: stats,
      issues: issues
    };

    writeFileSync(integrityReportPath, JSON.stringify(report, null, 2));

    // 결과 출력
    console.log('\n' + '='.repeat(60));
    console.log('📋 무결성 체크 결과');
    console.log('='.repeat(60));
    console.log(`📊 기본 통계:`);
    console.log(`   - 총 상담: ${stats.totalConsultations}개`);
    console.log(`   - 총 고객: ${stats.totalCustomers}개`);
    console.log(`   - 이미지가 있는 상담: ${stats.consultationsWithImages}개`);
    console.log(`   - 총 이미지: ${stats.totalImages}개`);
    console.log(`🔍 무결성 체크:`);
    console.log(`   - 총 이슈: ${issues.length}개`);

    if (issues.length > 0) {
      console.log(`⚠️ 발견된 이슈:`);
      const issueTypes = issues.reduce((acc: any, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      }, {});

      Object.entries(issueTypes).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}개`);
      });

      console.log(`📄 상세 보고서: ${integrityReportPath}`);
    } else {
      console.log('✅ 모든 무결성 검사 통과!');
    }

    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 무결성 체크 실패:', error);
    throw error;
  }
}

async function collectBasicStats(): Promise<any> {
  const stats: any = {};

  try {
    // 총 상담 수
    const { count: consultationCount, error: consultationError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true });

    stats.totalConsultations = consultationError ? 0 : consultationCount;

    // 총 고객 수
    const { count: customerCount, error: customerError } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });

    stats.totalCustomers = customerError ? 0 : customerCount;

    // 이미지가 있는 상담 수
    const { data: consultationsWithImages, error: imageError } = await supabase
      .from('consultations')
      .select('image_urls')
      .not('image_urls', 'eq', '[]');

    stats.consultationsWithImages = imageError ? 0 : consultationsWithImages?.length || 0;

    // 총 이미지 수
    let totalImages = 0;
    if (!imageError && consultationsWithImages) {
      consultationsWithImages.forEach(consultation => {
        const imageUrls = consultation.image_urls as string[];
        totalImages += imageUrls.length;
      });
    }
    stats.totalImages = totalImages;

  } catch (error) {
    console.error('통계 수집 중 오류:', error);
  }

  return stats;
}

async function checkImageIntegrity(): Promise<any[]> {
  const issues: any[] = [];

  try {
    // Supabase에서 이미지 URL이 있는 상담 조회 (샘플링)
    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('consultation_id, image_urls')
      .not('image_urls', 'eq', '[]')
      .limit(10); // 샘플링으로 10개만 체크

    if (error) throw error;

    for (const consultation of consultations) {
      const imageUrls = consultation.image_urls as string[];
      
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        
        try {
          const response = await fetch(imageUrl, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
          });
          
          if (!response.ok) {
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

// 실행
if (require.main === module) {
  runIntegrityCheck()
    .then(() => {
      console.log('🎉 무결성 체크 완료!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 무결성 체크 실패:', error);
      process.exit(1);
    });
} 