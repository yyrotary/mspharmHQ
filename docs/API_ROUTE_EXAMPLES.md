// API Route 예시 - 직원 구매 장부 시스템
// 이 파일은 RLS 대신 API 레벨에서 권한을 검증하는 방법을 보여줍니다.

import { NextRequest, NextResponse } from 'next/server';
import { 
  requireAuth, 
  checkPermission, 
  withPermission,
  getCurrentUser 
} from '@/app/lib/employee-purchase/auth';
import { 
  getPurchaseRequests, 
  createPurchaseRequest, 
  approvePurchaseRequest 
} from '@/app/lib/employee-purchase/supabase';

// 예시 1: 구매 요청 목록 조회
// GET /api/employee-purchase/requests
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 권한에 따른 필터링
    let filters: any = {};
    
    // 일반 직원은 자신의 요청만 볼 수 있음
    if (user.role === 'staff') {
      filters.employee_id = user.id;
    }
    // 관리자와 약국장은 모든 요청을 볼 수 있음
    
    const { data, count } = await getPurchaseRequests(filters);
    
    return NextResponse.json({
      success: true,
      data,
      total: count,
    });
  } catch (error) {
    console.error('Error fetching requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 예시 2: 새 구매 요청 생성
// POST /api/employee-purchase/requests
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    
    const body = await request.json();
    const { totalAmount, imageUrls, notes } = body;

    // 유효성 검사
    if (!totalAmount || !imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 구매 요청 생성
    const purchaseRequest = await createPurchaseRequest(
      user.id,
      totalAmount,
      imageUrls,
      notes
    );

    return NextResponse.json({
      success: true,
      data: purchaseRequest,
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 예시 3: 구매 요청 승인
// PUT /api/employee-purchase/requests/[id]/approve
export async function approveRequest(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const { id } = params;

    // 승인할 요청 정보 가져오기
    const { data: requests } = await getPurchaseRequests({
      status: 'pending',
    });
    
    const targetRequest = requests.find(r => r.id === id);
    if (!targetRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // 권한 검증
    const hasPermission = await checkPermission(
      user,
      'APPROVE_REQUEST',
      targetRequest
    );
    
    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 승인 처리
    await approvePurchaseRequest(id, user.id);

    return NextResponse.json({
      success: true,
      message: 'Request approved successfully',
    });
  } catch (error) {
    console.error('Error approving request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 예시 4: withPermission 래퍼 사용
// GET /api/employee-purchase/statistics
export const getStatistics = withPermission(
  'VIEW_STATISTICS',
  undefined
)(async (req: any, res: any) => {
  // req.user에 인증된 사용자 정보가 자동으로 포함됨
  const { user } = req;
  
  // 통계 데이터 조회 로직
  const statistics = await getPurchaseStatistics();
  
  return res.json({
    success: true,
    data: statistics,
  });
});

// 예시 5: 리소스 기반 권한 검증
// DELETE /api/employee-purchase/requests/[id]
export const deleteRequest = withPermission(
  'DELETE_REQUEST',
  async (req) => {
    // 삭제할 요청 정보를 가져와서 권한 검증에 사용
    const { id } = req.query;
    const { data } = await getPurchaseRequests({ id });
    return data[0];
  }
)(async (req: any, res: any) => {
  const { resource } = req; // 위에서 가져온 요청 정보
  
  // 자신의 요청만 삭제 가능 (pending 상태일 때만)
  if (resource.status !== 'pending') {
    return res.status(400).json({
      error: 'Can only delete pending requests',
    });
  }
  
  // 삭제 로직
  await supabaseAdmin
    .from('purchase_requests')
    .delete()
    .eq('id', resource.id);
  
  return res.json({
    success: true,
    message: 'Request deleted successfully',
  });
});

/**
 * API 보안 체크리스트:
 * 
 * 1. 모든 엔드포인트에서 인증 확인 (getCurrentUser 또는 requireAuth)
 * 2. 권한 검증 (checkPermission 또는 withPermission)
 * 3. 입력 데이터 유효성 검사
 * 4. 에러 처리 및 적절한 HTTP 상태 코드 반환
 * 5. 민감한 정보 로깅 방지
 * 6. Rate limiting 적용 (프로덕션)
 * 7. CORS 설정 (필요한 경우)
 */
