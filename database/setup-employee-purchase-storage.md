# Supabase Storage 설정 가이드 - 직원 구매 시스템

## 1. Storage 버킷 생성

Supabase 대시보드에서:

1. **Storage** 메뉴로 이동
2. **"New bucket"** 클릭
3. 버킷 설정:
   - **Name**: `employee-purchases`
   - **Public bucket**: ✅ 체크 (공개 URL 사용 가능하도록)
   - **File size limit**: 10MB
   - **Allowed MIME types**: `image/*` (모든 이미지 타입)

## 2. Storage Policies 설정

버킷 생성 후 정책(Policies) 설정:

### 2.1 업로드 정책 (INSERT)

```sql
-- 인증된 모든 사용자가 업로드 가능
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'employee-purchases');
```

### 2.2 조회 정책 (SELECT)

```sql
-- 모든 사용자가 이미지 조회 가능 (공개 버킷이므로)
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'employee-purchases');
```

### 2.3 삭제 정책 (DELETE)

```sql
-- 관리자만 삭제 가능 (선택사항)
CREATE POLICY "Allow authenticated users to delete their images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'employee-purchases');
```

## 3. RLS (Row Level Security) 비활성화

직원 구매 시스템은 서비스 역할 키를 사용하므로 RLS를 비활성화하거나 적절히 설정:

```sql
-- Storage objects 테이블의 RLS 확인
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## 4. 환경 변수 확인

`.env.local` 파일에 다음 환경 변수가 설정되어 있는지 확인:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=employee-purchases
```

## 5. 테스트

1. 로그인
2. 새 구매 신청 페이지로 이동
3. 이미지 업로드 시도
4. 콘솔에서 로그 확인

## 문제 해결

### 에러: "Bucket not found"
- Supabase 대시보드에서 `employee-purchases` 버킷이 생성되어 있는지 확인
- 버킷 이름이 정확한지 확인

### 에러: "Permission denied"
- Storage Policies가 올바르게 설정되어 있는지 확인
- 서비스 역할 키가 올바른지 확인

### 에러: "File too large"
- 파일 크기가 10MB 이하인지 확인
- 버킷의 파일 크기 제한 확인

## 버킷 구조

```
employee-purchases/
└── purchase-images/
    ├── 1234567890-abc123.jpg
    ├── 1234567891-def456.png
    └── ...
```

모든 이미지는 `purchase-images/` 폴더 안에 저장됩니다.
파일명 형식: `{timestamp}-{random}.{extension}`

