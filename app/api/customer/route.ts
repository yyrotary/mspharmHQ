import { NextResponse } from 'next/server';
import { 
  searchCustomers, 
  getCustomerById, 
  createCustomer,
  type CreateCustomerData 
} from '@/app/lib/supabase-customer';

// 고객 정보 조회
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const gender = searchParams.get('gender');
    const id = searchParams.get('id');
    const specialNote = searchParams.get('specialNote');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    let customers = [];

    if (id) {
      // ID로 단일 고객 조회
      const customer = await getCustomerById(id);
      if (customer) {
        customers = [customer];
      }
    } else if (name || phone || specialNote) {
      // 검색어로 고객 검색
      const searchTerm = name || phone || specialNote || '';
      customers = await searchCustomers(searchTerm);
    } else {
      // 검색어가 없으면 모든 고객 조회
      customers = await searchCustomers('', includeDeleted);
    }

    // 순수한 Supabase 형식으로 반환
    return NextResponse.json({ 
      success: true, 
      customers: customers 
    });

  } catch (error) {
    console.error('고객 조회 오류:', error);
    return NextResponse.json(
      { error: '고객 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 고객 정보 등록
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }

    // 고객 데이터 준비
    const customerData: CreateCustomerData = {
      name: data.name,
      phone: data.phone || undefined,
      gender: data.gender || undefined,
      birth_date: data.birth || undefined,
      estimated_age: data.estimatedAge ? parseInt(data.estimatedAge) : undefined,
      address: data.address || undefined,
      special_notes: data.specialNote || undefined,
      face_embedding: data.faceEmbedding || undefined
    };

    // 고객 생성
    const customer = await createCustomer(customerData);

    // 순수한 Supabase 형식으로 반환
    return NextResponse.json({
      success: true,
      customer: customer
    });

  } catch (error) {
    console.error('고객 등록 오류:', error);
    return NextResponse.json(
      { error: '고객 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

