import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabase-admin';

// GET: 생활 기록 조회
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get('customerId');
    const date = searchParams.get('date');
    const type = searchParams.get('type');

    if (!customerId) {
      return NextResponse.json({ success: false, error: '고객 ID가 필요합니다' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('lifestyle_records')
      .select('*')
      .eq('customer_id', customerId)
      .order('recorded_at', { ascending: false });

    if (date) {
      // 특정 날짜의 기록만 조회
      const startOfDay = `${date}T00:00:00`;
      const endOfDay = `${date}T23:59:59`;
      query = query
        .gte('recorded_at', startOfDay)
        .lte('recorded_at', endOfDay);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data: records, error } = await query.limit(100);

    if (error) {
      console.error('Lifestyle records fetch error:', error);
      return NextResponse.json({ success: false, error: '기록 조회 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, records });
  } catch (error) {
    console.error('Lifestyle GET error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

// POST: 생활 기록 추가
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, type, value, notes } = body;

    if (!customerId || !type || value === undefined) {
      return NextResponse.json(
        { success: false, error: '필수 필드가 누락되었습니다' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('lifestyle_records')
      .insert({
        customer_id: customerId,
        type,
        value,
        notes,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Lifestyle record insert error:', error);
      return NextResponse.json({ success: false, error: '기록 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Lifestyle POST error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

// PUT: 생활 기록 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, value, notes } = body;

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: '기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (value !== undefined) updateData.value = value;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabaseAdmin
      .from('lifestyle_records')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single();

    if (error) {
      console.error('Lifestyle record update error:', error);
      return NextResponse.json({ success: false, error: '기록 수정 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (error) {
    console.error('Lifestyle PUT error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

// DELETE: 생활 기록 삭제
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json(
        { success: false, error: '기록 ID가 필요합니다' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('lifestyle_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Lifestyle record delete error:', error);
      return NextResponse.json({ success: false, error: '기록 삭제 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lifestyle DELETE error:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}




