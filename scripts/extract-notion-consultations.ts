import { Client } from '@notionhq/client';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function extractAllNotionConsultations(): Promise<NotionConsultationData[]> {
  console.log('📥 Notion 상담 데이터 추출 시작...');

  try {
    const consultations: NotionConsultationData[] = [];
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

    console.log(`🎉 추출 완료: 총 ${consultations.length}개의 상담 데이터`);
    console.log(`💾 저장 위치: ${outputPath}`);

    return consultations;

  } catch (error) {
    console.error('💥 Notion 데이터 추출 실패:', error);
    throw error;
  }
}

async function parseNotionConsultation(page: any): Promise<NotionConsultationData | null> {
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

    const consultation: NotionConsultationData = {
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

// 실행
if (require.main === module) {
  // migration_data 디렉토리 생성
  const fs = require('fs');
  const migrationDir = join(process.cwd(), 'migration_data');
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }

  extractAllNotionConsultations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 