import { createClient } from '@supabase/supabase-js';
import { validateKoreaDateRange, toKoreaISOString } from './date-utils';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface SupabaseConsultation {
  id: string;
  consultation_id: string;
  customer_id: string;
  consult_date: string;
  symptoms: string;
  patient_condition?: string;
  tongue_analysis?: string;
  special_notes?: string;
  prescription?: string;
  result?: string;
  image_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface Consultation {
  id: string;
  consultation_id: string;
  customer_id: string;
  customer_name?: string;
  chief_complaint?: string;
  patient_condition?: string;
  tongue_analysis?: string;
  prescription?: string;
  special_notes?: string;
  result?: string;
  image_urls?: string[];
  consultation_date: string;
  created_at: string;
  updated_at: string;
}

export interface CreateConsultationData {
  customer_id: string;
  chief_complaint?: string;
  patient_condition?: string;
  tongue_analysis?: string;
  prescription?: string;
  special_notes?: string;
  result?: string;
  image_urls?: string[];
  consultation_date: string;
}

export interface UpdateConsultationData {
  chief_complaint?: string;
  patient_condition?: string;
  tongue_analysis?: string;
  prescription?: string;
  special_notes?: string;
  result?: string;
  image_urls?: string[];
  consultation_date?: string;
}

export interface SearchConsultationsParams {
  customerId?: string;
  customerName?: string;
  consultationId?: string;
  page?: number;
  limit?: number;
}

export interface ConsultationCreateInput {
  customer_id: string;
  symptoms: string;
  consultDate: string;
  stateAnalysis?: string;
  tongueAnalysis?: string;
  specialNote?: string;
  medicine?: string;
  result?: string;
  imageDataArray?: string[];
}

// 특정 상담일지 조회
export async function getConsultationById(consultationId: string): Promise<Consultation | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          name
        )
      `)
      .eq('id', consultationId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 데이터 없음
      }
      throw error;
    }

    return {
      id: data.id,
      consultation_id: data.consultation_id,
      customer_id: data.customer_id,
      customer_name: data.customers?.name,
      chief_complaint: data.symptoms,
      patient_condition: data.patient_condition,
      tongue_analysis: data.tongue_analysis,
      prescription: data.prescription,
      special_notes: data.special_notes,
      result: data.result,
      image_urls: data.image_urls || [],
      consultation_date: data.consult_date,
      created_at: data.created_at,
      updated_at: data.updated_at
    };

  } catch (error) {
    console.error('상담일지 조회 오류:', error);
    throw error;
  }
}

// 상담일지 검색
export async function searchConsultations(params: SearchConsultationsParams): Promise<Consultation[]> {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          name
        )
      `)
      .order('consult_date', { ascending: false })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (params.customerId) {
      query = query.eq('customer_id', params.customerId);
    }

    if (params.customerName) {
      // 고객명으로 검색하는 경우, 먼저 고객 ID를 찾아야 함
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .ilike('name', `%${params.customerName}%`);

      if (customers && customers.length > 0) {
        const customerIds = customers.map(c => c.id);
        query = query.in('customer_id', customerIds);
      } else {
        return []; // 해당 이름의 고객이 없음
      }
    }

    if (params.consultationId) {
      query = query.eq('consultation_id', params.consultationId);
    }

    // 페이지네이션
    if (params.page && params.limit) {
      const from = (params.page - 1) * params.limit;
      const to = from + params.limit - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data.map(consultation => ({
      id: consultation.id,
      consultation_id: consultation.consultation_id,
      customer_id: consultation.customer_id,
      customer_name: consultation.customers?.name,
      chief_complaint: consultation.symptoms,
      patient_condition: consultation.patient_condition,
      tongue_analysis: consultation.tongue_analysis,
      prescription: consultation.prescription,
      special_notes: consultation.special_notes,
      result: consultation.result,
      image_urls: consultation.image_urls || [],
      consultation_date: consultation.consult_date,
      created_at: consultation.created_at,
      updated_at: consultation.updated_at
    }));

  } catch (error) {
    console.error('상담일지 검색 오류:', error);
    throw error;
  }
}

