import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeDuration, formatClock, formatScore } from '../utils/scoring';
import { Lesson, TypingStats } from '../types/typing';
import { soundEngine } from '../utils/audio';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Sparkles,
  RotateCcw,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  X,
  Target,
  Zap,
  Flame,
  Clock,
  AlertCircle
} from 'lucide-react';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson;
  stats: TypingStats;
  /** Kết quả theo bảng điểm: thời gian hoàn thành, điểm thang 10, tốc độ từ/phút, kỷ lục */
  result?: {
    elapsedSec: number;
    score: number;
    wordsPerMin: number;
    totalWords: number;
    /** Số từ đã gõ đúng (khi kết thúc sớm nhỏ hơn totalWords) */
    doneWords?: number;
    /** Học sinh bấm Kết thúc khi chưa gõ hết bài */
    endedEarly?: boolean;
    prevBestSec?: number;
    bestScore?: number;
  };
  onRestart: () => void;
  onNextLesson: () => void;
  hasNextLesson: boolean;
  onOpenCurriculumModal?: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  isOpen,
  onClose,
  lesson,
  stats,
  result,
  onRestart,
  onNextLesson,
  hasNextLesson,
  onOpenCurriculumModal,
}) => {
  // PHÓNG TO VỪA MÀN HÌNH: đo bảng ở cỡ gốc rồi phóng (hoặc thu) cho vừa khung nhìn, giữ nguyên tỉ lệ
  const panelRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  // Màn hình nằm ngang: bảng rộng hơn (chữ ít xuống dòng, bảng thấp lại) để phóng to được nhiều hơn
  const [panelWidth, setPanelWidth] = useState(576);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = panelRef.current;
    if (!el) return;
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const want = vw / vh > 1.25 ? 880 : Math.min(576, vw - 16);
      if (Math.abs(el.offsetWidth - want) > 1) {
        setPanelWidth(want); // ResizeObserver sẽ gọi lại fit sau khi đổi bề rộng
        return;
      }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const pad = window.innerWidth < 640 ? 16 : 40; // chừa lề quanh bảng
      const s = Math.min((window.innerWidth - pad) / w, (window.innerHeight - pad) / h, 2.2);
      setFitScale(Math.max(0.4, Math.round(s * 1000) / 1000));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [isOpen]);

  // Fire multi-stage confetti and play applause + fanfare audio on open
  const endedEarly = !!result?.endedEarly;
  useEffect(() => {
    if (!isOpen || endedEarly) return; // kết thúc sớm: không pháo hoa, không kèn chiến thắng

    // 1. Play crowd applause & victory fanfare
    soundEngine.playApplause();
    soundEngine.playVictoryFanfare();

    // 2. Confetti cannons in 3 festive bursts
    const fireConfetti = () => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6, x: 0.3 },
      });
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6, x: 0.7 },
      });
    };

    fireConfetti();
    const t1 = setTimeout(fireConfetti, 450);
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
      });
    }, 1100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, endedEarly]);

  if (!isOpen) return null;

  // Điểm thang 10 và thời gian theo cùng công thức với bảng điểm khi đang gõ
  const elapsedSec = result?.elapsedSec ?? stats.timeSpentSeconds;
  const score = result?.score ?? 0;
  const wordsPerMin = result?.wordsPerMin ?? 0;
  const isNewRecord = !endedEarly && result?.prevBestSec !== undefined && elapsedSec < result.prevBestSec;
  const doneWords = result?.doneWords ?? result?.totalWords ?? 0;
  const totalWords = result?.totalWords ?? 0;
  const bestSec = result?.prevBestSec !== undefined ? Math.min(result.prevBestSec, elapsedSec) : elapsedSec;

  // Đánh giá kỹ năng gõ theo điểm thang 10
  let skillRating = 'Khá';
  let skillBadgeClass = 'bg-sky-500 text-white';
  let congratulationMessage = 'Bé đã rất cố gắng! Hãy tiếp tục luyện tập để gõ phím nhanh và chính xác hơn nhé!';

  if (endedEarly) {
    congratulationMessage =
      doneWords === 0
        ? 'Em chưa gõ được từ nào. Bấm "Luyện Lại Bài Này" để thử lại nhé!'
        : 'Em đã cố gắng rồi! Lần sau hãy thử gõ hết cả bài để được điểm cao hơn nhé!';
  } else if (score >= 9) {
    skillRating = 'Xuất Sắc ⭐⭐⭐';
    skillBadgeClass = 'bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950';
    congratulationMessage = 'Tuyệt vời! Bé gõ phím chuẩn 10 ngón siêu nhanh và cực kỳ chính xác như nghệ sĩ đánh đàn!';
  } else if (score >= 7.5) {
    skillRating = 'Giỏi ⭐⭐';
    skillBadgeClass = 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white';
    congratulationMessage = 'Chúc mừng bé đã thực hiện rất tốt thao tác gõ! Đôi tay của bé đã quen dần với hàng cơ sở rồi đấy!';
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center overflow-hidden animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Lớp ngoài chỉ để phóng to; lớp trong giữ hiệu ứng xuất hiện */}
      <div style={{ transform: `scale(${fitScale})`, transformOrigin: 'center center' }} className="shrink-0">
      <div
        ref={panelRef}
        data-testid="completion-panel"
        style={{ width: panelWidth }}
        className="relative bg-gradient-to-b from-white via-amber-50/40 to-sky-50/50 rounded-3xl border-4 border-amber-400 shadow-2xl p-5 sm:p-7 flex flex-col items-center animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="Đóng bảng tổng kết"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Cúp vàng rực rỡ */}
        <div className="relative mb-2">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 via-yellow-300 to-orange-400 flex items-center justify-center shadow-lg border-4 border-white animate-bounce">
            <Trophy className="w-11 h-11 text-amber-950 drop-shadow-sm" />
          </div>
          <span className="absolute -bottom-1 -right-1 text-2xl animate-spin">
            ✨
          </span>
        </div>

        {/* Tiêu đề & Lời chúc */}
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 text-center tracking-tight">
          {endedEarly ? 'EM ĐÃ KẾT THÚC BÀI SỚM' : 'CHÚC MỪNG BÉ HOÀN THÀNH BÀI GÕ!'}
        </h2>
        <p className="text-xs sm:text-sm font-bold text-slate-600 text-center mt-0.5">
          Bài học: <span className="text-indigo-700 font-black">"{lesson.title}"</span>
        </p>

        {/* Huy hiệu xếp loại kỹ năng */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Đánh giá kỹ năng:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-black shadow-xs ${skillBadgeClass}`}>
            {skillRating}
          </span>
        </div>

        {/* Thẻ Điểm Tổng Kết Hoành Tráng */}
        <div className="w-full mt-4 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-slate-950 p-3.5 rounded-2xl shadow-md border-2 border-amber-300 flex items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-white drop-shadow" />
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-slate-900/80">ĐIỂM ĐẠT ĐƯỢC</p>
              <p className="text-[13px] font-bold text-slate-900">7 phần chính xác + 3 phần tốc độ</p>
            </div>
          </div>
          <div className="text-4xl sm:text-5xl font-black text-slate-950 drop-shadow-xs tabular-nums">
            {formatScore(score)} <span className="text-lg font-bold">/ 10</span>
          </div>
        </div>

        {/* Thời gian hoàn thành bài: học sinh biết mình gõ xong trong bao lâu */}
        <div className="w-full mt-3 rounded-2xl border-2 border-sky-300 bg-sky-50 px-4 py-3 text-center">
          <p className="text-base sm:text-lg font-black text-sky-900">
            {endedEarly ? (
              <>
                ⏱ Em đã gõ được <span className="text-sky-700">{doneWords}/{totalWords} từ</span> trong{' '}
                <span className="text-sky-700">{describeDuration(elapsedSec)}</span>
              </>
            ) : (
              <>
                ⏱ Em đã gõ xong bài trong <span className="text-sky-700">{describeDuration(elapsedSec)}</span>
              </>
            )}
          </p>
          <p className="text-sm font-bold text-slate-600 mt-0.5">
            {endedEarly ? (
              <>Bài chưa gõ xong nên chưa tính kỷ lục. Điểm chấm theo phần đã gõ.</>
            ) : isNewRecord ? (
              <span className="text-emerald-700">🎉 Kỷ lục mới! Nhanh hơn lần trước {describeDuration((result?.prevBestSec ?? 0) - elapsedSec)}</span>
            ) : (
              <>Kỷ lục của em ở bài này: {formatClock(bestSec)}</>
            )}
          </p>
        </div>

        {/* Lưới 4 Thống kê kỹ năng gõ chi tiết */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-center">
          {/* 1. Tốc độ WPM */}
          <div className="bg-white p-2.5 rounded-2xl border border-sky-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-sky-600 mb-0.5">
              <Zap className="w-4 h-4" />
              <span className="text-[13px] font-black uppercase">Tốc Độ</span>
            </div>
            <div className="font-mono text-xl font-black text-slate-900">
              {wordsPerMin} <span className="text-xs font-bold text-slate-500">từ/phút</span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Mục tiêu: {lesson.targetWpm} từ/phút
            </p>
          </div>

          {/* 2. Độ chính xác */}
          <div className="bg-white p-2.5 rounded-2xl border border-emerald-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-emerald-600 mb-0.5">
              <Target className="w-4 h-4" />
              <span className="text-[13px] font-black uppercase">Chính Xác</span>
            </div>
            <div className="font-mono text-xl font-black text-emerald-900">
              {stats.accuracy}%
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Đạt chuẩn SGK
            </p>
          </div>

          {/* 3. Chuỗi gõ đúng */}
          <div className="bg-white p-2.5 rounded-2xl border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-0.5">
              <Flame className="w-4 h-4" />
              <span className="text-[13px] font-black uppercase">Chuỗi Kỷ Lục</span>
            </div>
            <div className="font-mono text-xl font-black text-amber-900">
              {stats.bestStreak} <span className="text-xs font-bold text-slate-500">phím</span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              Liên tục không sai
            </p>
          </div>

          {/* 4. Lỗi & Thời gian */}
          <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-center gap-1 text-slate-600 mb-0.5">
              <Clock className="w-4 h-4" />
              <span className="text-[13px] font-black uppercase">Thời Gian</span>
            </div>
            <div className="font-mono text-xl font-black text-slate-800">
              {formatClock(elapsedSec)}
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {stats.mistakes === 0 ? '✓ Không có lỗi' : `${stats.mistakes} lần gõ sai`}
            </p>
          </div>
        </div>

        {/* Khung Lời chúc nồng ấm dành cho học sinh */}
        <div className="w-full mt-3 p-3 rounded-2xl bg-white/90 border border-amber-200 shadow-2xs text-center">
          <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
            💌 {congratulationMessage}
          </p>
        </div>

        {/* Các nút hành động chính */}
        <div className="w-full mt-4 flex items-center justify-between gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onRestart}
            className="flex-1 py-2.5 px-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-slate-300"
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>Luyện Lại Bài Này</span>
          </button>

          {onOpenCurriculumModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenCurriculumModal();
              }}
              className="py-2.5 px-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all border border-indigo-200"
            >
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Chọn Bài Khác</span>
            </button>
          )}

          {hasNextLesson && (
            <button
              type="button"
              onClick={onNextLesson}
              className="flex-1 py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <span>Bài Tiếp Theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
