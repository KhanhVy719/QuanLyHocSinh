-- Create semester_settings table for semester date configuration
CREATE TABLE IF NOT EXISTS semester_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id VARCHAR(20) NOT NULL UNIQUE,
  semester2_start DATE NOT NULL DEFAULT '2025-01-13',
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE semester_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read semester settings
CREATE POLICY "Anyone can read semester settings" ON semester_settings FOR SELECT USING (true);
-- Allow authenticated users to insert/update
CREATE POLICY "Auth users can insert semester" ON semester_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth users can update semester" ON semester_settings FOR UPDATE TO authenticated USING (true);
