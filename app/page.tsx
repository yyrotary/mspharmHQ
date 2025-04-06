import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* 헤더 */}
      <header className="header border-b border-gray-200">
        <h1 className="text-xl font-bold text-center">노션 데이터베이스 관리</h1>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="flex-grow p-4 container">
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
          <h1 style={{ 
            fontSize: '20px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '10px'
          }}>
            노션 데이터베이스 관리
          </h1>
          
          <p style={{ 
            fontSize: '14px',
            color: '#666',
            textAlign: 'center',
            marginBottom: '30px'
          }}>
            일일 수입과 지출을 노션 데이터베이스에 쉽게 기록하고 관리하세요.
          </p>

          {/* 메뉴 목록 */}
          <div className="grid gap-4">
            <Link href="/daily-income" className="block p-6 bg-white shadow-md rounded-lg hover:shadow-lg transition">
              <h2 className="text-lg font-semibold mb-2">일일 수입/지출 관리</h2>
              <p className="text-sm text-gray-600">일일 수입과 지출을 기록하고 관리합니다.</p>
            </Link>
            
            <Link href="/invoice-scanner" className="block p-6 bg-white shadow-md rounded-lg hover:shadow-lg transition">
              <h2 className="text-lg font-semibold mb-2">영수증 스캔</h2>
              <p className="text-sm text-gray-600">영수증을 스캔하여 데이터를 자동으로 추출합니다.</p>
            </Link>
            
            <Link href="/customer-recognition" className="block p-6 bg-white shadow-md rounded-lg hover:shadow-lg transition">
              <h2 className="text-lg font-semibold mb-2">고객 인식</h2>
              <p className="text-sm text-gray-600">카메라로 고객을 인식하여 정보를 조회합니다.</p>
            </Link>
          </div>
          
          <div style={{
            margin: '30px 0',
            padding: '15px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#666',
            textAlign: 'center'
          }}>
            v1.0.0 - DB ID: 1a81d8554a468039b6fdc63a830e1d24
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="bg-white border-t border-gray-200 p-4 text-center">
        <p className="text-gray-500 text-sm">
          DB ID: 1a81d8554a468039b6fdc63a830e1d24
        </p>
      </footer>
    </div>
  );
}
