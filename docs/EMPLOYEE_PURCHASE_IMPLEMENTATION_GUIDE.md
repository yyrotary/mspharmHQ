# 직원 구매 장부 시스템 구현 가이드

## 🎯 프로젝트 개요

명성약국 직원들이 약국 내 물품을 구매할 때 사용하는 디지털 장부 시스템을 구현합니다. 이 문서는 구현 개발자를 위한 단계별 가이드입니다.

## 📋 구현 전 체크리스트

- [✅] Supabase 프로젝트 설정 완료
- [✅] 데이터베이스 테이블 생성 완료
- [✅] 초기 사용자 데이터 입력 완료
- [ ] 개발 환경 설정 완료
- [ ] 필요한 패키지 설치 완료

## 🏗️ 구현 순서

### 1단계: 환경 설정 (30분)

#### 1.1 패키지 설치
```bash
cd mspharmHQ
npm install @supabase/supabase-js bcryptjs jsonwebtoken
npm install --save-dev @types/bcryptjs @types/jsonwebtoken
```

#### 1.2 환경 변수 설정
`.env.local` 파일 생성 (`.env.local.template` 참고):
```env
# 기존 환경 변수는 유지하고 아래 추가
NEXT_PUBLIC_SUPABASE_URL=https://qpuagbmgtebcetzvbrfq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=geCwFZCj4S4IqxqYLpOCii8Pj8uPGlfgrvUCWuXiAZXFFbfSV5zPzkOCkGqmy31u...
SUPABASE_STORAGE_BUCKET=employee-purchases
```

### 2단계: 메인 메뉴 통합 (30분)

#### 2.1 메인 페이지에 메뉴 추가
`app/page.tsx` 파일 수정:

```typescript
// 기존 메뉴 카드 배열에 추가
const menuCards = [
  // ... 기존 메뉴들 ...
  {
    title: '직원 구매 장부',
    description: '직원 물품 구매 관리',
    icon: '🛒', // 또는 적절한 아이콘 컴포넌트
    href: '/employee-purchase',
    color: 'bg-purple-500',
  },
];
```

### 3단계: 라우트 구조 생성 (1시간)

#### 3.1 디렉토리 생성
```bash
mkdir -p app/employee-purchase
mkdir -p app/employee-purchase/login
mkdir -p app/employee-purchase/new
mkdir -p app/employee-purchase/requests
mkdir -p app/employee-purchase/admin
mkdir -p app/employee-purchase/admin/statistics
mkdir -p app/employee-purchase/components
mkdir -p app/api/employee-purchase/auth/login
mkdir -p app/api/employee-purchase/auth/logout
mkdir -p app/api/employee-purchase/requests
mkdir -p app/api/employee-purchase/upload
mkdir -p app/api/employee-purchase/statistics
```

### 4단계: 로그인 기능 구현 (2시간)

