import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { 
  getCustomerById, 
  updateCustomer, 
  deleteCustomer,
  type UpdateCustomerData 
} from '@/app/lib/supabase-customer';


// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 정보 수정
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    const customerId = params.id;

    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }

    // 고객 존재 확인
    const existingCustomer = await getCustomerById(customerId);
    if (!existingCustomer) {
      return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 수정 데이터 준비
    const updateData: UpdateCustomerData = {
      name: data.name,
      phone: data.phone || undefined,
      gender: data.gender || undefined,
      birth_date: data.birth || undefined,
      estimated_age: data.estimatedAge ? parseInt(data.estimatedAge) : undefined,
      address: data.address || undefined,
      special_notes: data.specialNote || undefined,
      face_embedding: data.faceEmbedding || undefined
    };

    // 고객 정보 수정
    const updatedCustomer = await updateCustomer(customerId, updateData);

    // Notion API 형식과 호환되는 응답
    const transformedCustomer = {
      id: updatedCustomer.id,
      properties: {
        id: {
          title: [{ text: { content: updatedCustomer.customer_code } }]
        },
        고객명: {
          rich_text: [{ text: { content: updatedCustomer.name } }]
        },
        전화번호: {
          phone_number: updatedCustomer.phone
        },
        성별: {
          select: updatedCustomer.gender ? { name: updatedCustomer.gender } : null
        },
        생년월일: {
          date: updatedCustomer.birth_date ? { start: updatedCustomer.birth_date } : null
        },
        추정나이: {
          number: updatedCustomer.estimated_age
        },
        주소: {
          rich_text: updatedCustomer.address ? [{ text: { content: updatedCustomer.address } }] : []
        },
        특이사항: {
          rich_text: updatedCustomer.special_notes ? [{ text: { content: updatedCustomer.special_notes } }] : []
        },
        얼굴_임베딩: {
          rich_text: updatedCustomer.face_embedding ? [{ text: { content: updatedCustomer.face_embedding } }] : []
        },
        customerFolderId: {
          rich_text: updatedCustomer.google_drive_folder_id ? [{ text: { content: updatedCustomer.google_drive_folder_id } }] : []
        },
        상담수: {
          formula: { number: updatedCustomer.consultation_count }
        },
        생성일시: {
          created_time: updatedCustomer.created_at
        }
      }
    };

    return NextResponse.json({
      success: true,
      customer: transformedCustomer,
      message: '고객 정보가 성공적으로 수정되었습니다.'
    });

  } catch (error) {
    console.error('고객 수정 오류:', error);
    return NextResponse.json(
      { error: '고객 정보 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 고객 삭제 (소프트 삭제)
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    // 고객 존재 확인
    const existingCustomer = await getCustomerById(customerId);
    if (!existingCustomer) {
      return NextResponse.json({ error: '고객을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 고객 삭제 (소프트 삭제)
    await deleteCustomer(customerId);

    return NextResponse.json({
      success: true,
      message: '고객이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('고객 삭제 오류:', error);
    return NextResponse.json(
      { error: '고객 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 