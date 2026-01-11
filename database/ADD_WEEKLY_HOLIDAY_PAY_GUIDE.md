# 주휴 수당 컬럼 추가 가이드

## 문제 상황
급여 계산 시 500 에러가 발생합니다. `payroll` 테이블에 `weekly_holiday_pay` 컬럼이 없어서 발생하는 문제입니다.

## 해결 방법

### 1. Supabase SQL Editor에서 실행

1. Supabase 대시보드 접속
2. 좌측 메뉴에서 **SQL Editor** 선택
3. **New query** 클릭
4. 아래 SQL 복사하여 붙여넣기:

```sql
-- payroll 테이블에 weekly_holiday_pay 컬럼 추가
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payroll' 
        AND column_name = 'weekly_holiday_pay'
    ) THEN
        ALTER TABLE payroll 
        ADD COLUMN weekly_holiday_pay NUMERIC(12,2) DEFAULT 0;
        
        RAISE NOTICE 'weekly_holiday_pay 컬럼이 추가되었습니다.';
    ELSE
        RAISE NOTICE 'weekly_holiday_pay 컬럼이 이미 존재합니다.';
    END IF;
END $$;

-- 기존 레코드에 대해 기본값 설정
UPDATE payroll 
SET weekly_holiday_pay = 0 
WHERE weekly_holiday_pay IS NULL;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN payroll.weekly_holiday_pay IS '주휴 수당 (파트타임 직원, 주 15시간 이상 근무 시 지급)';
```

5. **Run** 버튼 클릭
6. "Success" 메시지 확인

### 2. 확인

SQL Editor에서 다음 쿼리로 컬럼이 추가되었는지 확인:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'payroll' 
AND column_name = 'weekly_holiday_pay';
```

### 3. 서버 재시작

터미널에서:
```bash
# 서버가 실행 중이면 Ctrl+C로 종료 후
npm run dev
```

## 주휴 수당이란?

- **대상**: 파트타임 직원
- **조건**: 주 평균 15시간 이상 근무
- **계산**: (평균 일 근무시간) × 시급 × 주수
- **적용**: 근로기준법에 따른 법정 수당

## 완료 후 테스트

1. 파트타임 직원 선택
2. 근태 확정 (주 15시간 이상 근무 데이터)
3. 급여 자동 계산
4. Step 3에서 "🎉 주휴 수당" 항목 확인
