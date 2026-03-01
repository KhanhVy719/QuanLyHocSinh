// Test what anon key can access (simulating an attacker with the key)
import { createClient } from '@supabase/supabase-js';

const url = 'https://buwhzyvtpvvssqliosdh.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo';

const supabase = createClient(url, key);

const tables = ['users', 'students', 'classes', 'subjects', 'score_logs', 'public_links', 'semester_settings'];

console.log('=== RLS SECURITY CHECK ===');
console.log('Testing as ANONYMOUS user (no login)\n');

for (const table of tables) {
  try {
    const { data, error } = await supabase.from(table).select('*').limit(3);
    if (error) {
      console.log(`[OK] ${table}: BLOCKED (${error.message})`);
    } else if (!data || data.length === 0) {
      console.log(`[OK] ${table}: empty or blocked (0 rows)`);
    } else {
      console.log(`[!!] ${table}: READABLE! (${data.length} rows) Sample:`, JSON.stringify(data[0]).slice(0, 150));
    }
  } catch (e) {
    console.log(`[OK] ${table}: BLOCKED (${e.message})`);
  }
}

console.log('\n--- INSERT tests ---');
const { error: e1 } = await supabase.from('score_logs').insert({ student_id: 'FAKE', change: 999, note: 'HACK_TEST' });
console.log(e1 ? `[OK] score_logs INSERT: BLOCKED` : `[!!] score_logs INSERT: ALLOWED!`);

const { error: e2 } = await supabase.from('students').insert({ id: 'HACK', name: 'Hacker', class: 'X' });
console.log(e2 ? `[OK] students INSERT: BLOCKED` : `[!!] students INSERT: ALLOWED!`);

const { error: e3 } = await supabase.from('users').delete().eq('id', -999);
console.log(e3 ? `[OK] users DELETE: BLOCKED` : `[!!] users DELETE: ALLOWED!`);

console.log('\n=== DONE ===');
process.exit(0);
