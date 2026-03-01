// Setup script to create tables and seed data in Supabase
// Run: node src/setup-db.mjs

const SUPABASE_URL = 'https://buwhzyvtpvvssqliosdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo';

async function rpc(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  return res;
}

async function insertData(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
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

async function checkTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.ok;
}

// ---- SEED DATA ----

const students = [
  { id: 'HS001', name: 'Nguyễn Văn An', dob: '2008-05-15', gender: 'Nam', class: '10A1', phone: '0912345678', status: 'Đang học' },
  { id: 'HS002', name: 'Trần Thị Bình', dob: '2008-08-22', gender: 'Nữ', class: '10A1', phone: '0912345679', status: 'Đang học' },
  { id: 'HS003', name: 'Lê Văn Cường', dob: '2008-03-10', gender: 'Nam', class: '10A2', phone: '0912345680', status: 'Đang học' },
  { id: 'HS004', name: 'Phạm Thị Diệu', dob: '2008-11-30', gender: 'Nữ', class: '10A2', phone: '0912345681', status: 'Đang học' },
  { id: 'HS005', name: 'Hoàng Văn Em', dob: '2008-07-18', gender: 'Nam', class: '11A1', phone: '0912345682', status: 'Đang học' },
  { id: 'HS006', name: 'Ngô Thị Phương', dob: '2008-01-25', gender: 'Nữ', class: '11A1', phone: '0912345683', status: 'Đang học' },
  { id: 'HS007', name: 'Đỗ Văn Giang', dob: '2008-09-05', gender: 'Nam', class: '11A2', phone: '0912345684', status: 'Đang học' },
  { id: 'HS008', name: 'Vũ Thị Hương', dob: '2008-12-14', gender: 'Nữ', class: '11A2', phone: '0912345685', status: 'Đang học' },
];

const classes = [
  { code: 'L001', name: 'Lớp 10A1', max_students: 40, teacher: 'Nguyễn Thị Lan', room: 'A101', schedule: 'Thứ 2-6, 7h00-11h30' },
  { code: 'L002', name: 'Lớp 10A2', max_students: 40, teacher: 'Trần Văn Minh', room: 'A102', schedule: 'Thứ 2-6, 7h00-11h30' },
  { code: 'L003', name: 'Lớp 11A1', max_students: 40, teacher: 'Lê Thị Hoa', room: 'B101', schedule: 'Thứ 2-6, 7h00-11h30' },
  { code: 'L004', name: 'Lớp 11A2', max_students: 40, teacher: 'Phạm Văn Đức', room: 'B102', schedule: 'Thứ 2-6, 7h00-11h30' },
  { code: 'L005', name: 'Lớp 12A1', max_students: 40, teacher: 'Hoàng Thị Mai', room: 'C101', schedule: 'Thứ 2-6, 7h00-11h30' },
  { code: 'L006', name: 'Lớp 12A2', max_students: 40, teacher: 'Ngô Văn Tùng', room: 'C102', schedule: 'Thứ 2-6, 7h00-11h30' },
];

const subjects = [
  { code: 'TOAN10', name: 'Toán học', credits: 4, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: 'Môn toán học cơ bản' },
  { code: 'VAN10', name: 'Ngữ văn', credits: 4, type: 'Bắt buộc', department: 'Khoa học xã hội', description: 'Môn ngữ văn Việt Nam' },
  { code: 'ANH10', name: 'Tiếng Anh', credits: 3, type: 'Bắt buộc', department: 'Ngoại ngữ', description: 'Tiếng Anh cơ bản' },
  { code: 'LY10', name: 'Vật lý', credits: 3, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: 'Vật lý đại cương' },
  { code: 'HOA10', name: 'Hóa học', credits: 3, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: 'Hóa học cơ bản' },
  { code: 'SINH10', name: 'Sinh học', credits: 2, type: 'Bắt buộc', department: 'Khoa học tự nhiên', description: 'Sinh học cơ bản' },
  { code: 'SU10', name: 'Lịch sử', credits: 2, type: 'Bắt buộc', department: 'Khoa học xã hội', description: 'Lịch sử Việt Nam và thế giới' },
  { code: 'DIA10', name: 'Địa lý', credits: 2, type: 'Bắt buộc', department: 'Khoa học xã hội', description: 'Địa lý tự nhiên và kinh tế' },
  { code: 'GDCD10', name: 'GDCD', credits: 1, type: 'Bắt buộc', department: 'Khoa học xã hội', description: 'Giáo dục công dân' },
  { code: 'TIN10', name: 'Tin học', credits: 2, type: 'Tự chọn', department: 'Công nghệ', description: 'Tin học ứng dụng' },
];

