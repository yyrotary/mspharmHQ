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

async function checkImageUrls() {
  try {
    console.log('Checking image URLs in purchase requests...\n');

    // 구매 요청의 이미지 URL 확인
    const { data: requests, error } = await supabase
      .from('purchase_requests')
      .select('id, image_urls, employee:employees!employee_id(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching purchase requests:', error);
      return;
    }

    console.log(`Found ${requests.length} purchase requests\n`);

    requests.forEach((request, index) => {
      console.log(`${index + 1}. Request by ${request.employee?.name}`);
      console.log(`   Request ID: ${request.id}`);
      console.log(`   Image URLs (${request.image_urls?.length || 0}):`);
      
      if (request.image_urls && request.image_urls.length > 0) {
        request.image_urls.forEach((url, urlIndex) => {
          console.log(`     ${urlIndex + 1}. ${url}`);
        });
      } else {
        console.log('     No images found');
      }
      console.log('');
    });

    // Storage 버킷 확인
    console.log('\n--- Checking Storage Buckets ---');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('Error listing buckets:', bucketError);
    } else {
      console.log(`Found ${buckets.length} buckets:`);
      buckets.forEach(bucket => {
        console.log(`  - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
      });
    }

    // employee-purchases 버킷의 파일 확인
    console.log('\n--- Checking employee-purchases bucket ---');
    const { data: files, error: filesError } = await supabase.storage
      .from('employee-purchases')
      .list('purchase-images', {
        limit: 10,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (filesError) {
      console.error('Error listing files:', filesError);
    } else {
      console.log(`Found ${files.length} files in purchase-images folder:`);
      files.forEach(file => {
        console.log(`  - ${file.name} (${file.metadata?.size || 'unknown size'})`);
      });
    }

  } catch (error) {
    console.error('Check failed:', error);
  }
}

checkImageUrls(); 