# MSPharmHQ 프로젝트 구조 문서

## 프로젝트 개요
MSPharmHQ는 명성약국의 통합 관리 시스템으로, 고객 관리, 상담 기록, 수입/지출 관리, 약품 인식, 직원 구매 관리 등의 기능을 제공하는 Next.js 기반 웹 애플리케이션입니다.

## 기술 스택
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **AI/ML**: 
  - Google Generative AI (Gemini)
  - Anthropic Claude AI
  - OpenAI API
  - TensorFlow.js (얼굴 인식)
- **Database**: 
  - Notion API (고객 관리, 상담 기록, 수입/지출)
  - Supabase (PostgreSQL - 직원 구매 시스템)
- **Storage**: 
  - Google Drive API (상담 이미지)
  - Supabase Storage (직원 구매 영수증)
- **Backend**: Next.js API Routes
- **Authentication**: JWT 기반 인증 (직원/마스터 시스템)

## 디렉토리 구조

```
mspharmHQ/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── bandapi/       # 밴드 API 연동
│   │   ├── consultation/  # 상담 관련 API
│   │   ├── customer/      # 고객 관리 API
│   │   ├── daily-income/  # 수입/지출 관리 API
│   │   ├── employee-purchase/ # 직원 구매 관리 API
│   │   │   ├── auth/      # 인증 관련 (로그인/로그아웃)
│   │   │   ├── requests/  # 구매 요청 관리
│   │   │   ├── statistics/ # 통계 및 리포트
│   │   │   └── upload/    # 파일 업로드
│   │   ├── extract-invoice/ # 영수증 데이터 추출
│   │   ├── face-embedding/  # 얼굴 인식 임베딩
│   │   ├── gemini/        # Google Gemini AI API
│   │   ├── google-drive/  # Google Drive 파일 저장
│   │   ├── master/        # 마스터 데이터 관리
│   │   ├── recognize-medicine/ # 약품 인식
│   │   └── notion.ts      # Notion API 설정
│   ├── components/        # 재사용 가능한 컴포넌트
│   ├── consultation/      # 고객 상담 페이지
│   ├── consultation-history/ # 상담 내역 조회
│   ├── customer-list/     # 고객 목록 관리
│   ├── customer-recognition/ # 고객 얼굴 인식
│   ├── daily-income/      # 일일 수입/지출 관리 (마스터 전용)
│   ├── employee-purchase/ # 직원 구매 장부 시스템
│   │   ├── login/         # 직원 로그인
│   │   ├── new/           # 구매 신청
│   │   ├── requests/      # 구매 내역
│   │   └── page.tsx       # 대시보드
│   ├── invoice-scanner/   # 영수증 스캔
│   ├── lib/              # 유틸리티 함수
│   │   └── employee-purchase/ # 직원 구매 시스템 라이브러리
│   │       ├── auth.ts    # 인증 유틸리티
│   │       ├── supabase.ts # Supabase 클라이언트
│   │       └── types.ts   # TypeScript 타입 정의
│   ├── master-dashboard/  # 마스터 전용 대시보드
│   ├── master-login/      # 마스터 로그인
│   ├── page.tsx          # 메인 홈페이지
│   └── layout.tsx        # 기본 레이아웃
├── certificates/         # SSL 인증서 (HTTPS)
├── database/            # 데이터베이스 스키마
│   ├── employee_purchase_schema.sql      # 직원 구매 시스템 스키마
│   ├── employee_purchase_schema_fix.sql  # 스키마 수정
│   └── employee_purchase_schema_safe.sql # 안전한 스키마 (DROP 없음)
├── docs/                # 프로젝트 문서
│   ├── API_ARCHITECTURE.md     # API 설계 문서
│   ├── API_ROUTE_EXAMPLES.md   # API 사용 예시
│   ├── DEVELOPER_GUIDE.md      # 개발자 가이드
│   ├── DOCUMENTATION_CHECKLIST.md # 문서화 체크리스트
│   ├── EMPLOYEE_PURCHASE_*.md  # 직원 구매 시스템 문서
│   ├── GUI_DOCUMENTATION.md    # UI/UX 문서
│   ├── SYSTEM_ARCHITECTURE.md  # 시스템 아키텍처
│   └── WORK_LOG.md            # 작업 일지
├── public/              # 정적 파일
├── scripts/             # 유틸리티 스크립트
│   ├── check-*.js       # 데이터베이스 검증 스크립트
│   ├── setup-*.js       # 초기 설정 스크립트
│   └── test-*.js        # 테스트 스크립트
├── .github/             # GitHub Actions 설정
├── package.json         # 프로젝트 의존성
├── next.config.ts       # Next.js 설정
├── tsconfig.json        # TypeScript 설정
├── tailwind.config.js   # Tailwind CSS 설정
├── Dockerfile          # Docker 컨테이너 설정
├── server.js           # 커스텀 서버 (필요시)
├── supabase.txt        # Supabase 프로젝트 정보 (개발용)
└── .env.local          # 환경 변수 (Git 제외)
```

