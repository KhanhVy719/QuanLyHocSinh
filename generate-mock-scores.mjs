// Generate fake score_logs for class 10A4 in HK1 (Sep 2025 - Jan 2026)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://buwhzyvtpvvssqliosdh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1d2h6eXZ0cHZ2c3NxbGlvc2RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTI2MzIsImV4cCI6MjA4Nzc2ODYzMn0.cHdYK2IF4fKV5glnXjUhgPsnQlKNKaUncc3dX9t9WGo'
);

const reasons = {
  deduct: [
    'Nói chuyện trong giờ học',
    'Không làm bài tập',
    'Đi trễ',
    'Không mặc đồng phục',
    'Sử dụng điện thoại trong lớp',
    'Gây mất trật tự',
    'Không mang sách vở',
    'Ngủ trong giờ học',
    'Vắng không phép',
    'Không vệ sinh lớp',
  ],
  add: [
    'Tham gia tích cực phát biểu',
    'Đạt điểm cao bài kiểm tra',
    'Giúp đỡ bạn bè',
    'Tham gia hoạt động ngoại khóa',
    'Đóng góp quỹ lớp',
    'Trực nhật tốt',
    'Hoàn thành bài tập xuất sắc',
    'Đại diện lớp thi học sinh giỏi',
  ],
};

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  // Get students in 10A4
  const { data: students, error } = await supabase
    .from('students')
    .select('id, name')
    .eq('class', '10A4')
    .order('id');

  if (error) { console.error('Error fetching students:', error); return; }
  if (!students?.length) { console.error('No students in 10A4'); return; }

  console.log(`Found ${students.length} students in 10A4`);

  // HK1 range: Sep 5 2025 - Jan 12 2026
  const hk1Start = new Date(2025, 8, 5); // Sep 5
  const hk1End = new Date(2026, 0, 12);  // Jan 12

  const logs = [];

  for (const student of students) {
    // Each student gets 3-12 random score events
    const numEvents = 3 + Math.floor(Math.random() * 10);
    let runningScore = 0;

    for (let i = 0; i < numEvents; i++) {
      const isDeduct = Math.random() < 0.55; // 55% chance deduction
      const change = isDeduct
        ? -(Math.floor(Math.random() * 3) + 1) // -1 to -3
        : (Math.floor(Math.random() * 2) + 1); // +1 to +2
      
      runningScore += change;
      const date = randomDate(hk1Start, hk1End);

      logs.push({
        student_id: student.id,
        change,
        note: isDeduct ? pick(reasons.deduct) : pick(reasons.add),
        score_after: runningScore,
        created_at: date.toISOString(),
      });
    }
  }

  console.log(`Inserting ${logs.length} score logs...`);

  // Insert in batches of 50
  for (let i = 0; i < logs.length; i += 50) {
    const batch = logs.slice(i, i + 50);
    const { error: insertError } = await supabase.from('score_logs').insert(batch);
    if (insertError) {
      console.error(`Batch ${i / 50 + 1} error:`, insertError);
    } else {
      console.log(`Batch ${i / 50 + 1}: inserted ${batch.length} records`);
    }
  }

  console.log('Done! ✅');
}

main();
