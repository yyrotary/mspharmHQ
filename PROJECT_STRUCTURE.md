# MSPharmHQ 프로젝트 구조 문서

## 프로젝트 개요
MSPharmHQ는 명성약국의 통합 관리 시스템으로, 고객 관리, 상담 기록, 수입/지출 관리, 약품 인식 등의 기능을 제공하는 Next.js 기반 웹 애플리케이션입니다.

## 기술 스택
- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **AI/ML**: 
  - Google Generative AI (Gemini)
  - Anthropic Claude AI
  - OpenAI API
  - TensorFlow.js (얼굴 인식)
- **Database**: Notion API
- **Storage**: Google Drive API
- **Backend**: Next.js API Routes

## 디렉토리 구조

```
mspharmHQ/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── bandapi/       # 밴드 API 연동
│   │   ├── consultation/  # 상담 관련 API
│   │   ├── customer/      # 고객 관리 API
│   │   ├── daily-income/  # 수입/지출 관리 API
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
│   ├── daily-income/      # 일일 수입/지출 관리
│   ├── invoice-scanner/   # 영수증 스캔
│   ├── lib/              # 유틸리티 함수
│   ├── page.tsx          # 메인 홈페이지
│   └── layout.tsx        # 기본 레이아웃
├── public/               # 정적 파일
├── .github/              # GitHub Actions 설정
├── node_modules/         # npm 패키지
├── package.json          # 프로젝트 의존성
├── next.config.ts        # Next.js 설정
├── tsconfig.json         # TypeScript 설정
├── tailwind.config.js    # Tailwind CSS 설정
├── Dockerfile           # Docker 컨테이너 설정
└── server.js            # 커스텀 서버 (필요시)
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

### 3. 수입/지출 관리
- **일일 관리** (`/daily-income`): 일별 수입/지출 입력
- **월별 통계** (`/daily-income/monthly`): 월간 통계 분석
- **수입 API** (`/api/daily-income`): 재무 데이터 처리

### 4. AI 기능
- **영수증 인식** (`/invoice-scanner`, `/api/extract-invoice`): AI를 통한 영수증 자동 인식
- **약품 인식** (`/api/recognize-medicine`): 약품 이미지 인식
- **얼굴 인식** (`/api/face-embedding`): 고객 얼굴 인식 및 매칭

### 5. 외부 서비스 연동
- **Notion API**: 데이터베이스로 Notion 활용
- **Google Drive**: 이미지 및 파일 저장
- **AI Services**: Gemini, Claude, OpenAI API 연동

## 데이터 흐름
1. **고객 등록**: 얼굴 인식 → 고객 정보 저장 → Notion DB
2. **상담 기록**: 고객 선택 → 상담 내용 입력 → 이미지 업로드 → Notion DB
3. **수입/지출**: 일일 데이터 입력 → 자동 계산 → 월별 통계 생성
4. **영수증 처리**: 이미지 촬영 → AI 인식 → 데이터 추출 → 자동 입력

## 보안 및 인증
- 환경 변수를 통한 API 키 관리
- HTTPS 지원 (카메라 기능 사용)
- Google Cloud 서비스 계정 인증

## 개발 환경 설정
1. Node.js 및 npm 설치
2. 환경 변수 설정 (`.env.local`)
3. Notion API 키 및 데이터베이스 ID 설정
4. Google Cloud 서비스 계정 설정
5. AI API 키 설정 (Gemini, Claude, OpenAI)

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
