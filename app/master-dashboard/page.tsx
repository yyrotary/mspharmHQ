'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMasterAuth } from '../lib/master-auth';

export default function MasterDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [remainingTime, setRemainingTime] = useState(0);
  const router = useRouter();
  const { isAuthenticated, logout, getRemainingTime, setLogoutCallback } = useMasterAuth();

  useEffect(() => {
    // 인증 상태 확인
    if (!isAuthenticated()) {
      router.push('/master-login');
      return;
    }

    setLoading(false);

    // 로그아웃 콜백 설정
    setLogoutCallback(() => {
      router.push('/master-login');
    });

    // 남은 시간 업데이트 타이머
    const timer = setInterval(() => {
      const remaining = getRemainingTime();
      setRemainingTime(remaining);
      
      // 세션이 만료되었으면 로그인 페이지로 이동
      if (remaining <= 0) {
        logout();
        router.push('/master-login');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/master-login');
  };

  const handleMainPageClick = () => {
    // 메인 페이지로 이동 시 자동 로그아웃
    logout();
    router.push('/');
  };

  const formatTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔐</div>
          <div>인증 확인 중...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      padding: '1rem'
    }}>
      {/* 상단 헤더 */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '1rem',
        marginBottom: '2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#1f2937',
            margin: 0
          }}>
            🔐 마스터 대시보드
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem',
            margin: '0.25rem 0 0 0'
          }}>
            관리자 전용 시스템
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* 세션 타이머 */}
          <div style={{
            backgroundColor: remainingTime < 60000 ? '#fee2e2' : '#f0f9ff',
            color: remainingTime < 60000 ? '#b91c1c' : '#1e40af',
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 'bold'
          }}>
            ⏱️ {formatTime(remainingTime)}
          </div>
          
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* 수입/지출 관리 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{
                backgroundColor: '#dbeafe',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginRight: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>💰</span>
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  margin: 0
                }}>
                  수입/지출 관리
                </h3>
                <p style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  margin: '0.25rem 0 0 0'
                }}>
                  일일 수입과 지출을 관리합니다
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                href="/daily-income"
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                일일 관리
              </Link>
              <Link
                href="/daily-income/monthly"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                월별 통계
              </Link>
            </div>
          </div>

          {/* MSP Family 구매 관리 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{
                backgroundColor: '#f3e8ff',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginRight: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🛒</span>
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  margin: 0
                }}>
                  MSP Family 구매 관리
                </h3>
                <p style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  margin: '0.25rem 0 0 0'
                }}>
                  직원 구매 승인 및 관리
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link
                href="/employee-purchase/admin"
                style={{
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                승인 관리
              </Link>
              <Link
                href="/employee-purchase/reports"
                style={{
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  flex: 1,
                  textAlign: 'center'
                }}
              >
                통계 보고서
              </Link>
            </div>
          </div>

          {/* 빠른 액세스 */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            padding: '1.5rem',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <div style={{
                backgroundColor: '#fef3c7',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                marginRight: '1rem'
              }}>
                <span style={{ fontSize: '1.5rem' }}>⚡</span>
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  margin: 0
                }}>
                  빠른 액세스
                </h3>
                <p style={{
                  color: '#6b7280',
                  fontSize: '0.875rem',
                  margin: '0.25rem 0 0 0'
                }}>
                  자주 사용하는 기능들
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link
                href="/employee-purchase/manage-employees"
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}
              >
                직원 관리
              </Link>
              <button
                onClick={handleMainPageClick}
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                메인으로 (자동 로그아웃)
              </button>
            </div>
          </div>
        </div>

        {/* 보안 알림 */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '1.5rem',
          marginTop: '2rem',
          border: '1px solid #fbbf24'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <span style={{ fontSize: '1.5rem', marginRight: '0.75rem' }}>🔒</span>
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: '#92400e',
              margin: 0
            }}>
              보안 알림
            </h3>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1rem',
            fontSize: '0.875rem',
            color: '#78350f'
          }}>
            <div>
              <strong>• 자동 로그아웃 조건:</strong><br/>
              - 3분간 비활성 시<br/>
              - 브라우저 재시작 시<br/>
              - 메인 페이지 이동 시
            </div>
            <div>
              <strong>• 보안 권장사항:</strong><br/>
              - 사용 후 반드시 로그아웃<br/>
              - 공용 컴퓨터 사용 금지<br/>
              - 비밀번호 타인 공유 금지
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 