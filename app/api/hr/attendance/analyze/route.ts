import { NextRequest, NextResponse } from 'next/server';
import { getEmployeePurchaseSupabase } from '@/app/lib/employee-purchase/supabase';
import { verifyEmployeeAuth } from '@/app/lib/employee-purchase/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Gemini API 설정
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: NextRequest) {
    try {
        // 1. 인증 확인
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 });
        }

        const user = await verifyEmployeeAuth(request);
        if (!user || !['owner', 'manager'].includes(user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. 이미지 데이터 받기
        const formData = await request.formData();
        const file = formData.get('image') as File;

        if (!file) {
            return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
        }

        // 3. 직원 목록 조회 (이름 매칭용)
        // 3. 직원 목록 조회 (이름 매칭용)
        const supabase = getEmployeePurchaseSupabase();
        const { data: employees } = await supabase
            .from('employees')
            .select('id, name');

        // 클라이언트에서 전달받은 특정 직원 ID (선택사항)
        const targetEmployeeId = formData.get('employee_id') as string;
        let targetEmployeeName = '';

        if (targetEmployeeId && employees) {
            const target = employees.find(e => e.id === targetEmployeeId);
            if (target) targetEmployeeName = target.name;
        }

        const employeeList = employees?.map(e => `${e.name} (ID: ${e.id})`).join(', ') || '';

        // 4. Gemini 모델 준비 (Fallback Logic)
        const generateContentWithFallback = async (imagePart: any, prompt: string) => {
            const models = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];
            let lastError: any;

            for (const modelName of models) {
                try {
                    console.log(`Attempting analysis with model: ${modelName}`);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent([prompt, imagePart]);
                    const response = await result.response;
                    return response.text();
                } catch (error) {
                    console.warn(`Model ${modelName} failed:`, (error as Error).message);
                    lastError = error;
                    // Continue to next model
                }
            }
            throw lastError || new Error("All models failed");
        };

        // 이미지 바이너리 변환
        const arrayBuffer = await file.arrayBuffer();
        const imagePart = {
            inlineData: {
                data: Buffer.from(arrayBuffer).toString('base64'),
                mimeType: file.type
            },
        };

        // 5. 프롬프트 작성
        const prompt = `
      이 이미지는 수기로 작성된 '근무 일지'입니다. 
      특히 **${targetEmployeeName ? targetEmployeeName + " 님의" : ""} 근무 기록 목록**을 추출해야 합니다.
      이미지에는 날짜와 출/퇴근 시간이 리스트 형태로 나열되어 있을 수 있습니다.

      다음 정보를 추출하여 정확한 JSON Array 형식으로 반환해줘.
      JSON 외에 다른 말은 하지 마.

      **추출할 항목:**
      1. work_date: 근무 날짜 (YYYY-MM-DD 형식). 연도가 명시되지 않았다면 현재 연도(${new Date().getFullYear()})를 기준으로 추정.
      2. employee_name: 직원 이름. (명시되어 있지 않다면 "${targetEmployeeName || 'Unknown'}" 사용).
      3. check_in_time: 출근 시간 (HH:MM). 오전/오후 주의. 24시간제 변환.
      4. check_out_time: 퇴근 시간 (HH:MM). 오전/오후 주의. 24시간제 변환.

      **주의사항:**
      - 손글씨가 흘려 써져 있어도 문맥을 파악해.
      - 여러 날짜의 기록이 있다면 모두 배열에 담아줘.
      - 날짜 순서가 뒤죽박죽이라도 있는 대로 다 추출해.
      - 유효하지 않은 행은 건너뛰어.

      **직원 명단 참고:**
      ${employeeList}

      **응답 형식:**
      [
        {
          "work_date": "2024-05-01",
          "employee_name": "홍길동",
          "employee_id": "${targetEmployeeId || 'null'}", 
          "check_in_time": "09:00",
          "check_out_time": "18:00"
        },
        ...
      ]
    `;

        // 6. AI 분석 실행 (With Fallback)
        let text = '';
        try {
            text = await generateContentWithFallback(imagePart, prompt);
            console.log('Gemini Analysis Result:', text);
        } catch (genError) {
            console.error('Gemini generation failed:', genError);
            // Return specific error to client for debugging
            return NextResponse.json({
                error: 'AI 모델 오류: ' + (genError as Error).message,
                troubleshooting: '서버 콘솔 로그를 확인하세요. 2.0/1.5 모델 모두 실패함.'
            }, { status: 500 });
        }

        // 7. JSON 파싱
        let parsedData = [];
        try {
            // Markdown 코드 블록 제거
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanedText);
        } catch (e) {
            console.error('JSON Parse Error:', e);
            // 재시도 또는 에러 반환 (여기서는 에러 반환)
            // Gemini 2.0이 가끔 텍스트를 섞을 수 있으므로 파싱 실패 시 raw text 반환
            return NextResponse.json({ error: 'AI 응답을 분석할 수 없습니다.', raw: text }, { status: 500 });
        }

        // 8. 데이터 검증 및 보정
        const validatedData = parsedData.map((item: any) => {
            // Target Employee 강제 적용 (사용자가 선택했다면)
            if (targetEmployeeId) {
                item.employee_id = targetEmployeeId;
                item.employee_name = targetEmployeeName;
            }
            // ID 매칭 실패 시 이름으로 다시 시도
            else if (!item.employee_id && employees) {
                const matched = employees.find(e => e.name === item.employee_name);
                if (matched) item.employee_id = matched.id;
            }
            return item;
        });

        return NextResponse.json({ success: true, data: validatedData });

    } catch (error) {
        console.error('Image analysis error:', error);
        return NextResponse.json(
            {
                error: '이미지 분석 중 오류가 발생했습니다.',
                details: (error as Error).message,
                stack: (error as Error).stack
            },
            { status: 500 }
        );
    }
}
