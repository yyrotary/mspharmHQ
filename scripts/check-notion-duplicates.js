const { readFileSync } = require('fs');
const { join } = require('path');

async function checkNotionDuplicates() {
  console.log('🔍 Notion 중복 고객 데이터 분석...');
  console.log('=' .repeat(80));

  try {
    // 1. Notion 고객 데이터 로드
    console.log('📥 Notion 고객 데이터 로드 중...');
    const notionCustomersPath = join(process.cwd(), 'migration_data', 'notion_customers.json');
    const notionCustomers = JSON.parse(readFileSync(notionCustomersPath, 'utf-8'));
    console.log(`📊 Notion 고객 수: ${notionCustomers.length}개`);

    // 2. 중복 찾기
    const customerCodeCounts = {};
    const duplicateGroups = {};

    notionCustomers.forEach(customer => {
      const code = customer.customer_code;
      customerCodeCounts[code] = (customerCodeCounts[code] || 0) + 1;
      
      if (!duplicateGroups[code]) {
        duplicateGroups[code] = [];
      }
      duplicateGroups[code].push(customer);
    });

    // 3. 중복된 고객 상세 분석
    console.log('\n🔍 중복된 고객 상세 분석:');
    console.log('-' .repeat(80));

    for (const [code, count] of Object.entries(customerCodeCounts)) {
      if (count > 1) {
        console.log(`\n📋 고객 코드: ${code} (${count}개 중복)`);
        console.log('-' .repeat(40));
        
        const customers = duplicateGroups[code];
        customers.forEach((customer, index) => {
          console.log(`\n${index + 1}번째 레코드:`);
          console.log(`  ID: ${customer.id}`);
          console.log(`  이름: ${customer.name}`);
          console.log(`  전화: ${customer.phone || 'N/A'}`);
          console.log(`  성별: ${customer.gender || 'N/A'}`);
          console.log(`  주소: ${customer.address || 'N/A'}`);
          console.log(`  생년월일: ${customer.birth_date || 'N/A'}`);
          console.log(`  나이: ${customer.estimated_age || 'N/A'}`);
          console.log(`  특이사항: ${customer.special_notes || 'N/A'}`);
          console.log(`  생성일: ${customer.created_at}`);
          console.log(`  수정일: ${customer.updated_at}`);
        });

        // 차이점 분석
        console.log(`\n🔍 ${code} 차이점 분석:`);
        const first = customers[0];
        const others = customers.slice(1);
        
        others.forEach((other, index) => {
          console.log(`\n${index + 2}번째와 1번째 차이점:`);
          const differences = [];
          
          if (first.name !== other.name) differences.push(`이름: "${first.name}" vs "${other.name}"`);
          if (first.phone !== other.phone) differences.push(`전화: "${first.phone || 'N/A'}" vs "${other.phone || 'N/A'}"`);
          if (first.gender !== other.gender) differences.push(`성별: "${first.gender || 'N/A'}" vs "${other.gender || 'N/A'}"`);
          if (first.address !== other.address) differences.push(`주소: "${first.address || 'N/A'}" vs "${other.address || 'N/A'}"`);
          if (first.birth_date !== other.birth_date) differences.push(`생년월일: "${first.birth_date || 'N/A'}" vs "${other.birth_date || 'N/A'}"`);
          if (first.estimated_age !== other.estimated_age) differences.push(`나이: "${first.estimated_age || 'N/A'}" vs "${other.estimated_age || 'N/A'}"`);
          if (first.special_notes !== other.special_notes) differences.push(`특이사항: "${first.special_notes || 'N/A'}" vs "${other.special_notes || 'N/A'}"`);
          
          if (differences.length === 0) {
            console.log(`  완전히 동일한 데이터`);
          } else {
            differences.forEach(diff => console.log(`  - ${diff}`));
          }
        });
      }
    }

    // 4. 요약
    console.log('\n📊 중복 요약:');
    console.log('=' .repeat(80));
    const duplicateCodes = Object.keys(customerCodeCounts).filter(code => customerCodeCounts[code] > 1);
    console.log(`중복된 고객 코드: ${duplicateCodes.length}개`);
    console.log(`중복 코드: ${duplicateCodes.join(', ')}`);
    
    let totalDuplicates = 0;
    duplicateCodes.forEach(code => {
      const count = customerCodeCounts[code];
      totalDuplicates += count - 1; // 첫 번째는 원본, 나머지는 중복
      console.log(`  ${code}: ${count}개 (${count - 1}개 중복)`);
    });
    
    console.log(`총 중복 레코드 수: ${totalDuplicates}개`);
    console.log(`실제 고유 고객 수: ${notionCustomers.length - totalDuplicates}개`);

    // 5. 권장사항
    console.log('\n🔧 권장사항:');
    console.log('-' .repeat(80));
    console.log('1. 중복된 레코드 중 가장 최신 데이터를 유지');
    console.log('2. 나머지 중복 레코드는 제거');
    console.log('3. 데이터 정합성 확인 후 Supabase와 재동기화');

  } catch (error) {
    console.error('💥 중복 분석 실패:', error);
  }
}

// 실행
if (require.main === module) {
  checkNotionDuplicates()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
} 