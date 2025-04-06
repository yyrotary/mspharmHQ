const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  '790128821978-7leq1g85g94c3hlbmvusd0v22cqj361c.apps.googleusercontent.com',
  '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',
  'http://localhost:3000/api/auth/google/callback'
);

// 여기에 인증 후 받은 코드를 입력하세요
const code = '여기에_인증_코드_입력';

async function getRefreshToken() {
  const { tokens } = await oauth2Client.getToken(code);
  console.log('리프레시 토큰:', tokens.refresh_token);
}

getRefreshToken();