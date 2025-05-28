import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header 
        style={{ 
          background: 'linear-gradient(to right, #2563eb, #1e40af)', 
          color: 'white', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}
      >
        
      </header>

      {/* 메인 컨텐츠 */}
      <main style={{ flexGrow: 1, padding: '1rem' }}>
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          {/* 약국 소개 카드 */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
            padding: '1.5rem', 
            marginBottom: '1.5rem',
            border: '1px solid #e5e7eb' 
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              gap: '1rem', 
              marginBottom: '1rem' 
            }}>
              <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.5rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img 
                  src="/logo.png" 
                  alt="명성약국 로고" 
                  style={{ 
                    height: '350px',
                    width: 'auto',
                    objectFit: 'contain'
                  }}
                />
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1e40af' }}>건강을 위한 최선의 선택</h2>
              <p style={{ fontSize: '1.125rem', textAlign: 'center', color: '#4b5563', maxWidth: '42rem' }}>
                고객의 건강을 최우선으로 생각하는 명성약국입니다.
                정확한 약품 정보와 친절한 상담으로 여러분의 건강을 지켜드립니다.
              </p>
            </div>
          </div>

          {/* 메뉴 버튼 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af' }}>서비스 메뉴</h2>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(1, 1fr)', 
              gap: '1rem' 
            }}>
              <Link href="/consultation" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>👥</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2563eb' }}>고객 상담</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>고객 정보를 조회하고 호소증상을 기록합니다.</p>
                </div>
              </Link>
              
              <Link href="/consultation-history" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #0891b2',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>📋</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0891b2' }}>상담 내역</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>기간별 상담 내역을 조회합니다.</p>
                </div>
              </Link>
              
              <Link href="/customer-list" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #ec4899',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>📚</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ec4899' }}>고객 목록</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>전체 고객 목록을 조회하고 관리합니다.</p>
                </div>
              </Link>
              
              <Link href="/customer-recognition" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #10b981',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>👤</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>고객 인식</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>카메라를 통해 고객을 자동 인식합니다.</p>
                </div>
              </Link>
              
              <Link href="/daily-income" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>📊</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#8b5cf6' }}>수입/지출 관리</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>일일 수입과 지출을 기록하고 관리합니다.</p>
                </div>
              </Link>
              
              <Link href="/daily-income/monthly" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>📊</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f59e0b' }}>월별 통계</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>월간 수입/지출 통계를 확인합니다</p>
                </div>
              </Link>
              
              <Link href="/employee-purchase" 
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '0.75rem', 
                  padding: '1.5rem', 
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', 
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit'
                }}
              >
                <div style={{ fontSize: '2rem', marginRight: '1.5rem' }}>🛒</div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#7c3aed' }}>MSP Family 임직원가 구매</h3>
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>직원 물품 구매 관리</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer style={{ 
        padding: '1rem', 
        backgroundColor: 'white', 
        borderTop: '1px solid #e5e7eb', 
        textAlign: 'center' 
      }}>
        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          명성약국 &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
