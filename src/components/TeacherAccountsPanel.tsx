// ============================================================================
// QUẢN LÝ TÀI KHOẢN GIÁO VIÊN PHỤ (chỉ admin): tạo, đặt lại mật khẩu, xoá
// Mọi thao tác chạy qua hàm máy chủ quan-ly-giao-vien (máy chủ kiểm tra người gọi là admin).
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Trash2, RefreshCw, Eye, EyeOff, Users } from 'lucide-react';
import {
  listTeachers,
  createTeacher,
  deleteTeacher,
  resetTeacherPassword,
  MIN_PASSWORD_LENGTH,
  type TeacherAccount,
} from '../lib/adminAuth';

const inputCls =
  'w-full min-h-[44px] text-sm font-bold px-3 rounded-xl bg-white border-2 border-slate-300 focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-xs font-black text-slate-700 mb-1';

interface Props {
  /** Admin đăng nhập lúc mất mạng: không gọi được máy chủ */
  offline?: boolean;
}

export const TeacherAccountsPanel: React.FC<Props> = ({ offline }) => {
  const [teachers, setTeachers] = useState<TeacherAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newUser, setNewUser] = useState('');
  const [newName, setNewName] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    const r = await listTeachers();
    setLoading(false);
    if (r.ok) setTeachers(r.data.teachers || []);
    else setError(r.error);
  }, []);

  useEffect(() => {
    if (!offline) reload();
  }, [offline, reload]);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setCreating(true);
    const r = await createTeacher(newUser.trim().toLowerCase(), newName.trim(), newPw);
    setCreating(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNotice(`Đã tạo tài khoản ${r.data.teacher.code} – ${r.data.teacher.displayName} (tên đăng nhập: ${r.data.teacher.username}).`);
    setNewUser('');
    setNewName('');
    setNewPw('');
    reload();
  };

  const onReset = async (t: TeacherAccount) => {
    setError('');
    setNotice('');
    setBusyId(t.userId);
    const r = await resetTeacherPassword(t.userId, resetPw);
    setBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNotice(`Đã đặt mật khẩu mới cho ${t.code} – ${t.displayName}.`);
    setResetFor(null);
    setResetPw('');
  };

  const onDelete = async (t: TeacherAccount) => {
    if (
      !window.confirm(
        `Xoá tài khoản ${t.code} – ${t.displayName}?\n\nGiáo viên này sẽ không đăng nhập được nữa. ${t.lessonCount} bài đã tạo vẫn được giữ lại (admin quản lý). Không hoàn tác được.`
      )
    )
      return;
    setError('');
    setNotice('');
    setBusyId(t.userId);
    const r = await deleteTeacher(t.userId);
    setBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNotice(`Đã xoá tài khoản ${t.code} – ${t.displayName}.`);
    reload();
  };

  if (offline) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-sm font-semibold" data-testid="accounts-offline">
        Đang đăng nhập khi mất mạng nên chưa quản lý được tài khoản giáo viên. Hãy kết nối Internet rồi đăng xuất và đăng nhập lại.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl" data-testid="teacher-accounts">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" /> Tài khoản giáo viên
          </h3>
          <p className="text-sm text-slate-600">
            Giáo viên phụ được thêm bài và sửa/xoá bài của chính mình; không giao bài cho lớp, không xoá bài của người khác.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="min-h-[44px] px-4 rounded-full bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại
        </button>
      </div>

      {error && (
        <p className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-sm font-bold" data-testid="accounts-error">
          {error}
        </p>
      )}
      {notice && (
        <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-bold" data-testid="accounts-notice">
          {notice}
        </p>
      )}

      {/* Tạo tài khoản mới */}
      <form onSubmit={onCreate} className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <div>
          <label className={labelCls}>Tên đăng nhập (không dấu)</label>
          <input
            value={newUser}
            onChange={(e) => setNewUser(e.target.value.replace(/\s/g, '').toLowerCase())}
            placeholder="vd: colan"
            required
            autoComplete="off"
            data-testid="new-teacher-username"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Họ tên giáo viên</label>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="vd: Cô Nguyễn Thị Lan"
            required
            autoComplete="off"
            data-testid="new-teacher-name"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Mật khẩu (ít nhất {MIN_PASSWORD_LENGTH} ký tự)</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
              autoComplete="new-password"
              data-testid="new-teacher-password"
              className={`${inputCls} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 cursor-pointer"
              title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          data-testid="create-teacher"
          className="min-h-[44px] px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <UserPlus className="w-4 h-4" /> {creating ? 'Đang tạo…' : 'Tạo tài khoản'}
        </button>
      </form>

      {/* Danh sách */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {teachers.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 font-semibold">{loading ? 'Đang tải danh sách…' : 'Chưa có giáo viên phụ nào.'}</p>
        ) : (
          <ul>
            {teachers.map((t) => (
              <li key={t.userId} data-teacher-row={t.code} className="border-b border-slate-100 last:border-b-0 px-3 py-2.5">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-black px-2 py-1 rounded-lg bg-sky-100 text-sky-800">{t.code}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{t.displayName}</p>
                    <p className="text-xs text-slate-500">
                      Tên đăng nhập: <b>{t.username}</b> · {t.lessonCount} bài đã tạo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResetFor(resetFor === t.userId ? null : t.userId);
                      setResetPw('');
                    }}
                    className="min-h-[40px] px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    data-action="reset-password"
                  >
                    <KeyRound className="w-4 h-4" /> Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    disabled={busyId === t.userId}
                    className="min-h-[40px] px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    data-action="delete-teacher"
                  >
                    <Trash2 className="w-4 h-4" /> Xoá
                  </button>
                </div>
                {resetFor === t.userId && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      onReset(t);
                    }}
                    className="mt-2 flex items-end gap-2 flex-wrap"
                  >
                    <div className="flex-1 min-w-[200px]">
                      <label className={labelCls}>Mật khẩu mới cho {t.displayName}</label>
                      <input
                        type="text"
                        value={resetPw}
                        onChange={(e) => setResetPw(e.target.value)}
                        required
                        autoFocus
                        autoComplete="off"
                        data-testid="reset-teacher-password"
                        className={inputCls}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busyId === t.userId}
                      className="min-h-[44px] px-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-sm cursor-pointer disabled:opacity-60"
                      data-testid="confirm-reset-password"
                    >
                      {busyId === t.userId ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
