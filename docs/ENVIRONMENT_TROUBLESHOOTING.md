# 환경 변수 문제 해결 가이드

## 🚨 .env.local 파일 인식 문제

### 문제 증상
- `.env.local` 파일이 존재하지만 스크립트에서 환경 변수를 읽지 못함
- `GEMINI_API_KEY is undefined` 또는 `supabaseUrl is required` 오류 발생
- 터미널에서 스크립트 실행 시 환경 변수 로딩 실패

### 주요 원인들

#### 1. 파일 경로 문제
```bash
# 잘못된 경우 - 상대 경로 문제
npx tsx scripts/test-gemini-api.ts  # 현재 디렉토리가 scripts/ 폴더인 경우

# 올바른 경우 - 프로젝트 루트에서 실행
cd D:\devel\MSLINKV2\mspharmHQ
npx tsx scripts/test-gemini-api.ts
```

#### 2. 파일 인코딩 문제
- `.env.local` 파일이 UTF-8 BOM으로 저장된 경우
- 특수 문자나 숨겨진 문자 포함

#### 3. 파일 위치 문제
```
올바른 위치:
D:\devel\MSLINKV2\mspharmHQ\.env.local  ✅

잘못된 위치:
D:\devel\MSLINKV2\mspharmHQ\scripts\.env.local  ❌
D:\devel\MSLINKV2\.env.local  ❌
```

## 🔧 해결 방법

### 1. 즉시 해결법

#### 방법 A: 파일 재생성
```bash
# 1. 기존 파일 삭제
rm .env.local

# 2. 새 파일 생성 (UTF-8 인코딩)
echo "GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y" > .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co" >> .env.local
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> .env.local
```

#### 방법 B: 환경 변수 직접 설정
```bash
# Windows PowerShell
$env:GEMINI_API_KEY="AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y"
npx tsx scripts/test-gemini-api.ts

# Windows CMD
set GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y
npx tsx scripts/test-gemini-api.ts

# Linux/Mac
export GEMINI_API_KEY="AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y"
npx tsx scripts/test-gemini-api.ts
```

### 2. 파일 내용 검증

#### 올바른 .env.local 형식
```env
# 주석은 # 으로 시작
GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y
NEXT_PUBLIC_SUPABASE_URL=https://qpuagbmgtebcetzvbrfq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# 공백 라인은 문제없음

# 따옴표는 선택사항 (특수문자 포함시에만 필요)
JWT_SECRET="some-secret-with-spaces"
```

#### 피해야 할 형식
```env
# ❌ 잘못된 형식들
GEMINI_API_KEY = AIzaSyD...          # 등호 주변 공백
GEMINI_API_KEY: AIzaSyD...           # 콜론 사용
"GEMINI_API_KEY"="AIzaSyD..."        # 키에 따옴표
GEMINI_API_KEY=''                    # 빈 값
```

### 3. 디버깅 도구 사용

#### 환경 변수 확인 스크립트
```bash
# 간단한 확인
npx tsx scripts/check-environment.ts

# 상세한 디버깅 정보
npx tsx scripts/test-gemini-api.ts
```

#### 수동 확인 방법
```javascript
// Node.js 콘솔에서 확인
console.log('현재 작업 디렉토리:', process.cwd());
console.log('환경 변수:', process.env.GEMINI_API_KEY);
```

## 🛠️ 예방 조치

### 1. 스크립트 작성 시 모범 사례

#### 강화된 환경 변수 로딩
```typescript
import dotenv from 'dotenv';
import path from 'path';

// 절대 경로로 .env.local 로드
const envPath = path.join(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });

// 로딩 실패 시 명확한 에러 메시지
if (result.error) {
  console.error('❌ .env.local 파일을 찾을 수 없습니다:', envPath);
  console.log('📝 다음 위치에 .env.local 파일을 생성해주세요:', process.cwd());
  process.exit(1);
}

// 필수 환경 변수 검증
const requiredEnvVars = ['GEMINI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 필수 환경 변수가 없습니다: ${envVar}`);
    process.exit(1);
  }
}
```

### 2. .env.local 템플릿 제공

#### .env.example 파일 생성
```env
# Gemini AI API
GEMINI_API_KEY=your_gemini_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# JWT Secret (for employee purchase system)
JWT_SECRET=your_jwt_secret_here

# Optional: Other AI Services
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 3. 개발 환경 설정 자동화

#### setup.sh 스크립트 (Linux/Mac)
```bash
#!/bin/bash
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo "📝 .env.local 파일이 생성되었습니다. 실제 값으로 수정해주세요."
else
  echo "✅ .env.local 파일이 이미 존재합니다."
fi
```

#### setup.ps1 스크립트 (Windows PowerShell)
```powershell
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "📝 .env.local 파일이 생성되었습니다. 실제 값으로 수정해주세요."
} else {
    Write-Host "✅ .env.local 파일이 이미 존재합니다."
}
```

## 📋 체크리스트

### 환경 변수 문제 발생 시 확인사항

- [ ] **파일 위치**: `.env.local`이 프로젝트 루트에 있는가?
- [ ] **파일 내용**: 필수 환경 변수가 모두 설정되어 있는가?
- [ ] **파일 인코딩**: UTF-8 (BOM 없음)으로 저장되어 있는가?
- [ ] **실행 위치**: 프로젝트 루트에서 스크립트를 실행하는가?
- [ ] **파일 권한**: 파일을 읽을 수 있는 권한이 있는가?
- [ ] **특수 문자**: API 키에 특수 문자가 있다면 따옴표로 감쌌는가?

### 디버깅 순서

1. **파일 존재 확인**
   ```bash
   ls -la .env.local  # Linux/Mac
   dir .env.local     # Windows
   ```

2. **파일 내용 확인**
   ```bash
   cat .env.local     # Linux/Mac
   type .env.local    # Windows
   ```

3. **환경 변수 로딩 테스트**
   ```bash
   npx tsx scripts/check-environment.ts
   ```

4. **개별 API 테스트**
   ```bash
   npx tsx scripts/test-gemini-api.ts
   ```

## 🔄 재발 방지 정책

### 1. 개발팀 규칙
- 새 스크립트 작성 시 반드시 환경 변수 검증 로직 포함
- .env.example 파일을 항상 최신 상태로 유지
- 환경 변수 문제 발생 시 이 문서 참조 후 해결

### 2. 코드 리뷰 체크포인트
- [ ] 환경 변수 로딩 방식이 표준화되어 있는가?
- [ ] 필수 환경 변수 검증이 포함되어 있는가?
- [ ] 오류 발생 시 명확한 안내 메시지가 있는가?

### 3. 문서화 규칙
- 새로운 환경 변수 추가 시 이 문서에 예시 추가
- 환경 변수 관련 문제 발생 시 해결 방법을 이 문서에 추가

---

**📝 문서 업데이트 이력**
- 2024-12-19: 초기 작성 (.env.local 인식 문제 해결)
- 향후 환경 변수 관련 이슈 발생 시 이 문서에 계속 추가

**🔧 관련 파일**
- `scripts/test-gemini-api.ts`: 강화된 환경 변수 로딩 예시
- `scripts/check-environment.ts`: 환경 변수 검증 도구
- `.env.example`: 환경 변수 템플릿
