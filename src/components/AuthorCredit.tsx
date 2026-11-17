// ============================================================================
// DÒNG "TÁC GIẢ PHẦN MỀM" hiện dưới các màn chào (thông báo Unikey, chọn lớp, bắt đầu gõ).
// Bấm vào mở trang Thông tin tác giả.
// ============================================================================
import React from 'react';

export const AUTHOR_CREDIT_TEXT = 'Tác giả phần mềm: Nguyễn Thanh Liêm\u00a0\u00a0Điện thoại: 0888358363';

export const AuthorCredit: React.FC<{ onClick?: () => void; tone?: 'light' | 'dark'; className?: string }> = ({
  onClick,
  tone = 'light',
  className = '',
}) => (
  <button
    type="button"
    data-testid="author-credit"
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
    title="Xem thông tin tác giả"
    className={`font-semibold leading-snug text-[clamp(0.95rem,1.7vw,1.6rem)] underline-offset-4 hover:underline cursor-pointer rounded-lg px-2 py-0.5 focus-visible:outline-2 focus-visible:outline-amber-300 ${
      tone === 'light' ? 'text-white/90 hover:text-white [text-shadow:0_1px_3px_rgba(0,0,0,.45)]' : 'text-slate-600 hover:text-slate-900'
    } ${className}`}
  >
    {AUTHOR_CREDIT_TEXT}
  </button>
);
