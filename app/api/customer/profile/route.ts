import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

// GET: 고객 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ success: false, error: '고객 ID가 필요합니다' }, { status: 400 });
    }

    const { data: customer, error } = await supabaseAdmin
      .from('customers')
      .select('id, customer_code, name, phone, address, birth_date, health_conditions, custom_alerts, created_at')
      .eq('id', customerId)
      .single();

    if (error || !customer) {
      return NextResponse.json({ success: false, error: '고객을 찾을 수 없습니다' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      customer: {
        ...customer,
        health_conditions: customer.health_conditions || [],
        custom_alerts: customer.custom_alerts || []
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ success: false, error: '프로필 조회 실패' }, { status: 500 });
  }
}

// PUT: 고객 프로필 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, health_conditions, custom_alerts, phone, address } = body;

    if (!customerId) {
      return NextResponse.json({ success: false, error: '고객 ID가 필요합니다' }, { status: 400 });
    }

    const updateData: any = {};
    if (health_conditions !== undefined) updateData.health_conditions = health_conditions;
    if (custom_alerts !== undefined) updateData.custom_alerts = custom_alerts;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const { data, error } = await supabaseAdmin
      .from('customers')
      .update(updateData)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('Profile update error:', error);
      return NextResponse.json({ success: false, error: '프로필 업데이트 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, customer: data });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: '프로필 업데이트 실패' }, { status: 500 });
  }
}




