// ============================================================================
// HÀM MÁY CHỦ (Supabase Edge Function): QUẢN LÝ TÀI KHOẢN GIÁO VIÊN PHỤ
// Chỉ tài khoản admin gọi được. Khoá service_role chỉ nằm trên máy chủ Supabase (biến môi trường
// SUPABASE_SERVICE_ROLE_KEY có sẵn), KHÔNG bao giờ nằm trong phần mềm của học sinh/giáo viên.
//
// Các thao tác (gửi JSON { action, ... }):
//   list                                   -> danh sách giáo viên phụ + số bài mỗi người đã tạo
//   create  { username, displayName, password }
//   delete  { userId }                     -> xoá tài khoản (bài đã tạo vẫn giữ, chuyển cho admin quản lý)
//   set_password { userId, password }      -> admin đặt lại mật khẩu cho giáo viên
// ============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

// Tài khoản giáo viên phụ không cần Gmail thật: đăng nhập bằng tên đăng nhập, phần mềm tự ghép đuôi này
const TEACHER_EMAIL_DOMAIN = 'gv.beluyengo10ngon.local';
const MIN_PASSWORD = 8;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'Chỉ nhận POST' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Xác định người gọi từ phiên đăng nhập gửi kèm
  const authHeader = req.headers.get('Authorization') || '';
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: callerData } = await asCaller.auth.getUser();
  const caller = callerData?.user;
  if (!caller) return json(401, { error: 'Chưa đăng nhập hoặc phiên đã hết hạn. Hãy đăng nhập lại.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: callerProfile } = await admin
    .from('teacher_profiles')
    .select('role')
    .eq('user_id', caller.id)
    .maybeSingle();
  if (callerProfile?.role !== 'admin') return json(403, { error: 'Chỉ tài khoản quản trị (admin) được quản lý giáo viên.' });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Dữ liệu gửi lên không hợp lệ' });
  }
  const action = String(body.action || '');

  // Chỉ thao tác trên tài khoản GIÁO VIÊN PHỤ (không cho xoá/đổi mật khẩu admin qua đây)
  const loadTeacher = async (userId: string) => {
    const { data } = await admin.from('teacher_profiles').select('*').eq('user_id', userId).maybeSingle();
    return data && data.role === 'teacher' ? data : null;
  };

  try {
    if (action === 'list') {
      const { data: profiles, error } = await admin
        .from('teacher_profiles')
        .select('user_id, teacher_code, username, display_name, role, created_at')
        .eq('role', 'teacher')
        .order('teacher_code');
      if (error) throw error;
      const { data: owned } = await admin.from('lessons').select('owner_id').not('owner_id', 'is', null);
      const counts: Record<string, number> = {};
      (owned || []).forEach((r: { owner_id: string }) => (counts[r.owner_id] = (counts[r.owner_id] || 0) + 1));
      return json(200, {
        teachers: (profiles || []).map((p) => ({
          userId: p.user_id,
          code: p.teacher_code,
          username: p.username,
          displayName: p.display_name,
          createdAt: p.created_at,
          lessonCount: counts[p.user_id] || 0,
        })),
      });
    }

    if (action === 'create') {
      const username = String(body.username || '').trim().toLowerCase();
      const displayName = String(body.displayName || '').trim();
      const password = String(body.password || '');
      if (!/^[a-z0-9._-]{3,32}$/.test(username) || username === 'admin') {
        return json(400, { error: 'Tên đăng nhập gồm 3–32 ký tự: chữ thường không dấu, số, dấu chấm, gạch ngang (không được là "admin").' });
      }
      if (!displayName) return json(400, { error: 'Hãy nhập họ tên giáo viên.' });
      if (password.length < MIN_PASSWORD) return json(400, { error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.` });

      const { data: existed } = await admin.from('teacher_profiles').select('user_id').eq('username', username).maybeSingle();
      if (existed) return json(409, { error: `Tên đăng nhập "${username}" đã có người dùng.` });

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: `${username}@${TEACHER_EMAIL_DOMAIN}`,
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      });
      if (cErr || !created?.user) return json(400, { error: 'Không tạo được tài khoản: ' + (cErr?.message || 'lỗi không rõ') });

      const { data: code, error: codeErr } = await admin.rpc('next_teacher_code');
      if (codeErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw codeErr;
      }
      const { error: pErr } = await admin.from('teacher_profiles').insert({
        user_id: created.user.id,
        teacher_code: code,
        username,
        display_name: displayName,
        role: 'teacher',
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        throw pErr;
      }
      return json(200, { teacher: { userId: created.user.id, code, username, displayName, lessonCount: 0 } });
    }

    if (action === 'delete') {
      const userId = String(body.userId || '');
      const t = await loadTeacher(userId);
      if (!t) return json(404, { error: 'Không tìm thấy giáo viên phụ này.' });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json(200, { ok: true });
    }

    if (action === 'set_password') {
      const userId = String(body.userId || '');
      const password = String(body.password || '');
      if (password.length < MIN_PASSWORD) return json(400, { error: `Mật khẩu cần ít nhất ${MIN_PASSWORD} ký tự.` });
      const t = await loadTeacher(userId);
      if (!t) return json(404, { error: 'Không tìm thấy giáo viên phụ này.' });
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(400, { error: 'Thao tác không hỗ trợ: ' + action });
  } catch (err) {
    return json(500, { error: 'Lỗi máy chủ: ' + ((err as Error)?.message || String(err)) });
  }
});
