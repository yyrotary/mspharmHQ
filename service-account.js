const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * 서비스 계정으로 Google Drive API 사용하기
 * 
 * 사용 방법:
 * 1. Google Cloud Console에서 서비스 계정 생성
 * 2. 서비스 계정에 키 생성 (JSON 형식 다운로드)
 * 3. 다운로드한 JSON 파일을 'service-account-key.json'으로 저장
 * 4. 이 스크립트 실행
 */

// 서비스 계정 키 파일 경로
const keyFilePath = path.join(__dirname, 'service-account-key.json');

if (!fs.existsSync(keyFilePath)) {
  console.error('서비스 계정 키 파일이 없습니다.');
  console.error('다음 단계를 따라 서비스 계정 키를 생성하세요:');
  console.error('1. https://console.cloud.google.com/iam-admin/serviceaccounts 접속');
  console.error('2. 프로젝트 선택 후 "서비스 계정 만들기" 클릭');
  console.error('3. 서비스 계정 세부 정보 입력 후 생성');
  console.error('4. 서비스 계정 선택 > 키 탭 > 키 추가 > 새 키 만들기 > JSON 선택');
  console.error('5. 다운로드된 JSON 파일을 이 스크립트와 같은 위치에 service-account-key.json 이름으로 저장');
  process.exit(1);
}

// Drive API 인증 설정
async function authenticate() {
  // JWT(서비스 계정) 인증 클라이언트 생성
  const auth = new google.auth.GoogleAuth({
    keyFile: keyFilePath,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  const client = await auth.getClient();
  
  // Drive API 초기화
  const drive = google.drive({ version: 'v3', auth: client });

  try {
    // 테스트: 파일 목록 가져오기
    const response = await drive.files.list({
      pageSize: 10,
      fields: 'files(id, name)',
    });

    console.log('인증 성공! Google Drive API에 접근할 수 있습니다.');
    console.log('\n파일 목록 (테스트):');
    response.data.files.forEach(file => {
      console.log(`${file.name} (${file.id})`);
    });

    // .env.local 파일 수정 안내
    console.log('\n.env.local 파일 설정 방법:');
    console.log('1. GOOGLE_APPLICATION_CREDENTIALS 환경 변수를 다음과 같이 설정하세요:');
    console.log(`GOOGLE_APPLICATION_CREDENTIALS="${keyFilePath}"`);
    console.log('\n2. route.ts 파일을 수정하여 서비스 계정 인증 방식을 사용하도록 변경하세요.');

  } catch (error) {
    console.error('인증 실패:', error.message);
  }
}

authenticate(); 