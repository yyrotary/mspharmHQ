# 고객용 앱 설정 가이드

## 🚀 빠른 설정 가이드

### 1. 환경 변수 설정

#### ⚠️ 중요: 파일 위치 및 인코딩

**반드시 프로젝트 루트 디렉토리**에 `.env.local` 파일을 생성하세요:

```
올바른 위치: D:\devel\MSLINKV2\mspharmHQ\.env.local ✅
잘못된 위치: D:\devel\MSLINKV2\mspharmHQ\scripts\.env.local ❌
```

**파일 인코딩**: UTF-8 (BOM 없음)으로 저장

#### 환경 변수 내용

```env
# Gemini AI API
GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y

# Supabase 설정 (실제 값으로 교체)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT 시크릿
JWT_SECRET=your_jwt_secret_here
```

#### 환경 변수 문제 해결

파일이 인식되지 않는 경우:

1. **파일 위치 확인**:
   ```bash
   # Windows
   dir .env.local
   
   # Linux/Mac  
   ls -la .env.local
   ```

2. **환경 변수 직접 설정** (임시 해결):
   ```bash
   # Windows PowerShell
   $env:GEMINI_API_KEY="AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y"
   
   # Windows CMD
   set GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y
   ```

3. **상세한 문제 해결**: [환경 변수 문제 해결 가이드](./ENVIRONMENT_TROUBLESHOOTING.md) 참조

### 2. Supabase 데이터베이스 스키마 적용

#### 방법 1: Supabase 대시보드 사용 (권장)

1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택 → **SQL Editor** 메뉴 클릭
3. **New Query** 버튼 클릭
4. `database/customer_app_schema.sql` 파일 내용을 복사하여 붙여넣기
5. **Run** 버튼 클릭하여 실행

#### 방법 2: 터미널 사용

```bash
# Gemini API 테스트
npx tsx scripts/test-gemini-api.ts

# 데이터베이스 스키마 적용 (수동)
# Supabase CLI가 설치된 경우
supabase db push
```

### 3. Supabase Storage 버킷 생성

1. Supabase 대시보드 → **Storage** 메뉴
2. **New bucket** 클릭
3. 버킷 설정:
   - **Name**: `food-images`
   - **Public bucket**: ✅ 체크
   - **File size limit**: 10 MB
   - **Allowed MIME types**: `image/jpeg,image/jpg,image/png,image/webp`
4. **Save** 클릭

### 4. 고객 PIN 생성

Supabase SQL Editor에서 다음 쿼리 실행:

```sql
-- 첫 번째 고객의 PIN 생성
SELECT create_customer_pin(
  (SELECT id FROM customers WHERE customer_code = '00001' LIMIT 1)
) as pin_code;

-- 여러 고객의 PIN 일괄 생성
DO $$
DECLARE
    customer_record RECORD;
    generated_pin VARCHAR(6);
BEGIN
    FOR customer_record IN 
        SELECT id, name, customer_code 
        FROM customers 
        WHERE is_deleted = FALSE 
        ORDER BY customer_code 
        LIMIT 5
    LOOP
        generated_pin := create_customer_pin(customer_record.id);
        RAISE NOTICE '고객: % (%) - PIN: %', 
            customer_record.name, 
            customer_record.customer_code, 
            generated_pin;
    END LOOP;
END $$;
```

## 🧪 테스트 및 확인

### 1. Gemini API 테스트

```bash
npx tsx scripts/test-gemini-api.ts
```

예상 결과:
```
🧪 Gemini API 테스트 시작...

1. 기본 텍스트 생성 테스트...
✅ 응답: 안녕하세요! 저는 음식 분석 AI입니다...

2. JSON 구조화 응답 테스트...
✅ JSON 응답: {"message": "테스트 성공"...}

3. 음식 분석 프롬프트 구조 테스트...
✅ 음식 분석 응답: {"food_name": "김치찌개"...}

🎉 Gemini API 테스트 완료!
```

### 2. 데이터베이스 확인

```sql
-- 테이블 생성 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('customer_pins', 'food_records', 'lifestyle_records');

-- PIN 생성 확인
SELECT cp.pin_code, c.name, c.customer_code
FROM customer_pins cp
JOIN customers c ON cp.customer_id = c.id
WHERE cp.is_active = TRUE;
```

### 3. 웹앱 테스트

1. 개발 서버 시작:
   ```bash
   npm run dev
   ```

2. 브라우저에서 접속:
   ```
   http://localhost:3000/customer
   ```

3. 생성된 PIN으로 로그인 테스트

## 📱 사용 시나리오

### 고객 사용법

1. **로그인**:
   - `/customer` 접속
   - 약사가 제공한 6자리 PIN 입력

2. **상담 기록 확인**:
   - 대시보드에서 최근 상담 내역 확인
   - 특정 상담 클릭하여 상세 정보 보기

3. **음식 기록**:
   - "음식 기록" 메뉴 선택
   - 카메라로 음식 촬영
   - AI 분석 결과 확인 및 메모 추가

### 약사 관리법

1. **고객 PIN 생성**:
   ```sql
   SELECT create_customer_pin('고객_UUID') as new_pin;
   ```

2. **고객 음식 기록 확인**:
   ```sql
   SELECT fr.*, c.name as customer_name
   FROM food_records fr
   JOIN customers c ON fr.customer_id = c.id
   WHERE c.customer_code = '00001'
   ORDER BY fr.recorded_date DESC;
   ```

## 🔧 트러블슈팅

### 자주 발생하는 문제

#### 1. Gemini API 오류
```
Error: API key not valid
```
**해결법**: `.env.local`에서 `GEMINI_API_KEY` 확인

#### 2. 카메라 접근 오류
```
Camera access denied
```
**해결법**: HTTPS 환경에서 실행 (`npm run dev:https`)

#### 3. Supabase 연결 오류
```
supabaseUrl is required
```
**해결법**: Supabase URL과 Service Role Key 확인

#### 4. 이미지 업로드 실패
```
Storage bucket not found
```
**해결법**: `food-images` 버킷 생성 및 Public 설정 확인

### 로그 확인 방법

1. **브라우저 개발자 도구**: F12 → Console 탭
2. **서버 로그**: 터미널에서 API 호출 로그 확인
3. **Supabase 로그**: Supabase 대시보드 → Logs 메뉴

## 🚀 운영 환경 배포

### 환경 변수 설정

```env
# 운영 환경용
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key
GEMINI_API_KEY=AIzaSyDSFB4bUqGGqRLaY8mbxNXBX9Jf2MkfE-Y
```

### HTTPS 설정

고객용 앱은 카메라 기능 사용을 위해 **HTTPS가 필수**입니다:

```bash
# 로컬 HTTPS 개발 환경
npm run dev:https

# 또는 ngrok 사용
npx ngrok http 3000
```

### 성능 최적화

1. **이미지 압축**: 업로드 전 클라이언트에서 이미지 압축
2. **API 캐싱**: Supabase 쿼리 결과 캐싱
3. **CDN 활용**: Supabase Storage CDN 활용

---

**🎉 설정 완료!**

이제 고객들이 스마트폰에서 명성약국 고객용 앱을 사용할 수 있습니다!
