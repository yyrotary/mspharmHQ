# HR 관리 시스템 가이드

## 📋 목차
1. [시스템 개요](#시스템-개요)
2. [주요 기능](#주요-기능)
3. [데이터베이스 설치](#데이터베이스-설치)
4. [기능별 상세 설명](#기능별-상세-설명)
5. [API 명세](#api-명세)
6. [화면 구성](#화면-구성)

## 🎯 시스템 개요

약국 직원들의 근태, 급여, 휴가, 인사평가를 종합 관리하는 HR 시스템입니다.

### 핵심 기능
- ✅ **근태 관리**: 출퇴근 체크, 초과근무, 야간근무 기록
- ✅ **급여 관리**: 급여 계산, 명세서 발행, 4대보험 자동 계산
- ✅ **휴가 관리**: 휴가 신청/승인, 잔여 일수 관리
- ✅ **인사 평가**: 직원 평가, 성과 관리
- ✅ **통계 및 리포트**: 월별/연도별 통계, Excel 내보내기

## 🚀 주요 기능

### 1. 근태 관리 (Attendance)
- **출퇴근 체크**: 버튼 클릭으로 간편한 출퇴근 기록
- **근무시간 자동 계산**: 출근-퇴근 시간으로 자동 계산
- **초과근무/야간근무**: 자동 감지 및 수당 계산
- **휴일근무**: 휴일 근무 자동 감지 (배율 2.0)
- **지각/조퇴 관리**: 출퇴근 시간 기준 자동 표시
- **월간 근태 요약**: 근무일수, 총 근무시간, 초과근무시간 통계

### 2. 급여 관리 (Payroll)
- **기본급 설정**: 직원별 기본급 및 시급 설정
- **자동 급여 계산**: 근무시간 기반 자동 계산
  - 기본급 + 초과근무수당 + 야간수당 + 휴일수당
- **4대보험 자동 계산**:
  - 국민연금 (4.5%)
  - 건강보험 (3.545%)
  - 장기요양보험 (건강보험료의 12.81%)
  - 고용보험 (0.9%)
- **소득세/주민세 계산**: 간이세액표 기준
- **급여명세서**: PDF 출력 가능
- **급여 지급 내역**: 월별/연도별 조회

### 3. 휴가 관리 (Leave Management)
- **휴가 종류**:
  - 연차 (유급, 15일)
  - 반차 (유급)
  - 병가 (유급, 10일)
  - 경조사 (유급, 5일)
  - 출산휴가 (유급, 90일)
  - 육아휴직 (유급, 365일)
- **휴가 신청/승인**: 모바일에서 간편 신청
- **잔여 일수 관리**: 실시간 잔여 일수 표시
- **연차 자동 부여**: 입사일 기준 자동 계산
- **휴가 사용 내역**: 월별/연도별 조회

### 4. 인사 평가 (Evaluation)
- **평가 항목** (각 5점 만점):
  - 업무 품질
  - 업무 속도
  - 책임감
  - 의사소통
  - 팀워크
  - 근무 태도
  - 적극성
- **종합 평가**: Excellent / Good / Average / Below Average / Poor
- **강점/약점 분석**: 텍스트 입력
- **개선 계획**: 향후 발전 방향
- **피평가자 확인**: 평가 결과 확인 및 의견 제출

## 📦 데이터베이스 설치

### 1. Supabase SQL Editor에서 실행

```bash
# 1. Supabase 대시보드 접속
# 2. SQL Editor 메뉴 선택
# 3. 아래 파일 내용 복사하여 실행
```

**실행 순서:**
1. `database/hr_management_schema.sql` 전체 실행
2. 실행 시간: 약 10-20초
3. 에러 없이 완료되는지 확인

### 2. 테이블 생성 확인

```sql
-- 생성된 테이블 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'salaries', 'attendance', 'leave_types', 
  'leave_balance', 'leave_requests', 'payroll', 
  'evaluations', 'work_schedules'
);
```

### 3. Storage 버킷 생성 (선택사항)

급여명세서 PDF나 평가서 파일 저장용:

```sql
-- Supabase Storage에서 버킷 생성
-- Dashboard > Storage > Create bucket
-- Name: hr-documents
-- Public: false (비공개)
```

## 📊 기능별 상세 설명

### 근태 관리 상세

#### 출퇴근 체크 프로세스
1. 직원 로그인
2. 대시보드에서 "출근" 버튼 클릭
3. 현재 시간이 `check_in_time`에 기록
4. 퇴근 시 "퇴근" 버튼 클릭
5. 근무시간 자동 계산

#### 근무시간 계산 로직
```typescript
// 기본 근무시간
work_hours = (check_out_time - check_in_time) / 60분

// 초과근무 (8시간 초과)
overtime_hours = work_hours > 8 ? work_hours - 8 : 0

// 야간근무 (22:00-06:00)
night_hours = calculate_night_hours(check_in, check_out)
```

#### 지각/조퇴 기준
- **지각**: 예정 출근시간 + 10분 이후
- **조퇴**: 예정 퇴근시간 - 30분 이전

### 급여 관리 상세

#### 급여 계산 공식

```typescript
// 1. 기본급
base_salary = employee.base_salary

// 2. 초과근무수당
overtime_pay = (base_salary / 월_근무시간) * overtime_hours * 1.5

// 3. 야간근무수당
night_shift_pay = (base_salary / 월_근무시간) * night_hours * 1.5

// 4. 휴일근무수당
holiday_pay = (base_salary / 월_근무시간) * holiday_hours * 2.0

// 5. 총 지급액 (세전)
gross_pay = base_salary + overtime_pay + night_shift_pay + holiday_pay + bonus + allowances

// 6. 4대보험 공제
national_pension = gross_pay * 0.045
health_insurance = gross_pay * 0.03545
long_term_care = health_insurance * 0.1281
employment_insurance = gross_pay * 0.009

// 7. 세금 공제 (간이세액표)
income_tax = calculate_income_tax(gross_pay)
resident_tax = income_tax * 0.1

// 8. 총 공제액
total_deductions = national_pension + health_insurance + long_term_care + 
                   employment_insurance + income_tax + resident_tax

// 9. 실수령액
net_pay = gross_pay - total_deductions
```

#### 급여 생성 프로세스
1. 관리자가 "급여 계산" 버튼 클릭
2. 대상 월 선택 (예: 2025년 1월)
3. 시스템이 해당 월 근태 데이터 조회
4. 자동으로 급여 계산
5. 관리자 검토 후 승인
6. 직원에게 급여명세서 발송

### 휴가 관리 상세

#### 연차 자동 부여 규칙 (근로기준법)
- **1년 미만**: 월 1일 (최대 11일)
- **1년 이상**: 15일
- **3년 이상**: 매 2년마다 +1일 (최대 25일)

예시:
- 입사 6개월: 6일
- 입사 1년: 15일
- 입사 3년: 16일
- 입사 5년: 17일
- 입사 20년: 25일 (최대)

#### 휴가 신청 프로세스
1. 직원이 휴가 신청
2. 관리자에게 알림
3. 관리자 승인/거부
4. 승인 시 잔여 일수 자동 차감
5. 휴가 당일 근태에 자동 반영

## 🔌 API 명세

### 근태 API

#### POST `/api/hr/attendance/check-in`
출근 체크

**Request:**
```json
{
  "employee_id": "uuid",
  "location": "본점" // 선택사항
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "check_in_time": "2025-01-10T09:00:00Z",
    "status": "present"
  }
}
```

#### POST `/api/hr/attendance/check-out`
퇴근 체크

#### GET `/api/hr/attendance/monthly?employee_id=uuid&month=2025-01`
월간 근태 조회

### 급여 API

#### POST `/api/hr/payroll/calculate`
급여 계산

**Request:**
```json
{
  "employee_id": "uuid",
  "pay_period_start": "2025-01-01",
  "pay_period_end": "2025-01-31"
}
```

#### GET `/api/hr/payroll?employee_id=uuid&year=2025`
급여 내역 조회

#### GET `/api/hr/payroll/[id]/pdf`
급여명세서 PDF 다운로드

### 휴가 API

#### POST `/api/hr/leave/request`
휴가 신청

**Request:**
```json
{
  "employee_id": "uuid",
  "leave_type_id": "uuid",
  "start_date": "2025-02-01",
  "end_date": "2025-02-03",
  "total_days": 3,
  "reason": "가족 여행"
}
```

#### POST `/api/hr/leave/[id]/approve`
휴가 승인

#### GET `/api/hr/leave/balance?employee_id=uuid`
휴가 잔여 조회

## 🖥️ 화면 구성

### 1. 직원용 화면

#### `/employee-hr/dashboard`
- 오늘의 출퇴근 상태
- 이번 달 근무시간
- 휴가 잔여 일수
- 최근 급여명세서

#### `/employee-hr/attendance`
- 출근/퇴근 버튼
- 오늘의 근무시간
- 월간 근태 캘린더

#### `/employee-hr/leave`
- 휴가 신청
- 휴가 사용 내역
- 잔여 일수

#### `/employee-hr/payroll`
- 급여명세서 목록
- PDF 다운로드

### 2. 관리자용 화면

#### `/hr-admin/dashboard`
- 전체 직원 현황
- 오늘의 출근 현황
- 대기 중인 휴가 신청
- 이번 달 급여 요약

#### `/hr-admin/attendance`
- 전체 직원 근태 현황
- 근태 수정/승인
- 통계 및 리포트

#### `/hr-admin/payroll`
- 급여 계산
- 급여 승인
- 급여 지급 내역
- Excel 내보내기

#### `/hr-admin/leave`
- 휴가 승인 대기 목록
- 휴가 승인/거부
- 직원별 휴가 현황

#### `/hr-admin/evaluation`
- 직원 평가 작성
- 평가 내역 조회
- 평가 통계

#### `/hr-admin/employees`
- 직원 정보 관리
- 급여 정보 설정
- 입퇴사 관리

## 📱 모바일 최적화

모든 화면은 모바일 친화적으로 설계됩니다:
- 터치 친화적인 큰 버튼
- 간편한 출퇴근 체크
- 모바일에서 급여명세서 확인
- 휴가 신청 간소화

## 🔐 권한 관리

### 권한 레벨
1. **staff**: 본인 정보만 조회, 휴가 신청
2. **manager**: 팀원 근태 관리, 휴가 승인
3. **owner**: 모든 HR 기능 접근, 급여 관리, 인사평가

## 📈 통계 및 리포트

### 제공 리포트
1. **월간 근태 리포트**: 직원별 출근율, 지각, 초과근무
2. **급여 지급 리포트**: 월별 인건비 총액
3. **휴가 사용 리포트**: 휴가 사용률, 미사용 연차
4. **인사평가 리포트**: 평가 점수 분포, 평균 점수

### Excel 내보내기
모든 리포트는 Excel 파일로 내보낼 수 있습니다.

## 🔄 자동화 기능

### 매일 자동 실행
- 결근자 자동 표시
- 휴가 직원 근태 자동 반영

### 매월 자동 실행
- 연차 발생 (월 1일)
- 급여 계산 알림 (말일)

### 매년 자동 실행
- 연차 자동 부여 (1월 1일)
- 미사용 연차 이월 계산

## 🛠️ 설정

### 근태 설정
- 정규 근무시간: 09:00 - 18:00
- 점심시간: 12:00 - 13:00 (무급)
- 지각 기준: 10분 초과
- 조퇴 기준: 30분 미만 조기 퇴근

### 급여 설정
- 급여일: 매월 25일
- 4대보험 적용
- 소득세 간이세액표 적용

## 🚨 주의사항

1. **급여 계산**: 급여 계산 후 반드시 검토 필요
2. **4대보험**: 요율이 변경될 수 있으므로 정기 업데이트 필요
3. **백업**: 급여 데이터는 정기적으로 백업
4. **보안**: 급여 정보는 민감정보이므로 접근 권한 철저히 관리

## 📞 문의

HR 시스템 관련 문의사항은 시스템 관리자에게 연락하세요.
