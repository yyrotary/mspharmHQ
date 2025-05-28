# MSPharmHQ 개발자 가이드

## 프로젝트 시작하기

### 1. 사전 요구사항
- Node.js 18.0 이상
- npm 또는 yarn
- Git
- 코드 에디터 (VS Code 권장)

### 2. 프로젝트 클론 및 설정

```bash
# 프로젝트 클론
git clone [repository-url]
cd mspharmHQ

# 의존성 설치
npm install
# 또는
yarn install
```

### 3. 환경 변수 설정

`.env.local` 파일을 프로젝트 루트에 생성하고 다음 내용을 추가:

```env
# HTTPS 설정 (카메라 기능 사용 시 필요)
HTTPS=true
NODE_TLS_REJECT_UNAUTHORIZED=0

# Notion API
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CLIENT_EMAIL=your_client_email
GOOGLE_CLOUD_PRIVATE_KEY=your_private_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google Drive
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
```

### 4. 개발 서버 실행

```bash
# 일반 HTTP 모드
npm run dev

# HTTPS 모드 (카메라 기능 필요 시)
npm run dev:https
```

브라우저에서 http://localhost:3000 또는 https://localhost:3000 접속

## 코드 구조 이해하기

### 1. 디렉토리 구조
```
mspharmHQ/
├── app/                    # Next.js App Router
│   ├── api/               # API 엔드포인트
│   ├── components/        # 재사용 가능한 컴포넌트
│   ├── lib/              # 유틸리티 함수
│   └── [feature]/        # 기능별 페이지
├── public/               # 정적 파일
├── docs/                 # 프로젝트 문서
└── types/                # TypeScript 타입 정의
```

### 2. 주요 컴포넌트
- **Layout**: 전체 앱 레이아웃 (`app/layout.tsx`)
- **Navigation**: 네비게이션 컴포넌트
- **Forms**: 입력 폼 컴포넌트
- **Tables**: 데이터 테이블 컴포넌트

### 3. API 구조
각 API는 Next.js의 Route Handler 패턴을 따릅니다:

```typescript
// app/api/[endpoint]/route.ts
export async function GET(request: Request) {
  // GET 요청 처리
}

export async function POST(request: Request) {
  // POST 요청 처리
}
```

## 주요 기능 개발 가이드

### 1. 새로운 페이지 추가

```typescript
// app/new-feature/page.tsx
export default function NewFeaturePage() {
  return (
    <div>
      <h1>새로운 기능</h1>
      {/* 페이지 내용 */}
    </div>
  );
}
```

### 2. API 엔드포인트 추가

```typescript
// app/api/new-endpoint/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    // 비즈니스 로직
    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: '오류 발생' },
      { status: 500 }
    );
  }
}
```

### 3. Notion 데이터베이스 연동

```typescript
import { getDailyIncome, saveDailyIncome } from '@/app/api/notion';

// 데이터 조회
const data = await getDailyIncome('2025-05-27');

// 데이터 저장
await saveDailyIncome('2025-05-27', {
  cas5: 100000,
  cas1: 50000,
  // ...
});
```

### 4. AI 기능 활용

```typescript
// Gemini API 사용 예시
const response = await fetch('/api/gemini', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: '약품 정보 분석',
    image: base64Image
  })
});
```

## 스타일링 가이드

### 1. Tailwind CSS 사용
```jsx
<div className="bg-white rounded-lg shadow-md p-6">
  <h2 className="text-2xl font-bold text-blue-600 mb-4">
    제목
  </h2>
  <p className="text-gray-600">
    내용
  </p>
</div>
```

### 2. 색상 팔레트
- Primary: Blue (#2563eb, #1e40af)
- Secondary: 기능별 구분색
  - 상담: 청록색 (#0891b2)
  - 고객: 분홍색 (#ec4899)
  - 인식: 녹색 (#10b981)
  - 수입: 보라색 (#8b5cf6)
  - 통계: 주황색 (#f59e0b)

### 3. 반응형 디자인
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 반응형 그리드 */}
</div>
```

## 테스트 가이드

### 1. 단위 테스트
```typescript
// __tests__/api/notion.test.ts
import { getDailyIncome } from '@/app/api/notion';

describe('Notion API', () => {
  test('일일 데이터 조회', async () => {
    const data = await getDailyIncome('2025-05-27');
    expect(data).toBeDefined();
  });
});
```

### 2. 통합 테스트
API 엔드포인트 테스트:
```bash
# GET 요청
curl http://localhost:3000/api/daily-income?date=2025-05-27

# POST 요청
curl -X POST http://localhost:3000/api/daily-income \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-05-27","cas5":100000}'
```

## 배포 가이드

### 1. 빌드
```bash
npm run build
```

### 2. 프로덕션 실행
```bash
npm start
```

### 3. Docker 배포
```bash
# 이미지 빌드
docker build -t mspharmhq .

# 컨테이너 실행
docker run -p 3000:3000 mspharmhq
```

### 4. Vercel 배포
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel
```

## 디버깅 팁

### 1. 콘솔 로깅
```typescript
console.log('디버그:', { 변수명 });
```

### 2. Next.js 디버깅
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    }
  ]
}
```

### 3. 네트워크 디버깅
브라우저 개발자 도구의 Network 탭 활용

## 일반적인 문제 해결

### 1. HTTPS 관련 오류
```bash
# 자체 서명 인증서 허용
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

### 2. Notion API 오류
- API 키 확인
- 데이터베이스 ID 확인
- 권한 설정 확인

### 3. 카메라 권한 오류
- HTTPS 모드로 실행 필요
- 브라우저 카메라 권한 허용

## 코드 컨벤션

### 1. 네이밍 규칙
- 컴포넌트: PascalCase (`CustomerList.tsx`)
- 함수: camelCase (`getDailyIncome()`)
- 상수: UPPER_SNAKE_CASE (`CACHE_DURATION`)
- 파일: kebab-case (`daily-income.ts`)

### 2. 타입스크립트
```typescript
// 인터페이스 정의
interface Customer {
  id: string;
  name: string;
  // ...
}

// 타입 안전성 보장
function getCustomer(id: string): Customer | null {
  // ...
}
```

### 3. 컴포넌트 구조
```typescript
// 1. imports
import { useState } from 'react';

// 2. 타입 정의
interface Props {
  title: string;
}

// 3. 컴포넌트
export default function Component({ title }: Props) {
  // 4. 상태 및 훅
  const [state, setState] = useState();
  
  // 5. 핸들러
  const handleClick = () => {};
  
  // 6. 렌더링
  return <div>{title}</div>;
}
```

## 기여 가이드

### 1. 브랜치 전략
- `main`: 프로덕션 브랜치
- `develop`: 개발 브랜치
- `feature/*`: 기능 개발 브랜치
- `hotfix/*`: 긴급 수정 브랜치

### 2. 커밋 메시지
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 업무 수정
```

### 3. Pull Request
- 명확한 제목과 설명
- 테스트 결과 포함
- 스크린샷 첨부 (UI 변경 시)

## 추가 리소스

### 1. 공식 문서
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Notion API](https://developers.notion.com/)
- [Google Cloud](https://cloud.google.com/docs)

### 2. 프로젝트 문서
- [프로젝트 구조](./PROJECT_STRUCTURE.md)
- [API 아키텍처](./API_ARCHITECTURE.md)
- [시스템 아키텍처](./SYSTEM_ARCHITECTURE.md)
- [GUI 문서](./GUI_DOCUMENTATION.md)

### 3. 도움 받기
- GitHub Issues에 문제 제기
- 팀 슬랙 채널
- 이메일: dev@mspharm.com
