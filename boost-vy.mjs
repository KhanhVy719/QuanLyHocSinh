import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://buwhzyvtpvvssqliosdh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo'
);

const logs = [
  { student_id: 'HS045', change: 3, note: 'Đạt giải nhất cuộc thi Toán cấp trường', score_after: 3, created_at: '2025-09-20T08:00:00Z' },
  { student_id: 'HS045', change: 2, note: 'Phát biểu xuất sắc trong tiết Văn', score_after: 5, created_at: '2025-10-05T09:00:00Z' },
  { student_id: 'HS045', change: 3, note: 'Đại diện trường thi Olympic Toán', score_after: 8, created_at: '2025-10-25T10:00:00Z' },
  { student_id: 'HS045', change: 2, note: 'Giúp đỡ bạn học yếu tiến bộ', score_after: 10, created_at: '2025-11-10T08:30:00Z' },
  { student_id: 'HS045', change: 3, note: 'Đạt điểm 10 bài kiểm tra giữa kỳ', score_after: 13, created_at: '2025-11-28T09:00:00Z' },
  { student_id: 'HS045', change: 2, note: 'Tham gia hoạt động tình nguyện', score_after: 15, created_at: '2025-12-15T14:00:00Z' },
  { student_id: 'HS045', change: 3, note: 'Đạt học sinh giỏi toàn diện', score_after: 18, created_at: '2026-01-05T08:00:00Z' },
];

const { error } = await s.from('score_logs').insert(logs);
console.log(error ? 'Error: ' + error.message : 'Done! Khanh Vy +18 points - TOP 1! ✅');
