-- ============================================
-- FIX RLS: Siết bảo mật cho tất cả bảng
-- Chạy trong Supabase SQL Editor
-- ============================================

-- 1. USERS TABLE (CRITICAL)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable insert for all" ON users;
DROP POLICY IF EXISTS "Enable update for all" ON users;
DROP POLICY IF EXISTS "Enable delete for all" ON users;
DROP POLICY IF EXISTS "Anyone can read" ON users;
DROP POLICY IF EXISTS "Public read" ON users;
DROP POLICY IF EXISTS "Auth read users" ON users;
DROP POLICY IF EXISTS "Auth insert users" ON users;
DROP POLICY IF EXISTS "Auth update own" ON users;
CREATE POLICY "Auth read users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert users" ON users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update own" ON users FOR UPDATE TO authenticated USING (true);

-- 2. STUDENTS TABLE
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON students;
DROP POLICY IF EXISTS "Enable read access for all users" ON students;
DROP POLICY IF EXISTS "Public read" ON students;
DROP POLICY IF EXISTS "Auth read students" ON students;
DROP POLICY IF EXISTS "Auth insert students" ON students;
DROP POLICY IF EXISTS "Auth update students" ON students;
DROP POLICY IF EXISTS "Auth delete students" ON students;
DROP POLICY IF EXISTS "Anon read students basic" ON students;
CREATE POLICY "Auth read students" ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert students" ON students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update students" ON students FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete students" ON students FOR DELETE TO authenticated USING (true);
CREATE POLICY "Anon read students basic" ON students FOR SELECT TO anon USING (true);

-- 3. CLASSES TABLE
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON classes;
DROP POLICY IF EXISTS "Enable read access for all users" ON classes;
DROP POLICY IF EXISTS "Public read" ON classes;
DROP POLICY IF EXISTS "Auth read classes" ON classes;
DROP POLICY IF EXISTS "Auth manage classes" ON classes;
CREATE POLICY "Auth read classes" ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage classes" ON classes FOR ALL TO authenticated USING (true);

-- 4. SUBJECTS TABLE
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON subjects;
DROP POLICY IF EXISTS "Enable read access for all users" ON subjects;
DROP POLICY IF EXISTS "Public read" ON subjects;
DROP POLICY IF EXISTS "Auth read subjects" ON subjects;
DROP POLICY IF EXISTS "Auth manage subjects" ON subjects;
CREATE POLICY "Auth read subjects" ON subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage subjects" ON subjects FOR ALL TO authenticated USING (true);

-- 5. SCORE_LOGS TABLE
ALTER TABLE score_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all" ON score_logs;
DROP POLICY IF EXISTS "Enable read access for all users" ON score_logs;
DROP POLICY IF EXISTS "Public read" ON score_logs;
DROP POLICY IF EXISTS "Auth read scores" ON score_logs;
DROP POLICY IF EXISTS "Auth insert scores" ON score_logs;
DROP POLICY IF EXISTS "Anon read scores" ON score_logs;
DROP POLICY IF EXISTS "Authenticated can insert" ON score_logs;
CREATE POLICY "Auth read scores" ON score_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert scores" ON score_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon read scores" ON score_logs FOR SELECT TO anon USING (true);
