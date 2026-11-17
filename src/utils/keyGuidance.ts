// ============================================================================
// HƯỚNG DẪN PHÍM ĐẶC BIỆT (hàm thuần để test tự động)
// - Caps Lock: bật rồi thì chữ HOA không cần Shift; gặp chữ thường thì hướng dẫn bấm Caps Lock để tắt.
// - Phím gõ liên tiếp nhiều lần (Telex dd -> đ, oo -> ô, aa -> â, ee -> ê): đếm lần bấm thứ mấy.
// ============================================================================
import type { KeystrokeStep } from './vietnameseKeystrokes';

export interface CapsGuidance {
  /** Caps Lock đang bật + cần chữ hoa: chỉ bấm phím chữ, không cần Shift */
  capsCoversUpper: boolean;
  /** Caps Lock đang bật + cần chữ thường: phải bấm Caps Lock để tắt trước */
  capsOffNeeded: boolean;
}

/**
 * Caps Lock chỉ đổi hoa/thường cho PHÍM CHỮ CÁI. Phím dấu thanh/mũ Telex (s f r x j, w, aa...) hoa hay thường
 * đều được chấp nhận, còn ký hiệu (! @ ? ...) vẫn cần Shift dù Caps Lock bật.
 */
export function capsGuidance(
  step: Pick<KeystrokeStep, 'keyChar' | 'isToneMarkKey' | 'isHatHookKey'> | undefined,
  capsLockOn: boolean,
  opts: { hasMistake?: boolean; isSymbol?: boolean } = {}
): CapsGuidance {
  const none = { capsCoversUpper: false, capsOffNeeded: false };
  if (!step || !capsLockOn || opts.hasMistake || opts.isSymbol) return none;
  const isLetter = /^[A-Za-z]$/.test(step.keyChar) && !step.isToneMarkKey && !step.isHatHookKey;
  if (!isLetter) return none;
  const upper = step.keyChar !== step.keyChar.toLowerCase();
  return { capsCoversUpper: upper, capsOffNeeded: !upper };
}

/** Lần bấm thứ mấy (n) trong chuỗi các bước liên tiếp cùng một phím, và tổng số lần (total). */
export function repeatPressInfo(
  steps: Pick<KeystrokeStep, 'code' | 'keyChar'>[],
  index: number
): { n: number; total: number } {
  const cur = steps[index];
  if (!cur || cur.code === 'Space' || cur.code === 'Enter') return { n: 1, total: 1 };
  const same = (a?: Pick<KeystrokeStep, 'code' | 'keyChar'>) =>
    !!a && a.code === cur.code && a.keyChar.toLowerCase() === cur.keyChar.toLowerCase();
  let n = 1;
  for (let i = index - 1; i >= 0 && same(steps[i]); i--) n++;
  let total = n;
  for (let j = index + 1; j < steps.length && same(steps[j]); j++) total++;
  return { n, total };
}
