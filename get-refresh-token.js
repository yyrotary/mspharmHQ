const { google } = require('googleapis');

// OAuth2 클라이언트 설정
const oauth2Client = new google.auth.OAuth2(
  '790128821978-7leq1g85g94c3hlbmvusd0v22cqj361c.apps.googleusercontent.com',
  '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',
  'http://localhost:3000/api/auth/google/callback'
);

// 인증 URL 생성
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // 항상 동의 화면을 표시하여 refresh_token이 항상 반환되도록 함
  scope: ['https://www.googleapis.com/auth/drive.file']
});

console.log('1. 다음 URL을 브라우저에 복사하여 접속하세요:');
console.log(authUrl);
console.log('\n2. Google 계정으로 로그인하고 권한을 허용하세요.');
console.log('\n3. 리다이렉트된 URL에서 코드 파라미터 값을 복사하세요.');
console.log('   (예: http://localhost:3000/api/auth/google/callback?code=4/0AeaYSHA...의 code= 다음 부분)');
console.log('\n4. 복사한 코드로 다음 명령어를 실행하세요:');
console.log('   node exchange-code.js 복사한코드값'); 