#### 4.1 로그인 페이지 생성
`app/employee-purchase/login/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState({
    name: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/employee-purchase/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('로그인 성공!');
        router.push('/employee-purchase');
      } else {
        toast.error(data.error || '로그인 실패');
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            직원 구매 장부
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            직원 계정으로 로그인하세요
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="name" className="sr-only">
                이름
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="이름"
                value={credentials.name}
                onChange={(e) =>
                  setCredentials({ ...credentials, name: e.target.value })
                }
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                placeholder="비밀번호"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

#### 4.2 로그인 API 생성
`app/api/employee-purchase/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken, setAuthCookie } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json();

    if (!name || !password) {
      return NextResponse.json(
        { error: '이름과 비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    const user = await authenticateUser(name, password);
    if (!user) {
      return NextResponse.json(
        { error: '잘못된 이름 또는 비밀번호입니다' },
        { status: 401 }
      );
    }

    const token = generateToken(user);
    setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
```

### 5단계: 대시보드 페이지 구현 (1시간)

#### 5.1 메인 대시보드
`app/employee-purchase/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

export default function EmployeePurchaseDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/employee-purchase/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/employee-purchase/login');
      }
    } catch (error) {
      router.push('/employee-purchase/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/employee-purchase/auth/logout', { method: 'POST' });
      router.push('/employee-purchase/login');
    } catch (error) {
      toast.error('로그아웃 실패');
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              직원 구매 장부
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              로그아웃
            </button>
          </div>

          <div className="mb-4">
            <p className="text-gray-600">
              안녕하세요, <span className="font-semibold">{user?.name}</span>님
            </p>
            <p className="text-sm text-gray-500">
              권한: {user?.role === 'owner' ? '약국장' : user?.role === 'manager' ? '관리자' : '직원'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/employee-purchase/new"
              className="block p-6 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
            >
              <h3 className="text-lg font-semibold text-purple-900">새 구매 신청</h3>
              <p className="text-purple-700 mt-2">물품 구매를 신청합니다</p>
            </Link>

            <Link
              href="/employee-purchase/requests"
              className="block p-6 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <h3 className="text-lg font-semibold text-blue-900">내 구매 내역</h3>
              <p className="text-blue-700 mt-2">구매 신청 내역을 확인합니다</p>
            </Link>

            {['manager', 'owner'].includes(user?.role || '') && (
              <Link
                href="/employee-purchase/admin"
                className="block p-6 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-green-900">승인 관리</h3>
                <p className="text-green-700 mt-2">대기 중인 구매 요청을 관리합니다</p>
              </Link>
            )}

            {user?.role === 'owner' && (
              <Link
                href="/employee-purchase/admin/statistics"
                className="block p-6 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <h3 className="text-lg font-semibold text-yellow-900">통계 및 리포트</h3>
                <p className="text-yellow-700 mt-2">전체 구매 현황을 확인합니다</p>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 6단계: 구매 신청 기능 구현 (2시간)

#### 6.1 구매 신청 페이지
`app/employee-purchase/new/page.tsx`:

```typescript
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';

export default function NewPurchaseRequest() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    totalAmount: '',
    notes: '',
  });

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error('최대 5개의 이미지만 업로드 가능합니다');
      return;
    }

    setImages([...images, ...files]);
    
    // 미리보기 생성
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (images.length === 0) {
      toast.error('최소 1개의 이미지를 업로드해주세요');
      return;
    }

    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      toast.error('올바른 금액을 입력해주세요');
      return;
    }

    setLoading(true);

    try {
      // 이미지 업로드
      const uploadedUrls: string[] = [];
      
      for (const image of images) {
        const formData = new FormData();
        formData.append('file', image);
        
        const uploadResponse = await fetch('/api/employee-purchase/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          throw new Error('이미지 업로드 실패');
        }
        
        const { url } = await uploadResponse.json();
        uploadedUrls.push(url);
      }

      // 구매 요청 생성
      const response = await fetch('/api/employee-purchase/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalAmount: parseFloat(formData.totalAmount),
          imageUrls: uploadedUrls,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        toast.success('구매 신청이 완료되었습니다');
        router.push('/employee-purchase/requests');
      } else {
        throw new Error('구매 신청 실패');
      }
    } catch (error) {
      toast.error('구매 신청 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            새 구매 신청
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이미지 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                물품 사진
              </label>
              <div className="flex flex-wrap gap-4">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`물품 ${index + 1}`}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400"
                  >
                    <span className="text-gray-500">+ 사진 추가</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                className="hidden"
                multiple
              />
            </div>

            {/* 총 금액 */}
            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">
                총 금액
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">₩</span>
                </div>
                <input
                  type="number"
                  id="totalAmount"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                  className="pl-8 block w-full rounded-md border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                메모 (선택)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 focus:ring-purple-500 focus:border-purple-500"
                placeholder="구매 품목이나 용도를 입력하세요"
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? '처리 중...' : '구매 신청'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
```

### 7단계: API 엔드포인트 구현 (2시간)

#### 7.1 인증 확인 API
`app/api/employee-purchase/auth/me/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/app/lib/employee-purchase/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 7.2 파일 업로드 API
`app/api/employee-purchase/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/app/lib/employee-purchase/auth';
import { uploadImage } from '@/app/lib/employee-purchase/supabase';

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다' },
        { status: 400 }
      );
    }

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: '파일 크기는 5MB 이하여야 합니다' },
        { status: 400 }
      );
    }

    // 이미지 파일 체크
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '이미지 파일만 업로드 가능합니다' },
        { status: 400 }
      );
    }

    const result = await uploadImage(file);
    if (!result) {
      throw new Error('Upload failed');
    }

    return NextResponse.json({
      success: true,
      url: result.url,
      path: result.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: '파일 업로드 실패' },
      { status: 500 }
    );
  }
}
```

### 8단계: 권한별 페이지 구현 (2시간)

#### 8.1 구매 내역 페이지
`app/employee-purchase/requests/page.tsx`

#### 8.2 관리자 승인 페이지
`app/employee-purchase/admin/page.tsx`

#### 8.3 통계 페이지 (약국장 전용)
`app/employee-purchase/admin/statistics/page.tsx`

### 9단계: 테스트 및 디버깅 (1시간)

#### 9.1 테스트 시나리오
1. **로그인 테스트**
   - 각 권한별 계정으로 로그인
   - 잘못된 정보로 로그인 시도

2. **구매 신청 테스트**
   - 이미지 업로드
   - 금액 입력
   - 신청 제출

3. **승인 워크플로우**
   - 일반 직원 → 관리자 승인
   - 관리자 → 약국장 승인

4. **통계 확인**
   - 약국장 계정으로 통계 페이지 접근

#### 9.2 테스트 계정
```
약국장: admin123
김관리자: manager123
이직원: staff123
박직원: staff123
```

## 📁 최종 파일 구조

```
app/
├── employee-purchase/
│   ├── page.tsx                    # 대시보드
│   ├── login/
│   │   └── page.tsx               # 로그인
│   ├── new/
│   │   └── page.tsx               # 새 구매 신청
│   ├── requests/
│   │   └── page.tsx               # 구매 내역
│   ├── admin/
│   │   ├── page.tsx               # 승인 관리
│   │   └── statistics/
│   │       └── page.tsx           # 통계 (약국장)
│   └── components/
│       ├── AuthCheck.tsx
│       ├── PurchaseCard.tsx
│       └── LoadingSpinner.tsx
├── api/
│   └── employee-purchase/
│       ├── auth/
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   └── me/route.ts
│       ├── requests/
│       │   ├── route.ts
│       │   └── [id]/
│       │       ├── approve/route.ts
│       │       └── complete/route.ts
│       ├── upload/route.ts
│       └── statistics/route.ts
└── lib/
    └── employee-purchase/
        ├── supabase.ts
        ├── auth.ts
        └── types.ts
