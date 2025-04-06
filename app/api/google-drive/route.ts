import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

// 서비스 계정을 사용한 인증 방식
async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    // 환경 변수에서 자동으로 GOOGLE_APPLICATION_CREDENTIALS 경로를 읽어옴
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  return auth;
}

// Base64를 버퍼로 변환하는 함수
async function saveBase64ToBuffer(base64Data: string): Promise<Buffer> {
  // Base64 데이터에서 헤더 제거 (예: "data:image/jpeg;base64,")
  const base64Image = base64Data.split(';base64,').pop() || '';
  // Base64를 Buffer로 변환
  return Buffer.from(base64Image, 'base64');
}

// Buffer를 스트림으로 변환하는 함수
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// 구글 드라이브에 업로드
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // 필수 필드 확인
    if (!data.imageData) {
      return NextResponse.json({ error: '이미지 데이터가 필요합니다.' }, { status: 400 });
    }
    
    // 파일명 설정 (제공된 파일명 또는 생성)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const uniqueId = uuidv4().substring(0, 8);
    const fileName = data.fileName || `symptom_image_${timestamp}_${uniqueId}.jpg`;
    
    // 폴더 ID 확인
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      console.warn('Google Drive 폴더 ID가 설정되지 않았습니다. 루트 폴더에 저장됩니다.');
    }
    
    // Base64 이미지 데이터를 버퍼로 변환
    const fileBuffer = await saveBase64ToBuffer(data.imageData);
    
    // 버퍼를 스트림으로 변환
    const fileStream = bufferToStream(fileBuffer);
    
    // 인증 클라이언트 가져오기
    const auth = await getAuthClient();
    
    // Google Drive API 초기화
    const drive = google.drive({ version: 'v3', auth });
    
    // 구글 드라이브에 파일 업로드
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'image/jpeg',
        parents: folderId ? [folderId] : []
      },
      media: {
        mimeType: 'image/jpeg',
        body: fileStream
      },
      fields: 'id,name,webViewLink,webContentLink'
    });
    
    // 파일을 모두가 볼 수 있도록 권한 설정
    await drive.permissions.create({
      fileId: response.data.id || '',
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    
    // 업로드된 이미지 URL 반환
    return NextResponse.json({
      success: true,
      fileId: response.data.id,
      fileName: response.data.name,
      viewUrl: `https://drive.google.com/uc?export=view&id=${response.data.id}`,
      downloadUrl: response.data.webContentLink,
      // 노션 relation에 사용할 수 있는 ID 명시
      notionRelationId: response.data.id
    });
  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json({ 
      error: '이미지 업로드 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 