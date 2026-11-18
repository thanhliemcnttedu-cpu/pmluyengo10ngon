// ============================================================================
// ĐĂNG NHẬP QUẢN TRỊ GIÁO VIÊN + KHÔI PHỤC MẬT KHẨU BẰNG MÃ OTP QUA GMAIL
//
// - Chỉ có MỘT tài khoản: tên đăng nhập "admin".
// - Mật khẩu thật nằm ở Supabase Auth (tài khoản gắn với Gmail tác giả: VITE_ADMIN_EMAIL),
//   nên đổi được bằng mã OTP gửi về Gmail khi quên.
// - Mất mạng / chưa cấu hình Supabase: so với mật khẩu đã đăng nhập đúng gần nhất trên máy này
//   (lưu dạng băm SHA-256), máy chưa từng đăng nhập thì dùng mật khẩu mặc định ban đầu.
// ============================================================================
import { supabase } from './supabase';

export const ADMIN_USERNAME = 'admin';
/** Mật khẩu ban đầu: chỉ dùng khi máy chưa từng đăng nhập trực tuyến và đang mất mạng */
const DEFAULT_ADMIN_PASSWORD = 'Tanuyen@2026';
/** Gmail tác giả (tài khoản Supabase Auth). Đặt trong .env / Vercel: VITE_ADMIN_EMAIL=... */
export const ADMIN_EMAIL: string = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
/** Số điện thoại tác giả (đã công khai ở trang Thông tin tác giả) dùng để xác minh khi khôi phục */
export const AUTHOR_PHONES = ['0888358363', '0977058363'];

const LOCAL_HASH_KEY = 'typing_kids_admin_pw_hash_v1';
const HASH_SALT = 'be-luyen-go-10-ngon::admin::';
const NETWORK_TIMEOUT_MS = 9000;

export const MIN_PASSWORD_LENGTH = 8;

/** Đuôi email của tài khoản giáo viên phụ (khớp với hàm máy chủ quan-ly-giao-vien) */
export const TEACHER_EMAIL_DOMAIN = 'gv.beluyengo10ngon.local';
export const TEACHER_SESSION_KEY = 'typing_kids_teacher_session_v1';
const TEACHER_ADMIN_FN = 'quan-ly-giao-vien';

export type TeacherRole = 'admin' | 'teacher';
/** Người đang đăng nhập Cổng Giáo Viên */
export interface TeacherSession {
  role: TeacherRole;
  /** id tài khoản Supabase (không có khi admin đăng nhập lúc mất mạng) */
  userId?: string;
  /** Mã giáo viên: ADMIN, GV001, GV002... */
  code: string;
  username: string;
  displayName: string;
  mode: 'online' | 'offline';
}

export type LoginResult =
  | { ok: true; mode: 'online' | 'offline'; session: TeacherSession }
  | { ok: false; error: string };

export function loadTeacherSession(): TeacherSession | null {
  try {
    const raw = localStorage.getItem(TEACHER_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TeacherSession;
    return s && (s.role === 'admin' || s.role === 'teacher') ? s : null;
  } catch {
    return null;
  }
}

function saveTeacherSession(s: TeacherSession | null) {
  try {
    if (s) localStorage.setItem(TEACHER_SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(TEACHER_SESSION_KEY);
  } catch {
    // Bộ nhớ bị chặn: phiên chỉ còn trong lần mở này
  }
}

const teacherEmail = (username: string) => `${username}@${TEACHER_EMAIL_DOMAIN}`;

/** Đọc hồ sơ (vai trò, mã GV) của người vừa đăng nhập. Chưa chạy SQL tạo bảng hồ sơ thì trả null. */
async function fetchOwnProfile(userId: string) {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.from('teacher_profiles').select('teacher_code, username, display_name, role').eq('user_id', userId).maybeSingle()
      )
    );
    if (error || !data) return null;
    return data as { teacher_code: string; username: string; display_name: string; role: TeacherRole };
  } catch {
    return null;
  }
}

async function sha256(text: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(HASH_SALT + text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

async function rememberPassword(password: string) {
  const h = await sha256(password);
  if (!h) return;
  try {
    localStorage.setItem(LOCAL_HASH_KEY, h);
  } catch {
    // Trình duyệt chặn bộ nhớ: lần sau mất mạng sẽ dùng mật khẩu mặc định
  }
}

async function checkOffline(password: string): Promise<boolean> {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LOCAL_HASH_KEY);
  } catch {
    saved = null;
  }
  if (saved) {
    const h = await sha256(password);
    return !!h && h === saved;
  }
  return password === DEFAULT_ADMIN_PASSWORD;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('TIMEOUT')), NETWORK_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(id);
        resolve(v);
      },
      (e) => {
        clearTimeout(id);
        reject(e);
      }
    );
  });
}

