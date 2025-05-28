const bcrypt = require('bcryptjs');
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

async function setupEmployees() {
  try {
    console.log('Setting up employees...');

    // 기존 직원 데이터 삭제
    const { error: deleteError } = await supabase
      .from('employees')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 레코드 삭제

    if (deleteError) {
      console.log('No existing employees to delete or error:', deleteError.message);
    }

    // 비밀번호 해싱
    const saltRounds = 12;
    const adminHash = await bcrypt.hash('admin123', saltRounds);
    const managerHash = await bcrypt.hash('manager123', saltRounds);
    const staffHash = await bcrypt.hash('staff123', saltRounds);

    // 직원 데이터 삽입
    const employees = [
      {
        name: 'admin123',
        password_hash: adminHash,
        role: 'owner',
        is_active: true
      },
      {
        name: 'manager123',
        password_hash: managerHash,
        role: 'manager',
        is_active: true
      },
      {
        name: 'staff123',
        password_hash: staffHash,
        role: 'staff',
        is_active: true
      },
      {
        name: 'staff456',
        password_hash: staffHash,
        role: 'staff',
        is_active: true
      }
    ];

    const { data, error } = await supabase
      .from('employees')
      .insert(employees)
      .select();

    if (error) {
      console.error('Error inserting employees:', error);
      return;
    }

    console.log('Employees created successfully:');
    data.forEach(emp => {
      console.log(`- ${emp.name} (${emp.role})`);
    });

    console.log('\nTest accounts:');
    console.log('- 약국장: admin123 / admin123');
    console.log('- 김관리자: manager123 / manager123');
    console.log('- 이직원: staff123 / staff123');
    console.log('- 박직원: staff456 / staff123');

  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupEmployees(); 