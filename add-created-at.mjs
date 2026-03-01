// Script to add created_at column to students table
// Run: node add-created-at.mjs

const SUPABASE_URL = 'https://buwhzyvtpvvssqliosdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo';

async function main() {
  // Check if column already exists by trying to select it
  console.log('🔍 Checking if created_at column exists...');
  
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=created_at&limit=1`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (checkRes.ok) {
    const data = await checkRes.json();
    if (data.length > 0 && data[0].created_at !== undefined) {
      console.log('✅ Column created_at already exists!');
      // Check how many have null
      const nullRes = await fetch(`${SUPABASE_URL}/rest/v1/students?select=id&created_at=is.null`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      const nullData = await nullRes.json();
      console.log(`   ${nullData.length} students have NULL created_at`);
      if (nullData.length > 0) {
        console.log('📝 Setting created_at for existing students to 2025-09-01 (start of academic year)...');
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/students?created_at=is.null`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ created_at: '2025-09-01T00:00:00.000Z' }),
        });
        if (updateRes.ok) {
          console.log(`✅ Updated ${nullData.length} students with created_at = 2025-09-01`);
        } else {
          console.error('❌ Failed to update:', await updateRes.text());
        }
      }
      return;
    }
  }

  console.log('❌ Column created_at does NOT exist.');
  console.log('');
  console.log('📋 Please go to Supabase SQL Editor and run this SQL:');
  console.log('   https://supabase.com/dashboard/project/buwhzyvtpvvssqliosdh/sql/new');
  console.log('');
  console.log(`
ALTER TABLE students ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();

-- Set existing students to start of academic year
UPDATE students SET created_at = '2025-09-01T00:00:00Z' WHERE created_at IS NULL;
  `);
  console.log('');
  console.log('After running the SQL, run this script again to verify.');
}

main().catch(console.error);
