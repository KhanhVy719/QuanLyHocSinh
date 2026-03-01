-- STEP 1: Xem tất cả policy hiện tại trên bảng users
SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'users';
