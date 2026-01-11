# HR 시스템과 Family 관리 통합 가이드

## 📋 개요

기존 MSP Family 임직원 구매 시스템의 Family 관리 기능을 확장하여, 직원 등록 시 HR 정보(급여, 근태, 휴가)도 함께 관리할 수 있도록 통합되었습니다.

## 🎯 주요 변경사항

### 1. Family 추가 시 HR 정보 입력

기존에는 이름, 권한, 비밀번호만 입력했지만, 이제 다음 정보도 함께 입력할 수 있습니다:

#### 기본 정보
- ✅ 이름 (필수)
- ✅ 권한: family / secretary / master (필수)
- ✅ 비밀번호 4자리 (필수)

#### HR 정보 (선택사항)
**연락처 정보:**
- 이메일
- 전화번호

**근무 정보:**
- 직책 (약사, 약무보조원, 관리자, 인턴)
- 부서 (기본값: 약국)
- 고용 형태 (정규직, 파트타임, 계약직, 인턴)
- 입사일

**급여 정보:**
- 기본급 (월급) - 정규직용
- 시급 - 파트타임용
- 생년월일

### 2. 자동화 기능

Family 추가 시 다음 작업이 자동으로 수행됩니다:

1. **급여 정보 자동 등록**
   - 기본급 또는 시급 입력 시 `salaries` 테이블에 자동 저장
   - 초과근무/야간근무/휴일근무 배율 자동 설정 (1.5배, 1.5배, 2.0배)

2. **연차 자동 부여**
   - 입사일 기준으로 해당 연도 연차 자동 계산
   - 1년 미만: 월 1일 (최대 11일)
   - 1년 이상: 15일 + 매 2년마다 1일 (최대 25일)

3. **휴가 잔여 초기화**
   - `leave_balance` 테이블에 연차 정보 자동 생성

## 🔄 사용 방법

### Family 추가 (HR 정보 포함)

1. **MSP Family 관리 페이지 접속**
   ```
   /employee-purchase/manage-employees
   ```

2. **"새 Family 추가" 버튼 클릭**

3. **기본 정보 입력** (필수)
   - 이름: 직원 이름
   - 권한: family (일반 직원)
   - 초기 비밀번호: 4자리 숫자

4. **"▶ HR 정보 추가" 클릭** (선택사항)
   - 연락처 정보 입력
   - 근무 정보 입력
   - 급여 정보 입력

5. **"Family 추가" 버튼 클릭**

### 결과

✅ employees 테이블에 직원 정보 저장
✅ salaries 테이블에 급여 정보 저장 (입력한 경우)
✅ leave_balance 테이블에 연차 정보 자동 생성 (입사일 입력한 경우)

## 📊 Family 목록 보기

Family 목록에서 다음 정보를 확인할 수 있습니다:

- 이름 및 권한
- 직책 (약사, 약무보조원 등)
- 입사일 또는 가입일
- 이메일, 전화번호
- 기본급 (설정된 경우)

## 🔌 API 엔드포인트

### 1. Family 추가 (HR 정보 포함)

**POST** `/api/employee-purchase/employees`

```json
{
  "name": "홍길동",
  "role": "staff",
  "password": "1234",
  "email": "hong@pharmacy.com",
  "phone": "010-1234-5678",
  "position": "약무보조원",
  "department": "약국",
  "employment_type": "full_time",
  "hire_date": "2025-01-10",
  "birth_date": "1990-01-01"
}
```

### 2. 급여 정보 설정

**POST** `/api/hr/salary/set`

```json
{
  "employee_id": "uuid",
  "base_salary": 2500000,
  "hourly_rate": null,
  "effective_from": "2025-01-10",
  "overtime_rate": 1.5,
  "night_shift_rate": 1.5,
  "holiday_rate": 2.0
}
```

### 3. 연차 자동 부여

**POST** `/api/hr/leave/grant-annual`

```json
{
  "employee_id": "uuid",
  "year": 2025
}
```

## 🔗 HR 시스템 연계

Family로 추가된 직원은 다음 HR 기능을 바로 사용할 수 있습니다:

### 직원용 기능
- **출퇴근 체크**: `/employee-hr/dashboard`
- **근태 기록 조회**: `/employee-hr/attendance`
- **휴가 신청**: `/employee-hr/leave`
- **급여 명세서**: `/employee-hr/payroll`

### 관리자용 기능 (secretary, master)
- **전체 직원 근태 관리**: `/hr-admin/attendance`
- **급여 계산 및 승인**: `/hr-admin/payroll`
- **휴가 승인/거부**: `/hr-admin/leave`
- **인사평가**: `/hr-admin/evaluation`
- **통계 및 리포트**: `/hr-admin/dashboard`

