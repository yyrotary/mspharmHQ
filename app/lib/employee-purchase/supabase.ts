import { createClient } from '@supabase/supabase-js';
import { Employee, PurchaseRequest, PurchaseRequestWithEmployee, UploadResult } from './types';

// Supabase 클라이언트 설정 (Service Role Key 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Supabase 클라이언트 반환 함수
export function getEmployeePurchaseSupabase() {
  return supabase;
}

// 직원 관련 함수들
export async function getEmployeeByName(name: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('name', name)
    .single();

  if (error) {
    console.error('Error fetching employee:', error);
    return null;
  }

  return data;
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching employee:', error);
    return null;
  }

  return data;
}

// 구매 요청 관련 함수들
export async function createPurchaseRequest(
  employeeId: string,
  totalAmount: number,
  imageUrls: string[],
  notes?: string
): Promise<PurchaseRequest | null> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .insert({
      employee_id: employeeId,
      total_amount: totalAmount,
      image_urls: imageUrls,
      notes,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating purchase request:', error);
    return null;
  }

  return data;
}

export async function getPurchaseRequestsByEmployee(
  employeeId: string,
  page: number = 1,
  limit: number = 10
): Promise<PurchaseRequestWithEmployee[]> {
  const offset = (page - 1) * limit;

  const { data, error } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      employee:employees!employee_id(id, name, role),
      approver:employees!approved_by(id, name)
    `)
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching purchase requests:', error);
    return [];
  }

  return data || [];
}

export async function getAllPurchaseRequests(
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<PurchaseRequestWithEmployee[]> {
  const offset = (page - 1) * limit;

  let query = supabase
    .from('purchase_requests')
    .select(`
      *,
      employee:employees!employee_id(id, name, role),
      approver:employees!approved_by(id, name)
    `);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching purchase requests:', error);
    return [];
  }

  return data || [];
}

export async function updatePurchaseRequestStatus(
  requestId: string,
  status: PurchaseRequest['status'],
  approverId?: string,
  rejectionReason?: string
): Promise<boolean> {
  const updateData: any = { status };

  if (status === 'approved_by_manager' && approverId) {
    updateData.approved_by_manager_id = approverId;
    updateData.approved_by_manager_at = new Date().toISOString();
  } else if (status === 'approved_by_owner' && approverId) {
    updateData.approved_by_owner_id = approverId;
    updateData.approved_by_owner_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  } else if (status === 'rejected' && rejectionReason) {
    updateData.rejection_reason = rejectionReason;
  }

  const { error } = await supabase
    .from('purchase_requests')
    .update(updateData)
    .eq('id', requestId);

  if (error) {
    console.error('Error updating purchase request:', error);
    return false;
  }

  return true;
}

// 파일 업로드 함수
export async function uploadImage(file: File): Promise<UploadResult | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `purchase-images/${fileName}`;

  const { data, error } = await supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || 'employee-purchases')
    .upload(filePath, file);

  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  // 공개 URL 생성
  const { data: urlData } = supabase.storage
    .from(process.env.SUPABASE_STORAGE_BUCKET || 'employee-purchases')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    path: filePath,
  };
}

// 통계 함수들
export async function getStatistics(): Promise<any> {
  // 전체 통계
  const { data: totalStats } = await supabase
    .from('purchase_requests')
    .select('status, total_amount');

  // 월별 통계 (최근 12개월)
  const { data: monthlyStats } = await supabase
    .from('purchase_requests')
    .select('created_at, total_amount')
    .gte('created_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString());

  // 직원별 통계
  const { data: employeeStats } = await supabase
    .from('purchase_requests')
    .select(`
      total_amount,
      employee:employees!employee_id(name)
    `);

  return {
    totalStats: totalStats || [],
    monthlyStats: monthlyStats || [],
    employeeStats: employeeStats || [],
  };
} 