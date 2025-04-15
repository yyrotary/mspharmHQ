/**
 * 유틸리티 함수 모음
 */

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
  const lastNameMap: Record<string, string> = {
    '김': 'kim', '이': 'lee', '박': 'park', '최': 'choi', '정': 'jung',
    '강': 'kang', '조': 'cho', '윤': 'yoon', '장': 'jang', '임': 'lim',
    '한': 'han', '오': 'oh', '서': 'seo', '신': 'shin', '권': 'kwon',
    '황': 'hwang', '안': 'ahn', '송': 'song', '류': 'ryu', '전': 'jeon',
    '홍': 'hong', '고': 'ko', '문': 'moon', '양': 'yang', '손': 'son',
    '배': 'bae', '조': 'jo', '백': 'baek', '허': 'heo', '유': 'yoo',
    '남': 'nam', '심': 'sim', '노': 'noh', '하': 'ha', '곽': 'kwak',
    '성': 'sung', '차': 'cha', '주': 'joo', '우': 'woo', '구': 'koo',
    '민': 'min', '유': 'yu', '나': 'na', '진': 'jin', '지': 'ji',
    '엄': 'uhm', '채': 'chae', '원': 'won', '천': 'chun', '방': 'bang',
    '공': 'kong', '반': 'ban', '명': 'myung', '석': 'seok', '길': 'gil',
    '여': 'yeo', '추': 'choo', '변': 'byun', '소': 'so', '노': 'roh',
    '위': 'wi', '사': 'sa'
  };
  
  return lastNameMap[lastName] || lastName;
}

/**
 * 한글 이름을 영문 이니셜로 변환합니다.
 * @param firstName 한글 이름 (성 제외)
 * @returns 이름의 첫 자모음을 따서 만든 이니셜
 */
export function koreanFirstNameToInitials(firstName: string): string {
  // 간단한 구현: 첫 번째 문자와 두 번째 문자만 추출
  return firstName.length > 1 
    ? firstName.charAt(0).toLowerCase() + firstName.charAt(1).toLowerCase()
    : firstName.toLowerCase();
}

/**
 * 한글 이름을 기반으로 고객 ID를 생성합니다.
 * 예: "홍길동" -> "honggd"
 * @param fullName 고객 전체 이름
 * @returns 생성된 고객 ID
 */
export function generateCustomerId(fullName: string): string {
  const lastName = getLastName(fullName);
  const firstName = getFirstName(fullName);
  
  const romanLastName = koreanLastNameToRoman(lastName);
  const initials = koreanFirstNameToInitials(firstName);
  
  return `${romanLastName}${initials}`;
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
  const dateShort = formatDateToShort(consultDate);
  return `${customerId}_${dateShort}`;
} 