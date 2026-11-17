// ============================================================================
// BIỂU TƯỢNG 5 TRÒ CHƠI (SVG vẽ tay, phẳng, màu tươi) thay cho emoji:
// emoji hiển thị khác nhau giữa Windows / máy tính bảng và trông nhỏ, rời rạc.
// Mỗi biểu tượng nằm trong ô bo tròn có nền chuyển sắc theo màu riêng của trò chơi.
// ============================================================================
import React from 'react';

export type GameIconId = 'climber' | 'balloon' | 'dance' | 'treasure' | 'courier';

const TILE: Record<GameIconId, [string, string]> = {
  climber: ['#fde68a', '#f59e0b'], // vàng chuối -> cam
  balloon: ['#fbcfe8', '#a855f7'], // hồng -> tím
  dance: ['#a7f3d0', '#14b8a6'], // xanh lá -> ngọc
  treasure: ['#bfdbfe', '#2563eb'], // xanh biển nhạt -> đậm
  courier: ['#fecaca', '#ef4444'], // hồng nhạt -> đỏ
};

const Monkey = () => (
  <g>
    {/* tai */}
    <circle cx="17" cy="30" r="7" fill="#8b5a2b" />
    <circle cx="47" cy="30" r="7" fill="#8b5a2b" />
    <circle cx="17" cy="30" r="3.8" fill="#f2c79b" />
    <circle cx="47" cy="30" r="3.8" fill="#f2c79b" />
    {/* đầu */}
    <circle cx="32" cy="31" r="15" fill="#a0673a" />
    {/* mặt */}
    <path d="M22 30c0-6 4.5-9 10-9s10 3 10 9c0 7-4.5 12-10 12s-10-5-10-12z" fill="#f2c79b" />
    <circle cx="27.5" cy="29" r="2.3" fill="#1f2937" />
    <circle cx="36.5" cy="29" r="2.3" fill="#1f2937" />
    <circle cx="28.2" cy="28.2" r="0.8" fill="#fff" />
    <circle cx="37.2" cy="28.2" r="0.8" fill="#fff" />
    <ellipse cx="32" cy="35" rx="5.5" ry="3.8" fill="#e8b384" />
    <path d="M29 35.5q3 2.6 6 0" stroke="#7c3f1d" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    {/* nải chuối */}
    <path d="M44 51c4-1 8-4 9-9" stroke="#facc15" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    <path d="M52.5 41.5l1.5-2" stroke="#65a30d" strokeWidth="2" strokeLinecap="round" />
  </g>
);

const Balloons = () => (
  <g>
    <path d="M22 38q2 8 9 16M42 36q-2 9-9 18M32 34v20" stroke="#64748b" strokeWidth="1.3" fill="none" />
    <ellipse cx="21" cy="25" rx="9" ry="11" fill="#f43f5e" />
    <ellipse cx="43" cy="23" rx="9" ry="11" fill="#3b82f6" />
    <ellipse cx="32" cy="21" rx="10" ry="12" fill="#facc15" />
    <ellipse cx="18" cy="21" rx="2.5" ry="4" fill="#fff" opacity=".55" />
    <ellipse cx="40" cy="19" rx="2.5" ry="4" fill="#fff" opacity=".55" />
    <ellipse cx="28.5" cy="16" rx="2.8" ry="4.5" fill="#fff" opacity=".6" />
    <path d="M30 33l2 2.5 2-2.5z" fill="#eab308" />
  </g>
);

const MusicNotes = () => (
  <g>
    {/* nốt móc đôi */}
    <path d="M24 44V18l22-5v26" stroke="#0f766e" strokeWidth="4" fill="none" strokeLinejoin="round" />
    <path d="M24 18l22-5v6l-22 5z" fill="#0f766e" />
    <ellipse cx="19.5" cy="44.5" rx="6.5" ry="5" fill="#0f766e" transform="rotate(-18 19.5 44.5)" />
    <ellipse cx="41.5" cy="39.5" rx="6.5" ry="5" fill="#0f766e" transform="rotate(-18 41.5 39.5)" />
    {/* bông hoa nhỏ */}
    <g transform="translate(49 51)">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-4.5" rx="2.8" ry="4" fill="#f472b6" transform={`rotate(${a})`} />
      ))}
      <circle r="2.6" fill="#fde047" />
    </g>
  </g>
);

const TreasureChest = () => (
  <g>
    {/* nắp */}
    <path d="M12 30v-6c0-6 5-10 10-10h20c5 0 10 4 10 10v6z" fill="#b45309" />
    <path d="M12 30v-6c0-6 5-10 10-10h20c5 0 10 4 10 10v6" fill="none" stroke="#78350f" strokeWidth="2" />
    {/* thân */}
    <rect x="12" y="30" width="40" height="22" rx="3" fill="#d97706" stroke="#78350f" strokeWidth="2" />
    {/* đai vàng */}
    <rect x="18" y="14.5" width="5" height="37.5" fill="#facc15" />
    <rect x="41" y="14.5" width="5" height="37.5" fill="#facc15" />
    <rect x="12" y="29" width="40" height="4" fill="#facc15" />
    {/* ổ khoá */}
    <rect x="28" y="31" width="8" height="9" rx="1.5" fill="#fde047" stroke="#a16207" strokeWidth="1.5" />
    <circle cx="32" cy="35" r="1.4" fill="#78350f" />
    {/* ngọc lấp lánh */}
    <path d="M32 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#fff" />
    <path d="M51 9l1.2 2.4 2.4 1.2-2.4 1.2L51 16l-1.2-2.2-2.4-1.2 2.4-1.2z" fill="#fff" opacity=".9" />
  </g>
);

const DeliveryTruck = () => (
  <g>
    {/* thùng hàng */}
    <rect x="6" y="17" width="31" height="25" rx="3" fill="#fff7ed" stroke="#9a3412" strokeWidth="2" />
    <rect x="15" y="22" width="13" height="12" rx="1.5" fill="#f59e0b" />
    <path d="M21.5 22v12M15 27h13" stroke="#b45309" strokeWidth="1.6" />
    {/* cabin */}
    <path d="M37 24h10l7 9v9H37z" fill="#ef4444" stroke="#991b1b" strokeWidth="2" strokeLinejoin="round" />
    <path d="M40 27h6l4.5 6H40z" fill="#bae6fd" />
    {/* bánh xe */}
    <circle cx="16" cy="45" r="5.5" fill="#1f2937" />
    <circle cx="46" cy="45" r="5.5" fill="#1f2937" />
    <circle cx="16" cy="45" r="2" fill="#e5e7eb" />
    <circle cx="46" cy="45" r="2" fill="#e5e7eb" />
    {/* vệt tốc độ */}
    <path d="M1.5 25h3M1.5 31h3M1.5 37h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </g>
);

const ART: Record<GameIconId, React.FC> = {
  climber: Monkey,
  balloon: Balloons,
  dance: MusicNotes,
  treasure: TreasureChest,
  courier: DeliveryTruck,
};

export const GameIcon: React.FC<{ id: GameIconId; size?: number; className?: string }> = ({ id, size = 48, className = '' }) => {
  const [from, to] = TILE[id];
  const Art = ART[id];
  const gid = `game-icon-bg-${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={`shrink-0 drop-shadow-sm ${className}`}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="16" fill={`url(#${gid})`} />
      <rect x="1.5" y="1.5" width="61" height="61" rx="14.5" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2" />
      <Art />
    </svg>
  );
};
