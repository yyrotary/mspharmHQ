'use client';

import { useState } from 'react';

export default function SimpleConsultationTest() {
  const [customer, setCustomer] = useState<any>(null);
  const [consultation, setConsultation] = useState({
    consultationDate: new Date().toISOString().split('T')[0],
    chiefComplaint: '',
    prescription: '',
    result: '',
    patientCondition: '',
    tongueAnalysis: '',
    specialNotes: ''
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 고객 검색
  const searchCustomer = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/customer?name=김분옥');
      const data = await response.json();
      
      if (data.success && data.customers.length > 0) {
        setCustomer(data.customers[0]);
        setMessage(`고객 찾음: ${data.customers[0].properties.고객명.rich_text[0].text.content}`);
      } else {
        setMessage('고객을 찾을 수 없습니다.');
      }
    } catch (error) {
      setMessage('고객 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상담일지 저장
  const saveConsultation = async () => {
    if (!customer) {
      setMessage('고객을 먼저 선택해주세요.');
      return;
    }

    if (!consultation.chiefComplaint) {
      setMessage('호소증상을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      setMessage('상담일지 저장 중...');

      const response = await fetch('/api/consultation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customer.id,
          consultationDate: consultation.consultationDate,
          chiefComplaint: consultation.chiefComplaint,
          prescription: consultation.prescription,
          result: consultation.result,
          patientCondition: consultation.patientCondition,
          tongueAnalysis: consultation.tongueAnalysis,
          specialNotes: consultation.specialNotes,
          imageDataArray: [] // 이미지 없이 테스트
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setMessage('상담일지가 성공적으로 저장되었습니다!');
        // 폼 초기화
        setConsultation({
          consultationDate: new Date().toISOString().split('T')[0],
          chiefComplaint: '',
          prescription: '',
          result: '',
          patientCondition: '',
          tongueAnalysis: '',
          specialNotes: ''
        });
      } else {
        setMessage(`저장 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      setMessage(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">상담일지 생성 테스트 (Google Drive 없이)</h1>
      
      {/* 고객 검색 */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-lg font-semibold mb-2">1. 고객 검색</h2>
        <button 
          onClick={searchCustomer}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          김분옥 고객 검색
        </button>
        {customer && (
          <div className="mt-2 p-2 bg-green-100 rounded">
            선택된 고객: {customer.properties.고객명.rich_text[0].text.content} 
            (코드: {customer.properties.id.title[0].text.content})
          </div>
        )}
      </div>

      {/* 상담일지 입력 */}
      <div className="mb-6 p-4 border rounded">
        <h2 className="text-lg font-semibold mb-4">2. 상담일지 입력</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">상담일자</label>
            <input
              type="date"
              value={consultation.consultationDate}
              onChange={(e) => setConsultation(prev => ({ ...prev, consultationDate: e.target.value }))}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">호소증상 *</label>
            <textarea
              value={consultation.chiefComplaint}
              onChange={(e) => setConsultation(prev => ({ ...prev, chiefComplaint: e.target.value }))}
              className="w-full p-2 border rounded h-24"
              placeholder="호소증상을 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">환자상태</label>
            <textarea
              value={consultation.patientCondition}
              onChange={(e) => setConsultation(prev => ({ ...prev, patientCondition: e.target.value }))}
              className="w-full p-2 border rounded h-20"
              placeholder="환자상태를 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">설진분석</label>
            <textarea
              value={consultation.tongueAnalysis}
              onChange={(e) => setConsultation(prev => ({ ...prev, tongueAnalysis: e.target.value }))}
              className="w-full p-2 border rounded h-20"
              placeholder="설진분석을 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">처방약</label>
            <textarea
              value={consultation.prescription}
              onChange={(e) => setConsultation(prev => ({ ...prev, prescription: e.target.value }))}
              className="w-full p-2 border rounded h-20"
              placeholder="처방약을 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">특이사항</label>
            <textarea
              value={consultation.specialNotes}
              onChange={(e) => setConsultation(prev => ({ ...prev, specialNotes: e.target.value }))}
              className="w-full p-2 border rounded h-20"
              placeholder="특이사항을 입력하세요..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">결과</label>
            <textarea
              value={consultation.result}
              onChange={(e) => setConsultation(prev => ({ ...prev, result: e.target.value }))}
              className="w-full p-2 border rounded h-20"
              placeholder="결과를 입력하세요..."
            />
          </div>
        </div>

        <button 
          onClick={saveConsultation}
          disabled={loading || !customer}
          className="mt-4 px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          상담일지 저장
        </button>
      </div>

      {/* 메시지 */}
      {message && (
        <div className={`p-4 rounded ${message.includes('성공') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2">처리 중...</p>
          </div>
        </div>
      )}
    </div>
  );
} 