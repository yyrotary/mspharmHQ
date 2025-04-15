import { NextResponse, NextRequest } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

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
        try {
          // JSON 형식 검증
          JSON.parse(value);
          console.log(`✅ 유효한 JSON 형식의 인증 정보가 확인되었습니다.`);
        } catch (err) {
          console.error(`❌ 유효한 JSON 형식이 아닙니다: ${err}`);
          hasError = true;
        }
      }
    }
  });
  
  console.log('================================\n');
  return { success: !hasError, error: hasError ? '환경 변수 설정에 문제가 있습니다.' : null };
}

// 앱 시작 시 환경 변수 진단 실행
checkEnvironmentVariables();

// 인증 클라이언트 생성
async function getAuthClient() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}');
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return auth.getClient();
  } catch (error) {
    console.error('인증 클라이언트 생성 실패:', error);
    throw new Error('Google Drive 인증 실패');
  }
}

// Google Drive 이미지 업로드 API
export async function POST(req: NextRequest) {
  try {
    // 환경 변수 검증
    const envCheck = checkEnvironmentVariables();
    if (!envCheck.success) {
      return NextResponse.json({ 
        success: false, 
        message: envCheck.error || '환경 변수 설정이 올바르지 않습니다.' 
      }, { status: 400 });
    }

    // 이미지 파일과 메타데이터 파싱
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!file) {
      return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });
    }

    // 파일 메타데이터 설정
    const fileName = formData.get('fileName') as string || file.name;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    // 구글 드라이브 클라이언트 초기화
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    // 파일 업로드
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: mimeType,
        parents: targetFolderId ? [targetFolderId] : undefined
      },
      media: {
        mimeType,
        body: Readable.from(buffer)
      },
      fields: 'id,name,webViewLink'
    });

    // 파일 권한 설정 (공개)
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return NextResponse.json({
      success: true,
      message: '파일 업로드 성공',
      file: {
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink
      }
    });
  } catch (error) {
    console.error('파일 업로드 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    
    return NextResponse.json({ 
      success: false, 
      message: '파일 업로드 실패', 
      error: errorMessage 
    }, { status: 500 });
  }
} 