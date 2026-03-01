// Setup script to create users table and seed role-based users
// Run: node src/setup-users.mjs

const SUPABASE_URL = 'https://buwhzyvtpvvssqliosdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo';

async function checkTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  return res.ok;
}

async function insertData(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error inserting into ${table}:`, res.status, text);
    return false;
  }
  console.log(`✅ Inserted ${data.length} rows into ${table}`);
  return true;
}

const users = [
  { username: 'admin', password: 'admin123', name: 'Admin', email: 'admin@school.edu.vn', role: 'admin', assigned_class: null, department: null },
  { username: 'gv_lan', password: 'gv123', name: 'Nguyễn Thị Lan', email: 'lan@school.edu.vn', role: 'giaovien', assigned_class: '10A1', department: null },
  { username: 'gv_minh', password: 'gv123', name: 'Trần Văn Minh', email: 'minh@school.edu.vn', role: 'giaovien', assigned_class: '10A2', department: null },
  { username: 'gv_hoa', password: 'gv123', name: 'Lê Thị Hoa', email: 'hoa@school.edu.vn', role: 'giaovien', assigned_class: '11A1', department: null },
  { username: 'tt_khtn', password: 'tt123', name: 'Phạm Văn Đức', email: 'duc@school.edu.vn', role: 'totruong', assigned_class: null, department: 'Khoa học tự nhiên' },
  { username: 'tt_khxh', password: 'tt123', name: 'Hoàng Thị Mai', email: 'mai@school.edu.vn', role: 'totruong', assigned_class: null, department: 'Khoa học xã hội' },
];

async function main() {
  const exists = await checkTable('users');
  console.log(`users table: ${exists ? '✅ exists' : '❌ not found'}`);

  if (!exists) {
    console.log('\n⚠️  Table "users" not found! Create it in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/buwhzyvtpvvssqliosdh/sql/new\n');
    console.log(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'giaovien', 'totruong')),
  assigned_class TEXT,
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to users" ON users FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('After creating, run this script again to seed users.');
    return;
  }

  console.log('\n📦 Seeding users...');
  await insertData('users', users);
  console.log('\n🎉 Users created! Accounts:');
  console.log('  Admin:     admin / admin123');
  console.log('  Giáo viên: gv_lan / gv123 (10A1)');
  console.log('  Giáo viên: gv_minh / gv123 (10A2)');
  console.log('  Giáo viên: gv_hoa / gv123 (11A1)');
  console.log('  Tổ trưởng: tt_khtn / tt123 (KHTN)');
  console.log('  Tổ trưởng: tt_khxh / tt123 (KHXH)');
}

main().catch(console.error);
