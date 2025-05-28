import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface UseAutoLogoutOptions {
  timeoutMinutes?: number;
  onLogout?: () => void;
  enabled?: boolean;
}

export function useAutoLogout(options: UseAutoLogoutOptions = {}) {
  const {
    timeoutMinutes = 5,
    onLogout,
    enabled = true
  } = options;

  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    try {
      await fetch('/api/employee-purchase/auth/logout', { method: 'POST' });
      if (onLogout) {
        onLogout();
      }
      toast.error('비활성으로 인해 자동 로그아웃되었습니다');
      router.push('/employee-purchase/login');
    } catch (error) {
      console.error('Auto logout error:', error);
      router.push('/employee-purchase/login');
    }
  }, [router, onLogout]);

  const showWarning = useCallback(() => {
    const remainingTime = 60; // 1분 전 경고
    
    // 경고 토스트 표시
    toast.error('1분 후 자동 로그아웃됩니다', {
      duration: remainingTime * 1000,
      id: 'auto-logout-warning'
    });

    // 연장 버튼을 위한 별도 토스트
    toast((t) => (
      `자동 로그아웃 경고: ${remainingTime}초 후 로그아웃됩니다. 계속 사용하려면 화면을 클릭하세요.`
    ), {
      duration: remainingTime * 1000,
      id: 'auto-logout-warning-action'
    });
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();

    // 기존 타이머 클리어
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // 경고 타이머 설정 (로그아웃 1분 전)
    const warningTime = (timeoutMinutes - 1) * 60 * 1000;
    if (warningTime > 0) {
      warningTimeoutRef.current = setTimeout(showWarning, warningTime);
    }

    // 로그아웃 타이머 설정
    timeoutRef.current = setTimeout(logout, timeoutMinutes * 60 * 1000);
  }, [enabled, timeoutMinutes, logout, showWarning]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      // 페이지가 숨겨질 때 (탭 변경, 브라우저 최소화 등)
      // 현재 시간을 저장
      lastActivityRef.current = Date.now();
    } else {
      // 페이지가 다시 보일 때
      const now = Date.now();
      const timeDiff = now - lastActivityRef.current;
      const timeoutMs = timeoutMinutes * 60 * 1000;

      if (timeDiff >= timeoutMs) {
        // 타임아웃 시간이 지났으면 즉시 로그아웃
        logout();
      } else {
        // 남은 시간으로 타이머 재설정
        resetTimer();
      }
    }
  }, [timeoutMinutes, logout, resetTimer]);

  const handleBeforeUnload = useCallback(() => {
    // 브라우저 종료/새로고침 시 로그아웃
    navigator.sendBeacon('/api/employee-purchase/auth/logout', JSON.stringify({}));
  }, []);

  const handlePopState = useCallback((event: PopStateEvent) => {
    // 뒤로가기로 메인 페이지(/)로 이동하는 경우 로그아웃
    if (window.location.pathname === '/') {
      logout();
    }
  }, [logout]);

  useEffect(() => {
    if (!enabled) return;

    // 활동 감지 이벤트들
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // 이벤트 리스너 등록
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // 페이지 가시성 변경 감지
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 브라우저 종료/새로고침 감지
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 뒤로가기 감지
    window.addEventListener('popstate', handlePopState);

    // 초기 타이머 설정
    resetTimer();

    return () => {
      // 클린업
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [enabled, handleActivity, handleVisibilityChange, handleBeforeUnload, handlePopState, resetTimer]);

  return {
    resetTimer,
    logout
  };
} 