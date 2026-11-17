import React from 'react';
import { X, CheckCircle2 } from 'lucide-react';

interface UnikeyNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnikeyNoticeModal: React.FC<UnikeyNoticeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Hộp TO, co giãn theo màn hình (cỡ chữ dùng clamp theo vw/vh) để học sinh đọc rõ từ cuối lớp */}
      <div
        className="relative w-[min(94vw,1280px)] bg-gradient-to-b from-amber-50 via-white to-sky-50 rounded-[32px] shadow-2xl border-[6px] border-amber-300 max-h-[94vh] overflow-y-auto text-slate-800 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unikey-notice-title"
        data-testid="unikey-notice"
      >
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-6 py-[clamp(10px,2vh,22px)] text-white text-center shadow-md relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-1/2 -translate-y-1/2 right-4 w-11 h-11 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center cursor-pointer"
            title="Đóng thông báo"
            aria-label="Đóng thông báo"
          >
            <X className="w-6 h-6" />
          </button>
          <h2
            id="unikey-notice-title"
            className="font-black tracking-tight text-white drop-shadow-sm text-[clamp(1.6rem,3.4vw,3.2rem)] leading-tight"
          >
            📢 THÔNG BÁO TỚI BẠN NHỎ 🐱
          </h2>
        </div>

        <div className="px-[clamp(16px,3vw,48px)] py-[clamp(12px,2.6vh,32px)] space-y-[clamp(10px,2.2vh,26px)] text-center">
          {/* Lời nhắn chính: TẮT UNIKEY hoặc CHUYỂN V SANG E */}
          <p className="font-black text-amber-950 leading-snug text-[clamp(1.25rem,2.5vw,2.4rem)]">
            Trước khi luyện gõ, em hãy{' '}
            <span className="text-rose-600 whitespace-nowrap">TẮT UNIKEY</span> hoặc{' '}
            <span className="text-sky-600">chuyển Unikey từ chữ <span className="text-[#ff0000]">V</span> sang chữ <span className="text-[#00b0f0]">E</span></span>
          </p>

          {/* Hình minh họa: biểu tượng Unikey ở góc phải dưới màn hình đổi từ V (tiếng Việt) sang E (tiếng Anh) */}
          <div
            className="bg-white border-4 border-emerald-500 rounded-[28px] px-4 py-[clamp(8px,2vh,24px)] grid grid-cols-[1fr_auto_1fr] items-center shadow-xs"
            role="img"
            aria-label="Bấm vào biểu tượng Unikey để đổi từ chữ V sang chữ E"
          >
            <div className="flex flex-col items-center">
              <span className="font-black leading-none text-[#ff0000] select-none text-[clamp(90px,22vh,260px)]">V</span>
              <span className="font-bold text-slate-600 text-[clamp(0.95rem,1.6vw,1.5rem)]">Đang gõ tiếng Việt</span>
            </div>
            <svg viewBox="0 0 110 52" className="w-[clamp(80px,12vw,200px)] h-auto unikey-arrow" aria-hidden="true">
              <path d="M0 18 H62 V2 L108 26 L62 50 V34 H0 Z" fill="#ffc000" />
            </svg>
            <div className="flex flex-col items-center">
              <span className="font-black leading-none text-[#00b0f0] select-none text-[clamp(90px,22vh,260px)]">E</span>
              <span className="font-bold text-slate-600 text-[clamp(0.95rem,1.6vw,1.5rem)]">Sẵn sàng luyện gõ</span>
            </div>
          </div>

          {/* Cách làm ngắn gọn, chữ to */}
          <p className="font-semibold text-slate-700 text-[clamp(1rem,1.7vw,1.6rem)] leading-snug">
            👉 Bấm vào chữ <b className="text-[#ff0000]">V</b> ở <b>góc phải dưới màn hình</b> (cạnh đồng hồ) cho thành chữ{' '}
            <b className="text-[#00b0f0]">E</b>, hoặc nhấn <kbd className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-300 font-black">Ctrl</kbd> +{' '}
            <kbd className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-300 font-black">Shift</kbd>
          </p>

          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="min-w-[min(80vw,420px)] px-10 py-[clamp(10px,1.8vh,20px)] rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 font-black shadow-lg hover:shadow-xl active:scale-[0.98] transition-all cursor-pointer inline-flex items-center justify-center gap-3 border-4 border-amber-300 focus-visible:outline-4 focus-visible:outline-amber-300"
          >
            <CheckCircle2 className="w-[clamp(24px,2.4vw,40px)] h-[clamp(24px,2.4vw,40px)] text-emerald-100" />
            <span className="text-[clamp(1.4rem,2.6vw,2.6rem)] tracking-tight text-yellow-300 drop-shadow-sm">BẮT ĐẦU LUYỆN GÕ</span>
          </button>
          <style>{`
            /* Mũi tên nhích nhẹ sang phải để gợi ý hành động "đổi V thành E" */
            @keyframes unikey-nudge { 0%,100% { transform: translateX(0) } 50% { transform: translateX(6px) } }
            .unikey-arrow { animation: unikey-nudge 1.4s ease-in-out infinite; }
            @media (prefers-reduced-motion: reduce) { .unikey-arrow { animation: none } }
          `}</style>
        </div>
      </div>
    </div>
  );
};
