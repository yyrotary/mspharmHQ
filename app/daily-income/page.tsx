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

  // 컴포넌트 마운트 시와 날짜 변경 시 데이터 조회
  useEffect(() => {
    fetchData();
  }, [date]);

  // 데이터 조회 함수
  const fetchData = async () => {
    if (!date) return;
    
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

  // 총합 계산 수정
  const calculateTotal = () => {
    // CAS5, CAS1, GIF, CAR1, CAR2를 더하고 PERSON을 빼는 방식으로 변경
    const values = {
      cas5: removeCommas(formData.cas5 || '0'),
      cas1: removeCommas(formData.cas1 || '0'),
      gif: removeCommas(formData.gif || '0'),
      car1: removeCommas(formData.car1 || '0'),
      car2: removeCommas(formData.car2 || '0'),
      person: removeCommas(formData.person || '0'),
      pos: removeCommas(formData.Pos || '0')
    };
    
    // 숫자로 변환
    const numValues = {
      cas5: parseFloat(values.cas5) || 0,
      cas1: parseFloat(values.cas1) || 0,
      gif: parseFloat(values.gif) || 0,
      car1: parseFloat(values.car1) || 0,
      car2: parseFloat(values.car2) || 0,
      person: parseFloat(values.person) || 0,
      pos: parseFloat(values.pos) || 0
    };
    
    // 총액 계산 = (CAS5 + CAS1 + GIF + CAR1 + CAR2) - PERSON
    const total = 
      (numValues.cas5 + numValues.cas1 + numValues.gif + numValues.car1 + numValues.car2) - 
      numValues.person;
    
    return {
      total: formatKRW(total),
      rawTotal: total,
      isWarning: total < numValues.pos
    };
  };

  const totalData = calculateTotal();

  return (
    <div style={{ 
      maxWidth: '100%', 
      margin: '0 auto', 
      padding: '0', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#ffffff', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 상단 헤더 */}
      <header style={{ 
        padding: '15px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e1e1e1',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center'
      }}>
        <Link href="/" style={{ 
          textDecoration: 'none', 
          marginRight: '10px',
          color: '#333'
        }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}>
            ←
          </div>
        </Link>
        <h1 style={{ 
          margin: 0, 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: '#333',
          flex: 1,
          textAlign: 'center'
        }}>
          일일 수입 관리
        </h1>
        <div style={{ width: '40px' }}></div>
      </header>

      {/* 로딩 인디케이터 */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>
            <p style={{
              margin: 0,
              fontWeight: 'bold'
            }}>데이터를 불러오는 중...</p>
          </div>
        </div>
      )}

      <div style={{ 
        padding: '20px', 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '500px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* 날짜 선택 */}
        <div style={{ 
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '10px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            날짜 선택
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <button 
              type="button" 
              onClick={goToPreviousDay}
              style={{ 
                padding: '8px 15px',
                backgroundColor: '#0066FF',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              이전
            </button>
            <input
              type="date"
              value={date}
              onChange={handleDateChange}
              style={{ 
                flex: 1,
                padding: '8px 10px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                textAlign: 'center',
                fontSize: '14px'
              }}
            />
            <button 
              type="button" 
              onClick={goToNextDay}
              style={{ 
                padding: '8px 15px',
                backgroundColor: '#0066FF',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              다음
            </button>
          </div>
        </div>

        {/* 총합 표시 */}
        <div style={{ 
          backgroundColor: '#fff',
          padding: '15px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '5px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#555'
          }}>
            총액
          </label>
          <div style={{ 
            fontSize: '28px',
            fontWeight: 'bold',
            color: totalData.isWarning ? '#d32f2f' : '#0c753a'
          }}>
            ₩ {totalData.total}
          </div>
          {totalData.isWarning && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#fff4f4',
              color: '#d32f2f',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 'medium',
              borderLeft: '3px solid #d32f2f'
            }}>
              경고: 총액이 POS 금액보다 작습니다
            </div>
          )}
          {!totalData.isWarning && formData.Pos && (
            <div style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: '#f0f9f4',
              color: '#0c753a',
              borderRadius: '4px',
              fontSize: '13px',
              fontWeight: 'medium',
              borderLeft: '3px solid #0c753a'
            }}>
              적정: 총액이 POS 금액보다 크거나 같습니다
            </div>
          )}
        </div>

        {/* 메인 폼 */}
        <form onSubmit={saveData} style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
          paddingBottom: '80px'
        }}>
          {Object.entries({
            cas5: 'CAS5',
            cas1: 'CAS1',
            gif: 'GIF',
            car1: 'CAR1',
            car2: 'CAR2',
            person: 'PERSON',
            Pos: 'POS'
          }).map(([key, label]) => (
            <div key={key} style={{ 
              backgroundColor: '#fff',
              padding: '15px',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '10px',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#555'
              }}>
                {label}
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ 
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#888'
                }}>₩</span>
                <input
                  type="text"
                  inputMode="numeric"
                  name={key}
                  value={(formData as any)[key]}
                  onChange={handleChange}
                  style={{ 
                    width: '100%',
                    padding: '12px 10px 12px 30px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '16px',
                    textAlign: 'right'
                  }}
                  placeholder="0"
                />
              </div>
            </div>
          ))}
          
          {/* 메시지 표시 */}
          {message && (
            <div style={{ 
              padding: '15px',
              borderRadius: '8px',
              textAlign: 'center',
              backgroundColor: message.includes('성공') ? '#e7f7ed' : '#ffeeee',
              color: message.includes('성공') ? '#0c753a' : '#d32f2f',
              border: `1px solid ${message.includes('성공') ? '#a8e0bc' : '#ffd1d1'}`
            }}>
              {message}
            </div>
          )}
        </form>
      </div>

      {/* 저장 버튼 */}
      <div style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTop: '1px solid #e1e1e1',
        padding: '15px'
      }}>
        <div style={{ 
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <button
            type="button"
            onClick={saveData}
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '14px',
              backgroundColor: loading ? '#cccccc' : '#0066FF',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '처리 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </div>
  );
} 