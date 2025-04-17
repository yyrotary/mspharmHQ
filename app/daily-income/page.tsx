'use client';

import { useState, useEffect } from 'react';
import { format, addDays, parseISO } from 'date-fns';
import Link from 'next/link';

// 원화 포맷 함수
const formatKRW = (value: string | number) => {
  if (!value && value !== 0) return '';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ko-KR').format(num);
};

// 쉼표 제거 함수
const removeCommas = (value: string) => {
  return value?.replace(/,/g, '') || '';
};

export default function DailyIncomePage() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formData, setFormData] = useState({
    날짜: '',
    cas5: '',
    cas1: '',
    gif: '',
    car1: '',
    car2: '',
    person: '',
    Pos: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // 비밀번호 관련 상태 추가
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  
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

  // 컴포넌트 마운트 시와 날짜 변경 시 데이터 조회
  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [date, isAuthenticated]);
  
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

  // 데이터 조회 함수
  const fetchData = async () => {
    if (!date || !isAuthenticated) return;
    
    try {
      setLoading(true);
      setMessage('');
      
      const response = await fetch(`/api/daily-income?date=${date}`);
      
      if (!response.ok) {
        // HTTP 오류 처리
        const errorData = await response.json().catch(() => ({ error: '응답을 파싱할 수 없습니다' }));
        throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.data) {
        // 노션 API 응답 형식에 따라 데이터 추출
        const pageData = result.data.properties;
        
        // 데이터를 가져올 때 바로 포맷팅 적용
        setFormData({
          날짜: date,
          cas5: formatKRW(pageData['cas5']?.number || 0),
          cas1: formatKRW(pageData['cas1']?.number || 0),
          gif: formatKRW(pageData['gif']?.number || 0),
          car1: formatKRW(pageData['car1']?.number || 0),
          car2: formatKRW(pageData['car2']?.number || 0),
          person: formatKRW(pageData['person']?.number || 0),
          Pos: formatKRW(pageData['Pos']?.number || 0),
        });
      } else {
        // 새 데이터 입력을 위해 폼 초기화
        setFormData({
          날짜: date,
          cas5: '',
          cas1: '',
          gif: '',
          car1: '',
          car2: '',
          person: '',
          Pos: '',
        });
      }
    } catch (error) {
      console.error('데이터 조회 오류:', error);
      setMessage(`데이터 조회 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
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
            수입/지출 관리
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

  // 데이터 저장 함수
  const saveData = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!date) {
      setMessage('날짜를 선택해주세요.');
      return;
    }
    
    try {
      setLoading(true);
      setMessage('');
      
      // 폼 데이터에서 쉼표를 제거하고 숫자로 변환
      const cleanedData = {
        cas5: removeCommas(formData.cas5),
        cas1: removeCommas(formData.cas1),
        gif: removeCommas(formData.gif),
        car1: removeCommas(formData.car1),
        car2: removeCommas(formData.car2),
        person: removeCommas(formData.person),
        Pos: removeCommas(formData.Pos),
      };
      
      // 노션 API 형식에 맞게 데이터 변환
      const notionData = {
        date,
        'cas5': {
          number: parseFloat(cleanedData.cas5) || 0,
        },
        'cas1': {
          number: parseFloat(cleanedData.cas1) || 0,
        },
        'gif': {
          number: parseFloat(cleanedData.gif) || 0,
        },
        'car1': {
          number: parseFloat(cleanedData.car1) || 0,
        },
        'car2': {
          number: parseFloat(cleanedData.car2) || 0,
        },
        'person': {
          number: parseFloat(cleanedData.person) || 0,
        },
        'Pos': {
          number: parseFloat(cleanedData.Pos) || 0,
        },
      };
      
      const response = await fetch('/api/daily-income', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notionData),
      });
      
      if (!response.ok) {
        // HTTP 오류 처리
        const errorData = await response.json().catch(() => ({ error: '응답을 파싱할 수 없습니다' }));
        throw new Error(errorData.error || `HTTP 오류: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setMessage('데이터가 성공적으로 저장되었습니다.');
      } else {
        setMessage(`저장 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('데이터 저장 오류:', error);
      setMessage(`데이터 저장 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수 추가
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword('');
  };

  // 입력 변경 처리
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // 숫자와 쉼표만 허용
    const numericValue = value.replace(/[^\d,]/g, '');
    
    // 쉼표 제거 후 숫자 변환
    const plainNumber = removeCommas(numericValue);
    
    // 유효한 숫자인 경우에만 처리
    if (plainNumber === '' || !isNaN(Number(plainNumber))) {
      // 원화 포맷으로 변환하여 저장
      const formattedValue = plainNumber === '' ? '' : formatKRW(plainNumber);
      setFormData({ ...formData, [name]: formattedValue });
    }
  };

  // 날짜 변경 처리
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDate(newDate);
  };

  // 이전 날짜로 이동
  const goToPreviousDay = () => {
    const currentDate = parseISO(date);
    const newDate = addDays(currentDate, -1);
    setDate(format(newDate, 'yyyy-MM-dd'));
  };

  // 다음 날짜로 이동
  const goToNextDay = () => {
    const currentDate = parseISO(date);
    const newDate = addDays(currentDate, 1);
    setDate(format(newDate, 'yyyy-MM-dd'));
  };

  // 합계 계산
  const calculateTotal = () => {
    // cas5부터 car2까지 합하고 person을 뺌
    const values = [
      formData.cas5,
      formData.cas1,
      formData.gif,
      formData.car1,
      formData.car2
    ];
    
    const income = values.reduce((acc, curr) => {
      const numValue = parseFloat(removeCommas(curr) || '0');
      return acc + numValue;
    }, 0);
    
    // person 비용 계산
    const personCost = parseFloat(removeCommas(formData.person) || '0');
    
    // 최종 계산 (수입 - 지출)
    return income - personCost;
  };
  
  const total = calculateTotal();
  
  // POS와 비교하여 적정성 판단
  const compareWithPos = () => {
    const posValue = parseFloat(removeCommas(formData.Pos) || '0');
    const diff = total - posValue;
    
    if (Math.abs(diff) < 0.01) {
      return { status: '일치', diff: 0 };
    } else if (diff > 0) {
      return { status: '적정 (초과)', diff };
    } else {
      return { status: '부적정 (부족)', diff };
    }
  };
  
  const comparison = compareWithPos();

  return (
    <div style={{ 
      maxWidth: '800px', 
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
          일일 수입/지출 관리
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
            href="/"
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
            홈으로
          </Link>
        </div>
      </div>
      
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        marginBottom: '1.5rem'
      }}>
        <button 
          onClick={goToPreviousDay}
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
          type="date"
          value={date}
          onChange={handleDateChange}
          style={{ 
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem'
          }}
        />
        
        <button 
          onClick={goToNextDay}
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
      </div>
      
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
      
      <form onSubmit={saveData}>
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          {/* 현금5% */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              현금5%
            </label>
            <input
              type="text"
              name="cas5"
              value={formData.cas5}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 현금1% */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              현금1%
            </label>
            <input
              type="text"
              name="cas1"
              value={formData.cas1}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 상품권 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              상품권
            </label>
            <input
              type="text"
              name="gif"
              value={formData.gif}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 카드1 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              카드1
            </label>
            <input
              type="text"
              name="car1"
              value={formData.car1}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 카드2 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              카드2
            </label>
            <input
              type="text"
              name="car2"
              value={formData.car2}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 개인입금 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              개인입금
            </label>
            <input
              type="text"
              name="person"
              value={formData.person}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 포스 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#4b5563'
            }}>
              포스
            </label>
            <input
              type="text"
              name="Pos"
              value={formData.Pos}
              onChange={handleChange}
              placeholder="0"
              style={{ 
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                textAlign: 'right'
              }}
            />
          </div>
          
          {/* 합계 */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.25rem',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              color: '#1e40af'
            }}>
              합계
            </label>
            <div style={{ 
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#e0e7ff',
              borderRadius: '0.375rem',
              textAlign: 'right',
              fontWeight: 'bold',
              color: '#1e40af'
            }}>
              {formatKRW(total)}
            </div>
          </div>
        </div>
        
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: '0.5rem',
          border: '1px solid #d1d5db',
          padding: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontWeight: 'bold' }}>계산된 합계 (수입-지출):</span>
            <span style={{ fontWeight: 'bold' }}>{formatKRW(total)}</span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <span>POS 합계:</span>
            <span>{formData.Pos}</span>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.5rem',
            backgroundColor: comparison.status.includes('부적정') ? '#fee2e2' : 
                             comparison.status.includes('적정') ? '#dcfce7' : '#f3f4f6',
            borderRadius: '0.25rem',
            color: comparison.status.includes('부적정') ? '#b91c1c' : 
                   comparison.status.includes('적정') ? '#166534' : '#4b5563'
          }}>
            <span>상태:</span>
            <span>{comparison.status} {Math.abs(comparison.diff) > 0 ? `(${formatKRW(Math.abs(comparison.diff))})` : ''}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="submit"
            disabled={loading}
            style={{ 
              backgroundColor: '#8b5cf6',
              color: 'white',
              fontWeight: 'bold',
              padding: '0.75rem 2rem',
              borderRadius: '0.375rem',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? '저장 중...' : '데이터 저장'}
          </button>
        </div>
      </form>
    </div>
  );
} 