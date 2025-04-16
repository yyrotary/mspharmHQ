/**
 * 노션 데이터베이스 스키마 정의
 * 
 * 이 파일은 노션 데이터베이스의 스키마를 중앙 집중식으로 관리합니다.
 * 다른 파일에서 스키마를 참조할 때 이 파일을 임포트하여 사용하세요.
 * 노션 DB 구조가 변경될 경우 이 파일만 수정하면 됩니다.
 */

// 노션 데이터 타입 정의
export interface NotionText {
  type: string;
  text: {
    content: string;
    link: null | { url: string };
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: null | string;
}

export interface NotionRichTextProperty {
  id: string;
  type: 'rich_text';
  rich_text: { content?: string };
}

export interface NotionTitleProperty {
  id: string;
  name: string;
  type: 'title';
  title: {}; 
}

export interface NotionPhoneNumberProperty {
  id: string;
  name: string;
  type: 'phone_number'; 
  phone_number: {}; 
}

export interface NotionSelectOption {
  id: string;
  name: string;
  color: string;
  description: null | string;
}

export interface NotionSelectProperty {
  id: string;
  name: string;
  type: 'select';
  select: {
    options: NotionSelectOption[];
  };
}

export interface NotionDateProperty {
  id: string;
  name: string;
  type: 'date';
  date: {}; 
}

export interface NotionFilesProperty {
  id: string;
  name: string;
  type: 'files';
  files: {};
}

export interface NotionRelationProperty {
  id: string;
  name: string;
  type: 'relation';
  relation: {
    database_id: string;
    type: string;
    dual_property: {
      synced_property_name: string;
      synced_property_id: string;
    };
  };
}

export interface NotionCreatedTimeProperty {
  id: string;
  name: string;
  type: 'created_time';
  created_time: {};
}

// 고객 데이터베이스 스키마
export const CUSTOMER_SCHEMA = {
  id: { type: 'title' },
  고객명: { type: 'rich_text' },
  전화번호: { type: 'phone_number' },
  성별: { type: 'select' },
  생년월일: { type: 'date' },
  주소: { type: 'rich_text' },
  특이사항: { type: 'rich_text' },
  사진: { type: 'relation' },
  얼굴_임베딩: { type: 'rich_text' },
  상담일지DB: { type: 'relation' },
  customerFolderId: { type: 'rich_text' }
};

// 상담일지 데이터베이스 스키마
export const CONSULTATION_SCHEMA = {
  id: { type: 'title' },
  상담일자: { type: 'date' },
  고객: { type: 'relation' },
  상담내용: { type: 'rich_text' },
  상태분석: { type: 'rich_text' },
  설진분석: { type: 'rich_text' },
  특이사항: { type: 'rich_text' },
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
    id: {
      id: string;
      type: 'title';
      title: Array<NotionText> | [];
    };
    고객명: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    전화번호: {
      id: string;
      type: 'phone_number';
      phone_number: string | null;
    };
    성별: {
      id: string;
      type: 'select';
      select: {
        id: string;
        name: string;
        color: string;
      } | null;
    };
    생년월일: {
      id: string;
      type: 'date';
      date: {
        start: string;
        end: string | null;
        time_zone: string | null;
      } | null;
    };
    주소: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    특이사항: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    사진?: {
      id: string;
      type: 'relation';
      relation: Array<{id: string}> | [];
    };
    얼굴_임베딩?: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    상담일지DB?: {
      id: string;
      type: 'relation';
      relation: Array<{id: string}> | [];
    };
    customerFolderId?: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
  };
}

// 상담일지 데이터 인터페이스
export interface NotionConsultation {
  id: string;
  properties: {
    id: {
      id: string;
      type: 'title';
      title: Array<NotionText> | [];
    };
    상담일자: {
      id: string;
      type: 'date';
      date: {
        start: string;
        end: string | null;
        time_zone: string | null;
      } | null;
    };
    고객: {
      id: string;
      type: 'relation';
      relation: Array<{id: string}> | [];
    };
    상담내용: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    상태분석: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    설진분석: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    특이사항: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    증상이미지: {
      id: string;
      type: 'files';
      files: Array<{
        name: string;
        type: 'external' | 'file';
        external?: { url: string };
        file?: { url: string; expiry_time: string };
      }> | [];
    };
    처방약: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    결과: {
      id: string;
      type: 'rich_text';
      rich_text: Array<NotionText> | [];
    };
    생성일시: {
      id: string;
      type: 'created_time';
      created_time: string;
    };
  };
}

// 노션 클라이언트를 생성할 때 사용하는 환경 변수 이름
export const NOTION_ENV_VARS = {
  API_KEY: 'NOTION_API_KEY',
  CUSTOMER_DB_ID: 'NOTION_CUSTOMER_DB_ID',
  CONSULTATION_DB_ID: 'NOTION_CONSULTATION_DB_ID',
  MASTER_DB_ID: 'NOTION_MASTER_DB_ID'
};

// Master DB 스키마
export const MASTER_DB_SCHEMA = {
  Name: { type: 'title' },
  고객DB: { type: 'relation' },
  고객수: { type: 'formula' }
};

// Master DB 인터페이스
export interface NotionMasterDB {
  id: string;
  properties: {
    Name: {
      id: string;
      type: 'title';
      title: Array<NotionText> | [];
    };
    고객DB: {
      id: string;
      type: 'relation';
      relation: Array<{id: string}> | [];
    };
    고객수: {
      id: string;
      type: 'formula';
      formula: {
        type: 'number';
        number: number;
      };
    };
  };
} 