```

## 🔍 주의사항

### 보안
1. **모든 API에서 인증 확인**: `getCurrentUser()` 또는 `requireAuth()` 사용
2. **권한 검증**: `checkPermission()` 함수 활용
3. **Service Role Key**: 서버 사이드에서만 사용
4. **클라이언트 직접 접근 차단**: Supabase에 직접 접근 불가

### 성능
1. **이미지 최적화**: 업로드 시 크기 제한
2. **페이지네이션**: 목록 조회 시 적용
3. **로딩 상태**: 모든 비동기 작업에 표시

### 사용자 경험
1. **에러 처리**: toast 메시지로 명확한 피드백
2. **로딩 인디케이터**: 대기 시간 동안 표시
3. **반응형 디자인**: 모바일 지원

## 🚀 배포 준비

1. **환경 변수 확인**
   - 프로덕션용 JWT_SECRET 변경
   - HTTPS 설정

2. **빌드 테스트**
   ```bash
   npm run build
   npm run start
   ```

3. **에러 로그 확인**
   - 콘솔 에러 제거
   - API 응답 시간 체크

## 📞 지원

구현 중 문제가 발생하면 다음 문서를 참고하세요:
- `docs/EMPLOYEE_PURCHASE_SYSTEM.md` - 시스템 설계
- `docs/API_ROUTE_EXAMPLES.md` - API 구현 예시
- `docs/EMPLOYEE_PURCHASE_INSTALLATION.md` - 설치 가이드

---

**문서 작성일**: 2025년 5월 27일  
**버전**: 1.0.0  
**상태**: 구현 준비 완료
