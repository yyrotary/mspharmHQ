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

    // 요청 유형 확인 (formData 또는 JSON)
    const contentType = req.headers.get('content-type') || '';
    
    // 파일 및 메타데이터 변수
    let fileName = '';
    let buffer: Buffer;
    let mimeType = 'image/jpeg';
    let targetFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    if (contentType.includes('multipart/form-data')) {
      // FormData에서 파일 및 메타데이터 파싱
      console.log('multipart/form-data 요청 처리');
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ success: false, message: '파일이 없습니다.' }, { status: 400 });
      }
      
      fileName = formData.get('fileName') as string || file.name;
      buffer = Buffer.from(await file.arrayBuffer());
      mimeType = file.type;
      
      // 타깃 폴더 - form 데이터에서 전달된 값 또는 기본 폴더 사용
      const customFolderId = formData.get('targetFolderId') as string;
      console.log(`폼 데이터에서 추출한 대상 폴더 ID: ${customFolderId}`);
      if (customFolderId && customFolderId.length > 5) {  // 유효한 ID인지 간단히 체크
        targetFolderId = customFolderId;
      }
    } else {
      // JSON 데이터에서 이미지 및 메타데이터 파싱
      console.log('JSON 요청 처리');
      const data = await req.json();
      
      // Base64 이미지 데이터 확인
      const imageBase64 = data.imageBase64 || data.imageData;
      if (!imageBase64) {
        return NextResponse.json({ success: false, message: '이미지 데이터가 없습니다.' }, { status: 400 });
      }
      
      // Base64 이미지 데이터 처리
      let base64Data = imageBase64;
      if (base64Data.includes(';base64,')) {
        base64Data = base64Data.split(';base64,')[1];
      }
      
      // Buffer 생성
      buffer = Buffer.from(base64Data, 'base64');
      
      // 파일명 설정 (imageIndex 파라미터가 있으면 사용)
      let imageIndex = data.imageIndex || 0;
      if (imageIndex > 0) {
        console.log(`전달받은 이미지 인덱스: ${imageIndex}`);
      }
      
      fileName = data.fileName || 
                (data.consultationId && imageIndex ? 
                  `${data.consultationId}_${imageIndex}.jpg` : 
                  `image_${Date.now()}.jpg`);
      
      console.log(`설정된 파일명: ${fileName}`);
      
      // 고객 폴더 ID 확인
      if (data.customerFolderId) {
        targetFolderId = data.customerFolderId;
        console.log(`고객 폴더 ID 할당: ${targetFolderId}`);
      } else {
        console.log(`고객 폴더 ID 없음, 기본 폴더 사용: ${targetFolderId}`);
      }
    }
    
    console.log(`업로드 정보: 파일명=${fileName}, 대상 폴더=${targetFolderId}`);

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

    // 공개 URL 가져오기
    const webViewLink = response.data.webViewLink;
    
    console.log(`파일 업로드 완료: ${fileName}, ID: ${response.data.id}, URL: ${webViewLink}`);

    return NextResponse.json({
      success: true,
      message: '파일 업로드 성공',
      file: {
        id: response.data.id,
        name: response.data.name,
        link: webViewLink || `https://drive.google.com/file/d/${response.data.id}/view`
      },
      // 이전 호환성을 위한 필드
      fileId: response.data.id
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