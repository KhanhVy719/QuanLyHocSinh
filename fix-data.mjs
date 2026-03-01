import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://buwhzyvtpvvssqliosdh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo'
);

const students = [
  { id: 'HS001', name: 'Trịnh Quang Huy',    gender: 'Nam', class: '10A1', dob: '2009-03-15' },
  { id: 'HS002', name: 'Đặng Ngọc Trâm',     gender: 'Nữ',  class: '10A1', dob: '2009-07-22' },
  { id: 'HS003', name: 'Bùi Thanh Sơn',       gender: 'Nam', class: '10A2', dob: '2009-01-10' },
  { id: 'HS004', name: 'Mai Khánh Linh',      gender: 'Nữ',  class: '10A2', dob: '2009-11-05' },
  { id: 'HS005', name: 'Lý Hoàng Phúc',       gender: 'Nam', class: '11A1', dob: '2008-06-18' },
  { id: 'HS006', name: 'Tô Bảo Ngọc',         gender: 'Nữ',  class: '11A1', dob: '2008-09-28' },
  { id: 'HS007', name: 'Dương Minh Khôi',     gender: 'Nam', class: '10A1', dob: '2009-04-12' },
  { id: 'HS008', name: 'Hà Phương Thảo',      gender: 'Nữ',  class: '10A2', dob: '2009-08-30' },
];

async function main() {
  for (const s of students) {
    const { error } = await supabase.from('students')
      .update({ name: s.name, gender: s.gender, class: s.class, dob: s.dob })
      .eq('id', s.id);
    console.log(error ? `ERR ${s.id}: ${error.message}` : `OK ${s.id} → ${s.name} (${s.class})`);
  }

  // Verify
  const { data } = await supabase.from('students').select('id,name,class').order('id');
  console.log('\nFinal students:');
  data.forEach(s => console.log(`  ${s.id} ${s.name} (${s.class})`));
  
  process.exit(0);
}

main();
