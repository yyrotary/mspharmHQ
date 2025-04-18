"use client";

import { useState, useEffect } from 'react';

export default function ConsultationDetailPage({ params }: { params: { id: string } }) {
  const [consultationData, setConsultationData] = useState<any>(null);
  const [isBandPosting, setIsBandPosting] = useState(false);
  const [bandPostResult, setBandPostResult] = useState<{ success: boolean; message: string } | null>(null);
  const [availableBands, setAvailableBands] = useState<any[]>([]);
  const [selectedBandKey, setSelectedBandKey] = useState<string>('');

  // 진료 정보 가져오기
  useEffect(() => {
    const fetchConsultationData = async () => {
      try {
        const response = await fetch(`/api/consultation/${params.id}`);
        const data = await response.json();
        
        if (data.success) {
          setConsultationData(data.consultation);
          console.log('가져온 진료 정보:', data.consultation);
        } else {
          console.error('진료 정보 가져오기 실패:', data.error);
        }
      } catch (error) {
        console.error('진료 정보 API 호출 오류:', error);
      }
    };

    if (params.id) {
      fetchConsultationData();
    }
  }, [params.id]);

  // 밴드 목록 가져오기
  useEffect(() => {
    const fetchBands = async () => {
      try {
        const response = await fetch('/api/bandapi/bands');
        const data = await response.json();
        
        if (data.success && Array.isArray(data.bands)) {
          console.log('가져온 밴드 목록:', data.bands);
          setAvailableBands(data.bands);
          if (data.bands.length > 0) {
            setSelectedBandKey(data.bands[0].band_key);
          }
        } else {
          console.error('밴드 목록 가져오기 실패:', data.error);
        }
      } catch (error) {
        console.error('밴드 API 호출 오류:', error);
      }
    };

    fetchBands();
  }, []);

  // 진료 정보 추출
  const extractConsultationData = () => {
    if (!consultationData || !consultationData.properties) {
      return null;
    }

    try {
      // 표준 속성 추출 함수
      const getPropertyValue = (propertyName: string, type: string) => {
        try {
          const property = consultationData.properties[propertyName];
          if (!property) return '';

          if (type === 'title' && property.title && property.title.length > 0) {
            return property.title[0].plain_text || property.title[0].text?.content || '';
          } else if (type === 'rich_text' && property.rich_text && property.rich_text.length > 0) {
            return property.rich_text[0].plain_text || property.rich_text[0].text?.content || '';
          } else if (type === 'date' && property.date) {
            return property.date.start || '';
          } else if (type === 'files' && property.files) {
            return property.files.map((file: any) => 
              file.type === 'external' ? file.external.url : 
              file.type === 'file' ? file.file.url : ''
            ).filter((url: string) => url);
          }
          return '';
        } catch (e) {
          console.warn(`${propertyName} 추출 실패:`, e);
          return '';
        }
      };

      // 진료 데이터 구성
      return {
        id: consultationData.id,
        consultationDate: getPropertyValue('상담일자', 'date'),
        consultationContent: getPropertyValue('호소증상', 'rich_text'),
        prescription: getPropertyValue('처방약', 'rich_text'),
        stateAnalysis: getPropertyValue('환자상태', 'rich_text'),
        tongueAnalysis: getPropertyValue('설진분석', 'rich_text'),
        result: getPropertyValue('결과', 'rich_text'),
        specialNote: getPropertyValue('특이사항', 'rich_text'),
        symptomImages: getPropertyValue('증상이미지', 'files'),
      };
    } catch (error) {
      console.error('진료 정보 추출 오류:', error);
      return null;
    }
  };

  // 밴드에 포스팅하는 함수
  const handleBandPosting = async () => {
    if (!consultationData || !selectedBandKey) return;
    
    setIsBandPosting(true);
    setBandPostResult(null);
    
    try {
      const extractedData = extractConsultationData();
      if (!extractedData) {
        throw new Error('진료 정보를 추출할 수 없습니다.');
      }

      // 고객 이름 추출
      const customerName = consultationData.properties['고객명']?.title?.[0]?.plain_text || 
                           consultationData.properties['고객명']?.title?.[0]?.text?.content || 
                           '고객';
      
      console.log('포스팅 데이터:', {
        bandKey: selectedBandKey,
        customerName,
        consultations: [extractedData]
      });
      
      const response = await fetch('/api/bandapi/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bandKey: selectedBandKey,
          customerName,
          consultations: [extractedData]
        }),
      });
      
      const result = await response.json();
      console.log('포스팅 결과:', result);
      
      if (result.success) {
        setBandPostResult({
          success: true,
          message: '밴드에 성공적으로 포스팅되었습니다.'
        });
      } else {
        setBandPostResult({
          success: false,
          message: `밴드 포스팅 실패: ${result.error || '알 수 없는 오류'}`
        });
      }
    } catch (error) {
      console.error('밴드 포스팅 오류:', error);
      setBandPostResult({
        success: false,
        message: '밴드 포스팅 중 오류가 발생했습니다.'
      });
    } finally {
      setIsBandPosting(false);
    }
  };

  return (
    <div className="consultation-detail p-4">
      {/* 밴드 포스팅 섹션 */}
      <div className="mt-6 p-4 bg-white rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-3">밴드에 진료 결과 공유하기</h3>
        
        {availableBands.length > 0 ? (
          <>
            <div className="mb-3">
              <label className="block text-sm font-medium mb-1">밴드 선택</label>
              <select 
                value={selectedBandKey} 
                onChange={(e) => setSelectedBandKey(e.target.value)}
                className="w-full p-2 border rounded"
              >
                {availableBands.map(band => (
                  <option key={band.band_key} value={band.band_key}>
                    {band.name} (멤버: {band.member_count}명)
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={handleBandPosting}
              disabled={isBandPosting || !selectedBandKey || !consultationData}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
            >
              {isBandPosting ? '포스팅 중...' : '밴드에 진료 결과 공유하기'}
            </button>
            
            {bandPostResult && (
              <div className={`mt-3 p-3 rounded ${bandPostResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {bandPostResult.message}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">연결된 밴드가 없습니다. 밴드 API 설정을 확인해주세요.</p>
        )}
      </div>
    </div>
  );
} 