const grades = [
  { student_id: 'HS001', student_name: 'Nguyễn Văn An', class: '10A1', subject: 'Toán', semester: 'HK1', midterm: 8.5, final_score: 9.0, average: 8.8, rank: 'Giỏi' },
  { student_id: 'HS001', student_name: 'Nguyễn Văn An', class: '10A1', subject: 'Văn', semester: 'HK1', midterm: 7.5, final_score: 8.0, average: 7.8, rank: 'Khá' },
  { student_id: 'HS002', student_name: 'Trần Thị Bình', class: '10A1', subject: 'Toán', semester: 'HK1', midterm: 9.0, final_score: 9.5, average: 9.3, rank: 'Xuất sắc' },
  { student_id: 'HS002', student_name: 'Trần Thị Bình', class: '10A1', subject: 'Văn', semester: 'HK1', midterm: 8.0, final_score: 8.5, average: 8.3, rank: 'Giỏi' },
  { student_id: 'HS003', student_name: 'Lê Văn Cường', class: '10A2', subject: 'Toán', semester: 'HK1', midterm: 6.5, final_score: 7.0, average: 6.8, rank: 'Khá' },
  { student_id: 'HS003', student_name: 'Lê Văn Cường', class: '10A2', subject: 'Anh', semester: 'HK1', midterm: 5.5, final_score: 6.0, average: 5.8, rank: 'Trung bình' },
  { student_id: 'HS004', student_name: 'Phạm Thị Diệu', class: '10A2', subject: 'Toán', semester: 'HK1', midterm: 7.0, final_score: 7.5, average: 7.3, rank: 'Khá' },
  { student_id: 'HS005', student_name: 'Hoàng Văn Em', class: '11A1', subject: 'Toán', semester: 'HK1', midterm: 9.5, final_score: 9.0, average: 9.2, rank: 'Xuất sắc' },
];

async function main() {
  console.log('🔍 Checking if tables exist...');
  
  const studentsExists = await checkTable('students');
  const classesExists = await checkTable('classes');
  const subjectsExists = await checkTable('subjects');
  const gradesExists = await checkTable('grades');

  console.log(`  students: ${studentsExists ? '✅ exists' : '❌ not found'}`);
  console.log(`  classes: ${classesExists ? '✅ exists' : '❌ not found'}`);
  console.log(`  subjects: ${subjectsExists ? '✅ exists' : '❌ not found'}`);
  console.log(`  grades: ${gradesExists ? '✅ exists' : '❌ not found'}`);

  if (!studentsExists || !classesExists || !subjectsExists || !gradesExists) {
    console.log('\n⚠️  Some tables are missing! Please create them in Supabase SQL Editor:');
    console.log('Go to: https://supabase.com/dashboard/project/buwhzyvtpvvssqliosdh/sql/new');
    console.log('\nRun this SQL:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  dob DATE NOT NULL,
  gender TEXT NOT NULL,
  class TEXT NOT NULL,
  phone TEXT,
  status TEXT DEFAULT 'Đang học'
);

CREATE TABLE IF NOT EXISTS classes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_students INTEGER DEFAULT 40,
  teacher TEXT NOT NULL,
  room TEXT NOT NULL,
  schedule TEXT DEFAULT 'Thứ 2-6, 7h00-11h30'
);

CREATE TABLE IF NOT EXISTS subjects (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  type TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  class TEXT NOT NULL,
  subject TEXT NOT NULL,
  semester TEXT NOT NULL,
  midterm NUMERIC(4,2),
  final_score NUMERIC(4,2),
  average NUMERIC(4,2),
  rank TEXT
);

-- Enable Row Level Security but allow all access for now
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to classes" ON classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to grades" ON grades FOR ALL USING (true) WITH CHECK (true);
    `);
    console.log('\nAfter creating the tables, run this script again to seed data.');
    return;
  }

  console.log('\n📦 Seeding data...');
  await insertData('students', students);
  await insertData('classes', classes);
  await insertData('subjects', subjects);
  await insertData('grades', grades);
  console.log('\n🎉 Done! Database is ready.');
}

main().catch(console.error);
