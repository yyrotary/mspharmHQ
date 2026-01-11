import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await verifyEmployeeAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['manager', 'owner'].includes(user.role)) {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { month, report, recipient } = body;

    if (!month || !report || !recipient) {
      return NextResponse.json(
        { error: '필수 파라미터가 누락되었습니다' },
        { status: 400 }
      );
    }

    const supabase = getEmployeePurchaseSupabase();

    // CSV 생성
    let csvContent = '이름,주민등록번호,총지급액,비과세,과세,국민연금,건강보험,장기요양,고용보험,소득세,지방소득세\n';
    
    report.employees.forEach((emp: any) => {
      csvContent += `${emp.name},${emp.resident_number},${emp.gross_pay},${emp.non_taxable},${emp.taxable},`;
      csvContent += `${emp.national_pension},${emp.health_insurance},${emp.long_term_care},${emp.employment_insurance},`;
      csvContent += `${emp.income_tax},${emp.local_tax}\n`;
    });

    csvContent += `\n합계,,${report.totals.gross_pay},${report.totals.non_taxable},${report.totals.taxable},`;
    csvContent += `${report.totals.national_pension},${report.totals.health_insurance},${report.totals.long_term_care},`;
    csvContent += `${report.totals.employment_insurance},${report.totals.income_tax},${report.totals.local_tax}\n`;

    // 이메일 본문 생성
    const emailSubject = `[급여대장] ${new Date(month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 급여대장`;
    const emailBody = `
안녕하세요.

${new Date(month).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })} 급여대장을 전송드립니다.

■ 요약
- 대상 인원: ${report.employees.length}명
- 총 지급액: ${new Intl.NumberFormat('ko-KR').format(report.totals.gross_pay)}원
- 실수령액 합계: ${new Intl.NumberFormat('ko-KR').format(report.totals.gross_pay - (report.totals.national_pension + report.totals.health_insurance + report.totals.long_term_care + report.totals.employment_insurance + report.totals.income_tax + report.totals.local_tax))}원

첨부된 CSV 파일을 확인해주시기 바랍니다.

감사합니다.
    `.trim();

    // 전송 이력 저장
    const { error: logError } = await supabase
      .from('tax_reports')
      .insert({
        report_month: month,
        recipient_email: recipient,
        employee_count: report.employees.length,
        total_gross_pay: report.totals.gross_pay,
        report_data: report,
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      });

    if (logError) {
      console.error('Tax report log error:', logError);
    }

    // 실제 이메일 전송은 환경에 따라 다양한 방법이 있습니다:
    // 1. Resend (resend.com)
    // 2. SendGrid
    // 3. AWS SES
    // 4. Nodemailer
    
    // 여기서는 Resend를 사용하는 예시를 보여드립니다
    // 먼저 RESEND_API_KEY를 환경변수에 설정해야 합니다
    
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY가 설정되지 않았습니다. 이메일 전송을 시뮬레이션합니다.');
      
      // 개발 환경에서는 로그만 출력
      console.log('=== 이메일 전송 시뮬레이션 ===');
      console.log('받는 사람:', recipient);
      console.log('제목:', emailSubject);
      console.log('본문:', emailBody);
      console.log('첨부파일: 급여대장.csv');
      console.log('=============================');
      
      return NextResponse.json({
        success: true,
        message: '개발 모드: 이메일 전송이 시뮬레이션되었습니다',
        simulation: true,
      });
    }

    // Resend를 사용한 실제 이메일 전송
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'noreply@yourdomain.com',
          to: [recipient],
          subject: emailSubject,
          text: emailBody,
          attachments: [
            {
              filename: `급여대장_${month}.csv`,
              content: Buffer.from('\uFEFF' + csvContent).toString('base64'),
            },
          ],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Resend API error:', result);
        throw new Error(result.message || '이메일 전송 실패');
      }

      return NextResponse.json({
        success: true,
        message: '이메일이 성공적으로 전송되었습니다',
        emailId: result.id,
      });

    } catch (emailError: any) {
      console.error('Email send error:', emailError);
      return NextResponse.json(
        { error: `이메일 전송 실패: ${emailError.message}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Send tax report error:', error);
    return NextResponse.json(
      { error: '이메일 전송 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
