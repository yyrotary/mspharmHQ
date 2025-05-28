import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/app/lib/employee-purchase/auth';
import { 
  createPurchaseRequest, 
  getPurchaseRequestsByEmployee,
  getAllPurchaseRequests 
} from '@/app/lib/employee-purchase/supabase';

// 구매 요청 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { totalAmount, imageUrls, notes } = await request.json();

    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json(
        { error: '올바른 금액을 입력해주세요' },
        { status: 400 }
      );
    }

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: '최소 1개의 이미지가 필요합니다' },
        { status: 400 }
      );
    }

    const purchaseRequest = await createPurchaseRequest(
      user.id,
      totalAmount,
      imageUrls,
      notes
    );

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: '구매 요청 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: purchaseRequest,
    });
  } catch (error) {
    console.error('Create purchase request error:', error);
    return NextResponse.json(
      { error: '구매 요청 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 구매 요청 조회
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status') || undefined;
    const admin = searchParams.get('admin') === 'true';

    let requests;

    // admin=true 파라미터가 있고 manager 이상 권한이면 모든 요청 조회
    if (admin && ['manager', 'owner'].includes(user.role)) {
      requests = await getAllPurchaseRequests(page, limit, status);
    } else {
      // 그 외에는 자신의 요청만 조회
      requests = await getPurchaseRequestsByEmployee(user.id, page, limit);
    }

    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total: requests.length,
      },
    });
  } catch (error) {
    console.error('Get purchase requests error:', error);
    return NextResponse.json(
      { error: '구매 요청 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 