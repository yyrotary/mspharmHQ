const { google } = require('googleapis');

// 명령행 인자에서 인증 코드 가져오기
const authCode = process.argv[2];

if (!authCode) {
  console.error('인증 코드를 입력해주세요.');
  console.error('사용법: node exchange-code.js 인증코드');
  process.exit(1);
}

// OAuth2 클라이언트 설정
const oauth2Client = new google.auth.OAuth2(
  '790128821978-7leq1g85g94c3hlbmvusd0v22cqj361c.apps.googleusercontent.com',
  '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',
  'http://localhost:3000/api/auth/google/callback'
);

async function getRefreshToken() {
  try {
    // 인증 코드를 토큰으로 교환
    const { tokens } = await oauth2Client.getToken(authCode);
    
    if (tokens.refresh_token) {
      console.log('\n리프레시 토큰을 획득했습니다:');
      console.log(tokens.refresh_token);
      console.log('\n.env.local 파일의 GOOGLE_REFRESH_TOKEN 값으로 이 토큰을 설정하세요.');
    } else {
      console.error('\n리프레시 토큰이 반환되지 않았습니다.');
      console.error('Google 계정 설정에서 앱 권한을 취소한 후 다시 시도하세요.');
      console.error('https://myaccount.google.com/permissions');
    }
  } catch (error) {
    console.error('토큰 교환 중 오류 발생:', error.message);
  }
}

getRefreshToken(); 