const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixStorageBucket() {
  try {
    console.log('Fixing storage bucket configuration...\n');

    // 1. 버킷을 public으로 업데이트
    console.log('1. Updating bucket to public...');
    const { data: updateData, error: updateError } = await supabase.storage
      .updateBucket('employee-purchases', { public: true });

    if (updateError) {
      console.error('Error updating bucket:', updateError);
      
      // 버킷이 없다면 새로 생성
      if (updateError.message.includes('not found')) {
        console.log('Bucket not found. Creating new bucket...');
        const { data: createData, error: createError } = await supabase.storage
          .createBucket('employee-purchases', { public: true });
        
        if (createError) {
          console.error('Error creating bucket:', createError);
          return;
        } else {
          console.log('✅ Bucket created successfully');
        }
      } else {
        return;
      }
    } else {
      console.log('✅ Bucket updated to public successfully');
    }

    // 2. 버킷 상태 확인
    console.log('\n2. Checking bucket status...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
    } else {
      const employeeBucket = buckets.find(b => b.name === 'employee-purchases');
      if (employeeBucket) {
        console.log(`✅ Bucket status: ${employeeBucket.public ? 'PUBLIC' : 'PRIVATE'}`);
      }
    }

    // 3. 테스트 이미지 URL 생성
    console.log('\n3. Testing image URL generation...');
    const testPath = 'purchase-images/1748397591394-z2npjvzc4zm.jpg';
    
    const { data: urlData } = supabase.storage
      .from('employee-purchases')
      .getPublicUrl(testPath);
    
    console.log(`Test URL: ${urlData.publicUrl}`);

    // 4. URL 접근 테스트
    console.log('\n4. Testing URL accessibility...');
    try {
      const response = await fetch(urlData.publicUrl, { method: 'HEAD' });
      console.log(`✅ URL accessible: ${response.status} ${response.statusText}`);
    } catch (fetchError) {
      console.error('❌ URL not accessible:', fetchError.message);
    }

    console.log('\n✅ Storage bucket configuration completed!');

  } catch (error) {
    console.error('Fix failed:', error);
  }
}

fixStorageBucket(); 