/** Lỗi do mạng (không tới được Supabase) chứ không phải do sai mật khẩu */
function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; status?: number; message?: string };
  if (e.message === 'TIMEOUT') return true;
  if (e.name === 'AuthRetryableFetchError') return true;
  if (e.status === 0) return true;
  return /fetch|network|Failed to fetch|NetworkError|ECONN|timed? ?out/i.test(e.message || '');
}

function friendlyAuthError(err: unknown): string {
  const e = err as { status?: number; message?: string; code?: string };
  const msg = (e?.message || '').toLowerCase();
  if (e?.status === 429 || /rate limit|too many/.test(msg)) {
    return 'Đã gửi quá nhiều lần trong thời gian ngắn. Vui lòng đợi khoảng 1 giờ rồi thử lại.';
  }
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/.test(msg) || e?.code === 'otp_expired') {
    return 'Mã OTP không đúng hoặc đã hết hạn. Hãy kiểm tra lại hoặc bấm "Gửi lại mã".';
  }
  if (/password.*(short|weak|at least)|weak_password/.test(msg)) {
    return `Mật khẩu mới quá yếu: cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự, nên có chữ hoa, chữ thường và số.`;
  }
  if (/same.*password|different from the old/.test(msg)) {
    return 'Mật khẩu mới phải khác mật khẩu cũ.';
  }
  if (isNetworkError(err)) {
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng Internet rồi thử lại.';
  }
  return 'Có lỗi xảy ra: ' + (e?.message || 'không rõ nguyên nhân');
}

const WRONG = 'Tên đăng nhập hoặc mật khẩu không chính xác! Vui lòng kiểm tra lại.';

function adminSession(mode: 'online' | 'offline', userId?: string, displayName?: string): TeacherSession {
  return { role: 'admin', userId, code: 'ADMIN', username: ADMIN_USERNAME, displayName: displayName || 'Quản trị (Tác giả)', mode };
}

/**
 * Đăng nhập Cổng Giáo Viên.
 * - "admin": kiểm tra trên Supabase (Gmail tác giả); mất mạng thì kiểm tra trên máy.
 * - Giáo viên phụ: BẮT BUỘC có mạng, kiểm tra trên Supabase, phải có hồ sơ giáo viên.
 * Đăng nhập trực tuyến thành công thì GIỮ phiên Supabase để máy chủ biết ai đang thêm/sửa/xoá bài.
 */
export async function loginTeacher(username: string, password: string): Promise<LoginResult> {
  const user = username.trim().toLowerCase();
  const pass = password.trim();
  if (!user || !pass) return { ok: false, error: WRONG };

  if (user === ADMIN_USERNAME) {
    const finish = (r: LoginResult) => {
      if (r.ok) saveTeacherSession(r.session);
      return r;
    };
    // Chưa cấu hình Gmail tác giả: chỉ kiểm tra trên máy
    if (!ADMIN_EMAIL) {
      return finish((await checkOffline(pass)) ? { ok: true, mode: 'offline', session: adminSession('offline') } : { ok: false, error: WRONG });
    }
    try {
      const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pass }));
      if (!error && data?.user) {
        await rememberPassword(pass);
        const prof = await fetchOwnProfile(data.user.id);
        return finish({ ok: true, mode: 'online', session: adminSession('online', data.user.id, prof?.display_name) });
      }
      if (error && !isNetworkError(error)) return { ok: false, error: WRONG };
    } catch (err) {
      if (!isNetworkError(err)) return { ok: false, error: friendlyAuthError(err) };
    }
    // Mất mạng: kiểm tra với mật khẩu đã nhớ trên máy
    return finish(
      (await checkOffline(pass))
        ? { ok: true, mode: 'offline', session: adminSession('offline') }
        : { ok: false, error: 'Không kết nối được máy chủ và mật khẩu không khớp với lần đăng nhập gần nhất trên máy này.' }
    );
  }

  // GIÁO VIÊN PHỤ
  const NEED_NET = 'Tài khoản giáo viên cần có mạng Internet để đăng nhập. Vui lòng kiểm tra mạng.';
  if (!/^[a-z0-9._-]{3,32}$/.test(user)) return { ok: false, error: WRONG };
  try {
    const { data, error } = await withTimeout(supabase.auth.signInWithPassword({ email: teacherEmail(user), password: pass }));
    if (error) return { ok: false, error: isNetworkError(error) ? NEED_NET : WRONG };
    const prof = data?.user ? await fetchOwnProfile(data.user.id) : null;
    if (!data?.user || !prof || prof.role !== 'teacher') {
      await supabase.auth.signOut().catch(() => undefined);
      return { ok: false, error: 'Tài khoản này chưa được cấp quyền giáo viên. Vui lòng liên hệ quản trị (admin).' };
    }
    const session: TeacherSession = {
      role: 'teacher',
      userId: data.user.id,
      code: prof.teacher_code,
      username: prof.username,
      displayName: prof.display_name || prof.username,
      mode: 'online',
    };
    saveTeacherSession(session);
    return { ok: true, mode: 'online', session };
  } catch (err) {
    return { ok: false, error: isNetworkError(err) ? NEED_NET : friendlyAuthError(err) };
  }
}

