-- Create public_links table for shareable score pages
CREATE TABLE IF NOT EXISTS public_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  class_id VARCHAR(20) NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Enable RLS
ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to create links
CREATE POLICY "Users can create public links" ON public_links FOR INSERT TO authenticated WITH CHECK (true);
-- Allow anyone to read active links (for public page)
CREATE POLICY "Anyone can read active links" ON public_links FOR SELECT USING (is_active = true);
-- Allow creator to manage their links
CREATE POLICY "Creator can update links" ON public_links FOR UPDATE TO authenticated USING (true);