// 상담일지 생성
export async function createConsultation(data: CreateConsultationData): Promise<Consultation> {
  try {
    const supabase = getSupabaseClient();
    
    // 고객 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('customer_code, name')
      .eq('id', data.customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error('존재하지 않는 고객입니다.');
    }

    // 상담 ID 생성
    const consultationId = await generateNextConsultationId(data.customer_id, customer.customer_code);

    // 상담 데이터 삽입
    const consultationData = {
      consultation_id: consultationId,
      customer_id: data.customer_id,
      consult_date: data.consultation_date,
      symptoms: data.chief_complaint || '',
      patient_condition: data.patient_condition,
      tongue_analysis: data.tongue_analysis,
      special_notes: data.special_notes,
      prescription: data.prescription,
      result: data.result,
      image_urls: data.image_urls || []
    };

    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select()
      .single();

    if (error) throw error;

    return {
      id: consultation.id,
      consultation_id: consultation.consultation_id,
      customer_id: consultation.customer_id,
      customer_name: customer.name,
      chief_complaint: consultation.symptoms,
      patient_condition: consultation.patient_condition,
      tongue_analysis: consultation.tongue_analysis,
      prescription: consultation.prescription,
      special_notes: consultation.special_notes,
      result: consultation.result,
      image_urls: consultation.image_urls || [],
      consultation_date: consultation.consult_date,
      created_at: consultation.created_at,
      updated_at: consultation.updated_at
    };

  } catch (error) {
    console.error('상담일지 생성 오류:', error);
    throw error;
  }
}

// 상담일지 수정
export async function updateConsultation(consultationId: string, data: UpdateConsultationData): Promise<Consultation> {
  try {
    const supabase = getSupabaseClient();
    
    // 수정 데이터 준비
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (data.chief_complaint !== undefined) updateData.symptoms = data.chief_complaint;
    if (data.patient_condition !== undefined) updateData.patient_condition = data.patient_condition;
    if (data.tongue_analysis !== undefined) updateData.tongue_analysis = data.tongue_analysis;
    if (data.prescription !== undefined) updateData.prescription = data.prescription;
    if (data.special_notes !== undefined) updateData.special_notes = data.special_notes;
    if (data.result !== undefined) updateData.result = data.result;
    if (data.image_urls !== undefined) updateData.image_urls = data.image_urls;
    if (data.consultation_date !== undefined) updateData.consult_date = data.consultation_date;

    const { data: consultation, error } = await supabase
      .from('consultations')
      .update(updateData)
      .eq('id', consultationId)
      .select(`
        *,
        customers:customer_id (
          name
        )
      `)
      .single();

    if (error) throw error;

    return {
      id: consultation.id,
      consultation_id: consultation.consultation_id,
      customer_id: consultation.customer_id,
      customer_name: consultation.customers?.name,
      chief_complaint: consultation.symptoms,
      patient_condition: consultation.patient_condition,
      tongue_analysis: consultation.tongue_analysis,
      prescription: consultation.prescription,
      special_notes: consultation.special_notes,
      result: consultation.result,
      image_urls: consultation.image_urls || [],
      consultation_date: consultation.consult_date,
      created_at: consultation.created_at,
      updated_at: consultation.updated_at
    };

  } catch (error) {
    console.error('상담일지 수정 오류:', error);
    throw error;
  }
}

// 상담일지 삭제
export async function deleteConsultation(consultationId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('id', consultationId);

    if (error) throw error;

  } catch (error) {
    console.error('상담일지 삭제 오류:', error);
    throw error;
  }
}

// 상담 목록 조회
export async function getConsultationsFromSupabase(
  customerId?: string,
  page: number = 1,
  limit: number = 10,
  search?: string
) {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('consultations')
      .select(`
        *,
        customers:customer_id (
          id,
          name,
          phone,
          customer_code
        )
      `, { count: 'exact' })
      .order('consult_date', { ascending: false })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      query = query.or(`symptoms.ilike.%${search}%,prescription.ilike.%${search}%`);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Notion API 형식과 호환되도록 변환
    const consultations = data.map(consultation => ({
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
    }));

    return {
      success: true,
      consultations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };

  } catch (error) {
    console.error('Supabase 상담 조회 오류:', error);
    throw error;
  }
}

