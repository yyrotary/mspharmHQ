# 개발자 가이드 - ImageUploader 컴포넌트

## 구조
ImageUploader 컴포넌트는 다음과 같은 파일 구조로 이루어져 있습니다:
- `app/components/ImageUploader.tsx` - 메인 컴포넌트 파일

## 인터페이스

```typescript
interface ImageFile {
  data: string;       // base64 인코딩된 이미지 데이터
  fileName: string;   // 파일 이름
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageFile[]) => void;  // 이미지 변경 콜백
  customerName?: string;  // 이미지 파일명에 사용할 고객 이름
  currentImages?: ImageFile[];  // 초기 이미지 목록
  prefix?: string;  // 파일명 접두사
}
```

## 주요 함수

### handleFileUpload
파일 입력을 처리하고 이미지 해상도를 줄여 상태에 추가합니다.

```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files) {
    Array.from(e.target.files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          processImage(event.target?.result as string);
        };
      }
    });
  }
};
```

### handleCameraCapture
카메라로 찍은 이미지를 처리합니다.

### processImage
이미지를 받아 해상도를 줄이고 고유한 파일 이름을 생성합니다.

### removeImage
미리보기에서or 이미지를 제거합니다.

## 확장 방법

### 이미지 처리 로직 변경
`processImage` 함수에서 이미지 해상도 처리 로직을 수정할 수 있습니다:

```typescript
const processImage = (imageData: string) => {
  // 이미지 로드
  const img = new Image();
  img.src = imageData;
  img.onload = () => {
    // 이미지 해상도 처리 로직 수정 부분
    const canvas = document.createElement('canvas');
    // 원하는 해상도로 변경 (현재는 원본의 2/3)
    const newWidth = img.width * 2/3;
    const newHeight = img.height * 2/3;
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0, newWidth, newHeight);
    
    // 결과 이미지 생성
    const newImageData = canvas.toDataURL('image/jpeg', 0.9);
    const fileName = generateFileName();
    
    setImages((prev) => [...prev, { data: newImageData, fileName }]);
  };
};
```

### 파일명 생성 로직 변경
`generateFileName` 함수에서 파일명 생성 로직을 수정할 수 있습니다:

```typescript
const generateFileName = () => {
  const now = new Date();
  // 파일명 형식 변경 부분
  return `${customerName || 'unknown'}_${now.getTime()}${prefix ? `_${prefix}` : ''}.jpg`;
};
```

## 성능 고려사항
- 대용량 이미지를 다룰 때 메모리 사용량에 주의하세요.
- 이미지 처리는 비동기적으로 이루어지므로 업로드 시 지연이 발생할 수 있습니다.
- 여러 이미지를 동시에 처리할 때 성능 저하가 발생할 수 있습니다. 