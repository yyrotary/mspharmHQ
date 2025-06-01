import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CONSULTATION_SCHEMA, NOTION_ENV_VARS } from '@/app/lib/notion-schema';
import { 
  getConsultationById, 
  updateConsultation, 
  deleteConsultation,
  type UpdateConsultationData 
} from '@/app/lib/supabase-consultation';
import { getCustomerById } from '@/app/lib/supabase-customer';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 상담일지 조회
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const id = context.params.id;
  
  if (!id) {
    return NextResponse.json({ success: false, error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    console.log(`상담일지 조회: ${id}`);
    
    // 노션 페이지 조회
    const response = await notion.pages.retrieve({ page_id: id });
    console.log('상담일지 조회 결과:', JSON.stringify(response).substring(0, 500) + '...');
    
    return NextResponse.json({ 
      success: true, 
      consultation: response
    });
  } catch (error) {
    console.error('상담일지 조회 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '상담일지 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 상담일지 수정
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const consultationId = params.id;

    // 상담일지 존재 확인
    const existingConsultation = await getConsultationById(consultationId);
    if (!existingConsultation) {
      return NextResponse.json({ error: '상담일지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 수정 데이터 준비
    const updateData: UpdateConsultationData = {
      chief_complaint: data.chiefComplaint || undefined,
      patient_condition: data.patientCondition || undefined,
      tongue_analysis: data.tongueAnalysis || undefined,
      prescription: data.prescription || undefined,
      special_notes: data.specialNotes || undefined,
      result: data.result || undefined,
      image_urls: data.imageUrls || undefined,
      consultation_date: data.consultationDate || undefined
    };

    // 상담일지 수정
    const updatedConsultation = await updateConsultation(consultationId, updateData);

    // 고객 정보 조회
    const customer = await getCustomerById(updatedConsultation.customer_id);

    // Notion API 형식과 호환되는 응답
    const transformedConsultation = {
      id: updatedConsultation.id,
      properties: {
        상담일지ID: {
          title: [{ text: { content: updatedConsultation.consultation_id } }]
        },
        고객ID: {
          relation: [{ id: updatedConsultation.customer_id }]
        },
        고객명: {
          rollup: {
            array: [{ rich_text: [{ text: { content: customer?.name || '' } }] }]
          }
        },
        호소증상: {
          rich_text: updatedConsultation.chief_complaint ? [{ text: { content: updatedConsultation.chief_complaint } }] : []
        },
        환자상태: {
          rich_text: updatedConsultation.patient_condition ? [{ text: { content: updatedConsultation.patient_condition } }] : []
        },
        설진분석: {
          rich_text: updatedConsultation.tongue_analysis ? [{ text: { content: updatedConsultation.tongue_analysis } }] : []
        },
        처방약: {
          rich_text: updatedConsultation.prescription ? [{ text: { content: updatedConsultation.prescription } }] : []
        },
        특이사항: {
          rich_text: updatedConsultation.special_notes ? [{ text: { content: updatedConsultation.special_notes } }] : []
        },
        결과: {
          rich_text: updatedConsultation.result ? [{ text: { content: updatedConsultation.result } }] : []
        },
        증상이미지: {
          files: updatedConsultation.image_urls ? updatedConsultation.image_urls.map(url => ({
            type: 'external',
            external: { url }
          })) : []
        },
        상담일시: {
          date: { start: updatedConsultation.consultation_date }
        },
        생성일시: {
          created_time: updatedConsultation.created_at
        }
      }
    };

    return NextResponse.json({
      success: true,
      consultation: transformedConsultation,
      message: '상담일지가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('상담일지 수정 오류:', error);
    return NextResponse.json(
      { error: '상담일지 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 상담일지 삭제
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const consultationId = params.id;

    // 상담일지 존재 확인
    const existingConsultation = await getConsultationById(consultationId);
    if (!existingConsultation) {
      return NextResponse.json({ error: '상담일지를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 상담일지 삭제
    await deleteConsultation(consultationId);

    return NextResponse.json({
      success: true,
      message: '상담일지가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('상담일지 삭제 오류:', error);
    return NextResponse.json(
      { error: '상담일지 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 