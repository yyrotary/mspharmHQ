# 🚨 긴급 배포 지침 - 상담일지 날짜 제약조건 수정

## 📋 배포 전 확인사항

### 1. 에러 상황
- **에러 코드**: `23514`
- **에러 메시지**: `new row for relation "consultations" violates check constraint "consultations_consult_date_check"`
- **문제 날짜**: `2025-06-19 17:35:00+00`

### 2. 해결 방법
- 데이터베이스 제약조건을 현재+2년으로 확장
- 백엔드/프론트엔드 검증 로직도 2년으로 통일

## 🚀 배포 순서

### 1단계: 데이터베이스 스키마 수정 (우선 실행)
```sql
-- Supabase SQL Editor에서 실행
-- database/emergency_constraint_fix.sql 내용:

ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_consult_date_check;

ALTER TABLE consultations ADD CONSTRAINT consultations_consult_date_check 
  CHECK (
    consult_date >= '1900-01-01'::timestamp with time zone AND 
    consult_date <= (NOW() + INTERVAL '2 years')
  );
```

### 2단계: 코드 배포
```bash
git add .
git commit -m "🔧 긴급 수정: 상담일지 날짜 제약조건 2년으로 확장

- 데이터베이스 제약조건: 현재+2년으로 확장
- 백엔드 검증: validateKoreaDateRange() 2년 적용  
- 프론트엔드: datetime-local min/max 2년 적용
- 해결: 2025-06-19 날짜 입력 에러 수정"

git push origin main
```

### 3단계: 배포 확인
1. Vercel 배포 완료 대기 (약 2-3분)
2. 상담일지 수정 기능 테스트
3. 2025-06-19 날짜로 다시 시도

## ⚡ 긴급 테스트 시나리오

### 성공해야 하는 케이스
- [x] 2025-06-19 날짜 입력 및 수정
- [x] 현재 날짜 입력
- [x] 과거 날짜 입력 (1900년 이후)
- [x] 미래 날짜 입력 (2년 이내)

### 실패해야 하는 케이스  
- [x] 1900년 이전 날짜
- [x] 현재+2년 초과 날짜

## 📞 문제 발생 시
1. Vercel 함수 로그 확인
2. 브라우저 개발자 도구 콘솔 확인
3. `/api/health` 엔드포인트로 상태 확인

---
**긴급 배포 날짜**: 2024-12-19  
**수정 버전**: v1.1.1 (긴급 제약조건 확장) 