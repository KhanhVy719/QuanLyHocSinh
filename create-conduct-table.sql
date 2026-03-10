-- Bảng xếp hạnh kiểm
CREATE TABLE IF NOT EXISTS conduct_ratings (
  id SERIAL PRIMARY KEY,
  student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
  semester INT NOT NULL CHECK (semester IN (1, 2)),
  rating TEXT NOT NULL CHECK (rating IN ('Tốt', 'Khá', 'Trung bình', 'Yếu')),
  note TEXT DEFAULT '',
  rated_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, semester)
);

-- RLS
ALTER TABLE conduct_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON conduct_ratings FOR ALL USING (true) WITH CHECK (true);