/** Giữ tương thích tên cũ */
export const loginAdmin = loginTeacher;

/**
 * Phiên đăng nhập trên máy chủ (Supabase) của người đang đăng nhập còn dùng được không.
 * Phiên có thể hết dù phần mềm vẫn hiện "đã đăng nhập": mật khẩu vừa bị đổi, lâu không mở máy…
 * Khi đó máy chủ coi như khách nên chặn lưu bài. Trả:
 *  - 'ok'      : phiên còn tốt (hoặc tài khoản admin đang dùng kiểu mất mạng, không cần phiên)
 *  - 'expired' : phiên đã hết → cần đăng nhập lại
 *  - 'unknown' : không hỏi được máy chủ (mất mạng) → giữ nguyên, không đăng xuất oan
 */
export async function checkCloudSession(session: TeacherSession | null): Promise<'ok' | 'expired' | 'unknown'> {
  if (!session || session.mode === 'offline') return 'ok';
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return 'expired';
    const { data: u, error } = await withTimeout(supabase.auth.getUser());
    if (error) return isNetworkError(error) ? 'unknown' : 'expired';
    if (!u?.user) return 'expired';
    // Phiên phải đúng là của người đang hiện trên phần mềm
    if (session.userId && u.user.id !== session.userId) return 'expired';
    return 'ok';
  } catch (err) {
    return isNetworkError(err) ? 'unknown' : 'expired';
  }
}

export const SESSION_EXPIRED_NOTICE =
  'Phiên đăng nhập trên máy chủ đã hết (thường do mật khẩu vừa được đổi hoặc lâu chưa đăng nhập). Thầy cô đăng nhập lại để lưu bài nhé.';

export async function logoutTeacher() {
  saveTeacherSession(null);
  await supabase.auth.signOut().catch(() => undefined);
}

