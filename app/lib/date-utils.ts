/**
 * 상담일지 날짜 처리 유틸리티 (날짜만 처리, 시간 정보 없음)
 * 타임존 문제를 근본적으로 해결하기 위해 DATE만 사용
 */

/**
 * 현재 한국(서울) 기준 날짜를 YYYY-MM-DD 형식으로 반환
 * 타임존 문제 없이 순수한 날짜만 반환
 */
export function getCurrentKoreaDate(): string {
  const now = new Date();
  // 한국 시간대 기준으로 날짜 계산
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  
  const year = koreaTime.getFullYear();
  const month = String(koreaTime.getMonth() + 1).padStart(2, '0');
  const day = String(koreaTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 정규화
 * 입력된 날짜가 어떤 형식이든 안전하게 YYYY-MM-DD로 변환
 */
export function normalizeDate(date: Date | string): string {
  try {
    if (typeof date === 'string') {
      // 이미 YYYY-MM-DD 형식이면 그대로 반환
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // 다른 형식이면 Date 객체로 변환 후 처리
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date string');
      }
      date = dateObj;
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
    
  } catch (error) {
    console.error('날짜 정규화 오류:', error);
    // 오류 시 현재 한국 날짜 반환
    return getCurrentKoreaDate();
  }
}

/**
 * 날짜 범위 검증 (순수한 날짜만, 타임존 고려 없음)
 * @param date - 검증할 날짜 (YYYY-MM-DD 형식)
 * @param minYear - 최소 연도 (기본값: 1900)
 * @param maxYearsFromNow - 현재로부터 최대 연수 (기본값: 2)
 * @returns 검증 결과 객체
 */
export function validateDateRange(
  date: string, 
  minYear: number = 1900, 
  maxYearsFromNow: number = 2
): { isValid: boolean; error?: string } {
  try {
    // YYYY-MM-DD 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { isValid: false, error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' };
    }
    
    const [year, month, day] = date.split('-').map(Number);
    
    // 기본적인 날짜 유효성 검사
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || 
        dateObj.getMonth() !== month - 1 || 
        dateObj.getDate() !== day) {
      return { isValid: false, error: '존재하지 않는 날짜입니다.' };
    }
    
    // 최소 연도 체크
    if (year < minYear) {
      return { isValid: false, error: `날짜는 ${minYear}년 이후여야 합니다.` };
    }
    
    // 최대 날짜 체크 (현재 한국 날짜 기준)
    const currentDate = getCurrentKoreaDate();
    const currentYear = parseInt(currentDate.split('-')[0]);
    const maxYear = currentYear + maxYearsFromNow;
    
    if (year > maxYear) {
      return { isValid: false, error: `날짜는 현재로부터 ${maxYearsFromNow}년 이내여야 합니다.` };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return { isValid: false, error: '날짜 검증 중 오류가 발생했습니다.' };
  }
}

/**
 * 날짜를 한국어 표시용 문자열로 포맷 (날짜만, 시간 없음)
 * @param date - 포맷할 날짜 (YYYY-MM-DD 형식)
 * @returns 한국어 형식 날짜 문자열
 */
export function formatKoreaDate(date: string): string {
  try {
    // YYYY-MM-DD 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return '날짜 없음';
    }
    
    const [year, month, day] = date.split('-');
    return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
    
  } catch (error) {
    console.warn('날짜 포맷팅 오류:', error);
    return '날짜 오류';
  }
}

/**
 * date 입력 필드의 min/max 값 생성 (순수한 날짜만)
 * @param minYear - 최소 연도 (기본값: 1900)
 * @param maxYearsFromNow - 현재로부터 최대 연수 (기본값: 2)
 * @returns min, max 값 객체
 */
export function getDateInputRange(
  minYear: number = 1900, 
  maxYearsFromNow: number = 2
): { min: string; max: string } {
  // 최소값: 지정된 연도의 1월 1일
  const min = `${minYear}-01-01`;
  
  // 최대값: 현재로부터 지정된 연수 후의 12월 31일
  const currentDate = getCurrentKoreaDate();
  const currentYear = parseInt(currentDate.split('-')[0]);
  const maxYear = currentYear + maxYearsFromNow;
  const max = `${maxYear}-12-31`;
  
  return { min, max };
}

/**
 * 현재 한국시간을 반환 (호환성을 위해 유지)
 */
export function getKoreaTime(): Date {
  const now = new Date();
  // 한국 시간대 기준으로 날짜 계산
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return koreaTime;
}

/**
 * 날짜/시간을 한국어 표시용 문자열로 포맷 (호환성을 위해 유지)
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
      timeZone: 'Asia/Seoul',
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