import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string;
  google_drive_folder_id?: string;
  consultation_count: number;
  is_deleted: boolean;
  pin_code: string;
  is_initial_pin: boolean;
  pin_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerData {
  name: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string;
}

export interface UpdateCustomerData {
  name?: string;
  phone?: string;
  gender?: string;
  birth_date?: string;
  estimated_age?: number;
  address?: string;
  special_notes?: string;
  face_embedding?: string;
}

// 고객 검색
export async function searchCustomers(searchTerm: string, includeDeleted: boolean = false): Promise<Customer[]> {
  try {
    const supabase = getSupabaseClient();
    
    let query = supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    // 삭제된 고객 포함 여부
    if (!includeDeleted) {
      query = query.eq('is_deleted', false);
    }

    if (searchTerm && searchTerm.trim() !== '') {
      query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,customer_code.ilike.%${searchTerm}%,special_notes.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];

  } catch (error) {
    console.error('고객 검색 오류:', error);
    throw error;
  }
}

// 고객 ID로 조회
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('is_deleted', false)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // 데이터 없음
      }
      throw error;
    }

    return data;

  } catch (error) {
    console.error('고객 조회 오류:', error);
    throw error;
  }
}

// 다음 고객 코드 생성 (가장 큰 번호 + 1)
export async function getNextCustomerCode(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // 가장 큰 고객 코드 조회
    const { data, error } = await supabase
      .from('customers')
      .select('customer_code')
      .order('customer_code', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastCode = data[0].customer_code;
      // 숫자 부분만 추출 (예: "00074" -> 74)
      const lastNumber = parseInt(lastCode);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // 5자리 문자열로 변환 (예: 75 -> "00075")
    return String(nextNumber).padStart(5, '0');

  } catch (error) {
    console.error('다음 고객 코드 생성 오류:', error);
    throw error;
  }
}

// 고객 생성
export async function createCustomer(data: CreateCustomerData): Promise<Customer> {
  try {
    const supabase = getSupabaseClient();
    
    // 다음 고객 코드 생성
    const customerCode = await getNextCustomerCode();

    // 고객 데이터 삽입
    const customerData = {
      customer_code: customerCode,
      name: data.name,
      phone: data.phone,
      gender: data.gender,
      birth_date: data.birth_date,
      estimated_age: data.estimated_age,
      address: data.address,
      special_notes: data.special_notes,
      face_embedding: data.face_embedding,
      consultation_count: 0,
      is_deleted: false
    };

    const { data: customer, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw error;

    return customer;

  } catch (error) {
    console.error('고객 생성 오류:', error);
    throw error;
  }
}

// 고객 정보 수정
export async function updateCustomer(customerId: string, data: UpdateCustomerData): Promise<Customer> {
  try {
    const supabase = getSupabaseClient();
    
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };

    const { data: customer, error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
      .eq('is_deleted', false)
      .select()
      .single();

    if (error) throw error;

    return customer;

  } catch (error) {
    console.error('고객 수정 오류:', error);
    throw error;
  }
}

// 고객 삭제 (소프트 삭제)
export async function deleteCustomer(customerId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('customers')
      .update({ 
        is_deleted: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (error) throw error;

  } catch (error) {
    console.error('고객 삭제 오류:', error);
    throw error;
  }
}

// 상담 수 업데이트
export async function updateConsultationCount(customerId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // 해당 고객의 상담 수 계산
    const { count, error: countError } = await supabase
      .from('consultations')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (countError) throw countError;

    // 고객의 상담 수 업데이트
    const { error } = await supabase
      .from('customers')
      .update({ 
        consultation_count: count || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (error) throw error;

  } catch (error) {
    console.error('상담 수 업데이트 오류:', error);
    throw error;
  }
} 