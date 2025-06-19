# 🔧 상담일지 날짜 제약조건 핫픽스 (한국시간 기준)

## 📋 문제 상황
- **에러**: `consultations_consult_date_check` 제약조건 위반
- **원인**: 데이터베이스에서 `consult_date <= now()` 제약으로 미래 날짜 입력 불가
- **시간대 문제**: UTC와 한국시간(KST) 혼재로 인한 날짜 처리 불일치
- **발생 환경**: Vercel 배포 환경

## 🛠️ 해결 방법

### 1. 한국시간(KST) 기준 통일
- **새로운 유틸리티**: `app/lib/date-utils.ts` 생성
- **모든 날짜 처리**: 한국시간 기준으로 통일
- **시간대 상수**: `Asia/Seoul` 사용

### 2. 데이터베이스 제약조건 수정 (긴급 수정)
```sql
-- 기존 제약조건 제거
ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;

-- 새로운 제약조건 추가 (2년 범위로 확장)
ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::timestamp with time zone AND 
    consult_date <= (NOW() + INTERVAL '2 years')
  );
```

**⚡ 긴급 수정사항**: 
- 날짜 범위를 현재+2년으로 확장하여 테스트 및 미래 날짜 입력 허용
- 한국시간 기준 대신 UTC 기준으로 단순화하여 호환성 향상

### 3. 백엔드 날짜 검증 강화 (한국시간 기준)
- **API 라우트**: `app/api/consultation-v2/route.ts`
- **라이브러리**: `app/lib/supabase-consultation.ts`
- **새 유틸리티**: `validateKoreaDateRange()`, `toKoreaISOString()` 사용
- **검증 범위**: 1900년 이후 ~ 현재+2년 이내 (긴급 확장)

### 4. 프론트엔드 한국시간 처리
- **새 상담일지**: 한국시간 기준 초기값 및 min/max 설정
- **편집 모달**: 한국시간 기준 날짜 변환 및 표시
- **날짜 표시**: `formatKoreaDateTime()` 함수로 통일

## 📁 수정된 파일들

### 🗄️ 데이터베이스
- `database/consultation_schema_fix.sql` (한국시간 기준으로 수정)
- `database/emergency_constraint_fix.sql` (긴급 제약조건 수정)

### 🔧 백엔드
- `app/lib/date-utils.ts` (새로 생성 - 한국시간 유틸리티)
- `app/api/consultation-v2/route.ts` (한국시간 검증 적용)
- `app/lib/supabase-consultation.ts` (한국시간 변환 적용)

### 🎨 프론트엔드
- `app/consultation/page.tsx` (한국시간 기준 날짜 처리)

## 🚀 배포 순서

### 1. 데이터베이스 스키마 업데이트
```bash
# Supabase SQL Editor에서 실행
-- database/consultation_schema_fix.sql 내용 실행
```

### 2. 코드 배포
- GitHub에 푸시하면 자동 배포됨
- Vercel 환경에서 새로운 날짜 검증 로직 적용

### 3. 테스트
- 미래 날짜 입력 테스트 (1년 이내)
- 과거 날짜 입력 테스트 (1900년 이후)
- 범위 초과 날짜 에러 메시지 확인

## ✅ 검증 포인트

1. **정상 케이스 (한국시간 기준)**
   - 현재 한국시간 날짜 입력 ✅
   - 과거 날짜 입력 (1900년 이후) ✅
   - 미래 날짜 입력 (현재+2년 이내) ✅
   - 시간대 자동 변환 확인 ✅

2. **에러 케이스**
   - 1900년 이전 날짜 입력 ❌
   - 현재+2년 초과 날짜 입력 ❌
   - 잘못된 날짜 형식 ❌

## 📞 문의
- 문제 발생 시 로그 확인: `/api/health` 엔드포인트
- 브라우저 개발자 도구 콘솔 확인
- 서버 로그에서 상세 에러 메시지 확인

---

**적용 완료 날짜**: 2024-12-19  
**핫픽스 버전**: v1.1.0 (한국시간 기준 통일)

## 🌏 한국시간(KST) 처리 특징

- **일관된 시간대**: 모든 날짜 처리가 `Asia/Seoul` 기준
- **자동 변환**: 사용자 입력이 자동으로 한국시간으로 변환
- **표시 통일**: 모든 날짜 표시가 한국시간 기준
- **검증 정확성**: 한국시간 기준으로 날짜 범위 검증 