import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthClient } from '@/app/lib/google-utils';

// 구글 드라이브 폴더 삭제 API
export async function DELETE(request: NextRequest) {
  try {
    const data = await request.json();
    const { folderId } = data;
    
    if (!folderId) {
      return NextResponse.json({ 
        success: false, 
        error: '폴더 ID가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 구글 드라이브 API 초기화
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    
    // 폴더 삭제 (휴지통으로 이동)
    await drive.files.update({
      fileId: folderId,
      requestBody: {
        trashed: true
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '폴더가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('구글 드라이브 폴더 삭제 오류:', error);
    return NextResponse.json({ 
      success: false, 
      error: '폴더 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 