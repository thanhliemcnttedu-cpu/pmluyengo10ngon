// ============================================================================
// MÀN CHỜ "BẮT ĐẦU GÕ": nhắc đặt tay lên hàng cơ sở, bấm nút (hoặc Enter) -> đếm 3, 2, 1 -> bắt đầu tính giờ.
// Giúp học sinh có thời gian chuẩn bị tay, đồng hồ chỉ chạy khi các em thật sự bắt đầu gõ.
// ============================================================================
import React from 'react';
import { AuthorCredit } from './AuthorCredit';

interface StartGateProps {
  phase: 'ready' | 'countdown';
  count: number; // 3, 2, 1, 0 (= "GÕ!")
  lessonTitle: string;
  onStart: () => void;
  /** Mở danh sách bài để học sinh đổi bài trước khi bắt đầu */
  onChooseLesson?: () => void;
  onOpenAuthor?: () => void;
}

export const StartGate: React.FC<StartGateProps> = ({ phase, count, lessonTitle, onStart, onChooseLesson, onOpenAuthor }) => (
  <div
    className="absolute inset-0 z-[45] flex items-center justify-center bg-white/70 backdrop-blur-[3px] rounded-2xl"
    data-testid="start-gate"
  >
    {phase === 'ready' ? (
      <div className="w-[min(92%,520px)] bg-white rounded-3xl border-4 border-sky-300 shadow-2xl px-6 py-5 text-center">
        <p className="text-sm font-bold text-slate-500">Bài học</p>
        <h3 className="text-xl font-black text-slate-900 leading-snug">{lessonTitle}</h3>
        <p className="mt-3 text-lg font-bold text-slate-700">
          ✋ Đặt tay lên <span className="text-sky-700 font-black">A S D F</span> và{' '}
          <span className="text-sky-700 font-black">J K L ;</span>
        </p>
        <p className="text-sm font-semibold text-slate-500">Hai ngón trỏ chạm gờ nổi ở phím F và J</p>
        <button
          type="button"
          onClick={onStart}
          autoFocus
          className="mt-4 w-full min-h-[56px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-yellow-300 text-2xl font-black tracking-tight shadow-lg border-2 border-emerald-300 cursor-pointer active:scale-[0.98] transition-transform focus-visible:outline-4 focus-visible:outline-amber-300"
        >
          ▶ BẮT ĐẦU GÕ
        </button>
        <p className="mt-2 text-sm font-semibold text-slate-500">hoặc nhấn phím Enter</p>
        {onChooseLesson && (
          <button
            type="button"
            onClick={onChooseLesson}
            data-testid="start-gate-choose"
            className="mt-3 w-full min-h-[48px] rounded-2xl bg-white hover:bg-sky-50 text-sky-700 text-lg font-black border-2 border-sky-300 hover:border-sky-500 cursor-pointer active:scale-[0.98] transition-colors focus-visible:outline-4 focus-visible:outline-sky-300"
          >
            📚 CHỌN BÀI KHÁC
          </button>
        )}
      </div>
    ) : (
      <div
        key={count}
        className="startgate-count select-none font-black text-sky-600 drop-shadow-lg"
        style={{ fontSize: count === 0 ? 110 : 150 }}
        aria-live="assertive"
      >
        {count === 0 ? 'GÕ!' : count}
      </div>
    )}
    {phase === 'ready' && onOpenAuthor && (
      <AuthorCredit onClick={onOpenAuthor} tone="dark" className="absolute bottom-3 left-4" />
    )}
    <style>{`
      @keyframes startgate-pop { 0% { transform: scale(.4); opacity: 0 } 40% { transform: scale(1.1); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
      .startgate-count { animation: startgate-pop .45s ease-out; }
      @media (prefers-reduced-motion: reduce) { .startgate-count { animation: none } }
    `}</style>
  </div>
);
