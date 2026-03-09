-- =====================================================
-- Migrate default score from 10 to 0
-- For each student, insert a -10 change to offset
-- the old default of 10. Only for students who have
-- score_logs (i.e., have been scored before).
-- Run ONCE in Supabase SQL Editor.
-- =====================================================

-- For students WITH existing score_logs, add -10 offset
INSERT INTO score_logs (student_id, subject_code, change, reason, changed_by, created_at)
SELECT DISTINCT s.id, 'khac', -10, 'Hệ thống: đổi điểm mặc định từ 10 về 0', 'system',
  '2025-01-01T00:00:00Z'
FROM students s
WHERE EXISTS (
  SELECT 1 FROM score_logs sl WHERE sl.student_id = s.id
);

-- Verify: check a few students after running
-- SELECT student_id, SUM(change) as total FROM score_logs GROUP BY student_id LIMIT 10;
