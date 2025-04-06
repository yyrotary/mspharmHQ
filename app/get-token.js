const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  '790128821978-7leq1g85g94c3hlbmvusd0v22cqj361c.apps.googleusercontent.com',
  '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',
  'http://localhost:3000/api/auth/google/callback'
);

// 인증 URL 생성
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive']
});

console.log('다음 URL로 접속하여 인증을 완료하세요:');
console.log(authUrl);
console.log('\n인증 후 리다이렉트된 URL에서 코드 파라미터 값을 복사하세요.');