## 💡 활용 예시

### 예시 1: 정규직 약사 추가

```
이름: 김약사
권한: family
비밀번호: 1234

HR 정보:
- 이메일: kim@pharmacy.com
- 전화: 010-1111-2222
- 직책: 약사
- 고용형태: 정규직
- 입사일: 2025-01-10
- 기본급: 3,500,000원
```

**자동 처리:**
- ✅ 급여 테이블에 월급 350만원 등록
- ✅ 2025년 연차 11일 자동 부여 (1년 미만)
- ✅ 출퇴근 체크 가능
- ✅ 휴가 신청 가능

### 예시 2: 파트타임 직원 추가

```
이름: 이보조
권한: family
비밀번호: 5678

HR 정보:
- 전화: 010-3333-4444
- 직책: 약무보조원
- 고용형태: 파트타임
- 입사일: 2025-01-10
- 시급: 12,000원
```

**자동 처리:**
- ✅ 급여 테이블에 시급 12,000원 등록
- ✅ 근무시간 기반 급여 자동 계산
- ✅ 출퇴근 체크로 근무시간 자동 집계

### 예시 3: 관리자 추가

```
이름: 박관리
권한: secretary
비밀번호: 9999

HR 정보:
- 이메일: park@pharmacy.com
- 직책: 관리자
- 고용형태: 정규직
- 입사일: 2020-01-01
- 기본급: 2,800,000원
```

**자동 처리:**
- ✅ 근속 5년으로 연차 17일 자동 부여
- ✅ 관리자 권한으로 휴가 승인 가능
- ✅ 직원 근태 조회 및 관리 가능

## ⚠️ 주의사항

### 1. 기본급 vs 시급
- **정규직**: 기본급만 입력
- **파트타임**: 시급만 입력
- 둘 다 입력하면 기본급 우선

### 2. 입사일 필수
- 연차 자동 부여를 위해 입사일 입력 권장
- 입사일 없으면 연차가 부여되지 않음

### 3. 권한 변경
- Family 목록에서 권한 변경 가능
- 권한 변경해도 HR 정보는 유지됨

### 4. Family 삭제
- 구매 요청 내역이 있으면 삭제 불가
- 근태/급여 기록이 있어도 삭제는 가능 (주의)

## 🔄 기존 Family HR 정보 추가

이미 등록된 Family에 HR 정보를 추가하려면:

### 방법 1: 직접 API 호출

```javascript
// 급여 정보 추가
await fetch('/api/hr/salary/set', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employee_id: '기존_직원_ID',
    base_salary: 2500000,
    effective_from: '2025-01-10',
  }),
});

// 연차 부여
await fetch('/api/hr/leave/grant-annual', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    employee_id: '기존_직원_ID',
    year: 2025,
  }),
});
```

### 방법 2: Supabase에서 직접 업데이트

```sql
-- 직원 정보 업데이트
UPDATE employees 
SET 
  email = 'example@pharmacy.com',
  phone = '010-0000-0000',
  position = '약사',
  hire_date = '2020-01-01',
  employment_type = 'full_time'
WHERE id = '직원_ID';

-- 급여 정보 추가
INSERT INTO salaries (employee_id, base_salary, effective_from)
VALUES ('직원_ID', 2500000, '2025-01-10');

-- 연차 부여
INSERT INTO leave_balance (employee_id, leave_type_id, year, total_days, used_days)
VALUES ('직원_ID', (SELECT id FROM leave_types WHERE code = 'ANNUAL'), 2025, 15, 0);
```

## 📈 확인 및 모니터링

### 1. Family가 잘 등록되었는지 확인

```
/employee-purchase/manage-employees
```
- Family 목록에서 이름, 직책, 급여 확인

### 2. HR 기능이 작동하는지 확인

해당 Family로 로그인:
```
/employee-purchase/login
```

HR 대시보드 접속:
```
/employee-hr/dashboard
```

- 출퇴근 체크 테스트
- 휴가 잔여 확인
- 급여 명세서 확인

### 3. Supabase에서 데이터 확인

```sql
-- 직원 정보
SELECT * FROM employees WHERE name = 'Family이름';

-- 급여 정보
SELECT * FROM salaries WHERE employee_id = '직원_ID';

-- 연차 잔여
SELECT * FROM leave_balance WHERE employee_id = '직원_ID';
```

## 🚀 다음 단계

1. **Family 추가 시 HR 정보도 함께 입력**
2. **기존 Family에도 HR 정보 추가** (선택사항)
3. **직원들에게 HR 시스템 사용법 안내**
4. **출퇴근 체크 시작**
5. **월말에 급여 자동 계산**

## 📞 문의

HR 시스템 관련 문의는 시스템 관리자에게 연락하세요.
