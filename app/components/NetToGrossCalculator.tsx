'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface CalculatorProps {
  onClose: () => void;
  onApply?: (grossPay: number) => void;
}

export default function NetToGrossCalculator({ onClose, onApply }: CalculatorProps) {
  const [netTarget, setNetTarget] = useState<string>('');
  const [dependentCount, setDependentCount] = useState<number>(1);
  const [mealAllowance, setMealAllowance] = useState<string>('200000');
  const [carAllowance, setCarAllowance] = useState<string>('0');
  const [childcareAllowance, setChildcareAllowance] = useState<string>('0');
  
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const calculateGrossFromNet = async () => {
    if (!netTarget || parseFloat(netTarget) <= 0) {
      toast.error('목표 실수령액을 입력해주세요');
      return;
    }

    const targetNet = parseFloat(netTarget);
    const meal = parseFloat(mealAllowance) || 0;
    const car = parseFloat(carAllowance) || 0;
    const childcare = parseFloat(childcareAllowance) || 0;

    // 최저임금 체크
    const MINIMUM_WAGE_MONTHLY = 2156880;
    if (targetNet < MINIMUM_WAGE_MONTHLY * 0.8) {
      if (!confirm(`입력하신 금액이 최저임금(${MINIMUM_WAGE_MONTHLY.toLocaleString()}원)보다 낮습니다.\n계속하시겠습니까?`)) {
        return;
      }
    }

    setCalculating(true);

    try {
      const response = await fetch('/api/hr/calculator/net-to-gross', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          net_target: targetNet,
          dependent_count: dependentCount,
          meal_allowance: meal,
          car_allowance: car,
          childcare_allowance: childcare,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data.result);
        toast.success('세전 금액이 계산되었습니다');
      } else {
        toast.error(data.error || '계산 실패');
      }
    } catch (error) {
      console.error('Calculate error:', error);
      toast.error('계산 중 오류가 발생했습니다');
    } finally {
      setCalculating(false);
    }
  };

  const handleApply = () => {
    if (result && onApply) {
      onApply(result.gross_pay_calculated);
      onClose();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(amount));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                🧮 세후 → 세전 역산 계산기
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                목표 실수령액(세후)을 입력하면 필요한 세전 금액을 자동 계산합니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* 입력 섹션 */}
          <div className="space-y-6 mb-6">
            {/* 목표 실수령액 */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <label className="block text-sm font-bold text-blue-900 mb-2">
                💰 목표 실수령액 (세후, Net) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={netTarget}
                onChange={(e) => setNetTarget(e.target.value)}
                className="w-full px-4 py-3 text-xl font-bold border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="예: 7000000"
              />
              <p className="text-xs text-blue-700 mt-2">
                실제로 직원에게 지급하고 싶은 금액 (세금, 4대보험 공제 후)
              </p>
            </div>

            {/* 부양가족 수 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👨‍👩‍👧‍👦 부양가족 수
              </label>
              <select
                value={dependentCount}
                onChange={(e) => setDependentCount(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>
                    {num}명 {num === 1 && '(본인만)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                소득세 계산에 영향을 줍니다 (많을수록 세금 감소)
              </p>
            </div>

            {/* 비과세 항목 */}
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-3">
                💵 비과세 항목 (4대보험, 소득세 계산 제외)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    식대
                  </label>
                  <input
                    type="number"
                    value={mealAllowance}
                    onChange={(e) => setMealAllowance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">최대 20만원</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    차량유지비
                  </label>
                  <input
                    type="number"
                    value={carAllowance}
                    onChange={(e) => setCarAllowance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">최대 20만원</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    보육수당
                  </label>
                  <input
                    type="number"
                    value={childcareAllowance}
                    onChange={(e) => setChildcareAllowance(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">10만원/자녀</p>
                </div>
              </div>
            </div>

            {/* 계산 버튼 */}
            <div>
              <button
                onClick={calculateGrossFromNet}
                disabled={calculating || !netTarget}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {calculating ? '계산 중...' : '🔍 세전 금액 계산하기'}
              </button>
            </div>
          </div>

          {/* 결과 섹션 */}
          {result && (
            <div className="border-t-4 border-green-500 pt-6">
              <h3 className="text-xl font-bold text-green-700 mb-4">
                ✅ 계산 결과
              </h3>
              
              {/* 핵심 결과 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 p-4 rounded-lg border-2 border-green-300">
                  <div className="text-sm text-green-700 mb-1">📊 세전 총액 (Gross)</div>
                  <div className="text-3xl font-bold text-green-900">
                    {formatCurrency(result.gross_pay_calculated)}원
                  </div>
                  <div className="text-xs text-green-600 mt-2">
                    = 과세소득 {formatCurrency(result.taxable_calculated)} + 비과세 {formatCurrency(result.total_non_taxable)}
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-300">
                  <div className="text-sm text-blue-700 mb-1">💰 실수령액 (Net)</div>
                  <div className="text-3xl font-bold text-blue-900">
                    {formatCurrency(result.net_pay_result)}원
                  </div>
                  <div className="text-xs text-blue-600 mt-2">
                    목표: {formatCurrency(result.net_target)}원
                  </div>
                </div>
              </div>

              {/* 공제 내역 */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">📉 공제 내역</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">국민연금:</span>
                    <span className="font-medium">{formatCurrency(result.national_pension)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">건강보험:</span>
                    <span className="font-medium">{formatCurrency(result.health_insurance)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">장기요양:</span>
                    <span className="font-medium">{formatCurrency(result.long_term_care)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">고용보험:</span>
                    <span className="font-medium">{formatCurrency(result.employment_insurance)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">소득세:</span>
                    <span className="font-medium">{formatCurrency(result.income_tax)}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">지방소득세:</span>
                    <span className="font-medium">{formatCurrency(result.local_tax)}원</span>
                  </div>
                </div>
                <div className="border-t border-gray-300 mt-3 pt-3">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-800">총 공제액:</span>
                    <span className="text-red-600">{formatCurrency(result.total_deductions)}원</span>
                  </div>
                </div>
              </div>

              {/* 최저임금 체크 */}
              {result.gross_pay_calculated < 2156880 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">⚠️</span>
                    <div>
                      <p className="font-semibold text-yellow-800">최저임금 미달 경고</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        2026년 최저임금: 2,156,880원 (월 209시간 기준)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 반복 횟수 */}
              <div className="text-center text-xs text-gray-500 mb-4">
                {result.iterations}회 반복 계산으로 오차 ±{formatCurrency(Math.abs(result.net_pay_result - result.net_target))}원 달성
              </div>

              {/* 액션 버튼 */}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                >
                  닫기
                </button>
                {onApply && (
                  <button
                    onClick={handleApply}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors"
                  >
                    ✓ 이 금액 적용하기
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
