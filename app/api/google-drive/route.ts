import { NextResponse, NextRequest } from 'next/server';
import { google } from 'googleapis';
import { Readable } from 'stream';

// 환경 변수 상태 확인
function checkEnvironmentVariables() {
  const requiredVars = {
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID
  };
  
  // 사일런트 체크 (로그 없이 확인만)
  let hasError = false;
  Object.entries(requiredVars).forEach(([name, value]) => {
    if (!value) {
      hasError = true;
    } else if (name === 'GOOGLE_APPLICATION_CREDENTIALS') {
      try {
        // JSON 형식 검증
        JSON.parse(value);
      } catch (err) {
        hasError = true;
      }
    }
  });
  
  return { success: !hasError, error: hasError ? '환경 변수 설정에 문제가 있습니다.' : null };
}

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
    // 환경 변수 간단 검증 (자세한 로그 없이)
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
    
    try {
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
        try {
          buffer = Buffer.from(base64Data, 'base64');
          if (buffer.length === 0) {
            console.error('생성된 버퍼가 비어있습니다.');
            return NextResponse.json({ success: false, message: '이미지 데이터가 잘못되었습니다.' }, { status: 400 });
          }
        } catch (error) {
          console.error('버퍼 생성 오류:', error);
          return NextResponse.json({ 
            success: false, 
            message: '이미지 데이터 변환 실패', 
            error: error instanceof Error ? error.message : '알 수 없는 오류'
          }, { status: 400 });
        }
        
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
          if (typeof data.customerFolderId === 'string' && data.customerFolderId.length > 5) {
            targetFolderId = data.customerFolderId;
            console.log(`고객 폴더 ID 할당: ${targetFolderId}`);
          } else {
            console.warn(`유효하지 않은 고객 폴더 ID (${data.customerFolderId}), 기본 폴더 사용`);
          }
        } else {
          console.log(`고객 폴더 ID 없음, 기본 폴더 사용: ${targetFolderId}`);
        }
      }
      
      console.log(`업로드 정보: 파일명=${fileName}, 대상 폴더=${targetFolderId}`);
  
      // 구글 드라이브 클라이언트 초기화
      const auth = await getAuthClient();
      const drive = google.drive({ version: 'v3', auth });
  
      // 파일 업로드
      console.log(`파일 업로드 시작: 파일명=${fileName}, 폴더=${targetFolderId || '기본 폴더'}`);
      
      // 부모 폴더 설정
      const parents = targetFolderId ? [targetFolderId] : undefined;
      if (!parents) {
        console.log(`상위 폴더 미지정, 기본 드라이브 루트 사용`);
      } else {
        console.log(`상위 폴더 ID: ${parents[0]}`);
      }
      
      const requestBody = {
        name: fileName,
        mimeType: mimeType,
        parents: parents
      };
      
      console.log(`파일 생성 요청: ${JSON.stringify(requestBody, null, 2)}`);
      
      const response = await drive.files.create({
        requestBody: requestBody,
        media: {
          mimeType,
          body: Readable.from(buffer)
        },
        fields: 'id,name,webViewLink'
      });
  
      console.log(`파일 생성 성공: ID=${response.data.id}`);
  
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
    } catch (innerError) {
      console.error('처리 오류:', innerError);
      // 오류 상세 정보 추출
      const errorDetails = innerError instanceof Error 
        ? { message: innerError.message, stack: innerError.stack } 
        : { message: '알 수 없는 오류' };
      
      console.error('상세 오류 정보:', JSON.stringify(errorDetails, null, 2));
      
      return NextResponse.json({ 
        success: false, 
        message: '처리 실패', 
        error: errorDetails.message,
        target: fileName ? {
          fileName,
          folderId: targetFolderId
        } : undefined
      }, { status: 500 });
    }
  } catch (error) {
    console.error('예상치 못한 오류:', error);
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    
    return NextResponse.json({ 
      success: false, 
      message: '치명적인 오류 발생', 
      error: errorMessage 
    }, { status: 500 });
  }
}