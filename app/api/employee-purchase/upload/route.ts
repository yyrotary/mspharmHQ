import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/app/lib/employee-purchase/auth';
import { uploadImage } from '@/app/lib/employee-purchase/supabase';

export async function POST(request: NextRequest) {
  console.log('=== UPLOAD API CALLED ===');
  try {
    // 인증 확인
    const user = await getCurrentUserFromRequest(request);
    console.log('1. User check:', user ? `${user.name} (${user.role})` : 'null');
    
    if (!user) {
      console.error('Upload: No authenticated user');
      return NextResponse.json(
        { error: '인증이 필요합니다' },
        { status: 401 }
      );
    }

    console.log('2. Parsing formData...');
    const formData = await request.formData();
    const keys = Array.from(formData.keys());
    console.log('3. FormData keys:', keys);
    
    const file = formData.get('file') as File;
    console.log('4. File object:', file ? {
      name: file.name,
      size: file.size,
      type: file.type,
      constructor: file.constructor.name
    } : 'null');

    if (!file) {
      console.error('Upload: No file in formData');
      return NextResponse.json(
        { error: '파일이 없습니다' },
        { status: 400 }
      );
    }

    // 파일 크기 체크 (4MB - Vercel 제한 고려)
    if (file.size > 4 * 1024 * 1024) {
      console.error('Upload: File too large:', file.size);
      return NextResponse.json(
        { error: '파일 크기는 4MB 이하여야 합니다. 이미지를 압축해주세요.' },
        { status: 400 }
      );
    }

    // 이미지 파일 체크
    if (!file.type.startsWith('image/')) {
      console.error('Upload: Invalid file type:', file.type);
      return NextResponse.json(
        { error: '이미지 파일만 업로드 가능합니다' },
        { status: 400 }
      );
    }

    console.log('Upload: Calling uploadImage function...');
    const result = await uploadImage(file);
    console.log('Upload: Result:', result);
    
    if (!result) {
      console.error('Upload: uploadImage returned null');
      return NextResponse.json(
        { error: '파일 업로드에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 