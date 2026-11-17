-- ============================================================================
-- TÀI KHOẢN GIÁO VIÊN PHỤ + PHÂN QUYỀN TRÊN MÁY CHỦ (Bé Luyện Gõ 10 Ngón)
--
-- Chạy MỘT lần trong Supabase → SQL Editor, SAU KHI đã tạo tài khoản admin (Gmail tác giả)
-- ở Authentication → Users. Nhớ thay GMAIL_TAC_GIA@gmail.com ở mục 7 bằng Gmail thật.
--
-- Kết quả:
--  - admin: thêm/sửa/xoá MỌI bài, giao bài cho lớp, tạo/xoá/đổi mật khẩu giáo viên phụ.
--  - giáo viên phụ: thêm bài; sửa/xoá CHỈ bài do mình tạo; KHÔNG giao bài; đổi được mật khẩu của mình.
--  - học sinh (chưa đăng nhập): chỉ ĐỌC bài và bài giao.
-- Chạy lại nhiều lần vẫn an toàn.
-- ============================================================================

-- 1. HỒ SƠ GIÁO VIÊN (mỗi tài khoản đăng nhập có 1 hồ sơ, mã số riêng)
CREATE SEQUENCE IF NOT EXISTS public.teacher_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.teacher_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    teacher_code TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.teacher_profiles TO authenticated;
GRANT ALL ON public.teacher_profiles TO service_role;
REVOKE ALL ON public.teacher_profiles FROM anon;

-- 2. HÀM KIỂM TRA ADMIN (dùng trong các quy tắc quyền)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Mỗi người đăng nhập chỉ đọc hồ sơ của mình; admin đọc tất cả. Ghi hồ sơ chỉ qua hàm máy chủ (service_role).
DROP POLICY IF EXISTS "Doc ho so cua minh" ON public.teacher_profiles;
CREATE POLICY "Doc ho so cua minh" ON public.teacher_profiles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

-- Mã giáo viên tiếp theo: GV001, GV002, ...
CREATE OR REPLACE FUNCTION public.next_teacher_code()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'GV' || lpad(nextval('public.teacher_code_seq')::text, 3, '0');
$$;
REVOKE ALL ON FUNCTION public.next_teacher_code() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_teacher_code() TO service_role;

-- 3. GẮN NGƯỜI TẠO VÀO TỪNG BÀI
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users (id) ON DELETE SET NULL;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS owner_code TEXT;
CREATE INDEX IF NOT EXISTS lessons_owner_id_idx ON public.lessons (owner_id);

-- Thêm bài: tự ghi người tạo = người đang đăng nhập (không tin dữ liệu gửi lên).
-- Sửa bài: KHÔNG ai đổi được người tạo (giữ nguyên như lúc tạo).
CREATE OR REPLACE FUNCTION public.lessons_set_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.owner_id := auth.uid();
      NEW.owner_code := (SELECT teacher_code FROM public.teacher_profiles WHERE user_id = auth.uid());
    ELSE
      -- Ghi bằng service_role (máy chủ) hoặc dữ liệu cũ: giữ giá trị gửi lên
      NULL;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.owner_id := OLD.owner_id;
    NEW.owner_code := OLD.owner_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lessons_set_owner_trg ON public.lessons;
CREATE TRIGGER lessons_set_owner_trg
BEFORE INSERT OR UPDATE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.lessons_set_owner();

-- 4. QUYỀN TRÊN BẢNG BÀI HỌC
GRANT SELECT ON public.lessons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lessons FROM anon;

DROP POLICY IF EXISTS "Allow public write lessons" ON public.lessons;
DROP POLICY IF EXISTS "Allow public read lessons" ON public.lessons;
DROP POLICY IF EXISTS "Moi nguoi doc bai" ON public.lessons;
DROP POLICY IF EXISTS "Giao vien them bai" ON public.lessons;
DROP POLICY IF EXISTS "Sua bai cua minh hoac admin" ON public.lessons;
DROP POLICY IF EXISTS "Xoa bai cua minh hoac admin" ON public.lessons;

CREATE POLICY "Moi nguoi doc bai" ON public.lessons
FOR SELECT USING (true);

-- Chỉ người có hồ sơ giáo viên/admin mới thêm bài
CREATE POLICY "Giao vien them bai" ON public.lessons
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.teacher_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Sua bai cua minh hoac admin" ON public.lessons
FOR UPDATE TO authenticated
USING (public.is_admin() OR owner_id = auth.uid())
WITH CHECK (public.is_admin() OR owner_id = auth.uid());

CREATE POLICY "Xoa bai cua minh hoac admin" ON public.lessons
FOR DELETE TO authenticated
USING (public.is_admin() OR owner_id = auth.uid());

-- 5. GIAO BÀI CHO LỚP: CHỈ ADMIN
GRANT SELECT ON public.grade_assignments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.grade_assignments TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.grade_assignments FROM anon;

DROP POLICY IF EXISTS "Allow public write assignments" ON public.grade_assignments;
DROP POLICY IF EXISTS "Allow public read assignments" ON public.grade_assignments;
DROP POLICY IF EXISTS "Moi nguoi doc bai giao" ON public.grade_assignments;
DROP POLICY IF EXISTS "Chi admin giao bai" ON public.grade_assignments;

CREATE POLICY "Moi nguoi doc bai giao" ON public.grade_assignments
FOR SELECT USING (true);

CREATE POLICY "Chi admin giao bai" ON public.grade_assignments
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. ẢNH SÁCH GIÁO KHOA: ai cũng xem; chỉ giáo viên/admin đã đăng nhập mới tải lên/sửa/xoá
DROP POLICY IF EXISTS "Public Insert Textbook Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Update Textbook Images" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Textbook Images" ON storage.objects;
DROP POLICY IF EXISTS "Giao vien tai anh SGK" ON storage.objects;
DROP POLICY IF EXISTS "Giao vien sua anh SGK" ON storage.objects;
DROP POLICY IF EXISTS "Admin xoa anh SGK" ON storage.objects;

CREATE POLICY "Giao vien tai anh SGK" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'textbook-images');

CREATE POLICY "Giao vien sua anh SGK" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'textbook-images' AND (owner = auth.uid() OR public.is_admin()));

CREATE POLICY "Admin xoa anh SGK" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'textbook-images' AND (owner = auth.uid() OR public.is_admin()));

-- 7. GẮN HỒ SƠ ADMIN CHO TÀI KHOẢN GMAIL TÁC GIẢ  ← THAY GMAIL Ở DÒNG DƯỚI
INSERT INTO public.teacher_profiles (user_id, teacher_code, username, display_name, role)
SELECT id, 'ADMIN', 'admin', 'Quản trị (Tác giả)', 'admin'
FROM auth.users
WHERE lower(email) = lower('GMAIL_TAC_GIA@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', username = 'admin', teacher_code = 'ADMIN';

-- Kiểm tra: phải thấy 1 dòng role = admin
SELECT teacher_code, username, display_name, role FROM public.teacher_profiles ORDER BY teacher_code;
