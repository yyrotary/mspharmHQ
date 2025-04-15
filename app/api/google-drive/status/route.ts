import { NextResponse } from 'next/server';
import { google } from 'googleapis';

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
        // JSON 형식 검증
        JSON.parse(value);
        console.log('JSON 형식의 인증 정보가 확인되었습니다.');
      } catch (err) {
        issues.push(`GOOGLE_APPLICATION_CREDENTIALS가 유효한 JSON 형식이 아닙니다: ${err}`);
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
    const credentialsEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!credentialsEnv) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 설정되지 않았습니다.');
    }
    
    let credentials;
    try {
      credentials = JSON.parse(credentialsEnv);
    } catch (error) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS 환경변수가 유효한 JSON 형식이 아닙니다.');
    }
    
    // 인증 객체 생성
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    
    // 인증 클라이언트 가져오기
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