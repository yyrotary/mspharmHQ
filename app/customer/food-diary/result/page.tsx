'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CustomerSession {
  customerId: string;
  customerCode: string;
  customerName: string;
}

interface FoodRecord {
  id: string;
  food_name: string;
  food_description: string;
  food_category: string;
  image_url: string;
  confidence_score: number;
  portion_consumed: number;
  actual_calories: number;
  meal_type: string;
  recorded_date: string;
  recorded_time: string;
  consumed_at: string;
  nutritional_info: {
    carbohydrates: number;
    protein: number;
    fat: number;
    estimated_weight_grams: number;
  };
  user_answers: any;
}

function FoodResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recordId = searchParams.get('recordId');

  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [foodRecord, setFoodRecord] = useState<FoodRecord | null>(null);

  useEffect(() => {
    // 세션 확인
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    setCustomerSession(JSON.parse(sessionData));
    
    // 음식 기록 조회
    console.log('🎯 URL에서 받은 recordId:', recordId);
    if (recordId) {
      loadFoodRecord(recordId);
    } else {
      console.warn('⚠️ recordId가 없습니다');
      setLoading(false);
    }
  }, [router, recordId]);

  const loadFoodRecord = async (id: string) => {
    try {
      console.log('🔍 음식 기록 로딩 시작:', id);
      const response = await fetch(`/api/customer/food/record?recordId=${id}`);
      const data = await response.json();
      
      console.log('📊 API 응답:', { status: response.status, data });

      if (response.ok) {
        console.log('✅ 음식 기록 로딩 성공:', data.record);
        setFoodRecord(data.record);
      } else {
        console.error('❌ API 응답 오류:', data);
        toast.error(`음식 기록을 불러오는데 실패했습니다: ${data.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 음식 기록 로딩 오류:', error);
      toast.error('데이터 로딩 중 오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMealTypeColor = (mealType: string) => {
    switch (mealType) {
      case '아침': return 'bg-yellow-100 text-yellow-800';
      case '점심': return 'bg-orange-100 text-orange-800';
      case '저녁': return 'bg-blue-100 text-blue-800';
      case '간식': return 'bg-purple-100 text-purple-800';
      case '야식': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPortionText = (portion: number) => {
    if (portion >= 90) return '전부';
    if (portion >= 45) return '절반 정도';
    if (portion >= 20) return '1/4 정도';
    return '조금만';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!foodRecord) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          음식 기록을 찾을 수 없습니다
        </h3>
        <Link href="/customer/food-diary" className="text-indigo-600 hover:text-indigo-700">
          음식 기록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push('/customer/food-diary')}
          className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록
        </button>
        <h1 className="text-lg font-semibold text-gray-900">✅ 기록 완료</h1>
        <button
          onClick={() => router.push('/customer/dashboard')}
          className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
        >
          홈
        </button>
      </div>

      {/* 성공 메시지 */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">음식 기록이 완료되었습니다!</h3>
            <p className="mt-1 text-sm text-green-700">
              AI 분석과 질문 답변을 통해 정확한 섭취 정보가 기록되었습니다.
            </p>
          </div>
        </div>
      </div>

      {/* 음식 이미지 */}
      {foodRecord.image_url && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <img
            src={foodRecord.image_url}
            alt={foodRecord.food_name}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* 음식 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">{foodRecord.food_name}</h2>
            <p className="text-sm text-gray-600 mt-1">{foodRecord.food_description}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getMealTypeColor(foodRecord.meal_type)}`}>
            {foodRecord.meal_type}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">카테고리</div>
            <div className="font-medium text-gray-900">{foodRecord.food_category}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm text-gray-600">섭취량</div>
            <div className="font-medium text-gray-900">
              {getPortionText(foodRecord.portion_consumed)} ({foodRecord.portion_consumed}%)
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="text-sm text-orange-600">실제 섭취 칼로리</div>
            <div className="text-xl font-bold text-orange-800">{foodRecord.actual_calories} kcal</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600">AI 신뢰도</div>
            <div className="text-xl font-bold text-blue-800">{Math.round(foodRecord.confidence_score * 100)}%</div>
          </div>
        </div>
      </div>

      {/* 영양 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">영양 정보</h3>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{foodRecord.nutritional_info.carbohydrates}g</div>
            <div className="text-sm text-gray-600">탄수화물</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{foodRecord.nutritional_info.protein}g</div>
            <div className="text-sm text-gray-600">단백질</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{foodRecord.nutritional_info.fat}g</div>
            <div className="text-sm text-gray-600">지방</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">예상 중량</div>
          <div className="font-medium text-gray-900">{foodRecord.nutritional_info.estimated_weight_grams}g</div>
        </div>
      </div>

      {/* 시간 정보 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">시간 정보</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">실제 섭취 시간</span>
            <span className="font-medium text-gray-900">{formatDateTime(foodRecord.consumed_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">기록 시간</span>
            <span className="font-medium text-gray-900">
              {foodRecord.recorded_date} {foodRecord.recorded_time.slice(0, 5)}
            </span>
          </div>
        </div>
      </div>

      {/* 사용자 답변 요약 */}
      {foodRecord.user_answers && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">답변 요약</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">섭취량</span>
              <span className="text-gray-900">{foodRecord.user_answers.portion_percentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">식사 구분</span>
              <span className="text-gray-900">{foodRecord.user_answers.meal_type}</span>
            </div>
            {foodRecord.user_answers.corrected_food_name && (
              <div className="flex justify-between">
                <span className="text-gray-600">수정된 음식명</span>
                <span className="text-gray-900">{foodRecord.user_answers.corrected_food_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/customer/food-diary/camera"
          className="bg-green-600 text-white py-3 px-4 rounded-md font-medium hover:bg-green-700 text-center"
        >
          다른 음식 기록하기
        </Link>
        <Link
          href="/customer/food-diary"
          className="bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 text-center"
        >
          전체 기록 보기
        </Link>
      </div>

      {/* 하루 통계 미리보기 */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">💡 오늘의 식단 분석</h3>
        <p className="text-sm text-gray-600">
          이 음식 기록이 저장되었습니다. 하루 종일의 섭취 패턴을 통해 
          영양 균형과 혈당 흐름을 분석할 수 있습니다.
        </p>
        <Link 
          href="/customer/food-diary/stats" 
          className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          오늘 통계 보기 →
        </Link>
      </div>
    </div>
  );
}

export default function FoodResultPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <FoodResultContent />
    </Suspense>
  );
}