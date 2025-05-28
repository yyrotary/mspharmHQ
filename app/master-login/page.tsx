'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMasterAuth } from '../lib/master-auth';

export default function MasterLoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, checkBrowserRestart, setLogoutCallback } = useMasterAuth();

  useEffect(() => {
    // 브라우저 재시작 감지
    if (checkBrowserRestart()) {
      setError('보안을 위해 다시 로그인해주세요.');
      return;
    }

    // 이미 인증된 경우 대시보드로 리다이렉트
    if (isAuthenticated()) {
      router.push('/master-dashboard');
      return;
    }

    // 로그아웃 콜백 설정
    setLogoutCallback(() => {
      setError('세션이 만료되었습니다. 다시 로그인해주세요.');
      router.push('/master-login');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Supabase에서 owner 권한 확인
      const response = await fetch('/api/employee-purchase/auth/me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, password }),
      });

      const data = await response.json();

      if (data.success && data.user?.role === 'owner') {
        // 마스터 세션 시작
        login(data.user.id);
        
        // 대시보드로 리다이렉트
        router.push('/master-dashboard');
      } else {
        setError('마스터 권한이 없거나 이름/비밀번호가 올바르지 않습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    setError('');
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // 숫자만 입력 허용 (4자리 제한)
    if (/^\d{0,4}$/.test(value)) {
      setPassword(value);
      setError('');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        padding: '2rem',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>
            🔐
          </div>
          <h1 style={{
            fontSize: '1.875rem',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '0.5rem'
          }}>
            마스터 로그인
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            마스터 권한이 필요한 기능입니다
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="이름을 입력하세요"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
              autoFocus
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem'
            }}>
              비밀번호 (4자리)
            </label>
            <input
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="••••"
              maxLength={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                textAlign: 'center',
                letterSpacing: '0.5rem'
              }}
              disabled={loading}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim() || password.length !== 4}
            style={{
              width: '100%',
              backgroundColor: name.trim() && password.length === 4 && !loading ? '#8b5cf6' : '#d1d5db',
              color: 'white',
              fontWeight: 'bold',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: name.trim() && password.length === 4 && !loading ? 'pointer' : 'not-allowed',
              fontSize: '1rem',
              transition: 'all 0.2s'
            }}
          >
            {loading ? '확인 중...' : '로그인'}
          </button>
        </form>

        <div style={{
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <button
            onClick={() => router.push('/')}
            style={{
              color: '#6b7280',
              textDecoration: 'none',
              fontSize: '0.875rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            ← 메인으로 돌아가기
          </button>
        </div>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          color: '#6b7280',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '0.5rem' }}>
            🔒 보안 알림
          </div>
          <div>
            • 3분간 비활성 시 자동 로그아웃<br/>
            • 브라우저 재시작 시 재로그인 필요<br/>
            • 메인 페이지 이동 시 자동 로그아웃
          </div>
        </div>
      </div>
    </div>
  );
} 