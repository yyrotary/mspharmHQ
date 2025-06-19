/**
 * 한국시간(KST) 기준 날짜 처리 유틸리티
 * 모든 날짜 처리는 한국시간 기준으로 통일
 */

// 한국 시간대 상수
export const KOREA_TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국시간을 반환
 */
export function getKoreaTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: KOREA_TIMEZONE }));
}

/**
 * 한국시간 기준으로 날짜를 ISO 문자열로 변환
 * @param date - 변환할 날짜 (Date 객체 또는 문자열)
 * @returns ISO 형식 문자열 (한국시간 기준)
 */
export function toKoreaISOString(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // 한국시간으로 변환
  const koreaTime = new Date(dateObj.toLocaleString('en-US', { timeZone: KOREA_TIMEZONE }));
  
  return koreaTime.toISOString();
}

/**
 * datetime-local 입력 필드용 한국시간 형식으로 변환
 * @param date - 변환할 날짜
 * @returns YYYY-MM-DDTHH:mm 형식 문자열
 */
export function toKoreaDateTimeLocal(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // 한국시간으로 변환
  const koreaTime = new Date(dateObj.toLocaleString('en-US', { timeZone: KOREA_TIMEZONE }));
  
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getDate()).padStart(2, '0');
  const hours = String(koreaTime.getHours()).padStart(2, '0');
  const minutes = String(koreaTime.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * 한국시간 기준으로 날짜 범위 검증
 * @param date - 검증할 날짜
 * @param minYear - 최소 연도 (기본값: 1900)
 * @param maxYearsFromNow - 현재로부터 최대 연수 (기본값: 1)
 * @returns 검증 결과 객체
 */
export function validateKoreaDateRange(
  date: Date | string, 
  minYear: number = 1900, 
  maxYearsFromNow: number = 1
): { isValid: boolean; error?: string } {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return { isValid: false, error: '유효하지 않은 날짜 형식입니다.' };
    }
    
    // 한국시간 기준으로 변환
    const koreaTime = new Date(dateObj.toLocaleString('en-US', { timeZone: KOREA_TIMEZONE }));
    const currentKoreaTime = getKoreaTime();
    
    // 최소 날짜 체크
    const minDate = new Date(minYear, 0, 1);
    if (koreaTime < minDate) {
      return { isValid: false, error: `날짜는 ${minYear}년 이후여야 합니다.` };
    }
    
    // 최대 날짜 체크
    const maxDate = new Date(currentKoreaTime);
    maxDate.setFullYear(maxDate.getFullYear() + maxYearsFromNow);
    
    if (koreaTime > maxDate) {
      return { isValid: false, error: `날짜는 현재로부터 ${maxYearsFromNow}년 이내여야 합니다.` };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { isValid: false, error: '날짜 검증 중 오류가 발생했습니다.' };
  }
}

/**
 * 한국시간 기준으로 날짜를 표시용 문자열로 포맷
 * @param date - 포맷할 날짜
 * @param includeTime - 시간 포함 여부 (기본값: true)
 * @returns 한국어 형식 날짜 문자열
 */
export function formatKoreaDateTime(date: Date | string, includeTime: boolean = true): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj.getTime())) {
      return '날짜 없음';
    }
    
    // 한국시간으로 변환하여 표시
    const options: Intl.DateTimeFormatOptions = {
      timeZone: KOREA_TIMEZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    
    return dateObj.toLocaleString('ko-KR', options);
    
  } catch (error) {
    console.warn('날짜 포맷팅 오류:', error);
    return '날짜 오류';
  }
}

/**
 * datetime-local 입력 필드의 min/max 값을 한국시간 기준으로 생성
 * @param minYear - 최소 연도 (기본값: 1900)
 * @param maxYearsFromNow - 현재로부터 최대 연수 (기본값: 1)
 * @returns min, max 값 객체
 */
export function getKoreaDateTimeLocalRange(
  minYear: number = 1900, 
  maxYearsFromNow: number = 1
): { min: string; max: string } {
  const currentKoreaTime = getKoreaTime();
  
  // 최소값: 지정된 연도의 1월 1일 00:00
  const min = `${minYear}-01-01T00:00`;
  
  // 최대값: 현재로부터 지정된 연수 후
  const maxDate = new Date(currentKoreaTime);
  maxDate.setFullYear(maxDate.getFullYear() + maxYearsFromNow);
  const max = toKoreaDateTimeLocal(maxDate);
  
  return { min, max };
}

/**
 * 현재 한국시간을 datetime-local 형식으로 반환
 * @returns YYYY-MM-DDTHH:mm 형식의 현재 한국시간
 */
export function getCurrentKoreaDateTimeLocal(): string {
  return toKoreaDateTimeLocal(getKoreaTime());
} 