import { NextResponse } from 'next/server';
import { google } from 'googleapis';

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

// 폴더 생성 API
export async function POST(request: Request) {
  try {
    console.log('고객 폴더 생성 시작');
    const data = await request.json();
    
    // 필수 필드 확인
    if (!data.folderName) {
      return NextResponse.json({ 
        success: false,
        error: '폴더 이름이 필요합니다.' 
      }, { status: 400 });
    }
    
    const folderName = data.folderName;
    console.log(`폴더명: ${folderName}`);
    
    // 부모 폴더 ID 확인
    const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!parentFolderId) {
      console.warn('Google Drive 루트 폴더 ID가 설정되지 않았습니다. 루트에 폴더를 생성합니다.');
    } else {
      console.log(`부모 폴더 ID: ${parentFolderId}`);
    }
    
    // 인증 클라이언트 가져오기
    const auth = await getAuthClient();
    
    // Google Drive API 초기화
    const drive = google.drive({ version: 'v3', auth });
    console.log('구글 드라이브 API 초기화 완료');
    
    // 이미 존재하는 폴더인지 확인 (중복 방지)
    let existingFolder;
    try {
      const response = await drive.files.list({
        q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentFolderId ? ` and '${parentFolderId}' in parents` : ''}`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      if (response.data.files && response.data.files.length > 0) {
        existingFolder = response.data.files[0];
        console.log(`이미 존재하는 폴더를 찾았습니다: ${existingFolder.name} (${existingFolder.id})`);
      }
    } catch (error) {
      console.warn('폴더 검색 중 오류 발생:', error);
      // 검색 오류는 무시하고 새 폴더 생성 시도
    }
    
    // 폴더가 이미 존재하면 그 폴더를 반환
    if (existingFolder) {
      return NextResponse.json({
        success: true,
        folderId: existingFolder.id,
        folderName: existingFolder.name,
        message: '이미 존재하는 폴더를 찾았습니다.',
        isNew: false
      });
    }
    
    // 구글 드라이브에 폴더 생성
    console.log('새 폴더 생성 중...');
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : []
    };
    
    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id,name,webViewLink'
    });
    
    const folderId = response.data.id;
    console.log(`폴더 생성 완료, ID: ${folderId}`);
    
    // 폴더를 모두가 볼 수 있도록 권한 설정
    console.log('폴더 권한 설정 중');
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
    console.log('폴더 권한 설정 완료');
    
    // 생성된 폴더 정보 반환
    return NextResponse.json({
      success: true,
      folderId: folderId,
      folderName: folderName,
      folderUrl: response.data.webViewLink,
      message: '새 폴더가 생성되었습니다.',
      isNew: true
    });
  } catch (error: any) {
    console.error('폴더 생성 오류:', error);
    
    return NextResponse.json({ 
      success: false,
      error: '폴더 생성 중 오류가 발생했습니다.',
      details: error.message || '상세 오류 정보 없음'
    }, { status: 500 });
  }
} 