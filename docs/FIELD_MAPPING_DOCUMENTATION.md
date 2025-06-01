# 필드 매핑 문서 (Field Mapping Documentation)

> **작성일**: 2025-05-31  
> **목적**: API와 프론트엔드 간 필드 매핑 불일치 방지 및 표준화

## 📋 개요

MSPharmHQ 시스템에서 상담일지 관련 API와 프론트엔드 간의 필드 매핑을 정리한 문서입니다. 필드명 불일치로 인한 오류를 방지하고 일관성을 유지하기 위해 작성되었습니다.

## 🔍 발견된 문제점

### 1. 상담일지 생성 시 필드 불일치 (해결됨)
- **문제**: API 필수 필드와 프론트엔드 전송 필드명 불일치
- **해결**: 프론트엔드에서 API 기대 필드명으로 수정

## 📊 필드 매핑 테이블

### 상담일지 생성 (POST /api/consultation-v2)

| 프론트엔드 필드 | API 필드 | 데이터베이스 필드 | 필수 여부 | 설명 |
|---|---|---|---|---|
| `customer.id` | `customer_id` | `customer_id` | ✅ 필수 | 고객 ID |
| `newConsultation.consultDate` | `consultDate` | `consult_date` | ✅ 필수 | 상담 날짜 |
| `newConsultation.content` | `symptoms` | `symptoms` | ✅ 필수 | 호소증상 |
| `newConsultation.medicine` | `prescription` | `prescription` | ⚪ 선택 | 처방약 |
| `newConsultation.result` | `result` | `result` | ⚪ 선택 | 결과 |
| `newConsultation.stateAnalysis` | `stateAnalysis` | `patient_condition` | ⚪ 선택 | 환자상태 |
| `newConsultation.tongueAnalysis` | `tongueAnalysis` | `tongue_analysis` | ⚪ 선택 | 설진분석 |
| `newConsultation.specialNote` | `specialNotes` | `special_notes` | ⚪ 선택 | 특이사항 |
| `newConsultation.images` | `imageDataArray` | `image_urls` | ⚪ 선택 | 이미지 배열 |

### 상담일지 수정 (PUT /api/consultation-v2)

| 프론트엔드 필드 | API 필드 | 데이터베이스 필드 | 필수 여부 | 설명 |
|---|---|---|---|---|
| `editingConsultation.id` | `id` | `id` | ✅ 필수 | 상담일지 ID |
| `editFormData.content` | `symptoms` | `symptoms` | ✅ 필수 | 호소증상 |
| `editFormData.medicine` | `medicine` | `prescription` | ⚪ 선택 | 처방약 |
| `editFormData.result` | `result` | `result` | ⚪ 선택 | 결과 |
| `editFormData.stateAnalysis` | `stateAnalysis` | `patient_condition` | ⚪ 선택 | 환자상태 |
| `editFormData.tongueAnalysis` | `tongueAnalysis` | `tongue_analysis` | ⚪ 선택 | 설진분석 |
| `editFormData.specialNote` | `specialNote` | `special_notes` | ⚪ 선택 | 특이사항 |
| `editFormData.images` | `imageDataArray` | `image_urls` | ⚪ 선택 | 이미지 배열 |

### 상담일지 조회 (GET /api/consultation-v2)

| API 응답 필드 | 프론트엔드 매핑 | 데이터베이스 필드 | 설명 |
|---|---|---|---|
| `consultation.id` | `id` | `id` | 상담일지 ID |
| `consultation.customer_id` | `customerId` | `customer_id` | 고객 ID |
| `consultation.customer.name` | `customerName` | `customers.name` | 고객 이름 (조인) |
| `consultation.consult_date` | `consultationDate` | `consult_date` | 상담 날짜 |
| `consultation.symptoms` | `consultationContent` | `symptoms` | 호소증상 |
| `consultation.prescription` | `prescription` | `prescription` | 처방약 |
| `consultation.result` | `result` | `result` | 결과 |
| `consultation.patient_condition` | `stateAnalysis` | `patient_condition` | 환자상태 |
| `consultation.tongue_analysis` | `tongueAnalysis` | `tongue_analysis` | 설진분석 |
| `consultation.special_notes` | `specialNote` | `special_notes` | 특이사항 |
| `consultation.image_urls` | `symptomImages` | `image_urls` | 이미지 URL 배열 |

