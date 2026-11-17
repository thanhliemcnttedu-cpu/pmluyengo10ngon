import React, { useEffect } from 'react';
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
  // Fire multi-stage confetti and play applause + fanfare audio on open
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  if (!isOpen) return null;

  // Điểm thang 10 và thời gian theo cùng công thức với bảng điểm khi đang gõ
  const elapsedSec = result?.elapsedSec ?? stats.timeSpentSeconds;
  const score = result?.score ?? 0;
  const wordsPerMin = result?.wordsPerMin ?? 0;
  const isNewRecord = result?.prevBestSec !== undefined && elapsedSec < result.prevBestSec;
  const bestSec = result?.prevBestSec !== undefined ? Math.min(result.prevBestSec, elapsedSec) : elapsedSec;

  // Đánh giá kỹ năng gõ theo điểm thang 10
  let skillRating = 'Khá';
  let skillBadgeClass = 'bg-sky-500 text-white';
  let congratulationMessage = 'Bé đã rất cố gắng! Hãy tiếp tục luyện tập để gõ phím nhanh và chính xác hơn nhé!';

  if (score >= 9) {
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
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-gradient-to-b from-white via-amber-50/40 to-sky-50/50 rounded-3xl border-4 border-amber-400 shadow-2xl p-5 sm:p-7 flex flex-col items-center max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200 select-none"
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
          CHÚC MỪNG BÉ HOÀN THÀNH BÀI GÕ!
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
            ⏱ Em đã gõ xong bài trong <span className="text-sky-700">{describeDuration(elapsedSec)}</span>
          </p>
          <p className="text-sm font-bold text-slate-600 mt-0.5">
            {isNewRecord ? (
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
  );
};
