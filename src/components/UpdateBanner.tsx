// ============================================================================
// DẢI THÔNG BÁO TỰ CẬP NHẬT (chỉ hiện trong phần mềm cài trên máy)
//   - Có bản mới: "Có phiên bản mới V2.1.2 cần cập nhật · đang tải 45%"
//   - Tải xong: "Tự cập nhật sau 5… 4… giây" + nút "Cập nhật ngay"
//   - Mở lại sau khi cài: "Đã cập nhật xong! Phiên bản hiện tại là V2.1.2 · phát hành ngày … · vào lúc …"
// Phần vỏ (electron/main.cjs) gửi trạng thái qua preload dưới dạng chuỗi JSON.
// ============================================================================
import React, { useEffect, useState } from 'react';
import { formatReleaseDate, formatReleaseTime } from '../utils/versionInfo';

type UpdateStatus =
  | { stage: 'idle' }
  | { stage: 'available'; version: string; current?: string; percent?: number }
  | { stage: 'ready'; version: string; current?: string; seconds?: number }
  | { stage: 'installing'; version: string }
  | { stage: 'done'; version: string; from?: string; buildTime?: string };

const parse = (raw: unknown): UpdateStatus | null => {
  try {
    const s = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return s && typeof s === 'object' && typeof (s as any).stage === 'string' ? (s as UpdateStatus) : null;
  } catch {
    return null;
  }
};

export const UpdateBanner: React.FC = () => {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [left, setLeft] = useState(0); // giây còn lại trước khi tự cài
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const s = parse((e as CustomEvent).detail);
      if (!s) return;
      setHidden(false);
      setStatus(s);
      if (s.stage === 'ready') setLeft(Math.max(1, s.seconds ?? 5));
    };
    window.addEventListener('luyengo-update-status', onStatus);
    // Trang vừa mở / vừa tải lại: hỏi trạng thái hiện tại
    const env = (window as any).electronEnv;
    if (env?.getUpdateStatus) {
      env
        .getUpdateStatus()
        .then((raw: string) => {
          const s = parse(raw);
          if (s) {
            setStatus(s);
            if (s.stage === 'ready') setLeft(Math.max(1, s.seconds ?? 5));
          }
        })
        .catch(() => {});
    }
    return () => window.removeEventListener('luyengo-update-status', onStatus);
  }, []);

  // Đếm ngược (chỉ để hiển thị; phần vỏ tự cài đúng giờ dù trang có đếm hay không)
  useEffect(() => {
    if (status?.stage !== 'ready' || left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [status, left]);

  // Báo "đã cập nhật xong" tự ẩn sau 20 giây
  useEffect(() => {
    if (status?.stage !== 'done') return;
    const t = setTimeout(() => setHidden(true), 20000);
    return () => clearTimeout(t);
  }, [status]);

  if (!status || status.stage === 'idle' || hidden) return null;

  let tone = 'bg-sky-600 text-white';
  let body: React.ReactNode = null;
  if (status.stage === 'available') {
    body = (
      <>
        🔄 <b>Có phiên bản mới V{status.version} cần cập nhật.</b>{' '}
        {status.current ? <span className="opacity-90">(Máy đang dùng V{status.current})</span> : null} Phần mềm đang tải về
        {typeof status.percent === 'number' && status.percent > 0 ? ` · ${status.percent}%` : '…'}
      </>
    );
  } else if (status.stage === 'ready') {
    tone = 'bg-amber-500 text-slate-950';
    body = (
      <>
        ⏳ <b>Đã tải xong V{status.version}.</b> Phần mềm tự cập nhật sau <b className="tabular-nums">{Math.max(0, left)}</b> giây
        (tự tắt rồi mở lại; nếu Windows hỏi quyền, bấm <b>Yes</b>).
        <button
          type="button"
          onClick={() => (window as any).electronEnv?.installUpdateNow?.()}
          className="ml-2 min-h-[36px] px-3 rounded-full bg-slate-900 text-white text-sm font-black cursor-pointer hover:bg-slate-700"
        >
          Cập nhật ngay
        </button>
      </>
    );
  } else if (status.stage === 'installing') {
    tone = 'bg-amber-500 text-slate-950';
    body = (
      <>
        ⚙️ <b>Đang cập nhật lên V{status.version}…</b> Phần mềm sẽ tự mở lại sau ít giây.
      </>
    );
  } else if (status.stage === 'done') {
    tone = 'bg-emerald-600 text-white';
    body = (
      <>
        🎉 <b>Đã cập nhật xong!</b> Phiên bản hiện tại là <b>V{status.version}</b>
        {status.buildTime ? (
          <>
            {' · '}phát hành ngày <b>{formatReleaseDate(status.buildTime)}</b> · vào lúc <b>{formatReleaseTime(status.buildTime)}</b>
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="ml-2 min-h-[32px] px-3 rounded-full bg-white/20 hover:bg-white/30 text-sm font-black cursor-pointer"
          aria-label="Đóng thông báo"
        >
          Đóng
        </button>
      </>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="update-banner"
      data-stage={status.stage}
      className={`fixed top-2 left-1/2 -translate-x-1/2 z-[90] max-w-[min(900px,94vw)] px-4 py-2.5 rounded-2xl shadow-2xl text-sm sm:text-base font-semibold flex items-center flex-wrap gap-x-1 gap-y-1 ${tone}`}
    >
      {body}
    </div>
  );
};
