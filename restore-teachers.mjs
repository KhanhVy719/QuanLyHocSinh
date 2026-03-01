import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://buwhzyvtpvvssqliosdh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo'
);

const teachers = [
  { name: 'Lê Thị Hoa', username: 'gv_hoa', email: 'hoa@school.edu.vn', password: 'gv123', role: 'giaovien', assigned_class: '10A1' },
  { name: 'Nguyễn Thị Lan', username: 'gv_lan', email: 'lan@school.edu.vn', password: 'gv123', role: 'giaovien', assigned_class: '10A2' },
  { name: 'Trần Văn Minh', username: 'gv_minh', email: 'minh@school.edu.vn', password: 'gv123', role: 'giaovien', assigned_class: '11A1' },
];

async function main() {
  // Check existing
  const { data: existing } = await supabase.from('users').select('username').eq('role', 'giaovien');
  console.log('Existing teachers:', existing?.map(t => t.username));

  for (const t of teachers) {
    if (existing?.find(e => e.username === t.username)) {
      console.log(`Skip ${t.username} (already exists)`);
      continue;
    }
    const { data, error } = await supabase.from('users').insert(t).select().single();
    if (error) console.error(`Error creating ${t.username}:`, error.message);
    else console.log(`Created: ${data.name} (${data.username})`);
  }
  console.log('Done!');
}

main();
