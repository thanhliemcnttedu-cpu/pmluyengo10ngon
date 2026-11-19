// ============================================================================
// QUẢN LÝ TÀI KHOẢN GIÁO VIÊN PHỤ (chỉ admin): tạo, đặt lại mật khẩu, xoá
// Mọi thao tác chạy qua hàm máy chủ quan-ly-giao-vien (máy chủ kiểm tra người gọi là admin).
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, KeyRound, Trash2, RefreshCw, Eye, EyeOff, Users, FileSpreadsheet, Copy } from 'lucide-react';
import { downloadXlsx } from '../utils/simpleXlsx';
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
  // Hiện mật khẩu: theo từng dòng, hoặc hiện tất cả
  const [showAllPw, setShowAllPw] = useState(false);
  const [shownPw, setShownPw] = useState<Record<string, boolean>>({});
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
    reload();
  };

  const copyText = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`Đã chép ${what}.`);
    } catch {
      setError('Trình duyệt không cho chép tự động. Hãy bôi đen rồi bấm Ctrl+C.');
    }
  };

  // Xuất danh sách tài khoản + mật khẩu ra tệp Excel (.xlsx) để in / gửi giáo viên
  const onExport = () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const rows: string[][] = [
      ['STT', 'Mã giáo viên', 'Họ tên', 'Tên đăng nhập', 'Mật khẩu', 'Người đặt mật khẩu', 'Số bài đã tạo', 'Ngày tạo tài khoản', 'Địa chỉ đăng nhập'],
      ...teachers.map((t, i) => [
        String(i + 1),
        t.code,
        t.displayName,
        t.username,
        t.password ?? '(chưa lưu – bấm Đổi mật khẩu để đặt lại)',
        t.passwordSetBy === 'teacher' ? 'Giáo viên tự đổi' : t.passwordSetBy === 'admin' ? 'Quản trị' : '',
        String(t.lessonCount),
        t.createdAt ? new Date(t.createdAt).toLocaleDateString('vi-VN') : '',
        typeof window !== 'undefined' && /^https?:/.test(window.location.origin) ? window.location.origin : 'https://luyengo10ngon.vercel.app',
      ]),
    ];
    downloadXlsx(`tai-khoan-giao-vien-${stamp}.xlsx`, rows, 'Tài khoản giáo viên', [6, 14, 28, 18, 20, 18, 12, 18, 34]);
    setNotice(`Đã xuất ${teachers.length} tài khoản ra tệp Excel tai-khoan-giao-vien-${stamp}.xlsx (thư mục Tải xuống). Hãy cất giữ cẩn thận vì tệp có mật khẩu.`);
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
            Giáo viên phụ được soạn, sửa, xoá bài của chính mình và giao bài theo mã của mình (vd GV001); không sửa hay xoá bài của người khác.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAllPw((v) => !v)}
            disabled={teachers.length === 0}
            data-testid="toggle-all-passwords"
            className="min-h-[44px] px-4 rounded-full bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50 disabled:opacity-60"
          >
            {showAllPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showAllPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={teachers.length === 0}
            data-testid="export-teachers-xlsx"
            className="min-h-[44px] px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <FileSpreadsheet className="w-4 h-4" /> Xuất Excel
          </button>
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="min-h-[44px] px-4 rounded-full bg-white border-2 border-slate-300 text-slate-700 font-bold text-sm flex items-center gap-2 cursor-pointer hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Tải lại
          </button>
        </div>
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
                  {/* Cột mật khẩu: ẩn mặc định, bấm con mắt để hiện */}
                  <div className="flex items-center gap-1 min-w-[230px]" data-teacher-password={t.code}>
                    <span className="text-xs font-bold text-slate-500">Mật khẩu:</span>
                    {t.password ? (
                      <>
                        <code className="px-2 py-1 rounded-lg bg-slate-100 text-sm font-bold text-slate-900 select-all" data-testid="teacher-password-value">
                          {showAllPw || shownPw[t.userId] ? t.password : '••••••••'}
                        </code>
                        <button
                          type="button"
                          onClick={() => setShownPw((m) => ({ ...m, [t.userId]: !m[t.userId] }))}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          title={showAllPw || shownPw[t.userId] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showAllPw || shownPw[t.userId] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyText(`Tên đăng nhập: ${t.username}\nMật khẩu: ${t.password}`, `tài khoản ${t.code}`)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
                          title="Chép tên đăng nhập và mật khẩu"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {t.passwordSetBy === 'teacher' && (
                          <span className="text-[10px] font-bold text-amber-700">GV tự đổi</span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-amber-700" title="Tài khoản tạo trước khi có chức năng lưu mật khẩu">
                        Chưa lưu – bấm Đổi mật khẩu để đặt lại
                      </span>
                    )}
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
