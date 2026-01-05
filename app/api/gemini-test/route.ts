import { NextResponse } from 'next/server';

// Gemini API 키
const GEMINI_API_KEY = 'AIzaSyCNyZ7ZuQR0RNjXhky9GKD1FApRDEOeV14';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// API 키 테스트를 위한 간단한 핸들러
export async function GET() {
  try {
    // Gemini API 요청 데이터 구성
    const requestData = {
      contents: [
        {
          parts: [
            { text: "Hello, are you working? Please respond with 'Yes, I am working.'" }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        topP: 1,
        topK: 32,
        maxOutputTokens: 100,
      }
    };
    
    // Gemini API 호출
    const geminiResponse = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      }
    );
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API 오류:', errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: '유효하지 않은 API 키 또는 API 호출 오류', 
          details: errorText,
          status: geminiResponse.status
        },
        { status: 500 }
      );
    }
    
    const geminiResult = await geminiResponse.json();
    
    return NextResponse.json({
      success: true,
      message: 'API 키가 유효합니다',
      response: geminiResult
    });
    
  } catch (error) {
    console.error('API 테스트 오류:', error);
    return NextResponse.json(
      { success: false, error: '테스트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 