## 🔧 API 내부 필드 매핑

### Supabase 라이브러리 (supabase-consultation.ts)

#### ConsultationCreateInput 인터페이스
```typescript
interface ConsultationCreateInput {
  customer_id: string;        // 고객 ID
  symptoms: string;           // 호소증상
  consultDate: string;        // 상담 날짜
  stateAnalysis?: string;     // 환자상태
  tongueAnalysis?: string;    // 설진분석
  specialNote?: string;       // 특이사항
  medicine?: string;          // 처방약
  result?: string;            // 결과
  imageDataArray?: string[];  // 이미지 데이터 배열
}
```

#### 데이터베이스 삽입 시 매핑
```typescript
const consultationData = {
  consultation_id: consultationId,
  customer_id: data.customer_id,
  consult_date: data.consultDate,
  symptoms: data.symptoms,
  patient_condition: data.stateAnalysis,
  tongue_analysis: data.tongueAnalysis,
  special_notes: data.specialNote,
  prescription: data.medicine,
  result: data.result,
  image_urls: imageUrls
};
```

## ⚠️ 주의사항

### 1. 필수 필드 검증
API에서 다음 필드들을 필수로 검증합니다:
- `symptoms` (호소증상)
- `customer_id` (고객 ID)
- `consultDate` (상담 날짜)

### 2. 필드명 일관성
- **Snake Case**: 데이터베이스 및 API 내부 (`customer_id`, `consult_date`)
- **Camel Case**: 프론트엔드 JavaScript/TypeScript (`customerId`, `consultDate`)
- **API 경계**: 프론트엔드 → API 전송 시 API 기대 형식 사용

### 3. 이미지 처리
- **프론트엔드**: Base64 데이터 배열 (`imageDataArray`)
- **API**: Supabase Storage 업로드 후 URL 배열 (`image_urls`)
- **데이터베이스**: JSON 배열로 저장 (`image_urls`)

## 🔄 변경 이력

### 2025-05-31 (33차 작업)
- **문제**: 상담일지 생성 시 필드명 불일치
- **해결**: 프론트엔드에서 API 기대 필드명으로 수정
  - `customerId` → `customer_id`
  - `chiefComplaint` → `symptoms`
  - `consultationDate` → `consultDate`
- **추가 수정**: 상담 생성과 수정 간 필드명 일관성 확보
  - 상담 생성: `patientCondition` → `stateAnalysis`로 통일

### 2025-05-31 (32차 작업)
- **문제**: 상담 내역 목록에서 고객 이름 표시 안됨
- **해결**: API 응답 구조에 맞게 접근 경로 수정
  - `consultation.customers?.name` → `consultation.customer?.name`

## 📝 개발 가이드라인

### 새로운 필드 추가 시
1. **데이터베이스 스키마** 먼저 정의
2. **API 인터페이스** 업데이트
3. **프론트엔드 타입** 정의
4. **이 문서** 업데이트

### 필드명 규칙
- **데이터베이스**: `snake_case`
- **API 내부**: `snake_case` (데이터베이스와 일치)
- **API 경계**: 명확한 매핑 정의
- **프론트엔드**: `camelCase`

### 검증 체크리스트
- [ ] API 필수 필드 검증 로직 확인
- [ ] 프론트엔드 데이터 전송 형식 확인
- [ ] 데이터베이스 스키마와 일치성 확인
- [ ] 타입 정의 일관성 확인
- [ ] 이 문서 업데이트

## 🚨 알려진 이슈

현재 알려진 필드 매핑 관련 이슈는 없습니다.

---

**마지막 업데이트**: 2025-05-31  
**담당자**: AI 시스템  
**관련 문서**: `docs/WORK_LOG.md`, `docs/API_ARCHITECTURE.md` 