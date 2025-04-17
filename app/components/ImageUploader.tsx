import React, { useRef, useState } from 'react';

interface ImageFile {
  data: string;
  fileName: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageFile[]) => void;
  customerName?: string;
  currentImages?: ImageFile[];
  prefix?: string;
}

export default function ImageUploader({
  onImagesChange,
  customerName = 'unknown',
  currentImages = [],
  prefix = '',
}: ImageUploaderProps) {
  const [images, setImages] = useState<ImageFile[]>(currentImages);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 파일 업로드 처리
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const reader = new FileReader();
        
        reader.onloadend = () => {
          // 현재 날짜와 시간을 파일 이름에 포함
          const now = new Date();
          const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
          const fileName = `${customerName}_${dateString}_${prefix}${i+1}.jpg`;
          
          // 이미지 해상도 줄이기
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // 이미지 해상도를 2/3로 줄임
            const maxWidth = Math.floor(img.width * 0.67);
            const maxHeight = Math.floor(img.height * 0.67);
            
            canvas.width = maxWidth;
            canvas.height = maxHeight;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
              const reducedImageData = canvas.toDataURL('image/jpeg', 0.9);
              
              // 이미지 데이터와 파일 이름 저장
              const newImages = [
                ...images,
                {
                  data: reducedImageData,
                  fileName
                }
              ];
              setImages(newImages);
              onImagesChange(newImages);
            }
          };
          img.src = reader.result as string;
        };
        
        reader.readAsDataURL(file);
      }
    }
  };

  // 카메라 캡처 처리
  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onloadend = () => {
        // 현재 날짜와 시간을 파일 이름에 포함
        const now = new Date();
        const dateString = now.toISOString().replace(/[-:]/g, '').split('.')[0];
        const fileName = `${customerName}_${dateString}_${prefix}camera.jpg`;
        
        // 이미지 해상도 줄이기
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // 이미지 해상도를 2/3로 줄임
          const maxWidth = Math.floor(img.width * 0.67);
          const maxHeight = Math.floor(img.height * 0.67);
          
          canvas.width = maxWidth;
          canvas.height = maxHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, maxWidth, maxHeight);
            const reducedImageData = canvas.toDataURL('image/jpeg', 0.9);
            
            // 이미지 데이터와 파일 이름 저장
            const newImages = [
              ...images,
              {
                data: reducedImageData,
                fileName
              }
            ];
            setImages(newImages);
            onImagesChange(newImages);
          }
        };
        img.src = reader.result as string;
      };
      
      reader.readAsDataURL(file);
    }
  };
  
  // 이미지 삭제
  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImagesChange(newImages);
  };

  return (
    <div className="mt-4">
      <div className="flex space-x-4 mb-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ 
            backgroundColor: '#10b981', 
            color: 'white', 
            padding: '1rem', 
            fontSize: '1.125rem', 
            borderRadius: '0.5rem', 
            display: 'flex', 
            alignItems: 'center',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>📁</span> 파일 업로드
        </button>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          style={{ 
            backgroundColor: '#3b82f6', 
            color: 'white', 
            padding: '1rem', 
            fontSize: '1.125rem', 
            borderRadius: '0.5rem', 
            display: 'flex', 
            alignItems: 'center',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <span style={{ marginRight: '0.5rem' }}>📷</span> 카메라
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          accept="image/*"
          multiple
        />
        <input
          type="file"
          ref={cameraInputRef}
          onChange={handleCameraCapture}
          style={{ display: 'none' }}
          accept="image/*"
          capture="environment"
        />
      </div>
      
      {/* 이미지 미리보기 */}
      {images.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">이미지 미리보기</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative border rounded-lg overflow-hidden">
                <img 
                  src={image.data} 
                  alt={`미리보기 ${index + 1}`} 
                  className="w-full h-32 object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 