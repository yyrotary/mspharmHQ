import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';

// 환경 변수 상태 확인
function checkEnvironmentVariables() {
  const requiredVars = {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID
  };
  
  const issues = [];
  
  for (const [name, value] of Object.entries(requiredVars)) {
    if (!value) {
      issues.push(`${name} 환경 변수가 설정되지 않았습니다.`);
    } else if (name === 'GOOGLE_APPLICATION_CREDENTIALS') {
      try {
        if (!fs.existsSync(value)) {
          issues.push(`자격 증명 파일이 존재하지 않습니다: ${value}`);
        }
      } catch (err) {
        issues.push(`자격 증명 파일 확인 중 오류 발생: ${err}`);
      }
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

// 구글 드라이브 연결 확인
async function testGoogleDriveConnection() {
  try {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsPath) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다.');
    }
    
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    
    // 인증 테스트
    const client = await auth.getClient();
    
    // 드라이브 API 연결 테스트
    const drive = google.drive({ version: 'v3', auth });
    
    // 폴더 ID 확인
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (folderId) {
      // 폴더 정보 가져오기 시도
      await drive.files.get({
        fileId: folderId,
        fields: 'id,name'
      });
    }
    
    return { isConnected: true };
  } catch (error: any) {
    const errorMessage = error.message || '알 수 없는 오류';
    const errorCode = error.code || 'UNKNOWN';
    return { 
      isConnected: false, 
      error: errorMessage,
      code: errorCode
    };
  }
}

// 상태 확인 API
export async function GET() {
  try {
    // 환경 변수 확인
    const envCheck = checkEnvironmentVariables();
    
    // 환경 변수에 문제가 있으면 바로 반환
    if (!envCheck.isValid) {
      return NextResponse.json({
        success: false,
        status: 'env_error',
        issues: envCheck.issues,
        message: '환경 변수 설정에 문제가 있습니다.'
      });
    }
    
    // 구글 드라이브 연결 테스트
    const connectionTest = await testGoogleDriveConnection();
    
    if (connectionTest.isConnected) {
      return NextResponse.json({
        success: true,
        status: 'connected',
        message: '구글 드라이브 연결 정상'
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'connection_error',
        error: connectionTest.error,
        code: connectionTest.code,
        message: '구글 드라이브 연결에 실패했습니다.'
      });
    }
  } catch (error: any) {
    console.error('상태 확인 중 오류 발생:', error);
    return NextResponse.json({
      success: false,
      status: 'unknown_error',
      error: error.message || '알 수 없는 오류',
      message: '상태 확인 중 예상치 못한 오류가 발생했습니다.'
    }, { status: 500 });
  }
} 