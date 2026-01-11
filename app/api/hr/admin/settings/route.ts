import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

// 설정 조회
export async function GET(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다' },
        { status: 403 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // payroll_settings 테이블에서 설정 조회
    const { data: settings, error } = await supabase
      .from('payroll_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Settings fetch error:', error);
      return NextResponse.json(
        { error: '설정 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: settings || { accountant_email: '' }
    });

  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: '설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// 설정 저장
export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { accountant_email } = body;

    if (!accountant_email) {
      return NextResponse.json(
        { error: '세무사 이메일이 필요합니다' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(accountant_email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // UPSERT로 설정 저장
    const { data, error } = await supabase
      .from('payroll_settings')
      .upsert({
        id: 1, // 단일 설정 레코드
        accountant_email,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Settings save error:', error);
      return NextResponse.json(
        { error: '설정 저장에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      settings: data
    });

  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json(
      { error: '설정 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
