import { NextResponse } from 'next/server';
import { 
  searchConsultations, 
  getConsultationById, 
  createConsultationInSupabase,
  type ConsultationCreateInput 
} from '@/app/lib/supabase-consultation';
import { getCustomerById } from '@/app/lib/supabase-customer';
import { getCurrentKoreaDate } from '@/app/lib/date-utils';

// 상담일지 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('customerName');
    const customerId = searchParams.get('customerId');
    const consultationId = searchParams.get('consultationId');

    let consultations = [];

    if (consultationId) {
      // 특정 상담일지 조회
      const consultation = await getConsultationById(consultationId);
      if (consultation) {
        consultations = [consultation];
      }
    } else if (customerId) {
      // 고객 ID로 상담일지 조회
      consultations = await searchConsultations({ customerId });
    } else if (customerName) {
      // 고객명으로 상담일지 조회
      consultations = await searchConsultations({ customerName });
    }

    // Notion API 형식과 호환되도록 변환
    const transformedConsultations = consultations.map(consultation => ({
      id: consultation.id,
      properties: {
        상담일지ID: {
          title: [{ text: { content: consultation.consultation_id } }]
        },
        고객ID: {
          relation: [{ id: consultation.customer_id }]
        },
        고객명: {
          rollup: {
            array: [{ rich_text: [{ text: { content: consultation.customer_name || '' } }] }]
          }
        },
        호소증상: {
          rich_text: consultation.chief_complaint ? [{ text: { content: consultation.chief_complaint } }] : []
        },
        환자상태: {
          rich_text: consultation.patient_condition ? [{ text: { content: consultation.patient_condition } }] : []
        },
        설진분석: {
          rich_text: consultation.tongue_analysis ? [{ text: { content: consultation.tongue_analysis } }] : []
        },
        처방약: {
          rich_text: consultation.prescription ? [{ text: { content: consultation.prescription } }] : []
        },
        특이사항: {
          rich_text: consultation.special_notes ? [{ text: { content: consultation.special_notes } }] : []
        },
        결과: {
          rich_text: consultation.result ? [{ text: { content: consultation.result } }] : []
        },
        증상이미지: {
          files: consultation.image_urls ? consultation.image_urls.map(url => ({
            type: 'external',
            external: { url }
          })) : []
        },
        상담일시: {
          date: { start: consultation.consultation_date }
        },
        생성일시: {
          created_time: consultation.created_at
        }
      }
    }));

    return NextResponse.json({ 
      success: true, 
      consultations: transformedConsultations 
    });

  } catch (error) {
    console.error('상담일지 조회 오류:', error);
    return NextResponse.json(
      { error: '상담일지 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상담일지 등록
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.customerId) {
      return NextResponse.json({ error: '고객 ID는 필수 입력 항목입니다.' }, { status: 400 });
    }

    // 고객 존재 확인
    const customer = await getCustomerById(data.customerId);
    if (!customer) {
      return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 상담일지 데이터 준비 (순수한 날짜 형식 사용)
    const consultationData: ConsultationCreateInput = {
      customer_id: data.customerId,
      symptoms: data.chiefComplaint || '',
      consultDate: data.consultationDate || getCurrentKoreaDate(), // 현재 한국 날짜 (YYYY-MM-DD)
      stateAnalysis: data.patientCondition || undefined,
      tongueAnalysis: data.tongueAnalysis || undefined,
      specialNote: data.specialNotes || undefined,
      medicine: data.prescription || undefined,
      result: data.result || undefined,
      imageDataArray: data.imageDataArray || []
    };

    // 상담일지 생성 (이미지 업로드 포함)
    const result = await createConsultationInSupabase(consultationData);

    return NextResponse.json({
      success: true,
      consultation: result.consultation,
      consultationId: result.consultationId,
      message: '상담일지가 성공적으로 등록되었습니다.'
    });

  } catch (error) {
    console.error('상담일지 등록 오류:', error);
    return NextResponse.json(
      { error: '상담일지 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 