// 상담 등록
export async function createConsultationInSupabase(data: ConsultationCreateInput) {
  try {
    const supabase = getSupabaseClient();
    
    // 한국시간 기준 날짜 검증
    if (data.consultDate) {
      const validation = validateKoreaDateRange(data.consultDate, 1900, 2);
      
      if (!validation.isValid) {
        console.error('날짜 검증 실패:', validation.error, '입력값:', data.consultDate);
        throw new Error(`날짜 오류: ${validation.error}`);
      }
      
      console.log('한국시간 기준 상담 날짜 검증 성공:', data.consultDate);
    }
    
    // 고객 정보 조회
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_code')
      .eq('id', data.customer_id)
      .single();

    if (customerError || !customer) {
      throw new Error('존재하지 않는 고객입니다.');
    }

    // 상담 ID 생성
    const consultationId = await generateNextConsultationId(data.customer_id, customer.customer_code);

    // 이미지 업로드 처리
    let imageUrls: string[] = [];
    if (data.imageDataArray && Array.isArray(data.imageDataArray) && data.imageDataArray.length > 0) {
      try {
        imageUrls = await uploadConsultationImages(
          customer.customer_code,
          consultationId,
          data.imageDataArray
        );
        console.log(`${imageUrls.length}개의 이미지 업로드 완료`);
      } catch (uploadError) {
        console.error('이미지 업로드 실패:', uploadError);
        // 이미지 업로드 실패해도 상담 등록은 계속 진행
      }
    }

    // 상담 데이터 삽입 (모든 시간을 서울 시간 기준으로 설정)
    const currentSeoulTime = toKoreaISOString(new Date());
    
    const consultationData = {
      consultation_id: consultationId,
      customer_id: data.customer_id,
      consult_date: toKoreaISOString(data.consultDate),
      symptoms: data.symptoms,
      patient_condition: data.stateAnalysis,
      tongue_analysis: data.tongueAnalysis,
      special_notes: data.specialNote,
      prescription: data.medicine,
      result: data.result,
      image_urls: imageUrls,
      created_at: currentSeoulTime,   // 생성시간도 서울 시간으로 명시적 설정
      updated_at: currentSeoulTime    // 수정시간도 서울 시간으로 명시적 설정
    };

    const { data: consultation, error } = await supabase
      .from('consultations')
      .insert(consultationData)
      .select()
      .single();

    if (error) throw error;

    // Notion API 형식과 호환되는 응답
    return {
      success: true,
      consultation: {
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
        }
      },
      consultationId: consultation.consultation_id
    };

  } catch (error) {
    console.error('Supabase 상담 등록 오류:', error);
    throw error;
  }
}

// 이미지 업로드 함수
export async function uploadConsultationImages(
  customerCode: string,
  consultationId: string,
  imageDataArray: string[]
): Promise<string[]> {
  const supabase = getSupabaseClient();
  const uploadedUrls: string[] = [];

  for (let i = 0; i < imageDataArray.length; i++) {
    try {
      const imageData = imageDataArray[i];
      const fileName = `image_${i + 1}.jpg`;
      const filePath = `${customerCode}/${consultationId}/${fileName}`;

      // Base64 데이터에서 실제 이미지 데이터 추출
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('consultation-images')
        .upload(filePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.error(`이미지 ${i + 1} 업로드 실패:`, error);
        continue;
      }

      // 공개 URL 생성
      const { data: publicUrlData } = supabase.storage
        .from('consultation-images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        uploadedUrls.push(publicUrlData.publicUrl);
        console.log(`이미지 ${i + 1} 업로드 성공: ${publicUrlData.publicUrl}`);
      }

    } catch (error) {
      console.error(`이미지 ${i + 1} 업로드 중 오류:`, error);
    }
  }

  return uploadedUrls;
}

// 다음 상담 ID 생성
export async function generateNextConsultationId(
  customerId: string,
  customerCode: string
): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // 해당 고객의 마지막 상담 번호 조회
    const { data, error } = await supabase
      .from('consultations')
      .select('consultation_id')
      .eq('customer_id', customerId)
      .order('consultation_id', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastId = data[0].consultation_id;
      const parts = lastId.split('_');
      if (parts.length === 2) {
        const lastNumber = parseInt(parts[1]);
        nextNumber = lastNumber + 1;
      }
    }

    return `${customerCode}_${String(nextNumber).padStart(3, '0')}`;

  } catch (error) {
    console.error('상담 ID 생성 오류:', error);
    throw error;
  }
}

// 상담 이미지 경로 생성
export function generateConsultationImagePath(
  customerCode: string,
  consultationId: string,
  imageIndex: number,
  fileExtension: string = 'jpg'
): string {
  return `${customerCode}/${consultationId}/image_${imageIndex}.${fileExtension}`;
} 