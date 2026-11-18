-- ============================================================================
-- BÀI GIAO THEO TỪNG GIÁO VIÊN (tách khỏi bài giao của quản trị)
-- Mỗi giáo viên phụ giao bài cho từng khối lớp (3, 4, 5) theo mã của mình.
-- Học sinh gõ mã cô giáo ở "Chọn bài" sẽ thấy mục "Bài cô … giao" riêng.
-- Ai cũng đọc được (học sinh không đăng nhập); chỉ chính giáo viên đó thêm/sửa/xoá bài giao của mình.
-- Chạy 1 lần: Supabase → SQL Editor → New query → dán → Run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  owner_code text NOT NULL,
  grade_level int NOT NULL CHECK (grade_level IN (3, 4, 5)),
  lesson_ids text[] NOT NULL DEFAULT '{}',
  teacher_name text,
  teacher_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, grade_level)
);
CREATE INDEX IF NOT EXISTS teacher_assignments_code_idx ON public.teacher_assignments (owner_code);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.teacher_assignments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_assignments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_assignments FROM anon;
GRANT ALL ON public.teacher_assignments TO service_role;

DROP POLICY IF EXISTS "Moi nguoi doc bai giao GV" ON public.teacher_assignments;
DROP POLICY IF EXISTS "GV them bai giao cua minh" ON public.teacher_assignments;
DROP POLICY IF EXISTS "GV sua bai giao cua minh" ON public.teacher_assignments;
DROP POLICY IF EXISTS "GV xoa bai giao cua minh" ON public.teacher_assignments;

CREATE POLICY "Moi nguoi doc bai giao GV" ON public.teacher_assignments
FOR SELECT USING (true);

-- Chỉ ghi được bài giao mang đúng mã của chính mình
CREATE POLICY "GV them bai giao cua minh" ON public.teacher_assignments
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND owner_code = (SELECT teacher_code FROM public.teacher_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "GV sua bai giao cua minh" ON public.teacher_assignments
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND owner_code = (SELECT teacher_code FROM public.teacher_profiles WHERE user_id = auth.uid())
);

CREATE POLICY "GV xoa bai giao cua minh" ON public.teacher_assignments
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- Kiểm tra: bảng đã có (0 dòng là đúng)
SELECT count(*) AS so_bai_giao_cua_giao_vien FROM public.teacher_assignments;
