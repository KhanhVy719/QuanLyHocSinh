-- Tạo bảng courses (khóa học)
CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT ''
);

-- Tạo bảng junction: khóa ↔ môn (many-to-many)
CREATE TABLE IF NOT EXISTS course_subjects (
  course_code TEXT REFERENCES courses(code) ON DELETE CASCADE,
  subject_code TEXT REFERENCES subjects(code) ON DELETE CASCADE,
  PRIMARY KEY (course_code, subject_code)
);

-- RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_subjects ENABLE ROW LEVEL SECURITY;

-- Policies (anon vì app dùng custom login)
CREATE POLICY "Anon manage courses" ON courses FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage courses" ON courses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Anon manage course_subjects" ON course_subjects FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Auth manage course_subjects" ON course_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);
