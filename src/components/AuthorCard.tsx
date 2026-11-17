import React, { useState } from 'react';
import { Coffee, Phone, MessageCircle, Copy, Check, Building2, CreditCard } from 'lucide-react';

// Sao chép an toàn: trên http qua mạng LAN, navigator.clipboard có thể không tồn tại,
// nên dùng textarea + execCommand('copy') làm dự phòng.
const copyTextSafely = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Bị chặn quyền: thử cách dự phòng bên dưới
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

interface AuthorCardProps {
  onOpenDonateModal: () => void;
}

export const AuthorCard: React.FC<AuthorCardProps> = ({ onOpenDonateModal }) => {
  const [copiedStk, setCopiedStk] = useState<boolean>(false);
  const [copyFailed, setCopyFailed] = useState<boolean>(false);

  const handleCopyStk = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyTextSafely('0977058363');
    // Báo rõ khi chép thất bại để không tưởng đã chép.
    setCopiedStk(ok);
    setCopyFailed(!ok);
    setTimeout(() => {
      setCopiedStk(false);
      setCopyFailed(false);
    }, 2000);
  };

  return (
    <section
      aria-label="Thông tin tác giả và ủng hộ phần mềm"
      className="w-full shrink-0 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/90 rounded-xl border border-amber-300 shadow-2xs p-1.5 flex flex-col gap-1 transition-all hover:border-amber-400 select-none"
    >
      {/* Hàng tiêu đề & tên tác giả */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xs font-black shadow-2xs shrink-0">
            👨‍🏫
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black uppercase text-amber-900 tracking-wider">
                THÔNG TIN TÁC GIẢ
              </span>
              <span className="inline-flex items-center px-1 py-0.2 rounded-full text-[8px] font-extrabold bg-amber-200 text-amber-900 border border-amber-300">
                Tiểu học
              </span>
            </div>
            <h4 className="text-[11px] font-black text-slate-900 truncate leading-tight">
              Nguyễn Thanh Liêm
            </h4>
          </div>
        </div>

        {/* Nút Donate ly cà phê nhanh */}
        <button
          type="button"
          onClick={onOpenDonateModal}
          className="shrink-0 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-[10px] shadow-2xs hover:shadow-xs hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center gap-1 border border-amber-400"
          title="Tặng tác giả 1 ly cà phê duy trì hoạt động phần mềm"
        >
          <Coffee className="w-3 h-3 text-amber-200 animate-bounce" />
          <span>Donate ☕</span>
        </button>
      </div>

      {/* Thông tin trường và SĐT / Zalo / STK BIDV */}
      <div className="bg-white/90 rounded-lg p-1 border border-amber-200 flex flex-col gap-0.5 text-[10px]">
        <div className="flex items-center justify-between gap-1 text-slate-700">
          <span className="text-slate-500 font-semibold truncate">Trường:</span>
          <span className="font-bold text-slate-900 truncate" title="Tiểu học số 1 Tân Uyên">
            Tiểu học số 1 Tân Uyên
          </span>
        </div>

        {/* SĐT & Zalo */}
        <div className="flex items-center justify-between gap-1 text-slate-700">
          <span className="text-slate-500 font-semibold shrink-0">SĐT / Zalo:</span>
          <div className="flex items-center gap-1 shrink-0 font-bold">
            <a
              href="tel:0888358363"
              className="text-sky-700 hover:underline flex items-center gap-0.5"
              title="Gọi 0888.358.363"
            >
              <Phone className="w-2.5 h-2.5" />
              <span>0888.358.363</span>
            </a>
            <span className="text-slate-300">•</span>
            <a
              href="https://zalo.me/0888358363"
              target="_blank"
              rel="noopener noreferrer"
              className="px-1 py-0.2 rounded bg-sky-500 hover:bg-sky-600 text-white text-[9px] font-black flex items-center gap-0.5 transition-colors"
              title="Nhắn tin Zalo"
            >
              <MessageCircle className="w-2.5 h-2.5" />
              <span>Zalo</span>
            </a>
          </div>
        </div>

        {/* STK BIDV */}
        <div className="flex items-center justify-between gap-1 text-slate-700 pt-0.5 border-t border-slate-100">
          <span className="text-slate-500 font-semibold truncate flex items-center gap-0.5">
            <CreditCard className="w-2.5 h-2.5 text-emerald-600" />
            <span>BIDV Tân Uyên:</span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="font-mono font-black text-emerald-800 text-[10px]">0977.058.363</span>
            <button
              type="button"
              onClick={handleCopyStk}
              className="p-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title={copyFailed ? 'Không sao chép được, hãy chép tay' : 'Sao chép số tài khoản BIDV'}
            >
              {copyFailed ? (
                <span className="text-[9px] font-black text-rose-600 px-0.5">Chép tay</span>
              ) : copiedStk ? (
                <Check className="w-2.5 h-2.5 text-emerald-600" />
              ) : (
                <Copy className="w-2.5 h-2.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
