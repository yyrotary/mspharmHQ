# 직원 구매 장부 시스템 설치 가이드

## 1. 필요한 패키지 설치

```bash
# Supabase 클라이언트
npm install @supabase/supabase-js

# 인증 관련 패키지
npm install bcryptjs jsonwebtoken
npm install --save-dev @types/bcryptjs @types/jsonwebtoken

# 기타 필요 패키지 (이미 설치되어 있을 수 있음)
npm install react-hot-toast
```

## 2. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수 추가:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://qpuagbmgtebcetzvbrfq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDYxMjMsImV4cCI6MjA2MzkyMjEyM30.f9DSJaU4MNuf1xjbXimxu2_tW-A6XNNT2PdmMBn0SEg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdWFnYm1ndGViY2V0enZicmZxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODM0NjEyMywiZXhwIjoyMDYzOTIyMTIzfQ.GpaHfKZrT2K3lseQuFlDovgSL6As-W43Wp2eVTvkVNo

# JWT Secret for Employee Authentication  
JWT_SECRET=geCwFZCj4S4IqxqYLpOCii8Pj8uPGlfgrvUCWuXiAZXFFbfSV5zPzkOCkGqmy31uLvfbzvPbWjLUJ+t74ZHY8g==
# 주의: 프로덕션에서는 반드시 다른 값으로 변경하세요!

# Supabase Storage
SUPABASE_STORAGE_BUCKET=employee-purchases
```

## 3. Supabase 데이터베이스 설정

### 3.1 Supabase Dashboard에서 SQL Editor 열기
1. https://supabase.com/dashboard/project/qpuagbmgtebcetzvbrfq 접속
2. SQL Editor 탭 클릭

### 3.2 데이터베이스 스키마 실행
`database/employee_purchase_schema.sql` 파일의 내용을 복사하여 실행

### 3.3 Storage Bucket 생성
1. Storage 탭으로 이동
2. "New bucket" 클릭
3. 이름: `employee-purchases`
4. Public bucket: 체크 해제 (비공개)
5. 생성

### 3.4 Storage 설정

#### Storage Bucket RLS 비활성화
RLS를 사용하지 않으므로 Storage에도 정책을 설정하지 않습니다.

1. Storage 탭으로 이동
2. Policies 탭에서 모든 정책 비활성화 또는 삭제
3. 모든 Storage 접근은 Service Role Key를 통해서만 가능

**주의**: 클라이언트에서 직접 Storage에 접근할 수 없으므로, 파일 업로드는 반드시 API Routes를 통해 처리해야 합니다.

```javascript
// 클라이언트에서 파일 업로드 예시
const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch('/api/employee-purchase/upload', {
    method: 'POST',
    body: formData,
  });
  
  return response.json();
};
```

## 4. 초기 사용자 생성

### 4.1 비밀번호 해시 생성
Node.js 콘솔에서 실행:

```javascript
const bcrypt = require('bcryptjs');

// 각 사용자의 비밀번호 해시 생성
async function generateHashes() {
  console.log('약국장:', await bcrypt.hash('admin123', 10));
  console.log('김관리자:', await bcrypt.hash('manager123', 10));
  console.log('이직원:', await bcrypt.hash('staff123', 10));
  console.log('박직원:', await bcrypt.hash('staff123', 10));
}

generateHashes();
```

### 4.2 사용자 데이터 삽입
SQL Editor에서 실행 (위에서 생성한 해시 값 사용):

```sql
INSERT INTO employees (name, password_hash, role) VALUES
  ('약국장', '$2b$10$생성된해시값', 'owner'),
  ('김관리자', '$2b$10$생성된해시값', 'manager'),
  ('이직원', '$2b$10$생성된해시값', 'staff'),
  ('박직원', '$2b$10$생성된해시값', 'staff')
ON CONFLICT (name) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role;
```

## 5. 개발 서버 실행

```bash
# HTTPS 모드로 실행 (카메라 기능 필요)
npm run dev:https
```

## 6. 기능 테스트

### 6.1 로그인 테스트
- URL: https://localhost:3001/employee-purchase/login
- 테스트 계정:
  - 약국장: admin123
  - 김관리자: manager123
  - 이직원: staff123

### 6.2 구매 신청 테스트
1. 일반 직원으로 로그인
2. 새 구매 신청
3. 사진 촬영 및 금액 입력
4. 신청 제출

### 6.3 승인 워크플로우 테스트
1. 관리자로 로그인
2. 승인 대기 목록 확인
3. 구매 요청 승인
4. 오프라인 결제 후 완료 처리

## 7. 문제 해결

### 7.1 CORS 오류
Supabase 대시보드에서 Authentication > URL Configuration 확인

### 7.2 Storage 업로드 실패
- Bucket 정책 확인
- 파일 크기 제한 확인 (기본 50MB)

### 7.3 RLS 정책 오류
- SQL Editor에서 RLS 정책 재실행
- 서비스 역할 키 확인

## 8. 프로덕션 배포 체크리스트

- [ ] JWT_SECRET 변경
- [ ] 초기 비밀번호 변경
- [ ] HTTPS 인증서 설정
- [ ] 환경 변수 보안 설정
- [ ] 백업 정책 수립
- [ ] 모니터링 설정
- [ ] 로그 수집 설정

---

**문서 작성일**: 2025년 5월 27일  
**버전**: 1.0.0
