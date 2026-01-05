'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string;
  role: 'staff' | 'manager' | 'owner';
}

export default function NewPurchaseRequest() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    totalAmount: '',
    notes: '',
  });

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
      setAuthLoading(false);
    }
  };

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
        const formDataForUpload = new FormData();
        formDataForUpload.append('file', image);
        
        const uploadResponse = await fetch('/api/employee-purchase/upload', {
          method: 'POST',
          body: formDataForUpload,
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
        const errorData = await response.json();
        throw new Error(errorData.error || '구매 신청 실패');
      }
    } catch (error) {
      console.error('Purchase request error:', error);
      toast.error(error instanceof Error ? error.message : '구매 신청 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              새 구매 신청
            </h1>
            <button
              onClick={() => router.back()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              뒤로가기
            </button>
          </div>

          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              신청자: <span className="font-semibold">{user?.name}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 이미지 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                물품 사진 <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {imageUrls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`물품 ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
                
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center hover:border-gray-400 transition-colors"
                  >
                    <div className="text-gray-400 text-2xl mb-2">📷</div>
                    <span className="text-gray-500 text-sm">사진 추가</span>
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
              <p className="text-xs text-gray-500 mt-2">
                최대 5개의 이미지를 업로드할 수 있습니다. (각 파일 최대 10MB)
              </p>
            </div>

            {/* 총 금액 */}
            <div>
              <label htmlFor="totalAmount" className="block text-sm font-medium text-gray-700">
                총 금액 <span className="text-red-500">*</span>
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
                  min="1"
                  step="1"
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

            {/* 안내사항 */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">신청 안내</h3>
              <ul className="text-xs text-yellow-700 space-y-1">
                <li>• 물품 사진을 명확하게 촬영해주세요</li>
                <li>• 정확한 금액을 입력해주세요</li>
                <li>• 신청 후 secretary 승인이 필요합니다</li>
                <li>• 승인 완료 후 물품을 수령하세요</li>
              </ul>
            </div>

            {/* 버튼 */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
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