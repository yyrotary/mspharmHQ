import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NotionConsultationData } from '../app/lib/types/consultation';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function migrateConsultationImages(): Promise<Map<string, string[]>> {
  console.log('🖼️ 상담 이미지 마이그레이션 시작...');

  // 추출된 상담 데이터 읽기
  const consultationsPath = join(process.cwd(), 'migration_data', 'notion_consultations.json');
  const consultations: NotionConsultationData[] = JSON.parse(readFileSync(consultationsPath, 'utf-8'));

  const imageUrlMap = new Map<string, string[]>();
  let processedCount = 0;
  let errorCount = 0;

  for (const consultation of consultations) {
    try {
      console.log(`처리 중: ${consultation.consultation_id} (${processedCount + 1}/${consultations.length})`);

      const migratedUrls = await migrateConsultationImageFiles(
        consultation.consultation_id,
        consultation.customer_id,
        consultation.image_files
      );

      imageUrlMap.set(consultation.consultation_id, migratedUrls);
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
      imageUrlMap.set(consultation.consultation_id, []);
    }
  }

  // 결과 저장
  const outputPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
  const mappingObject = Object.fromEntries(imageUrlMap);
  writeFileSync(outputPath, JSON.stringify(mappingObject, null, 2));
  console.log(`💾 이미지 URL 매핑 저장: ${outputPath}`);

  console.log(`🎉 이미지 마이그레이션 완료: 성공 ${processedCount}개, 실패 ${errorCount}개`);
  return imageUrlMap;
}

async function migrateConsultationImageFiles(
  consultationId: string,
  customerId: string,
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

      // Supabase Storage에 업로드
      const filePath = generateConsultationImagePath(customerId, consultationId, i + 1);

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

function generateConsultationImagePath(
  customerId: string,
  consultationId: string,
  imageIndex: number
): string {
  return `${customerId}/${consultationId}/image_${imageIndex}.jpg`;
}

// 실행
if (require.main === module) {
  migrateConsultationImages()
    .then(imageUrlMap => {
      // 결과 저장
      const outputPath = join(process.cwd(), 'migration_data', 'image_url_mapping.json');
      const mappingObject = Object.fromEntries(imageUrlMap);
      writeFileSync(outputPath, JSON.stringify(mappingObject, null, 2));
      console.log(`💾 이미지 URL 매핑 저장: ${outputPath}`);
    })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 