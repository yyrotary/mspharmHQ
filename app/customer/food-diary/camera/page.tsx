'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface AnalysisResult {
  food_name: string;
  food_category: string;
  confidence: number;
  estimated_calories_per_serving: number;
  estimated_serving_size: string;
  nutritional_info: {
    carbohydrates: number;
    protein: number;
    fat: number;
    sodium?: number;
    sugar?: number;
    fiber?: number;
  };
  smart_questions: {
    id: string;
    question: string;
    options: string[];
  }[];
}

interface QuestionAnswer {
  question_id: string;
  answer: string;
}

type Step = 'camera' | 'preview' | 'analyzing' | 'result' | 'questions' | 'saving';

export default function FoodCameraPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState<Step>('camera');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [mealType, setMealType] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    setSession(JSON.parse(sessionData));
    
    // 시간에 따른 기본 식사 유형 설정
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 10) setMealType('아침');
    else if (hour >= 10 && hour < 15) setMealType('점심');
    else if (hour >= 15 && hour < 21) setMealType('저녁');
    else setMealType('간식');
  }, [router]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
        setCameraError(null);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('카메라를 사용할 수 없습니다. 갤러리에서 사진을 선택해주세요.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraReady(false);
  }, []);

  useEffect(() => {
    if (step === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [step, startCamera, stopCamera]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageData);
      setStep('preview');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setCapturedImage(imageData);
      setStep('preview');
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!capturedImage || !session) return;

    setStep('analyzing');

    try {
      const base64Data = capturedImage.split(',')[1];

      const response = await fetch('/api/customer/food/analyze-with-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          customerId: session.customerId,
          mealType
        })
      });

      const data = await response.json();

      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis);
        
        // 질문이 있으면 질문 단계로, 없으면 바로 결과로
        if (data.analysis.smart_questions?.length > 0) {
          setStep('questions');
          setCurrentQuestion(0);
        } else {
          setStep('result');
        }
      } else {
        throw new Error(data.error || '분석 실패');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      toast.error('음식 분석에 실패했습니다');
      setStep('preview');
    }
  };

  const handleAnswer = (answer: string) => {
    if (!analysisResult) return;

    const question = analysisResult.smart_questions[currentQuestion];
    setAnswers(prev => [...prev, { question_id: question.id, answer }]);

    if (currentQuestion < analysisResult.smart_questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      setStep('result');
    }
  };

  const saveRecord = async () => {
    if (!session || !analysisResult || !capturedImage) return;

    setStep('saving');

    try {
      // 포션 크기 결정
      let portionConsumed = '100%';
      const portionAnswer = answers.find(a => a.question_id === 'portion_check');
      if (portionAnswer?.answer.includes('일부') || portionAnswer?.answer.includes('조금')) {
        portionConsumed = '50%';
      }

      // 실제 칼로리 계산
      const portionMultiplier = portionConsumed === '100%' ? 1 : 0.5;
      const actualCalories = Math.round(
        analysisResult.estimated_calories_per_serving * portionMultiplier
      );

      const response = await fetch('/api/customer/food/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: session.customerId,
          food_name: analysisResult.food_name,
          food_category: analysisResult.food_category,
          meal_type: mealType,
          image: capturedImage.split(',')[1],
          portion_consumed: portionConsumed,
          actual_calories: actualCalories,
          nutritional_info: analysisResult.nutritional_info,
          user_answers: answers,
          confidence: analysisResult.confidence
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('음식이 기록되었습니다! 🎉');
        router.push('/customer/food-diary');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('저장에 실패했습니다');
      setStep('result');
    }
  };

  const resetCamera = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setAnswers([]);
    setCurrentQuestion(0);
    setStep('camera');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* 헤더 */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        {step === 'camera' && (
          <div className="flex gap-2">
            {['아침', '점심', '저녁', '간식'].map(type => (
        <button
                key={type}
                onClick={() => setMealType(type)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  mealType === type
                    ? 'bg-green-500 text-white'
                    : 'bg-white/20 text-white/80 backdrop-blur-sm'
                }`}
        >
                {type}
        </button>
            ))}
          </div>
        )}
      </div>

      {/* 카메라 뷰 */}
      {step === 'camera' && (
        <div className="flex-1 relative">
          {cameraError ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white p-8 text-center">
              <span className="text-5xl mb-4">📷</span>
              <p className="text-lg mb-4">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-green-500 rounded-full font-medium"
              >
                갤러리에서 선택
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          )}
          
          {/* 가이드 프레임 */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-72 border-2 border-white/50 rounded-3xl"></div>
            </div>
            
            {/* 촬영 버튼 */}
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6">
              <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
              <span className="text-2xl">🖼️</span>
              </button>
            
            <button
              onClick={capturePhoto}
              disabled={!isCameraReady}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl disabled:opacity-50"
            >
              <div className="w-16 h-16 bg-green-500 rounded-full" />
            </button>
            
            <div className="w-14 h-14" />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      )}

      {/* 프리뷰 */}
      {step === 'preview' && capturedImage && (
        <div className="flex-1 relative">
          <img src={capturedImage} alt="Preview" className="w-full h-full object-contain" />
          
          <div className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-4 px-6">
            <button
              onClick={resetCamera}
              className="flex-1 py-4 bg-white/20 backdrop-blur-sm rounded-2xl text-white font-medium"
            >
              다시 찍기
            </button>
          <button
              onClick={analyzeImage}
              className="flex-1 py-4 bg-green-500 rounded-2xl text-white font-medium"
          >
              분석하기
          </button>
        </div>
      </div>
      )}

      {/* 분석 중 */}
      {step === 'analyzing' && (
        <div className="flex-1 flex flex-col items-center justify-center text-white">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 border-4 border-green-500/30 rounded-full animate-pulse"></div>
            <div className="absolute inset-2 border-4 border-green-500/50 rounded-full animate-ping"></div>
            <div className="absolute inset-4 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-3xl">🍽️</span>
            </div>
          </div>
          <p className="mt-6 text-lg font-medium">음식을 분석하고 있어요...</p>
          <p className="mt-2 text-sm text-white/60">AI가 영양 정보를 계산 중입니다</p>
        </div>
      )}

      {/* 질문 단계 */}
      {step === 'questions' && analysisResult && (
        <div className="flex-1 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 text-white p-6">
          <div className="flex-1 flex flex-col justify-center">
            {/* 음식 정보 요약 */}
            <div className="text-center mb-8">
              <span className="text-5xl mb-4 block">🍽️</span>
              <h2 className="text-2xl font-bold">{analysisResult.food_name}</h2>
              <p className="text-white/60 mt-2">
                예상 칼로리: {analysisResult.estimated_calories_per_serving} kcal
              </p>
            </div>

            {/* 진행 상황 */}
            <div className="flex justify-center gap-2 mb-8">
              {analysisResult.smart_questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentQuestion
                      ? 'w-6 bg-green-500'
                      : idx < currentQuestion
                      ? 'bg-green-500'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            {/* 현재 질문 */}
            <div className="bg-white/10 rounded-3xl p-6 backdrop-blur-sm">
              <p className="text-lg font-medium text-center mb-6">
                {analysisResult.smart_questions[currentQuestion]?.question}
              </p>
              
              <div className="space-y-3">
                {analysisResult.smart_questions[currentQuestion]?.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(option)}
                    className="w-full py-4 px-6 bg-white/10 hover:bg-green-500 rounded-2xl text-left font-medium transition-all"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 결과 */}
      {step === 'result' && analysisResult && (
        <div className="flex-1 flex flex-col bg-white">
          {/* 이미지 */}
          {capturedImage && (
            <div className="h-48 relative">
              <img src={capturedImage} alt="Food" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
            </div>
          )}

          {/* 분석 결과 */}
          <div className="flex-1 px-6 -mt-8 relative">
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <div className="text-center mb-6">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {analysisResult.food_category}
                </span>
                <h2 className="text-2xl font-bold text-gray-900 mt-3">{analysisResult.food_name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  신뢰도: {Math.round(analysisResult.confidence * 100)}%
                </p>
              </div>

              {/* 칼로리 */}
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl p-5 text-white text-center mb-6">
                <p className="text-green-100 text-sm">예상 칼로리</p>
                <p className="text-4xl font-bold">{analysisResult.estimated_calories_per_serving}</p>
                <p className="text-green-200 text-sm">kcal</p>
              </div>

              {/* 영양소 */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <p className="text-xs text-amber-600 font-medium">탄수화물</p>
                  <p className="text-xl font-bold text-amber-700">{analysisResult.nutritional_info.carbohydrates}g</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs text-blue-600 font-medium">단백질</p>
                  <p className="text-xl font-bold text-blue-700">{analysisResult.nutritional_info.protein}g</p>
                </div>
                <div className="text-center p-3 bg-pink-50 rounded-xl">
                  <p className="text-xs text-pink-600 font-medium">지방</p>
                  <p className="text-xl font-bold text-pink-700">{analysisResult.nutritional_info.fat}g</p>
                </div>
      </div>

              {/* 식사 유형 선택 */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">식사 유형</p>
                <div className="flex gap-2">
                  {['아침', '점심', '저녁', '간식'].map(type => (
                    <button
                      key={type}
                      onClick={() => setMealType(type)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                        mealType === type
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
      </div>

          {/* 저장 버튼 */}
          <div className="p-6 bg-white border-t border-gray-100">
            <div className="flex gap-3">
              <button
                onClick={resetCamera}
                className="flex-1 py-4 bg-gray-100 rounded-2xl text-gray-700 font-medium"
              >
                다시 촬영
              </button>
              <button
                onClick={saveRecord}
                className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl text-white font-medium shadow-lg"
              >
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장 중 */}
      {step === 'saving' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          <p className="mt-4 text-gray-600">저장 중...</p>
        </div>
      )}

      {/* 캔버스 (숨김) */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
