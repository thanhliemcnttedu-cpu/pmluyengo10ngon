// ============================================================================
// ĐỔI MẬT KHẨU CỦA CHÍNH MÌNH (admin và giáo viên phụ đều dùng được; cần mạng)
// ============================================================================
import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import { changeOwnPassword, MIN_PASSWORD_LENGTH, type TeacherSession } from '../lib/adminAuth';

const inputCls =
  'w-full min-h-[44px] text-sm font-bold px-3 rounded-xl bg-white border-2 border-slate-300 focus:outline-none focus:border-emerald-500';
const labelCls = 'block text-xs font-black text-slate-700 mb-1';

export const ChangeOwnPasswordPanel: React.FC<{ session: TeacherSession }> = ({ session }) => {
  const [cur, setCur] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  // Gõ lại thì xoá dòng báo lỗi / báo xong cũ để khỏi nhầm là lỗi của lần gõ mới
  const edit = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    if (error) setError('');
    if (done) setDone('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDone('');
    if (pw1 !== pw2) {
      setError('Hai lần nhập mật khẩu mới không giống nhau.');
      return;
    }
    setBusy(true);
    const r = await changeOwnPassword(session, cur, pw1);
    setBusy(false);
    if (!r.ok) {
      setError(r.error || 'Không đổi được mật khẩu.');
      return;
    }
    setCur('');
    setPw1('');
    setPw2('');
    setDone('Đã đổi mật khẩu. Lần đăng nhập sau hãy dùng mật khẩu mới.');
  };

  return (
    <form onSubmit={submit} className="space-y-3 max-w-md" data-testid="change-own-password">
      <div>
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-emerald-600" /> Đổi mật khẩu
        </h3>
        <p className="text-sm text-slate-600">
          Tài khoản: <b>{session.code}</b> – {session.displayName} (tên đăng nhập <b>{session.username}</b>). Cần có mạng Internet.
        </p>
        {session.role === 'teacher' && (
          <p className="mt-1 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1" data-testid="own-password-notice">
            Lưu ý: quản trị (admin) xem được mật khẩu mới để hỗ trợ khi thầy cô quên mật khẩu.
          </p>
        )}
      </div>
      <div>
        <label className={labelCls}>Mật khẩu hiện tại</label>
        <input type={show ? 'text' : 'password'} value={cur} onChange={edit(setCur)} required autoComplete="current-password" data-testid="own-current" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Mật khẩu mới (ít nhất {MIN_PASSWORD_LENGTH} ký tự)</label>
        <div className="relative">
          <input type={show ? 'text' : 'password'} value={pw1} onChange={edit(setPw1)} required autoComplete="new-password" data-testid="own-new1" className={`${inputCls} pr-10`} />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 cursor-pointer" title={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className={labelCls}>Nhập lại mật khẩu mới</label>
        <input type={show ? 'text' : 'password'} value={pw2} onChange={edit(setPw2)} required autoComplete="new-password" data-testid="own-new2" className={inputCls} />
      </div>
      {error && <p className="text-sm text-rose-700 font-bold" data-testid="own-error">{error}</p>}
      {done && <p className="text-sm text-emerald-700 font-bold" data-testid="own-done">{done}</p>}
      <button type="submit" disabled={busy} data-testid="own-submit" className="min-h-[44px] px-5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm cursor-pointer disabled:opacity-60">
        {busy ? 'Đang đổi…' : 'Đổi mật khẩu'}
      </button>
    </form>
  );
};
