'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface CustomerSession {
  customerId: string;
  customerCode: string;
  customerName: string;
}

interface QuestionData {
  id: string;
  type: 'portion' | 'timing' | 'category' | 'confirmation';
  question: string;
  options?: string[];
  defaultValue?: string;
}

interface FoodAnalysis {
  food_name: string;
  food_category: string;
  confidence: number;
  questions: QuestionData[];
  estimated_calories_per_100g: number;
}

interface Answer {
  questionId: string;
  answer: string;
  customValue?: string;
}

export default function FoodQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [customerSession, setCustomerSession] = useState<CustomerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    // 세션 확인
    const sessionData = localStorage.getItem('customer_session');
    if (!sessionData) {
      router.push('/customer/login');
      return;
    }
    setCustomerSession(JSON.parse(sessionData));
    
    // URL에서 분석 결과 가져오기
    loadAnalysisSession();
  }, [router]);

  const loadAnalysisSession = async () => {
    try {
      // 실제로는 세션 ID로 분석 결과를 조회해야 하지만, 
      // 여기서는 localStorage에서 임시로 가져옵니다.
      const analysisData = localStorage.getItem(`food_analysis_${sessionId}`);
      if (analysisData) {
        const data = JSON.parse(analysisData);
        setImageUrl(data.imageUrl);
        setAnalysis(data.analysis);
        
        // 기본 답변 설정
        const defaultAnswers: Answer[] = data.analysis.questions.map((q: QuestionData) => ({
          questionId: q.id,
          answer: q.defaultValue || (q.options?.[0] || ''),
          customValue: undefined
        }));
        setAnswers(defaultAnswers);
      }
    } catch (error) {
      console.error('분석 세션 로드 오류:', error);
      toast.error('분석 데이터를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const updateAnswer = (questionId: string, answer: string, customValue?: string) => {
    setAnswers(prev => prev.map(a => 
      a.questionId === questionId 
        ? { ...a, answer, customValue }
        : a
    ));
  };

  const handleNext = () => {
    if (analysis && currentQuestionIndex < analysis.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      submitAnswers();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const submitAnswers = async () => {
    if (!customerSession || !analysis) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/customer/food/submit-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          answers: answers,
          customerId: customerSession.customerId
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 임시 분석 데이터 정리
        localStorage.removeItem(`food_analysis_${sessionId}`);
        
        toast.success('음식 기록이 완료되었습니다!');
        router.push(`/customer/food-diary/result?recordId=${data.recordId}`);
      } else {
        toast.error(data.error || '기록 저장에 실패했습니다');
      }
    } catch (error) {
      console.error('답변 제출 오류:', error);
      toast.error('답변 제출 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">분석 데이터를 찾을 수 없습니다.</p>
        <Link href="/customer/food-diary" className="text-indigo-600 hover:text-indigo-700">
          음식 기록으로 돌아가기
        </Link>
      </div>
    );
  }

  const currentQuestion = analysis.questions[currentQuestionIndex];
  const currentAnswer = answers.find(a => a.questionId === currentQuestion.id);
  const progress = ((currentQuestionIndex + 1) / analysis.questions.length) * 100;

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
          취소
        </button>
        <h1 className="text-lg font-semibold text-gray-900">🤖 AI 질문</h1>
        <div className="w-12"></div>
      </div>

      {/* 진행률 표시 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {currentQuestionIndex + 1} / {analysis.questions.length}
          </span>
          <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 음식 이미지 및 분석 결과 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt="분석된 음식"
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{analysis.food_name}</h3>
              <p className="text-sm text-gray-600">{analysis.food_category}</p>
              <div className="flex items-center mt-1">
                <span className="text-xs text-gray-500">
                  AI 신뢰도: {Math.round(analysis.confidence * 100)}%
                </span>
                <span className="mx-2 text-gray-300">•</span>
                <span className="text-xs text-gray-500">
                  예상 칼로리: {analysis.estimated_calories_per_100g}kcal/100g
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 현재 질문 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {currentQuestion.question}
        </h2>

        <div className="space-y-3">
          {currentQuestion.options?.map((option, index) => (
            <label key={index} className="flex items-center">
              <input
                type="radio"
                name={currentQuestion.id}
                value={option}
                checked={currentAnswer?.answer === option}
                onChange={(e) => updateAnswer(currentQuestion.id, e.target.value)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
              />
              <span className="ml-3 text-gray-700">{option}</span>
            </label>
          ))}
        </div>

        {/* 직접 입력 옵션 */}
        {(currentAnswer?.answer?.includes('직접 입력') || currentQuestion.type === 'timing') && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {currentQuestion.type === 'timing' ? '구체적인 시간 입력' : '직접 입력'}
            </label>
            {currentQuestion.type === 'timing' ? (
              <input
                type="datetime-local"
                value={customInputs[currentQuestion.id] || ''}
                onChange={(e) => {
                  setCustomInputs(prev => ({ ...prev, [currentQuestion.id]: e.target.value }));
                  updateAnswer(currentQuestion.id, '직접 입력', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            ) : (
              <input
                type="text"
                value={customInputs[currentQuestion.id] || ''}
                onChange={(e) => {
                  setCustomInputs(prev => ({ ...prev, [currentQuestion.id]: e.target.value }));
                  updateAnswer(currentQuestion.id, currentAnswer?.answer || '', e.target.value);
                }}
                placeholder="음식명을 입력해주세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            )}
          </div>
        )}
      </div>

      {/* 네비게이션 버튼 */}
      <div className="flex space-x-3">
        {currentQuestionIndex > 0 && (
          <button
            onClick={handlePrevious}
            className="flex-1 bg-gray-600 text-white py-3 px-4 rounded-md font-medium hover:bg-gray-700"
          >
            이전
          </button>
        )}
        
        <button
          onClick={handleNext}
          disabled={submitting}
          className="flex-1 bg-indigo-600 text-white py-3 px-4 rounded-md font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              저장 중...
            </div>
          ) : currentQuestionIndex === analysis.questions.length - 1 ? (
            '완료'
          ) : (
            '다음'
          )}
        </button>
      </div>

      {/* 질문 미리보기 및 AI 분석 정보 */}
      <div className="bg-gray-50 rounded-lg p-4">
        {analysis.questions.length <= 2 ? (
          // 질문이 적을 때는 간단한 안내
          <div className="text-center">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">스마트 분석 완료</h3>
            <p className="text-xs text-gray-600">
              AI가 상황을 정확히 파악해서 필요한 질문만 {analysis.questions.length}개 준비했습니다
            </p>
          </div>
        ) : (
          // 질문이 많을 때는 기존 미리보기
          <>
            <h3 className="text-sm font-medium text-gray-700 mb-3">질문 미리보기</h3>
            <div className="space-y-2">
              {analysis.questions.map((question, index) => (
                <div 
                  key={question.id}
                  className={`flex items-center text-sm ${
                    index === currentQuestionIndex 
                      ? 'text-indigo-600 font-medium' 
                      : index < currentQuestionIndex 
                        ? 'text-green-600' 
                        : 'text-gray-500'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 ${
                    index === currentQuestionIndex 
                      ? 'bg-indigo-100 text-indigo-600' 
                      : index < currentQuestionIndex 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-500'
                  }`}>
                    {index < currentQuestionIndex ? '✓' : index + 1}
                  </div>
                  <span className="truncate">{question.question}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
