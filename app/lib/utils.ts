/**
 * 유틸리티 함수 모음
 */

// Node.js 타입 정의
declare const process: {
  env: {
    [key: string]: string | undefined;
    NEXT_PUBLIC_API_URL?: string;
    VERCEL_URL?: string;
    PORT?: string;
  }
};

/**
 * 한글 이름에서 성(姓)을 추출합니다.
 * @param fullName 전체 이름
 * @returns 성(姓)
 */
export function getLastName(fullName: string): string {
  return fullName.charAt(0);
}

/**
 * 한글 이름에서 이름 부분을 추출합니다.
 * @param fullName 전체 이름
 * @returns 이름 부분
 */
export function getFirstName(fullName: string): string {
  return fullName.substring(1);
}

/**
 * 한글 성(姓)을 로마자로 변환합니다.
 * @param lastName 한글 성(姓)
 * @returns 로마자로 변환된 성
 */
export function koreanLastNameToRoman(lastName: string): string {
  const lastNameMap: {[key: string]: string} = {
    '김': 'kim', '이': 'lee', '박': 'park', '최': 'choi', '정': 'jung',
    '강': 'kang', '조': 'cho', '윤': 'yoon', '장': 'jang', '임': 'lim',
    '한': 'han', '오': 'oh', '서': 'seo', '신': 'shin', '권': 'kwon',
    '황': 'hwang', '안': 'ahn', '송': 'song', '류': 'ryu', '전': 'jeon',
    '홍': 'hong', '고': 'ko', '문': 'moon', '양': 'yang', '손': 'son',
    '배': 'bae', '백': 'baek', '허': 'heo', '유': 'yoo',
    '남': 'nam', '심': 'sim', '노': 'noh', '하': 'ha', '곽': 'kwak',
    '성': 'sung', '차': 'cha', '주': 'joo', '우': 'woo', '구': 'koo',
    '민': 'min', '나': 'na', '진': 'jin', '지': 'ji',
    '엄': 'uhm', '채': 'chae', '원': 'won', '천': 'chun', '방': 'bang',
    '공': 'kong', '반': 'ban', '명': 'myung', '석': 'seok', '길': 'gil',
    '여': 'yeo', '추': 'choo', '변': 'byun', '소': 'so', '위': 'wi', '사': 'sa', '함': 'ham'
  };
  
  return lastNameMap[lastName] || lastName.toLowerCase();
}

/**
 * 한글 이름의 초성을 추출합니다.
 * @param name 한글 이름
 * @returns 각 글자의 초성
 */
export function getInitials(name: string): string {
  // 초성 추출 함수
  const getChoseong = (char: string): string => {
    const code = char.charCodeAt(0);
    
    // 한글 범위 체크 (0xAC00은 '가', 0xD7A3은 '힣')
    if (code >= 0xAC00 && code <= 0xD7A3) {
      // 한글 유니코드 계산식을 사용하여 초성 추출
      const choseongIndex = Math.floor((code - 0xAC00) / 28 / 21);
      
      // 초성 목록 (유니코드 순서)
      const choseongs = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
      
      return choseongs[choseongIndex];
    }
    
    // 한글이 아닌 경우 원래 문자 반환
    return char;
  };
  
  // 초성을 추출하고 로마자로 변환
  const initials = Array.from(name).map(char => getChoseong(char));
  
  // 초성을 로마자로 변환하는 맵
  const initialToRoman: {[key: string]: string} = {
    'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'dd',
    'ㄹ': 'r', 'ㅁ': 'm', 'ㅂ': 'b', 'ㅃ': 'bb', 'ㅅ': 's',
    'ㅆ': 'ss', 'ㅇ': 'i', 'ㅈ': 'j', 'ㅉ': 'jj', 'ㅊ': 'ch',
    'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h'
  };
  
  return initials.map(initial => initialToRoman[initial] || initial.toLowerCase()).join('');
}

/**
 * 한글 이름을 기반으로 고객 ID를 생성합니다.
 * 예: "홍길동" -> "honggd"
 * @param fullName 고객 전체 이름
 * @returns 생성된 고객 ID
 */
export function generateCustomerId(fullName: string): string {
  if (!fullName) return '';
  
  const lastName = getLastName(fullName);
  const firstName = getFirstName(fullName);
  
  // 성을 로마자로 변환
  const romanLastName = koreanLastNameToRoman(lastName);
  
  // 이름의 각 글자 초성을 추출하여 로마자로 변환
  const firstNameInitials = getInitials(firstName);
  
  return `${romanLastName}${firstNameInitials}`.toLowerCase();
}

/**
 * 날짜를 YYMMdd 형식의 문자열로 변환합니다.
 * @param date 날짜 (문자열 또는 Date 객체)
 * @returns YYMMdd 형식의 문자열
 */
export function formatDateToShort(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const year = dateObj.getFullYear().toString().slice(-2);
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  
  return `${year}${month}${day}`;
}

/**
 * 고객 ID와 날짜를 조합하여 상담 ID를 생성합니다.
 * 예: "honggd", "2025-04-15" -> "honggd_250415"
 * @param customerId 고객 ID
 * @param consultDate 상담 날짜
 * @returns 생성된 상담 ID
 */
export function generateConsultationId(customerId: string, consultDate: string): string {
  // customerId가 이미 Notion 페이지 ID인 경우 실제 고객 ID를 찾아야함
  // 페이지 ID 패턴 체크 (UUID 포맷)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // customerId가 UUID 형식이면 'id' 속성 값을 가져와야 함
  if (uuidPattern.test(customerId)) {
    console.warn('상담 ID 생성에 페이지 ID가 사용되었습니다. 고객 ID를 사용해야 합니다.');
    // 여기서는 임시로 'unknown'을 반환
    customerId = 'unknown';
  }
  
  const dateShort = formatDateToShort(consultDate);
  return `${customerId}_${dateShort}`;
}

/**
 * API 호출을 위한 기본 URL을 반환하는 함수
 * 개발 환경에서는 localhost, 프로덕션 환경에서는 실제 도메인을 사용
 */
export function getApiBaseUrl() {
  // 환경 변수에서 URL을 가져오거나 기본값으로 localhost 사용
  const baseUrl = process.env.NEXT_PUBLIC_API_URL
  
  if (baseUrl) {
    return baseUrl;
  }
    
  // 기본 개발 환경 URL
  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}