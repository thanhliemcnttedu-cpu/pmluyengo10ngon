-- ============================================================================
-- LƯU MẬT KHẨU GIÁO VIÊN PHỤ ĐỂ ADMIN XEM VÀ XUẤT EXCEL
-- Supabase chỉ lưu mật khẩu đã băm (không đọc lại được), nên phần mềm ghi thêm
-- bản đọc được vào bảng riêng này mỗi khi admin tạo/đặt lại mật khẩu
-- hoặc giáo viên tự đổi mật khẩu.
-- Bảng KHÔNG cho trình duyệt đọc/ghi trực tiếp: chỉ hàm máy chủ quan-ly-giao-vien
-- (chạy bằng khoá quản trị của Supabase) đọc và ghi, và hàm chỉ trả cho admin.
-- Chạy 1 lần trong Supabase → SQL Editor → New query → Run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teacher_secrets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shown_password text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text -- 'admin' hoặc 'teacher' (ai đặt mật khẩu gần nhất)
);

ALTER TABLE public.teacher_secrets ENABLE ROW LEVEL SECURITY;
-- Không tạo quy tắc (policy) nào: khách và người đăng nhập đều không đọc/ghi được.
REVOKE ALL ON public.teacher_secrets FROM anon, authenticated;
-- Chỉ khoá quản trị (dùng trong hàm máy chủ) được đọc/ghi. Dự án không tự cấp quyền cho bảng mới nên phải cấp rõ.
GRANT ALL ON public.teacher_secrets TO service_role;

-- Kiểm tra: bảng đã có (0 dòng là đúng, mật khẩu sẽ được ghi khi đặt lại)
SELECT count(*) AS so_mat_khau_da_luu FROM public.teacher_secrets;
