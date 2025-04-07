/**
 * 노션 데이터베이스 스키마 정의
 * 
 * 이 파일은 노션 데이터베이스의 스키마를 중앙 집중식으로 관리합니다.
 * 다른 파일에서 스키마를 참조할 때 이 파일을 임포트하여 사용하세요.
 * 노션 DB 구조가 변경될 경우 이 파일만 수정하면 됩니다.
 */

// 고객 데이터베이스 스키마
export const CUSTOMER_SCHEMA = {
  고객명: { type: 'rich_text' },
  전화번호: { type: 'phone_number' },
  성별: { type: 'select' },
  생년월일: { type: 'date' },
  주소: { type: 'rich_text' },
  특이사항: { type: 'rich_text' },
  사진: { type: 'files' },
  얼굴_임베딩: { type: 'rich_text' }  // 얼굴 인식 데이터를 텍스트로 저장
};

// 상담일지 데이터베이스 스키마
export const CONSULTATION_SCHEMA = {
  상담일자: { type: 'date' },
  고객: { type: 'relation' },
  상담내용: { type: 'rich_text' },
  증상이미지: { type: 'files' },
  처방약: { type: 'rich_text' },
  결과: { type: 'rich_text' },
  생성일시: { type: 'created_time' }
};

// 노션 데이터 표시 포맷팅 함수
export const getNotionPropertyValue = (property: any, type: string) => {
  if (!property) return '';
  
  switch (type) {
    case 'rich_text':
      return property.rich_text?.[0]?.text?.content || '';
    case 'title':
      return property.title?.[0]?.text?.content || '';
    case 'phone_number':
      return property.phone_number || '';
    case 'select':
      return property.select?.name || '';
    case 'date':
      return property.date?.start || '';
    case 'files':
      return property.files?.[0]?.file?.url || property.files?.[0]?.external?.url || '';
    case 'relation':
      return property.relation?.[0]?.id || '';
    case 'created_time':
      return property.created_time || '';
    default:
      return '';
  }
};

// 고객 데이터 인터페이스
export interface NotionCustomer {
  id: string;
  properties: {
    고객명: any;
    전화번호: any;
    성별: any;
    생년월일: any;
    주소: any;
    특이사항: any;
    사진?: any;
    얼굴_임베딩?: any;
  };
}

// 상담일지 데이터 인터페이스
export interface NotionConsultation {
  id: string;
  created_time: string; // 노션 페이지 생성 시간 (메타데이터)
  properties: {
    상담일자: any;
    고객: any;
    상담내용: any;
    증상이미지: any;
    처방약: any;
    결과: any;
  };
}

// 노션 클라이언트를 생성할 때 사용하는 환경 변수 이름
export const NOTION_ENV_VARS = {
  API_KEY: 'NOTION_API_KEY',
  CUSTOMER_DB_ID: 'NOTION_CUSTOMER_DB_ID',
  CONSULTATION_DB_ID: 'NOTION_CONSULTATION_DB_ID'
}; 