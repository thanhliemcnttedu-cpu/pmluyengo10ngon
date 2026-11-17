// ============================================================================
// KHÔI PHỤC MẬT KHẨU QUẢN TRỊ: Gmail + số điện thoại tác giả -> mã OTP gửi về Gmail -> đặt mật khẩu mới
// ============================================================================
import React, { useState } from 'react';
import { Eye, EyeOff, Mail, ArrowLeft, KeyRound } from 'lucide-react';
import { requestPasswordReset, confirmPasswordReset, MIN_PASSWORD_LENGTH } from '../lib/adminAuth';

interface Props {
  onBack: () => void;
  /** Đổi mật khẩu xong: quay về màn đăng nhập, báo thành công */
  onDone: () => void;
}

const inputCls =
  'w-full text-sm font-bold px-3.5 py-2.5 rounded-xl bg-white border-2 border-slate-300 focus:outline-none focus:border-emerald-500 transition-colors';
const labelCls = 'block text-xs font-black text-slate-700 uppercase tracking-wider mb-1';

export const AdminPasswordRecovery: React.FC<Props> = ({ onBack, onDone }) => {
  const [step, setStep] = useState<'identify' | 'otp'>('identify');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    setBusy(true);
    const r = await requestPasswordReset(email, phone);
    setBusy(false);
    if (!r.ok) {
      setError(r.error || 'Không gửi được mã.');
      return;
    }
    setStep('otp');
    setInfo('Đã gửi mã OTP về Gmail của tác giả. Mở hộp thư (kể cả mục Thư rác/Quảng cáo) để lấy mã.');
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pw1 !== pw2) {
      setError('Hai lần nhập mật khẩu mới không giống nhau.');
      return;
    }
    setBusy(true);
    const r = await confirmPasswordReset(otp, pw1);
    setBusy(false);
    if (!r.ok) {
      setError(r.error || 'Không đổi được mật khẩu.');
      return;
    }
    onDone();
  };

  return (
    <div className="space-y-3 text-left" data-testid="admin-recovery">
      <div className="text-center">
        <h3 className="text-lg font-black text-slate-900">Khôi Phục Mật Khẩu Quản Trị</h3>
        <p className="text-xs text-slate-600 mt-1">
          {step === 'identify'
            ? 'Nhập đúng Gmail và số điện thoại của tác giả để nhận mã OTP qua Gmail.'
            : 'Nhập mã OTP trong thư Gmail và đặt mật khẩu mới.'}
        </p>
      </div>

      {step === 'identify' ? (
        <form onSubmit={sendCode} className="space-y-3">
          <div>
            <label className={labelCls}>Gmail tác giả:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vidu@gmail.com"
              required
              autoFocus
              autoComplete="email"
              data-testid="recovery-email"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Số điện thoại tác giả:</label>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xx xxx xxx"
              required
              autoComplete="tel"
              data-testid="recovery-phone"
              className={inputCls}
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-bold" data-testid="recovery-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            data-testid="recovery-send"
            className="w-full min-h-[44px] rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-black text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {busy ? 'Đang gửi mã…' : 'Gửi mã OTP về Gmail'}
          </button>
        </form>
      ) : (
        <form onSubmit={confirm} className="space-y-3">
          {info && <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">{info}</p>}
          <div>
            <label className={labelCls}>Mã OTP trong Gmail:</label>
            <input
              type="text"
              inputMode="numeric"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Ví dụ: 123456"
              required
              autoFocus
              autoComplete="one-time-code"
              data-testid="recovery-otp"
              className={`${inputCls} tracking-[0.3em]`}
            />
          </div>
          <div>
            <label className={labelCls}>Mật khẩu mới (ít nhất {MIN_PASSWORD_LENGTH} ký tự):</label>
            <div className="relative flex items-center">
              <input
                type={showPw ? 'text' : 'password'}
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                required
                autoComplete="new-password"
                data-testid="recovery-pw1"
                className={`${inputCls} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2.5 p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
                title={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Nhập lại mật khẩu mới:</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              required
              autoComplete="new-password"
              data-testid="recovery-pw2"
              className={inputCls}
            />
          </div>
          {error && <p className="text-xs text-rose-600 font-bold" data-testid="recovery-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            data-testid="recovery-confirm"
            className="w-full min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-sm shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            {busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu mới'}
          </button>
          <button
            type="button"
            onClick={() => sendCode()}
            disabled={busy}
            className="w-full text-xs font-bold text-sky-700 hover:underline cursor-pointer disabled:opacity-60"
          >
            Chưa nhận được thư? Gửi lại mã
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="w-full text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1 cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Quay lại đăng nhập
      </button>
    </div>
  );
};
