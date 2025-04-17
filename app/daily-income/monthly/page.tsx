'use client';

import { useState, useEffect } from 'react';
import { format, addMonths, parseISO } from 'date-fns';
import Link from 'next/link';

// 원화 포맷 함수
const formatKRW = (value: number) => {
  return new Intl.NumberFormat('ko-KR').format(value);
};

// 통계 데이터 타입 정의
interface DailyData {
  date: string;
  income: number;
  expense: number;
  net: number;
  pos: number;
  diff: number;
}

interface MonthlyStats {
  totalDays: number;
  totalIncome: number;
  totalExpense: number;
  totalNet: number;
  avgIncome: number;
  avgExpense: number;
  avgNet: number;
  maxIncome: { date: string; amount: number };
  minIncome: { date: string; amount: number };
  dailyData: DailyData[];
}

export default function MonthlyStatsPage() {
  const [yearMonth, setYearMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [mode, setMode] = useState<'month' | 'recent' | 'all'>('month');
  const [days, setDays] = useState(31);
  const [period, setPeriod] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // 마스터DB에서 비밀번호 가져오기
  useEffect(() => {
    const fetchPassword = async () => {
      try {
        const response = await fetch('/api/master');
        if (!response.ok) {
          console.error('마스터DB 조회 실패');
          return;
        }
        
        const data = await response.json();
        if (data.success && data.master?.properties?.pass) {
          const passValue = data.master.properties.pass.rich_text?.[0]?.text?.content || '';
          setDbPassword(passValue);
        }
      } catch (error) {
        console.error('비밀번호 조회 오류:', error);
      }
    };
    
    fetchPassword();
  }, []);

  // 비밀번호 확인 함수
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 마스터DB의 pass 속성과 비교
    if (password === dbPassword) {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  // 통계 데이터 가져오기
  const fetchStats = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setMessage('');
      
      let url = '/api/daily-income/monthly?mode=' + mode;
      
      // 모드에 따라 파라미터 추가
      if (mode === 'month' && yearMonth) {
        url += `&yearMonth=${yearMonth}`;
      } else if (mode === 'recent') {
        url += `&days=${days}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        // HTTP 오류 처리
        const errorData = await response.json().catch(() => ({ error: '응답을 파싱할 수 없습니다' }));
        throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setStats(result.stats);
        setPeriod(result.period || '');
      } else {
        setMessage(`데이터 조회 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('통계 조회 오류:', error);
      setMessage(`통계 조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // 인증 상태나 선택된 모드, 월, 일수가 변경될 때 통계 데이터 가져오기
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
    }
  }, [mode, yearMonth, days, isAuthenticated]);

  // 이전 달로 이동
  const goToPreviousMonth = () => {
    try {
      const currentDate = parseISO(`${yearMonth}-01`);
      const newDate = addMonths(currentDate, -1);
      setYearMonth(format(newDate, 'yyyy-MM'));
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      setMessage('날짜 형식이 올바르지 않습니다.');
    }
  };

  // 다음 달로 이동
  const goToNextMonth = () => {
    try {
      const currentDate = parseISO(`${yearMonth}-01`);
      const newDate = addMonths(currentDate, 1);
      setYearMonth(format(newDate, 'yyyy-MM'));
    } catch (error) {
      console.error('날짜 변환 오류:', error);
      setMessage('날짜 형식이 올바르지 않습니다.');
    }
  };

  // 로그아웃 함수
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };

  // 현재 표시할 일별 데이터
  const getPaginatedData = () => {
    if (!stats?.dailyData) return [];
    
    // 현재 모드에 맞는 데이터 필터링
    let filteredData = [...stats.dailyData];
    
    // 페이지네이션 적용
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredData.slice(startIndex, endIndex);
  };
  
  // 총 페이지 수 계산
  const totalPages = stats?.dailyData 
    ? Math.ceil(stats.dailyData.length / rowsPerPage) 
    : 0;
  
  // 다음 페이지로 이동
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  // 이전 페이지로 이동
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // 비밀번호 입력 화면 렌더링
  if (!isAuthenticated) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '1rem',
        backgroundColor: '#f3f4f6'
      }}>
        <div style={{ 
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          padding: '2rem',
          width: '100%',
          maxWidth: '24rem',
          textAlign: 'center'
        }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 'bold', 
            marginBottom: '1.5rem',
            color: '#1e40af'
          }}>
            월별 통계
          </h1>
          
          <p style={{ marginBottom: '1.5rem', color: '#4b5563' }}>
            이 페이지는 비밀번호로 보호되어 있습니다.
          </p>
          
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                style={{ 
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #d1d5db',
                  marginBottom: '0.5rem'
                }}
                autoFocus
              />
              
              {passwordError && (
                <p style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {passwordError}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              style={{ 
                width: '100%',
                backgroundColor: '#8b5cf6',
                color: 'white',
                fontWeight: 'bold',
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              확인
            </button>
          </form>
          
          <div style={{ marginTop: '1.5rem' }}>
            <Link 
              href="/"
              style={{ 
                color: '#6b7280',
                textDecoration: 'none',
                fontSize: '0.875rem'
              }}
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '1000px', 
      margin: '0 auto', 
      padding: '1rem',
      fontFamily: 'sans-serif'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>
          수입/지출 통계
        </h1>
        
        <div>
          <button
            onClick={handleLogout}
            style={{
              backgroundColor: '#f3f4f6',
              color: '#4b5563',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            로그아웃
          </button>
          
          <Link 
            href="/daily-income"
            style={{
              backgroundColor: '#e0e7ff',
              color: '#3730a3',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              textDecoration: 'none',
              marginLeft: '0.5rem',
              display: 'inline-block'
            }}
          >
            일일 관리로
          </Link>
          
          <Link 
            href="/"
            style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              textDecoration: 'none',
              marginLeft: '0.5rem',
              display: 'inline-block'
            }}
          >
            홈으로
          </Link>
        </div>
      </div>
      
      {/* 모드 선택 탭 */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '1rem'
      }}>
        <button 
          onClick={() => setMode('month')}
          style={{ 
            padding: '0.75rem 1rem',
            backgroundColor: mode === 'month' ? '#e0e7ff' : 'transparent',
            color: mode === 'month' ? '#1e40af' : '#6b7280',
            fontWeight: mode === 'month' ? 'bold' : 'normal',
            border: 'none',
            borderBottom: mode === 'month' ? '2px solid #1e40af' : 'none',
            cursor: 'pointer'
          }}
        >
          월별 통계
        </button>
        <button 
          onClick={() => setMode('recent')}
          style={{ 
            padding: '0.75rem 1rem',
            backgroundColor: mode === 'recent' ? '#e0e7ff' : 'transparent',
            color: mode === 'recent' ? '#1e40af' : '#6b7280',
            fontWeight: mode === 'recent' ? 'bold' : 'normal',
            border: 'none',
            borderBottom: mode === 'recent' ? '2px solid #1e40af' : 'none',
            cursor: 'pointer'
          }}
        >
          최근 {days}일 통계
        </button>
        <button 
          onClick={() => setMode('all')}
          style={{ 
            padding: '0.75rem 1rem',
            backgroundColor: mode === 'all' ? '#e0e7ff' : 'transparent',
            color: mode === 'all' ? '#1e40af' : '#6b7280',
            fontWeight: mode === 'all' ? 'bold' : 'normal',
            border: 'none',
            borderBottom: mode === 'all' ? '2px solid #1e40af' : 'none',
            cursor: 'pointer'
          }}
        >
          전체 통계
        </button>
      </div>
      
      {/* 모드별 컨트롤 */}
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        marginBottom: '1.5rem'
      }}>
        {mode === 'month' && (
          <>
            <button 
              onClick={goToPreviousMonth}
              style={{ 
                backgroundColor: '#e0e7ff',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                cursor: 'pointer'
              }}
            >
              ◀
            </button>
            
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              style={{ 
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
            
            <button 
              onClick={goToNextMonth}
              style={{ 
                backgroundColor: '#e0e7ff',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                cursor: 'pointer'
              }}
            >
              ▶
            </button>
          </>
        )}
        
        {mode === 'recent' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#4b5563' }}>
              일수:
            </label>
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 31)}
              style={{ 
                width: '5rem',
                padding: '0.5rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem'
              }}
            />
            <button
              onClick={() => fetchStats()}
              style={{ 
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              조회
            </button>
          </div>
        )}
      </div>

      <h2 style={{ 
        fontSize: '1.25rem', 
        fontWeight: 'bold', 
        color: '#1e40af',
        marginBottom: '1rem',
        textAlign: 'center'
      }}>
        {mode === 'month' ? `${yearMonth} 통계` : 
         mode === 'recent' ? `최근 ${days}일 통계` : 
         '전체 데이터 통계'}
        {period && ` (${period})`}
      </h2>
      
      {message && (
        <div style={{ 
          backgroundColor: message.includes('오류') ? '#fee2e2' : '#dcfce7',
          color: message.includes('오류') ? '#b91c1c' : '#166534',
          padding: '0.75rem',
          borderRadius: '0.375rem',
          marginBottom: '1rem',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          데이터를 불러오는 중입니다...
        </div>
      ) : stats ? (
        <div>
          {/* 요약 통계 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <StatCard title="총 수입" value={formatKRW(stats.totalIncome)} bgColor="#e0f2fe" textColor="#0369a1" />
            <StatCard title="총 지출" value={formatKRW(stats.totalExpense)} bgColor="#fef3c7" textColor="#92400e" />
            <StatCard title="순이익" value={formatKRW(stats.totalNet)} bgColor="#d1fae5" textColor="#047857" />
            
            <StatCard title="일 평균 수입" value={formatKRW(Math.round(stats.avgIncome))} bgColor="#dbeafe" textColor="#1e40af" />
            <StatCard title="일 평균 지출" value={formatKRW(Math.round(stats.avgExpense))} bgColor="#fee2e2" textColor="#b91c1c" />
            <StatCard title="일 평균 순이익" value={formatKRW(Math.round(stats.avgNet))} bgColor="#dcfce7" textColor="#166534" />
            
            <StatCard 
              title="최고 수입일" 
              value={`${stats.maxIncome.date.substring(5)} (${formatKRW(stats.maxIncome.amount)})`} 
              bgColor="#e0e7ff" 
              textColor="#3730a3" 
            />
            <StatCard 
              title="최저 수입일" 
              value={`${stats.minIncome.date ? stats.minIncome.date.substring(5) : 'N/A'} (${formatKRW(stats.minIncome.amount)})`} 
              bgColor="#ede9fe" 
              textColor="#5b21b6" 
            />
            <StatCard 
              title="기록된 일수" 
              value={`${stats.totalDays}일`} 
              bgColor="#f3f4f6" 
              textColor="#1f2937" 
            />
          </div>
          
          {/* 일별 데이터 테이블 */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '1rem',
              fontSize: '0.875rem'
            }}>
              <thead>
                <tr style={{ 
                  backgroundColor: '#f3f4f6',
                  color: '#1f2937',
                  fontWeight: 'bold',
                  textAlign: 'right'
                }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>날짜</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>수입</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>지출</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>순이익</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>POS</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>차이</th>
                  <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {getPaginatedData().map((day, index) => (
                  <tr key={index} style={{ 
                    backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                    textAlign: 'right'
                  }}>
                    <td style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <Link 
                        href={`/daily-income?date=${day.date}`}
                        style={{ 
                          color: '#1e40af', 
                          textDecoration: 'none',
                          fontWeight: 'bold'
                        }}
                      >
                        {day.date.substring(5)}
                      </Link>
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>{formatKRW(day.income)}</td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>{formatKRW(day.expense)}</td>
                    <td style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid #e5e7eb',
                      color: day.net >= 0 ? '#047857' : '#b91c1c'
                    }}>
                      {formatKRW(day.net)}
                    </td>
                    <td style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb' }}>{formatKRW(day.pos)}</td>
                    <td style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid #e5e7eb',
                      color: day.diff >= 0 ? '#047857' : '#b91c1c'
                    }}>
                      {formatKRW(day.diff)}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid #e5e7eb',
                      color: day.diff >= 0 ? '#047857' : '#b91c1c',
                      fontWeight: 'bold'
                    }}>
                      {day.diff >= 0 ? '적정' : '부적정'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* 페이지네이션 컨트롤 */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '0.5rem',
                marginTop: '1rem'
              }}>
                <button 
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  style={{ 
                    padding: '0.5rem', 
                    borderRadius: '0.25rem', 
                    border: 'none', 
                    backgroundColor: currentPage === 1 ? '#e5e7eb' : '#e0e7ff',
                    color: currentPage === 1 ? '#9ca3af' : '#1e40af',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  이전
                </button>
                <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                  {currentPage} / {totalPages} 페이지
                </span>
                <button 
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  style={{ 
                    padding: '0.5rem', 
                    borderRadius: '0.25rem', 
                    border: 'none', 
                    backgroundColor: currentPage === totalPages ? '#e5e7eb' : '#e0e7ff',
                    color: currentPage === totalPages ? '#9ca3af' : '#1e40af',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  다음
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '2rem', 
          backgroundColor: '#f9fafb',
          borderRadius: '0.5rem',
          color: '#6b7280' 
        }}>
          {yearMonth}에 대한 데이터가 없습니다.
        </div>
      )}
    </div>
  );
}

// 통계 카드 컴포넌트
function StatCard({ title, value, bgColor, textColor }: { title: string, value: string, bgColor: string, textColor: string }) {
  return (
    <div style={{ 
      backgroundColor: bgColor,
      padding: '1rem',
      borderRadius: '0.5rem',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ 
        fontSize: '0.875rem',
        fontWeight: 'normal',
        color: textColor,
        marginBottom: '0.5rem',
        opacity: 0.8
      }}>
        {title}
      </h3>
      <p style={{ 
        fontSize: '1.25rem',
        fontWeight: 'bold',
        color: textColor,
        margin: 0
      }}>
        {value}
      </p>
    </div>
  );
} 