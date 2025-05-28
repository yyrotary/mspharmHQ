/**
 * 마스터 인증 및 세션 관리 유틸리티
 * 자동 로그아웃, 세션 타임아웃, 사용자 활동 감지 기능 제공
 */

// 세션 설정
const SESSION_TIMEOUT = 3 * 60 * 1000; // 3분 (밀리초)
const STORAGE_KEY = 'master_session';
const LAST_ACTIVITY_KEY = 'master_last_activity';

// 세션 데이터 타입
interface MasterSession {
  isAuthenticated: boolean;
  loginTime: number;
  lastActivity: number;
  userId?: string;
}

// 활동 이벤트 타입
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click'
];

/**
 * 마스터 세션 관리 클래스
 */
export class MasterAuthManager {
  private static instance: MasterAuthManager;
  private timeoutId: NodeJS.Timeout | null = null;
  private activityListeners: (() => void)[] = [];
  private onLogoutCallback?: () => void;

  private constructor() {}

  static getInstance(): MasterAuthManager {
    if (!MasterAuthManager.instance) {
      MasterAuthManager.instance = new MasterAuthManager();
    }
    return MasterAuthManager.instance;
  }

  /**
   * 마스터 로그인 처리
   */
  login(userId?: string): void {
    const session: MasterSession = {
      isAuthenticated: true,
      loginTime: Date.now(),
      lastActivity: Date.now(),
      userId
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    
    this.startActivityMonitoring();
    this.startSessionTimeout();
  }

  /**
   * 마스터 로그아웃 처리
   */
  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    
    this.stopActivityMonitoring();
    this.stopSessionTimeout();
    
    if (this.onLogoutCallback) {
      this.onLogoutCallback();
    }
  }

  /**
   * 현재 인증 상태 확인
   */
  isAuthenticated(): boolean {
    try {
      const sessionData = localStorage.getItem(STORAGE_KEY);
      if (!sessionData) return false;

      const session: MasterSession = JSON.parse(sessionData);
      const now = Date.now();

      // 세션 만료 확인 (3분)
      if (now - session.lastActivity > SESSION_TIMEOUT) {
        this.logout();
        return false;
      }

      return session.isAuthenticated;
    } catch (error) {
      console.error('세션 확인 오류:', error);
      this.logout();
      return false;
    }
  }

  /**
   * 사용자 활동 업데이트
   */
  private updateActivity(): void {
    try {
      const sessionData = localStorage.getItem(STORAGE_KEY);
      if (!sessionData) return;

      const session: MasterSession = JSON.parse(sessionData);
      session.lastActivity = Date.now();
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      
      // 타임아웃 재설정
      this.resetSessionTimeout();
    } catch (error) {
      console.error('활동 업데이트 오류:', error);
    }
  }

  /**
   * 활동 모니터링 시작
   */
  private startActivityMonitoring(): void {
    const activityHandler = () => this.updateActivity();
    
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, activityHandler, true);
      this.activityListeners.push(() => {
        document.removeEventListener(event, activityHandler, true);
      });
    });
  }

  /**
   * 활동 모니터링 중지
   */
  private stopActivityMonitoring(): void {
    this.activityListeners.forEach(removeListener => removeListener());
    this.activityListeners = [];
  }

  /**
   * 세션 타임아웃 시작
   */
  private startSessionTimeout(): void {
    this.timeoutId = setTimeout(() => {
      console.log('세션 타임아웃으로 인한 자동 로그아웃');
      this.logout();
    }, SESSION_TIMEOUT);
  }

  /**
   * 세션 타임아웃 중지
   */
  private stopSessionTimeout(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * 세션 타임아웃 재설정
   */
  private resetSessionTimeout(): void {
    this.stopSessionTimeout();
    this.startSessionTimeout();
  }

  /**
   * 로그아웃 콜백 설정
   */
  setLogoutCallback(callback: () => void): void {
    this.onLogoutCallback = callback;
  }

  /**
   * 브라우저 재시작 감지
   */
  checkBrowserRestart(): boolean {
    try {
      const sessionData = localStorage.getItem(STORAGE_KEY);
      const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
      
      if (!sessionData || !lastActivity) return false;

      const session: MasterSession = JSON.parse(sessionData);
      const lastActivityTime = parseInt(lastActivity);
      const now = Date.now();

      // 마지막 활동으로부터 5분 이상 지났으면 브라우저 재시작으로 간주
      if (now - lastActivityTime > 5 * 60 * 1000) {
        console.log('브라우저 재시작 감지로 인한 자동 로그아웃');
        this.logout();
        return true;
      }

      return false;
    } catch (error) {
      console.error('브라우저 재시작 감지 오류:', error);
      this.logout();
      return true;
    }
  }

  /**
   * 세션 정보 가져오기
   */
  getSession(): MasterSession | null {
    try {
      const sessionData = localStorage.getItem(STORAGE_KEY);
      if (!sessionData) return null;
      return JSON.parse(sessionData);
    } catch (error) {
      console.error('세션 정보 가져오기 오류:', error);
      return null;
    }
  }

  /**
   * 남은 세션 시간 (밀리초)
   */
  getRemainingTime(): number {
    const session = this.getSession();
    if (!session) return 0;
    
    const elapsed = Date.now() - session.lastActivity;
    return Math.max(0, SESSION_TIMEOUT - elapsed);
  }
}

/**
 * 편의 함수들
 */
export const masterAuth = MasterAuthManager.getInstance();

export const useMasterAuth = () => {
  return {
    login: (userId?: string) => masterAuth.login(userId),
    logout: () => masterAuth.logout(),
    isAuthenticated: () => masterAuth.isAuthenticated(),
    checkBrowserRestart: () => masterAuth.checkBrowserRestart(),
    setLogoutCallback: (callback: () => void) => masterAuth.setLogoutCallback(callback),
    getRemainingTime: () => masterAuth.getRemainingTime()
  };
}; 