import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// 환경 변수 상태 확인
function checkEnvironmentVariables() {
  const requiredVars = {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID
  };
  
  console.log('\n==== 구글 드라이브 환경 변수 진단 ====');
  
  let hasError = false;
  Object.entries(requiredVars).forEach(([name, value]) => {
    if (!value) {
      console.error(`❌ ${name} 환경 변수가 설정되지 않았습니다.`);
      hasError = true;
    } else {
      console.log(`✅ ${name} = ${value.substring(0, 10)}...`);
      
      // 인증 정보 확인
      if (name === 'GOOGLE_APPLICATION_CREDENTIALS') {
        // JSON 문자열인지 파일 경로인지 확인
        if (value.trim().startsWith('{')) {
          try {
            // JSON 형식 검증
            JSON.parse(value);
            console.log(`✅ 유효한 JSON 형식의 인증 정보가 확인되었습니다.`);
          } catch (err) {
            console.error(`❌ 유효한 JSON 형식이 아닙니다: ${err}`);
            hasError = true;
          }
        } else {
          // 자격 증명 파일 존재 확인
          try {
            if (fs.existsSync(value)) {
              console.log(`✅ 자격 증명 파일이 존재합니다: ${value}`);
            } else {
              console.error(`❌ 자격 증명 파일이 존재하지 않습니다: ${value}`);
              hasError = true;
            }
          } catch (err) {
            console.error(`❌ 자격 증명 파일 확인 중 오류 발생: ${err}`);
            hasError = true;
          }
        }
      }
    }
  });
  
  console.log('================================\n');
  return !hasError;
}

// 앱 시작 시 환경 변수 진단 실행
checkEnvironmentVariables();

// 서비스 계정을 사용한 인증 방식
async function getAuthClient() {
  try {
    // 환경 변수 검증
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다.');
    }
    
    // JSON 문자열 처리
    try {
      const credentials = JSON.parse(credentialsEnv);
      console.log('JSON 형식의 인증 정보를 사용합니다.');
      
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });
      
      // 인증 테스트
      await auth.getClient();
      console.log('구글 인증 성공');
      return auth;
    } catch (error) {
      console.error('JSON 파싱 오류:', error);
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 유효한 JSON 형식이 아닙니다.');
    }
  } catch (error) {
    console.error('구글 인증 오류:', error);
    throw error;
  }
}

// Base64를 버퍼로 변환하는 함수
async function saveBase64ToBuffer(base64Data: string): Promise<Buffer> {
  try {
    // Base64 데이터에서 헤더 제거 (예: "data:image/jpeg;base64,")
    const base64Image = base64Data.includes(';base64,') 
      ? base64Data.split(';base64,').pop() || ''
      : base64Data;
      
    if (!base64Image) {
      throw new Error('유효한 Base64 이미지 데이터가 아닙니다.');
    }
    
    // Base64를 Buffer로 변환
    return Buffer.from(base64Image, 'base64');
  } catch (error) {
    console.error('Base64 변환 오류:', error);
    throw error;
  }
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
  // 디버깅을 위한 변수들
  let fileBuffer: Buffer | null = null;
  let auth: any = null;
  let drive: any = null;
  let fileId: string | null = null;
  
  try {
    console.log('이미지 업로드 시작');
    const data = await request.json();
    
    // 필수 필드 확인
    if (!data.imageData) {
      return NextResponse.json({ 
        success: false,
        error: '이미지 데이터가 필요합니다.' 
      }, { status: 400 });
    }
    
    // 파일명 설정 (제공된 파일명 또는 생성)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
    const uniqueId = uuidv4().substring(0, 8);
    const fileName = data.fileName || `symptom_image_${timestamp}_${uniqueId}.jpg`;
    console.log(`파일명 생성: ${fileName}`);
    
    // 폴더 ID 확인
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) {
      console.warn('Google Drive 폴더 ID가 설정되지 않았습니다. 루트 폴더에 저장됩니다.');
    } else {
      console.log(`폴더 ID: ${folderId}`);
    }
    
    // Base64 이미지 데이터를 버퍼로 변환
    try {
      fileBuffer = await saveBase64ToBuffer(data.imageData);
      console.log(`이미지 버퍼 생성 완료: ${fileBuffer.length} 바이트`);
    } catch (error) {
      return NextResponse.json({ 
        success: false,
        error: '이미지 데이터 처리 중 오류가 발생했습니다. 유효한 이미지인지 확인하세요.' 
      }, { status: 400 });
    }
    
    // 버퍼를 스트림으로 변환
    const fileStream = bufferToStream(fileBuffer);
    
    // 인증 클라이언트 가져오기
    try {
      auth = await getAuthClient();
    } catch (error) {
      return NextResponse.json({ 
        success: false,
        error: '구글 인증에 실패했습니다. 서비스 계정 설정을 확인하세요.' 
      }, { status: 500 });
    }
    
    // Google Drive API 초기화
    drive = google.drive({ version: 'v3', auth });
    console.log('구글 드라이브 API 초기화 완료');
    
    // 구글 드라이브에 파일 업로드
    console.log('파일 업로드 시작');
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
    
    fileId = response.data.id;
    console.log(`파일 업로드 완료, ID: ${fileId}`);
    
    if (!fileId) {
      throw new Error('파일 업로드 후 ID를 받지 못했습니다.');
    }
    
    // 파일을 모두가 볼 수 있도록 권한 설정
    console.log('파일 권한 설정 중');
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    console.log('파일 권한 설정 완료');
    
    // 최종 URL 생성
    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    console.log(`최종 URL: ${viewUrl}`);
    
    // 업로드된 이미지 URL 반환
    return NextResponse.json({
      success: true,
      fileId: fileId,
      fileName: response.data.name,
      viewUrl: viewUrl,
      downloadUrl: response.data.webContentLink,
      // 노션 relation에 사용할 수 있는 ID 명시
      notionRelationId: fileId
    });
  } catch (error: any) {
    console.error('이미지 업로드 오류:', error);
    
    // 오류 메시지 세분화
    let errorMessage = '이미지 업로드 중 오류가 발생했습니다.';
    let statusCode = 500;
    
    if (error.code === 401 || error.code === 403) {
      errorMessage = '구글 드라이브 인증 오류: 권한이 없습니다. 서비스 계정 설정을 확인하세요.';
    } else if (error.code === 404) {
      errorMessage = '구글 드라이브 폴더를 찾을 수 없습니다. 폴더 ID를 확인하세요.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = '구글 드라이브 서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요.';
      statusCode = 503;
    } else if (!fileBuffer) {
      errorMessage = '이미지 데이터 처리 중 오류가 발생했습니다.';
      statusCode = 400;
    } else if (!auth) {
      errorMessage = '구글 인증에 실패했습니다.';
    } else if (!drive) {
      errorMessage = '구글 드라이브 API 초기화에 실패했습니다.';
    } else if (!fileId) {
      errorMessage = '파일 업로드 중 오류가 발생했습니다.';
    }
    
    return NextResponse.json({ 
      success: false,
      error: errorMessage,
      details: error.message || '상세 오류 정보 없음'
    }, { status: statusCode });
  }
} 