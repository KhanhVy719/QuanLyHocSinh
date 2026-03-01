// Script to add group_name column to students table
// Run: node src/add-group-column.mjs

const SUPABASE_URL = 'https://buwhzyvtpvvssqliosdh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo';

console.log(`
╔════════════════════════════════════════════════════════════╗
║  Thêm cột group_name vào bảng students                   ║
╚════════════════════════════════════════════════════════════╝

Vui lòng chạy SQL sau trong Supabase SQL Editor:
https://supabase.com/dashboard/project/buwhzyvtpvvssqliosdh/sql/new

ALTER TABLE students ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT NULL;

Sau khi chạy SQL xong, ứng dụng sẽ hoạt động bình thường.
`);
