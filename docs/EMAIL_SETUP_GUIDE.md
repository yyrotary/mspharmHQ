# 📧 이메일 전송 설정 가이드

## 개요
세무사 보고 기능에서 급여대장을 이메일로 전송하기 위한 설정 방법입니다.

## 이메일 서비스 선택

### 추천: Resend (무료 플랜 제공)
- **장점**: 간단한 API, 무료 플랜 (월 100개 이메일), Next.js 공식 추천
- **가격**: 무료 플랜 → Pro $20/월 (50,000개)
- **웹사이트**: https://resend.com

### 대안
1. **SendGrid**: 월 100개 무료
2. **AWS SES**: 62,000개 무료 (EC2 사용시)
3. **Nodemailer + Gmail**: 무료 (제한적)

## Resend 설정 방법

### 1. 회원가입
1. https://resend.com 접속
2. "Start Building for Free" 클릭
3. 이메일로 회원가입

### 2. API Key 생성
1. 로그인 후 Dashboard로 이동
2. 좌측 메뉴 "API Keys" 클릭
3. "Create API Key" 클릭
4. 이름 입력 (예: "mspharmHQ-production")
5. Permission: "Full access" 선택
6. "Add" 클릭
7. **API Key 복사** (한 번만 표시됨!)

### 3. 도메인 추가 (선택사항, 권장)
1. 좌측 메뉴 "Domains" 클릭
2. "Add Domain" 클릭
3. 도메인 입력 (예: yourdomain.com)
4. DNS 레코드 추가 (제공되는 TXT, MX 레코드)
5. 인증 완료

**도메인이 없는 경우**: 테스트용으로 `onboarding@resend.dev` 사용 가능 (하루 1개 제한)

### 4. 환경변수 설정

#### 로컬 개발 (.env.local)
```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx

# 발신자 이메일 (도메인 인증 후)
EMAIL_FROM=noreply@yourdomain.com

# 또는 테스트용
EMAIL_FROM=onboarding@resend.dev
```

#### Vercel 배포
1. Vercel Dashboard → 프로젝트 선택
2. "Settings" → "Environment Variables"
3. 추가:
   - `RESEND_API_KEY`: `re_xxxxx...`
   - `EMAIL_FROM`: `noreply@yourdomain.com`
4. "Save" 클릭
5. 재배포

## 테스트

### 1. 데이터베이스 테이블 생성
Supabase SQL Editor에서 실행:
```sql
-- database/create_payroll_settings.sql 내용 실행
```

### 2. 세무사 이메일 설정
1. 관리자로 로그인
2. "세무사 보고" 메뉴
3. 세무사 이메일 입력 및 저장

### 3. 이메일 전송 테스트
1. 급여 확정 (월 급여 정산 메뉴에서)
2. 세무사 보고 메뉴에서 급여대장 생성
3. "📧 세무사 전송" 클릭
4. 확인 팝업 → "확인"
5. 결과 확인:
   - ✅ 성공: "세무사에게 이메일이 전송되었습니다"
   - ⚠️ 개발 모드: "이메일 전송이 시뮬레이션되었습니다"
   - ❌ 실패: 에러 메시지

## 이메일 내용

### 제목
```
[급여대장] 2026년 1월 급여대장
```

### 본문
```
안녕하세요.

2026년 1월 급여대장을 전송드립니다.

■ 요약
- 대상 인원: 5명
- 총 지급액: 15,000,000원
- 실수령액 합계: 12,500,000원

첨부된 CSV 파일을 확인해주시기 바랍니다.

감사합니다.
```

### 첨부파일
- `급여대장_2026-01.csv`
- UTF-8 BOM 인코딩 (Excel에서 한글 정상 표시)

## 비용 예상

### Resend 무료 플랜
- **월 100개 이메일**: 무료
- 직원 5명, 월 1회 전송: **연 12개 이메일**
- → **무료 플랜으로 충분**

### Pro 플랜 ($20/월)
- 월 50,000개 이메일
- 대규모 조직에 적합

## 보안

### API Key 보호
- ✅ `.env.local`에 저장 (절대 커밋 금지)
- ✅ `.gitignore`에 `.env.local` 포함
- ✅ Vercel 환경변수에 암호화 저장
- ❌ 소스코드에 직접 입력 금지

### 이메일 보안
- 급여 데이터는 CSV 첨부파일로만 전송
- TLS 암호화 전송
- 전송 이력 데이터베이스 저장 (`tax_reports` 테이블)

## 트러블슈팅

### "개발 모드: 이메일 전송이 시뮬레이션되었습니다"
- **원인**: `RESEND_API_KEY` 환경변수 미설정
- **해결**: `.env.local`에 API Key 추가

### "이메일 전송 실패: Invalid 'from' address"
- **원인**: 도메인 미인증 상태에서 커스텀 도메인 사용
- **해결**: 
  1. 도메인 인증 완료
  2. 또는 `EMAIL_FROM=onboarding@resend.dev` 사용 (테스트)

### "relation 'public.payroll_settings' does not exist"
- **원인**: 데이터베이스 테이블 미생성
- **해결**: Supabase에서 `database/create_payroll_settings.sql` 실행

### 이메일이 스팸함으로 이동
- **원인**: 도메인 SPF/DKIM 미설정
- **해결**: Resend에서 제공하는 DNS 레코드 추가

## 대안: Gmail SMTP (무료, 간단)

### 설정
```env
EMAIL_SERVICE=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
```

### Gmail 앱 비밀번호 생성
1. Google 계정 → 보안
2. 2단계 인증 활성화
3. "앱 비밀번호" 생성
4. 앱: "메일", 기기: "기타" 선택
5. 생성된 16자리 비밀번호 복사

### 제한사항
- 하루 500개 이메일 제한
- Gmail 계정 필요
- 비즈니스용으로는 비추천

## 지원
- Resend 문서: https://resend.com/docs
- Resend Discord: https://resend.com/discord
- 프로젝트 이슈: GitHub Issues
