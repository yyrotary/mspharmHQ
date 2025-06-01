import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function uploadConsultationImages(
  customerCode: string,
  consultationId: string,
  imageDataArray: string[]
): Promise<string[]> {
  const uploadPromises = imageDataArray.map(async (imageData, index) => {
    try {
      // Base64 데이터 처리
      const base64Data = imageData.includes(';base64,')
        ? imageData.split(';base64,')[1]
        : imageData;

      const buffer = Buffer.from(base64Data, 'base64');

      // 파일 경로 생성 (customer_code 기반)
      const filePath = generateConsultationImagePath(
        customerCode,
        consultationId,
        index + 1
      );

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('consultation-images')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      // 공개 URL 생성
      const { data: publicUrl } = supabase.storage
        .from('consultation-images')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;

    } catch (error) {
      console.error(`이미지 ${index + 1} 업로드 실패:`, error);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null) as string[];
}

// 수정 시 새 이미지 업로드를 위한 함수 (기존 이미지와 중복되지 않도록)
export async function uploadAdditionalConsultationImages(
  customerCode: string,
  consultationId: string,
  imageDataArray: string[],
  existingImageCount: number = 0
): Promise<string[]> {
  const timestamp = Date.now();
  
  const uploadPromises = imageDataArray.map(async (imageData, index) => {
    try {
      // Base64 데이터 처리
      const base64Data = imageData.includes(';base64,')
        ? imageData.split(';base64,')[1]
        : imageData;

      const buffer = Buffer.from(base64Data, 'base64');

      // 고유한 파일 경로 생성 (타임스탬프 포함)
      const filePath = generateUniqueConsultationImagePath(
        customerCode,
        consultationId,
        existingImageCount + index + 1,
        timestamp
      );

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('consultation-images')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: false // 덮어쓰기 방지
        });

      if (error) throw error;

      // 공개 URL 생성
      const { data: publicUrl } = supabase.storage
        .from('consultation-images')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;

    } catch (error) {
      console.error(`추가 이미지 ${index + 1} 업로드 실패:`, error);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  return results.filter(url => url !== null) as string[];
}

export async function generateNextConsultationId(
  customerId: string,
  customerCode: string
): Promise<string> {
  // RPC 함수 호출로 다음 상담 ID 생성
  const { data, error } = await supabase
    .rpc('generate_next_consultation_id', {
      customer_uuid: customerId,
      customer_code: customerCode
    });

  if (error) throw error;

  return data;
}

export function generateConsultationImagePath(
  customerCode: string,
  consultationId: string,
  imageIndex: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerCode}/${consultationId}/image_${imageIndex}.${fileExtension}`;
}

// 고유한 파일 경로 생성 (타임스탬프 포함)
export function generateUniqueConsultationImagePath(
  customerCode: string,
  consultationId: string,
  imageIndex: number,
  timestamp: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerCode}/${consultationId}/image_${imageIndex}_${timestamp}.${fileExtension}`;
}

export async function deleteConsultationImages(
  customerCode: string,
  consultationId: string
): Promise<void> {
  // 상담 관련 모든 이미지 삭제 (customer_code 기반)
  const folderPath = `${customerCode}/${consultationId}/`;
  
  const { data: files, error: listError } = await supabase.storage
    .from('consultation-images')
    .list(folderPath);

  if (listError) throw listError;

  if (files && files.length > 0) {
    const filePaths = files.map(file => `${folderPath}${file.name}`);
    
    const { error: deleteError } = await supabase.storage
      .from('consultation-images')
      .remove(filePaths);

    if (deleteError) throw deleteError;
  }
}

// Notion 응답 형식과 호환되는 변환 함수
export function transformSupabaseToNotionFormat(consultation: any) {
  return {
    id: consultation.id,
    properties: {
      id: {
        title: [{ text: { content: consultation.consultation_id } }]
      },
      상담일자: {
        date: { start: consultation.consult_date }
      },
      고객: {
        relation: [{ id: consultation.customer_id }]
      },
      호소증상: {
        rich_text: [{ text: { content: consultation.symptoms } }]
      },
      환자상태: {
        rich_text: [{ text: { content: consultation.patient_condition || '' } }]
      },
      설진분석: {
        rich_text: [{ text: { content: consultation.tongue_analysis || '' } }]
      },
      특이사항: {
        rich_text: [{ text: { content: consultation.special_notes || '' } }]
      },
      처방약: {
        rich_text: [{ text: { content: consultation.prescription || '' } }]
      },
      결과: {
        rich_text: [{ text: { content: consultation.result || '' } }]
      },
      증상이미지: {
        files: consultation.image_urls.map((url: string, index: number) => ({
          type: 'external',
          name: `${consultation.consultation_id}_${index + 1}.jpg`,
          external: { url }
        }))
      },
      생성일시: {
        created_time: consultation.created_at
      }
    },
    customer: consultation.customers // 추가 고객 정보
  };
} 