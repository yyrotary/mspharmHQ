import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * Google API 인증 클라이언트를 생성합니다.
 * @returns JWT 인증 클라이언트
 */
export async function getAuthClient(): Promise<JWT> {
  try {
    // 서비스 계정 인증 정보
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    
    // JWT 인증 클라이언트 생성
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.appdata',
        'https://www.googleapis.com/auth/drive.metadata',
      ],
    });
    
    await client.authorize();
    return client;
  } catch (error) {
    console.error('구글 인증 클라이언트 생성 오류:', error);
    throw new Error('구글 인증 클라이언트 생성에 실패했습니다.');
  }
} 