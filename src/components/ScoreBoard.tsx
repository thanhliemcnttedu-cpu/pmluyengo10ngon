// ============================================================================
// BẢNG ĐIỂM KHI ĐANG GÕ: 5 ô chữ to cho học sinh tiểu học nhìn rõ
// Thời gian · Điểm (thang 10) · Từ đúng · Chính xác · Tốc độ (từ/phút)
// ============================================================================
import React from 'react';
import { MIN_SPEED_SEC, formatClock, formatScore } from '../utils/scoring';

interface ScoreBoardProps {
  elapsedSec: number;
  running: boolean; // đồng hồ đang chạy (nhấp nháy dấu hai chấm)
  score: number;
  doneWords: number;
  totalWords: number;
  accuracy: number;
  wpm: number;
  targetWpm: number;
  compact?: boolean; // màn hình thấp: thu gọn chiều cao
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  elapsedSec,
  running,
  score,
  doneWords,
  totalWords,
  accuracy,
  wpm,
  targetWpm,
  compact = false,
}) => {
  const tiles = [
    {
      key: 'time',
      icon: '⏱',
      label: 'Thời gian',
      value: formatClock(elapsedSec),
      sub: running ? 'Đang tính giờ' : elapsedSec > 0 ? 'Đã dừng' : 'Chưa bắt đầu',
      tone: 'from-sky-50 to-white border-sky-300 text-sky-900',
    },
    {
      key: 'score',
      icon: '⭐',
      label: 'Điểm',
      value: formatScore(score),
      sub: 'trên 10 điểm',
      tone: 'from-amber-50 to-white border-amber-300 text-amber-900',
    },
    {
      key: 'words',
      icon: '✅',
      label: 'Từ đúng',
      value: `${doneWords}/${totalWords}`,
      sub: 'từ đã gõ đúng',
      tone: 'from-emerald-50 to-white border-emerald-300 text-emerald-900',
    },
    {
      key: 'acc',
      icon: '🎯',
      label: 'Chính xác',
      value: `${accuracy}%`,
      sub: accuracy >= 95 ? 'Rất tốt!' : accuracy >= 85 ? 'Khá tốt' : 'Gõ chậm lại nhé',
      tone: 'from-rose-50 to-white border-rose-300 text-rose-900',
    },
    {
      key: 'speed',
      icon: '🚀',
      label: 'Tốc độ',
      // 10 giây đầu chưa đủ để đo tốc độ chính xác -> hiện "–"
      value: elapsedSec < MIN_SPEED_SEC ? '–' : `${wpm}`,
      sub: elapsedSec < MIN_SPEED_SEC ? 'đang đo…' : `từ/phút · mục tiêu ${targetWpm}`,
      tone: 'from-indigo-50 to-white border-indigo-300 text-indigo-900',
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Bảng điểm luyện gõ">
      {tiles.map((t) => (
        <div
          key={t.key}
          data-score-tile={t.key}
          className={`min-w-0 rounded-2xl border-2 bg-gradient-to-b ${t.tone} px-2 ${compact ? 'py-1' : 'py-1.5'} flex flex-col items-center justify-center text-center shadow-2xs`}
        >
          <div className="flex items-center gap-1 text-[13px] font-bold leading-tight">
            <span aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </div>
          <div
            className={`font-black tabular-nums leading-none ${compact ? 'text-xl' : 'text-[26px]'} ${
              t.key === 'time' && running ? 'scoreboard-clock' : ''
            }`}
            aria-live={t.key === 'time' ? 'off' : 'polite'}
          >
            {t.value}
          </div>
          {!compact && <div className="text-[11px] font-semibold opacity-75 leading-tight truncate max-w-full">{t.sub}</div>}
        </div>
      ))}
    </div>
  );
};