## 주요 기능 모듈

### 1. 고객 관리 시스템
- **고객 목록** (`/customer-list`): 전체 고객 목록 조회 및 관리
- **고객 인식** (`/customer-recognition`): TensorFlow.js를 활용한 얼굴 인식
- **고객 API** (`/api/customer`): 고객 정보 CRUD 작업

### 2. 상담 관리 시스템
- **상담 등록** (`/consultation`): 고객 상담 내용 등록
- **상담 내역** (`/consultation-history`): 기간별 상담 내역 조회
- **상담 API** (`/api/consultation`): 상담 데이터 관리

### 3. 수입/지출 관리 (마스터 전용)
- **마스터 로그인** (`/master-login`): owner 권한 인증
- **마스터 대시보드** (`/master-dashboard`): 마스터 전용 기능 접근
- **일일 관리** (`/daily-income`): 일별 수입/지출 입력
- **월별 통계** (`/daily-income/monthly`): 월간 통계 분석
- **수입 API** (`/api/daily-income`): 재무 데이터 처리

### 4. 직원 구매 장부 시스템
- **직원 로그인** (`/employee-purchase/login`): 직원 인증
- **구매 신청** (`/employee-purchase/new`): 영수증 업로드 및 구매 신청
- **구매 내역** (`/employee-purchase/requests`): 개인 구매 내역 조회
- **승인 관리**: 관리자/약국장 승인 워크플로우
- **통계 리포트**: 직원별, 기간별 구매 통계

### 5. AI 기능
- **영수증 인식** (`/invoice-scanner`, `/api/extract-invoice`): AI를 통한 영수증 자동 인식
- **약품 인식** (`/api/recognize-medicine`): 약품 이미지 인식
- **얼굴 인식** (`/api/face-embedding`): 고객 얼굴 인식 및 매칭

### 6. 외부 서비스 연동
- **Notion API**: 고객, 상담, 수입/지출 데이터베이스
- **Supabase**: 직원 구매 시스템 데이터베이스 및 파일 저장
- **Google Drive**: 상담 관련 이미지 저장
- **AI Services**: Gemini, Claude, OpenAI API 연동

## 데이터 흐름

### 1. 일반 사용자 플로우
```
메인 페이지 → 고객 관리/상담 → Notion DB
           → 고객 인식 → TensorFlow.js → 고객 정보
           → 직원 구매 → Supabase DB
```

### 2. 마스터 전용 플로우
```
메인 페이지 → 마스터 로그인 → 마스터 대시보드
                            → 수입/지출 관리 → Notion DB
                            → 월별 통계
                            → 직원 구매 승인
```

### 3. 직원 구매 플로우
```
직원 로그인 → 구매 신청 → 영수증 업로드 → Supabase Storage
           → 승인 대기 → 관리자 승인 → 약국장 최종 승인
           → 구매 완료
```

## 보안 및 인증

### 1. 인증 시스템
- **일반 사용자**: 인증 없음 (고객 관리, 상담 기능)
- **직원**: JWT 기반 인증 (직원 구매 시스템)
- **마스터**: owner 권한 확인 (수입/지출 관리)

### 2. 권한 관리
- **employee**: 본인 구매 신청 및 조회
- **manager**: 직원 구매 1차 승인
- **pharmacist**: 최종 승인 및 통계 조회
- **owner**: 전체 시스템 관리

### 3. 보안 설정
- 환경 변수를 통한 API 키 관리
- HTTPS 지원 (카메라 기능 사용)
- Service Role Key를 통한 데이터베이스 접근
- API Routes에서 권한 검증

## 개발 환경 설정

### 1. 필수 설치
- Node.js 18.0+
- npm 또는 yarn
- Git

### 2. 환경 변수 설정 (`.env.local`)
```env
# HTTPS 설정
HTTPS=true
NODE_TLS_REJECT_UNAUTHORIZED=0

# Notion API
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# Supabase
SUPABASE_URL=https://qpuagbmgtebcetzvbrfq.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_CLIENT_EMAIL=your_client_email
GOOGLE_CLOUD_PRIVATE_KEY=your_private_key

# AI Services
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 3. 데이터베이스 초기화
```bash
# Supabase 데이터베이스 스키마 적용
npm run setup:db

# 초기 직원 데이터 삽입
node scripts/setup-employees.js
```

## 빌드 및 배포
- 개발: `npm run dev` 또는 `npm run dev:https`
- 빌드: `npm run build`
- 프로덕션: `npm start`
- Docker 지원: `Dockerfile` 제공

## 향후 확장 계획
- 재고 관리 시스템 추가
- 처방전 관리 기능
- 보험 청구 자동화
- 고객 알림 시스템
- 모바일 앱 개발
- 다중 지점 관리
