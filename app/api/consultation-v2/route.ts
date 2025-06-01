import { NextResponse } from 'next/server';
import { createConsultationInSupabase } from '@/app/lib/supabase-consultation';
import { createClient } from '@supabase/supabase-js';
import { uploadConsultationImages, uploadAdditionalConsultationImages, deleteConsultationImages } from '@/app/lib/consultation-utils';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 상담 목록 조회 - 순수 Supabase 형식으로 반환
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get('customerId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
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

    // 날짜 필터링
    if (startDate && endDate) {
      query = query.gte('consult_date', startDate).lte('consult_date', endDate);
    }

    // 페이지네이션
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase 쿼리 오류:', error);
      throw error;
    }

    // 순수 Supabase 형식으로 반환 (Notion 변환 제거)
    const consultations = data?.map(consultation => ({
      id: consultation.id,
      consultation_id: consultation.consultation_id,
      customer_id: consultation.customer_id,
      consult_date: consultation.consult_date,
      symptoms: consultation.symptoms,
      patient_condition: consultation.patient_condition,
      tongue_analysis: consultation.tongue_analysis,
      special_notes: consultation.special_notes,
      prescription: consultation.prescription,
      result: consultation.result,
      image_urls: consultation.image_urls || [],
      created_at: consultation.created_at,
      updated_at: consultation.updated_at,
      customer: consultation.customers // 고객 정보
    })) || [];

    return NextResponse.json({
      success: true,
      consultations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('상담 조회 오류:', error);
    return NextResponse.json(
      { error: '상담 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상담 등록
export async function POST(request: Request) {
  try {
    const data = await request.json();

    // 필수 필드 검증
    if (!data.symptoms || !data.customer_id || !data.consultDate) {
      return NextResponse.json(
        { error: '필수 입력 항목이 누락되었습니다.' },
        { status: 400 }
      );
    }

    const result = await createConsultationInSupabase(data);

    return NextResponse.json(result);

  } catch (error) {
    console.error('상담 등록 오류:', error);
    return NextResponse.json(
      { error: '상담 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상담 수정
export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const { id, ...updateData } = data;

    if (!id) {
      return NextResponse.json(
        { error: '상담 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 기존 상담 정보 조회 (기존 이미지 URL 포함)
    const { data: existingConsultation, error: fetchError } = await supabase
      .from('consultations')
      .select(`
        consultation_id,
        image_urls,
        customers!inner(customer_code)
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 기존 이미지 URL 보존
    let imageUrls: string[] = existingConsultation?.image_urls || [];

    // 새 이미지 업로드 처리 (기존 이미지에 추가)
    if (updateData.imageDataArray && Array.isArray(updateData.imageDataArray) && updateData.imageDataArray.length > 0) {
      if (existingConsultation && existingConsultation.customers && existingConsultation.customers.customer_code) {
        try {
          const newImageUrls = await uploadAdditionalConsultationImages(
            existingConsultation.customers.customer_code,
            existingConsultation.consultation_id,
            updateData.imageDataArray,
            imageUrls.length // 기존 이미지 개수 전달
          );
          
          // 새 이미지 URL을 기존 이미지 URL에 추가
          imageUrls = [...imageUrls, ...newImageUrls];
          console.log(`기존 이미지 ${existingConsultation.image_urls?.length || 0}개 + 새 이미지 ${newImageUrls.length}개 = 총 ${imageUrls.length}개`);
        } catch (uploadError) {
          console.error('새 이미지 업로드 실패:', uploadError);
          // 이미지 업로드 실패해도 다른 필드 수정은 계속 진행
        }
      }
    }

    // 상담 데이터 업데이트 (날짜 필드 추가)
    const { data: updatedConsultation, error } = await supabase
      .from('consultations')
      .update({
        consult_date: updateData.consultDate ? new Date(updateData.consultDate).toISOString() : undefined, // ISO 형식으로 날짜와 시간 모두 저장
        symptoms: updateData.symptoms,
        patient_condition: updateData.stateAnalysis,
        tongue_analysis: updateData.tongueAnalysis,
        special_notes: updateData.specialNote,
        prescription: updateData.medicine,
        result: updateData.result,
        image_urls: imageUrls // 기존 이미지 + 새 이미지
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      consultation: updatedConsultation,
      message: `상담일지가 수정되었습니다. (이미지 ${imageUrls.length}개)`
    });

  } catch (error) {
    console.error('상담 수정 오류:', error);
    return NextResponse.json(
      { error: '상담 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상담 삭제
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '상담 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 상담 정보와 고객 코드 조회 (이미지 삭제를 위해)
    const { data: consultation, error: fetchError } = await supabase
      .from('consultations')
      .select(`
        consultation_id,
        customers!inner(customer_code)
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // 관련 이미지 삭제
    if (consultation && consultation.customers && consultation.customers.customer_code) {
      try {
        await deleteConsultationImages(
          consultation.customers.customer_code,
          consultation.consultation_id
        );
      } catch (imageError) {
        console.warn('이미지 삭제 실패:', imageError);
      }
    }

    // 상담 데이터 삭제
    const { error } = await supabase
      .from('consultations')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: '상담이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('상담 삭제 오류:', error);
    return NextResponse.json(
      { error: '상담 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 