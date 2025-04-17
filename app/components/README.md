# 컴포넌트 사용법

## ImageUploader 컴포넌트

이미지 업로드 기능을 제공하는 재사용 가능한 컴포넌트입니다.

### 주요 기능
- 다중 이미지 업로드
- 카메라로 이미지 캡처
- 이미지 해상도 자동 조정 (원본의 2/3 크기로 축소)
- 이미지 미리보기 및 삭제
- 파일 이름 자동 생성 (고객명_날짜시간_prefix포맷)

### Props

| 이름 | 타입 | 필수 | 기본값 | 설명 |
|------|------|------|--------|------|
| onImagesChange | (images: ImageFile[]) => void | 예 | - | 이미지 목록이 변경될 때 호출되는 콜백 함수 |
| customerName | string | 아니오 | 'unknown' | 이미지 파일명에 포함될 고객 이름 |
| currentImages | ImageFile[] | 아니오 | [] | 초기 이미지 목록 |
| prefix | string | 아니오 | '' | 파일명에 추가될 접두사 |

### 사용 예시

```tsx
import ImageUploader from 'app/components/ImageUploader';

export default function ConsultationPage() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const customerName = "홍길동";
  
  const handleImagesChange = (newImages: ImageFile[]) => {
    setImages(newImages);
    console.log('업로드된 이미지 수:', newImages.length);
  };
  
  const handleSubmit = async () => {
    // 이미지 업로드 API 호출 예시
    if (images.length > 0) {
      try {
        const response = await fetch('/api/google-drive', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: images.map(img => ({
              data: img.data,
              fileName: img.fileName
            })),
            folderId: '고객_폴더_ID'
          })
        });
        
        const result = await response.json();
        console.log('업로드 결과:', result);
      } catch (error) {
        console.error('이미지 업로드 실패:', error);
      }
    }
  };
  
  return (
    <div>
      <h1>상담 페이지</h1>
      
      <ImageUploader
        onImagesChange={handleImagesChange}
        customerName={customerName}
        prefix="consult_"
      />
      
      <button onClick={handleSubmit}>저장</button>
    </div>
  );
} 