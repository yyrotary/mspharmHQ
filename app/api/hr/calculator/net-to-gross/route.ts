import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';

/**
 * Net-to-Gross 역산 계산기
 * 목표 실수령액(세후)에서 필요한 세전 금액을 반복 시뮬레이션으로 계산
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      net_target,
      dependent_count = 1,
      meal_allowance = 200000,
      car_allowance = 0,
      childcare_allowance = 0,
    } = body;

    if (!net_target || net_target <= 0) {
      return NextResponse.json(
        { error: '목표 실수령액을 입력해주세요' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // 비과세 항목 합계
    const totalNonTaxable = meal_allowance + car_allowance + childcare_allowance;

    // 반복 시뮬레이션으로 세전 금액 역산
    let grossPayCalculated = net_target * 1.3; // 초기 추정값 (30% 공제 가정)
    let iterations = 0;
    const MAX_ITERATIONS = 200;
    const TOLERANCE = 100; // 오차 허용 범위 (100원)

    let bestGross = grossPayCalculated;
    let bestDiff = Infinity;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      // 과세소득 계산
      const taxableIncome = grossPayCalculated - totalNonTaxable;

      // 4대 보험 계산
      const { data: nationalPension } = await supabase
        .rpc('calculate_national_pension_2026', { p_taxable_income: taxableIncome });
      
      const { data: healthInsurance } = await supabase
        .rpc('calculate_health_insurance_2026', { p_taxable_income: taxableIncome });
      
      const { data: longTermCare } = await supabase
        .rpc('calculate_long_term_care_2026', { p_health_insurance: healthInsurance });
      
      const { data: employmentInsurance } = await supabase
        .rpc('calculate_employment_insurance_2026', { p_taxable_income: taxableIncome });

      // 소득세 계산 (간이세액표)
      const { data: incomeTax } = await supabase
        .rpc('calculate_income_tax_2026', {
          p_taxable_income: taxableIncome,
          p_dependent_count: dependent_count,
        });

      const localTax = Math.round((incomeTax || 0) * 0.1);

      // 총 공제액
      const totalDeductions = 
        (nationalPension || 0) + 
        (healthInsurance || 0) + 
        (longTermCare || 0) + 
        (employmentInsurance || 0) + 
        (incomeTax || 0) + 
        localTax;

      // 실수령액 계산
      const netPayResult = grossPayCalculated - totalDeductions;
      const diff = netPayResult - net_target;

      // 최선의 결과 저장
      if (Math.abs(diff) < Math.abs(bestDiff)) {
        bestDiff = diff;
        bestGross = grossPayCalculated;
      }

      // 오차 범위 내면 종료
      if (Math.abs(diff) <= TOLERANCE) {
        return NextResponse.json({
          success: true,
          result: {
            net_target,
            gross_pay_calculated: Math.round(grossPayCalculated),
            taxable_calculated: Math.round(taxableIncome),
            total_non_taxable: totalNonTaxable,
            national_pension: nationalPension || 0,
            health_insurance: healthInsurance || 0,
            long_term_care: longTermCare || 0,
            employment_insurance: employmentInsurance || 0,
            income_tax: incomeTax || 0,
            local_tax: localTax,
            total_deductions: Math.round(totalDeductions),
            net_pay_result: Math.round(netPayResult),
            iterations,
            difference: Math.round(diff),
          },
        });
      }

      // 다음 시도를 위한 조정 (10원 단위)
      if (diff < 0) {
        // 실수령액이 목표보다 적음 → 세전 증가
        grossPayCalculated += Math.max(10, Math.abs(diff) * 0.5);
      } else {
        // 실수령액이 목표보다 많음 → 세전 감소
        grossPayCalculated -= Math.max(10, Math.abs(diff) * 0.5);
      }

      // 최소값 보장
      if (grossPayCalculated < net_target) {
        grossPayCalculated = net_target * 1.1;
      }
    }

    // 최대 반복 횟수 도달 시 최선의 결과 반환
    console.warn(`최대 반복 횟수 도달. 최선의 결과 반환. 오차: ${bestDiff}원`);

    // 최선의 결과로 재계산
    const taxableIncome = bestGross - totalNonTaxable;

    const { data: nationalPension } = await supabase
      .rpc('calculate_national_pension_2026', { p_taxable_income: taxableIncome });
    
    const { data: healthInsurance } = await supabase
      .rpc('calculate_health_insurance_2026', { p_taxable_income: taxableIncome });
    
    const { data: longTermCare } = await supabase
      .rpc('calculate_long_term_care_2026', { p_health_insurance: healthInsurance });
    
    const { data: employmentInsurance } = await supabase
      .rpc('calculate_employment_insurance_2026', { p_taxable_income: taxableIncome });

    const { data: incomeTax } = await supabase
      .rpc('calculate_income_tax_2026', {
        p_taxable_income: taxableIncome,
        p_dependent_count: dependent_count,
      });

    const localTax = Math.round((incomeTax || 0) * 0.1);
    const totalDeductions = 
      (nationalPension || 0) + 
      (healthInsurance || 0) + 
      (longTermCare || 0) + 
      (employmentInsurance || 0) + 
      (incomeTax || 0) + 
      localTax;
    const netPayResult = bestGross - totalDeductions;

    return NextResponse.json({
      success: true,
      result: {
        net_target,
        gross_pay_calculated: Math.round(bestGross),
        taxable_calculated: Math.round(taxableIncome),
        total_non_taxable: totalNonTaxable,
        national_pension: nationalPension || 0,
        health_insurance: healthInsurance || 0,
        long_term_care: longTermCare || 0,
        employment_insurance: employmentInsurance || 0,
        income_tax: incomeTax || 0,
        local_tax: localTax,
        total_deductions: Math.round(totalDeductions),
        net_pay_result: Math.round(netPayResult),
        iterations: MAX_ITERATIONS,
        difference: Math.round(netPayResult - net_target),
      },
    });

  } catch (error) {
    console.error('Net-to-Gross calculation error:', error);
    return NextResponse.json(
      { error: '계산 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