/** Người đang đăng nhập tự đổi mật khẩu của mình (cần mạng): kiểm tra mật khẩu hiện tại rồi đặt mật khẩu mới */
export async function changeOwnPassword(
  session: TeacherSession,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  if (newPassword.length < MIN_PASSWORD_LENGTH) return { ok: false, error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  if (newPassword === currentPassword) return { ok: false, error: 'Mật khẩu mới phải khác mật khẩu hiện tại.' };
  // Giáo viên phụ đổi qua hàm máy chủ: máy chủ kiểm tra mật khẩu cũ, đặt mật khẩu mới
  // và ghi lại để admin xem được (bảng teacher_secrets)
  if (session.role === 'teacher') {
    const r = await callTeacherAdmin<{ ok: boolean }>({
      action: 'change_own_password',
      currentPassword: currentPassword.trim(),
      newPassword,
    });
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }
  const email = session.role === 'admin' ? ADMIN_EMAIL : teacherEmail(session.username);
  if (!email) {
    return { ok: false, error: 'Chưa cấu hình Gmail tác giả (VITE_ADMIN_EMAIL) nên chưa đổi được mật khẩu admin trên máy chủ.' };
  }
  try {
    const { error: sErr } = await withTimeout(supabase.auth.signInWithPassword({ email, password: currentPassword.trim() }));
    if (sErr) return { ok: false, error: isNetworkError(sErr) ? friendlyAuthError(sErr) : 'Mật khẩu hiện tại không đúng.' };
    const { error: uErr } = await withTimeout(supabase.auth.updateUser({ password: newPassword }));
    if (uErr) return { ok: false, error: friendlyAuthError(uErr) };
    if (session.role === 'admin') await rememberPassword(newPassword);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

// ----------------------------------------------------------------------------
// QUẢN LÝ GIÁO VIÊN PHỤ (chỉ admin; gọi hàm máy chủ quan-ly-giao-vien)
// ----------------------------------------------------------------------------
export interface TeacherAccount {
  userId: string;
  code: string;
  username: string;
  displayName: string;
  createdAt?: string;
  lessonCount: number;
  /** Mật khẩu đọc được do máy chủ lưu (null: tài khoản tạo trước khi có chức năng này) */
  password?: string | null;
  /** Ai đặt mật khẩu gần nhất: 'admin' hoặc 'teacher' */
  passwordSetBy?: string | null;
}

type AdminCall<T> = { ok: true; data: T } | { ok: false; error: string };

async function callTeacherAdmin<T>(body: Record<string, unknown>): Promise<AdminCall<T>> {
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke(TEACHER_ADMIN_FN, { body }));
    if (error) {
      // Lỗi do hàm máy chủ trả về (403, 400...): đọc câu báo lỗi tiếng Việt trong phản hồi
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const j = await ctx.json();
          if (j?.error) return { ok: false, error: String(j.error) };
        } catch {
          // bỏ qua
        }
      }
      if (/Failed to send|fetch|network/i.test(error.message)) {
        return { ok: false, error: 'Không gọi được hàm máy chủ quan-ly-giao-vien. Kiểm tra mạng hoặc hàm đã được triển khai trên Supabase chưa.' };
      }
      return { ok: false, error: error.message };
    }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      return { ok: false, error: String((data as { error: string }).error) };
    }
    return { ok: true, data: data as T };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

export const listTeachers = () => callTeacherAdmin<{ teachers: TeacherAccount[] }>({ action: 'list' });
export const createTeacher = (username: string, displayName: string, password: string) =>
  callTeacherAdmin<{ teacher: TeacherAccount }>({ action: 'create', username, displayName, password });
export const deleteTeacher = (userId: string) => callTeacherAdmin<{ ok: boolean }>({ action: 'delete', userId });
export const resetTeacherPassword = (userId: string, password: string) =>
  callTeacherAdmin<{ ok: boolean }>({ action: 'set_password', userId, password });

/** Bước 1 khôi phục: kiểm tra Gmail + số điện thoại tác giả rồi gửi mã OTP về Gmail */
export async function requestPasswordReset(email: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  if (!ADMIN_EMAIL) {
    return {
      ok: false,
      error: 'Phần mềm chưa được cấu hình Gmail tác giả nên chưa khôi phục được. Vui lòng liên hệ tác giả.',
    };
  }
  const mail = email.trim().toLowerCase();
  const digits = phone.replace(/\D/g, '').replace(/^84/, '0');
  if (mail !== ADMIN_EMAIL || !AUTHOR_PHONES.includes(digits)) {
    return { ok: false, error: 'Gmail hoặc số điện thoại không khớp với thông tin tác giả đã đăng ký.' };
  }
  try {
    const { error } = await withTimeout(supabase.auth.resetPasswordForEmail(ADMIN_EMAIL));
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}

/** Bước 2 khôi phục: nhập mã OTP trong Gmail + mật khẩu mới */
export async function confirmPasswordReset(otp: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const token = otp.replace(/\s/g, '');
  if (!/^\d{6,10}$/.test(token)) return { ok: false, error: 'Mã OTP gồm các chữ số trong thư Gmail (thường là 6 số).' };
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` };
  }
  try {
    const { error: vErr } = await withTimeout(
      supabase.auth.verifyOtp({ email: ADMIN_EMAIL, token, type: 'recovery' })
    );
    if (vErr) return { ok: false, error: friendlyAuthError(vErr) };
    const { error: uErr } = await withTimeout(supabase.auth.updateUser({ password: newPassword }));
    if (uErr) {
      await supabase.auth.signOut().catch(() => undefined);
      return { ok: false, error: friendlyAuthError(uErr) };
    }
    await rememberPassword(newPassword);
    saveTeacherSession(null);
    await supabase.auth.signOut().catch(() => undefined);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) };
  }
}
