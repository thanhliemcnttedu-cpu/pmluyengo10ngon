import React, { useState, useEffect, useRef } from 'react';
import { KeyConfig, FingerId, FINGER_DATA, HandDisplayStyle } from '../types/typing';
import {
  FUNCTION_ROW,
  SYSTEM_TOP_KEYS,
  KEYBOARD_ROWS,
  NAV_CLUSTER_ROWS,
  NUMPAD_ROWS,
  NUMPAD_TOP_EXTRA_KEYS,
  CODE_TO_KEY_MAP,
} from '../data/keyboardLayout';
// Bàn tay bám phím thật (phương án B) thay cho lớp bàn tay vẽ theo tọa độ cố định cũ
import { KeyHandsOverlay } from './KeyHandsOverlay';
import { KeyboardSkinTheme, KEYBOARD_THEMES, DEFAULT_KEYBOARD_THEME } from '../data/keyboardThemes';
import { SymbolKeyGuideInfo } from '../utils/symbolKeyGuide';

interface KeyboardProps {
  targetKey?: KeyConfig;
  activeFinger?: FingerId;
  pressedKeys: Set<string>;
  wrongKeyCode?: string | null;
  isShiftTarget?: boolean;
  isBackspaceTarget?: boolean;
  isEnterTarget?: boolean;
  /** Caps Lock đang bật nhưng cần chữ thường: hướng dẫn bấm Caps Lock để tắt */
  isCapsOffTarget?: boolean;
  /** Lần bấm thứ mấy của một phím phải gõ liên tiếp (Telex dd, oo, aa, ee) và tổng số lần */
  targetPressNumber?: number;
  targetPressTotal?: number;
  onKeyClick?: (key: KeyConfig) => void;
  handsOverlayEnabled: boolean; // kiểu bàn phím hướng dẫn (bố cục phím to, chỉ khu vực chính)
  handsVisible?: boolean; // hiện bàn tay (mọi kiểu bàn phím); bỏ trống = theo handsOverlayEnabled
  handsOpacity: number;
  handsStyle: HandDisplayStyle;
  showFingerDots?: boolean;
  theme?: KeyboardSkinTheme;
  onOpenThemeModal?: () => void;
  isCompactHeight?: boolean;
  maxUnitSize?: number;
  suggestedKeyHeight?: number;
  capsLockOn?: boolean;
  onToggleCapsLock?: () => void;
  symbolGuideInfo?: SymbolKeyGuideInfo | null;
}

// ---- Kiểu dáng chế độ bàn tay hướng dẫn: phím phẳng sáng màu, viền chàm rõ nét, chữ đậm dễ đọc ----
const GUIDE_FRAME_CLASS = 'bg-[#8e9bf0] border-2 border-[#5b6ad8]';
const GUIDE_PLATE_CLASS = 'bg-[#aab5f6]';
const GUIDE_KEYCAP_CLASS =
  'bg-gradient-to-b from-[#f4f6ff] to-[#dfe5ff] text-slate-800 border-2 border-[#5f6fd6] shadow-[inset_0_-2px_0_rgba(79,95,201,0.18)]';
const guideTypography = (key: KeyConfig, unit: number): string => {
  const big = unit >= 70;
  const mid = unit >= 46;
  if (key.label.length === 1) return big ? 'text-xl font-semibold' : mid ? 'text-base font-semibold' : 'text-sm font-semibold';
  return big ? 'text-base font-semibold' : mid ? 'text-sm font-semibold' : 'text-xs font-semibold';
};

export const Keyboard: React.FC<KeyboardProps> = ({
  targetKey,
  activeFinger,
  pressedKeys,
  wrongKeyCode,
  isShiftTarget,
  isBackspaceTarget,
  isEnterTarget,
  isCapsOffTarget = false,
  targetPressNumber = 1,
  targetPressTotal = 1,
  onKeyClick,
  handsOverlayEnabled,
  handsVisible,
  handsOpacity,
  handsStyle,
  showFingerDots = true,
  theme,
  onOpenThemeModal,
  isCompactHeight = false,
  maxUnitSize,
  suggestedKeyHeight,
  capsLockOn: capsLockOnProp,
  onToggleCapsLock,
  symbolGuideInfo,
}) => {
  const activeTheme = theme || DEFAULT_KEYBOARD_THEME;
  // CHẾ ĐỘ BÀN TAY HƯỚNG DẪN: chỉ hiện khối phím chính, phím to, phẳng, sáng màu để
  // ngón tay mô phỏng đặt lên rõ ràng (học sinh nhìn thấy ngón nào đi tới phím nào)
  const guideMode = handsOverlayEnabled;
  // Bàn 108 phím cũng hiện được bàn tay: lớp bàn tay nằm trong khu vực chính nên chỉ vẽ trên vùng đó
  const showHands = handsVisible ?? handsOverlayEnabled;
  // Phím Shift cần giữ theo quy tắc tay đối diện: phím do tay phải bấm -> Shift trái và ngược lại
  const guideShiftCode =
    symbolGuideInfo?.targetShiftCodes?.[0] ??
    (targetKey?.finger?.startsWith('right') ? 'ShiftLeft' : 'ShiftRight');
  const isKeyPressed = (code: string) => pressedKeys.has(code);

  // Keyboard LED statuses
  const [internalCapsLockActive, setInternalCapsLockActive] = useState<boolean>(false);
  const [numLockActive, setNumLockActive] = useState<boolean>(true);
  const [scrollLockActive, setScrollLockActive] = useState<boolean>(false);

  const capsLockActive = capsLockOnProp !== undefined ? capsLockOnProp : internalCapsLockActive;

  // Container ref to dynamically compute unit size ensuring true 1:1 keycap proportions
  const containerRef = useRef<HTMLDivElement>(null);
  const [unitSize, setUnitSize] = useState<number>(40);
  const [keyHeight, setKeyHeight] = useState<number>(46);
  // Chiều cao phím theo công thức (trần khi nâng lại); fitPassRef: đếm số lần căn để chống lặp
  const baseKeyHeightRef = useRef<number>(46);
  const fitPassRef = useRef(0);
  // Tăng mỗi lần tính lại kích thước: buộc bước "căn cho vừa khung" chạy lại kể cả khi số đo phím không đổi
  const [fitTick, setFitTick] = useState(0);

  // Tự động tính toán kích thước phím (U) theo chiều ngang container & chiều cao viewport
  // Mở rộng chiều cao các phím to rõ, trực quan, loại bỏ khoảng trống thừa và vừa khít màn hình 1366x768
  useEffect(() => {
    if (!containerRef.current) return;
    const calculateSize = () => {
      if (!containerRef.current) return;
      fitPassRef.current = 0;
      setFitTick((t) => t + 1);
      const width = containerRef.current.clientWidth;
      if (width <= 0) return;

      // Outer frame and plate padding (~16px total, or ~10px in compact mode)
      const framePadding = isCompactHeight ? 10 : 16;
      const availableWidth = Math.max(300, width - framePadding);

      if (guideMode) {
        // Chỉ khối phím chính (15U + 14 khe): phím rộng theo bề ngang, cao bằng ~0,78 bề rộng như phím thật nhìn từ trên
        const vhG = window.innerHeight || 768;
        const rectG = containerRef.current.getBoundingClientRect();
        const topG = rectG.top > 0 ? rectG.top : 330;
        const availH = Math.max(150, vhG - topG - (isCompactHeight ? 14 : 18));
        const unitByW = Math.floor((availableWidth - 8 - 14 * 4) / 15);
        const keyHByH = Math.floor((availH - 22 - 4 * 6) / 5);
        const u = Math.max(26, Math.min(120, unitByW));
        setUnitSize(u);
        baseKeyHeightRef.current = Math.max(26, Math.min(96, Math.round(u * 0.78), keyHByH));
        setKeyHeight(baseKeyHeightRef.current);
        return;
      }
      // Total keyboard width: 22.7 * unitSize + 76px
      const fitUnitByWidth = Math.floor((availableWidth - 76) / 22.7);

      // Measure available height in viewport
      const vh = window.innerHeight || 768;
      const rect = containerRef.current.getBoundingClientRect();
      const topOffset = rect.top > 0 ? rect.top : (isCompactHeight ? 280 : 330);
      // Reserve 20px for bottom safety margin & footer
      const maxKeyboardAvailableHeight = Math.max(160, vh - topOffset - (isCompactHeight ? 16 : 20));

      // Keyboard key rows height: fnKey (0.76) + 5 rows + gaps & margins
      // Total height = 5.76 * unitSize + fnRowBottomMargin(8) + 4 * gapY(22) + frame/plate padding (~16) + led bar (~24)
      const verticalExtras = 70;
      const fitUnitByHeight = Math.floor((maxKeyboardAvailableHeight - verticalExtras) / 5.76);

      let finalUnit = fitUnitByWidth;
      if (fitUnitByHeight > 0 && fitUnitByHeight < fitUnitByWidth) {
        finalUnit = fitUnitByHeight;
      }

      if (maxUnitSize && maxUnitSize < finalUnit) {
        finalUnit = maxUnitSize;
      }

      finalUnit = Math.max(22, Math.min(64, finalUnit));
      setUnitSize(finalUnit);

      // Mở rộng chiều cao phím: tăng thêm ~12-16% so với unitSize khi còn đủ chỗ
      const maxKeyHeightAllowed = Math.floor((maxKeyboardAvailableHeight - verticalExtras) / 5.76);
      let computedHeight = finalUnit;
      if (maxKeyHeightAllowed > finalUnit && !isCompactHeight) {
        computedHeight = Math.min(Math.round(finalUnit * 1.15), maxKeyHeightAllowed);
      } else if (maxKeyHeightAllowed > 0) {
        computedHeight = Math.min(finalUnit, maxKeyHeightAllowed);
      }

      if (suggestedKeyHeight && suggestedKeyHeight > 0) {
        computedHeight = Math.min(computedHeight, suggestedKeyHeight);
      }

      baseKeyHeightRef.current = Math.max(22, Math.min(68, computedHeight));
      setKeyHeight(baseKeyHeightRef.current);
    };

    calculateSize();
    // Chỉ tính lại khi BỀ NGANG bàn phím đổi, hoặc khi KHUNG CHỨA (section) đổi kích thước.
    // Không tính lại theo chiều cao của chính bàn phím: bước "thu cho vừa khung" bên dưới
    // làm bàn phím thấp đi, nếu tính lại theo đó sẽ phóng – thu lặp mãi.
    let lastW = containerRef.current.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth ?? 0;
      if (w !== lastW) {
        lastW = w;
        calculateSize();
      }
    });
    ro.observe(containerRef.current);
    const host = containerRef.current.parentElement;
    let lastHostH = host?.clientHeight ?? 0;
    const roHost = new ResizeObserver(() => {
      const h = host?.clientHeight ?? 0;
      if (Math.abs(h - lastHostH) > 1) {
        lastHostH = h;
        calculateSize();
      }
    });
    if (host) roHost.observe(host);
    window.addEventListener('resize', calculateSize);
    return () => {
      ro.disconnect();
      roHost.disconnect();
      window.removeEventListener('resize', calculateSize);
    };
  }, [isCompactHeight, maxUnitSize, suggestedKeyHeight, guideMode]);

  // LUÔN HIỆN ĐỦ BÀN PHÍM: sau khi vẽ, đo bàn phím thật so với khung còn trống (section bao ngoài).
  // Ước lượng theo chiều cao cửa sổ ở trên không biết dải "Mẹo nhỏ", thanh bài giao, ảnh SGK…
  // nên có khi hàng Ctrl/Space bị che. Bị tràn bao nhiêu thì hạ chiều cao phím bấy nhiêu.
  useEffect(() => {
    // Phím có hiệu ứng đổi cỡ (transition) nên đo NGAY sẽ ra chiều cao cũ -> thu quá tay.
    // Đợi hiệu ứng chạy xong (~150ms) rồi mới đo.
    const timer = window.setTimeout(() => {
      const el = containerRef.current;
      const host = el?.parentElement;
      if (!el || !host) return;
      // Màn dọc máy tính bảng: khung cao theo nội dung (không giới hạn) nên không cần thu
      if (parseFloat(getComputedStyle(host).flexGrow || '0') <= 0) return;
      const avail = host.clientHeight;
      // Khung ngoài có overflow nên bị ép bằng khung chứa: đo khung bàn phím bên trong (+ đệm dưới)
      const frame = el.firstElementChild as HTMLElement | null;
      if (!frame) return;
      const need = frame.offsetHeight + parseFloat(getComputedStyle(el).paddingBottom || '0');
      if (avail <= 0) return;
      const rows = guideMode ? 5 : 5.76;
      // Tràn: hạ phím đủ để vừa. Thừa chỗ (do lần trước hạ quá tay): nâng lại, không vượt cỡ chuẩn.
      const delta = need > avail ? -Math.ceil((need - avail) / rows) : Math.floor((avail - need - 2) / rows);
      if (delta === 0) return;
      // Chống lặp: mỗi lần tính lại kích thước chỉ cho căn tối đa 8 lần
      if (fitPassRef.current >= 8) return;
      fitPassRef.current += 1;
      setKeyHeight((kh) => {
        const next = Math.max(20, Math.min(baseKeyHeightRef.current, kh + delta));
        return next === kh ? kh : next;
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [keyHeight, unitSize, guideMode, isCompactHeight, fitTick]);

  useEffect(() => {
    const handleKeyToggle = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setInternalCapsLockActive(e.getModifierState('CapsLock'));
        setNumLockActive(e.getModifierState('NumLock'));
        setScrollLockActive(e.getModifierState('ScrollLock'));
      }
    };
    window.addEventListener('keydown', handleKeyToggle);
    window.addEventListener('keyup', handleKeyToggle);
    return () => {
      window.removeEventListener('keydown', handleKeyToggle);
      window.removeEventListener('keyup', handleKeyToggle);
    };
  }, []);

  // Proportional dimensional constants & Row Spacing
  // 1. Khoảng cách ngang giữa các phím trong cùng hàng (Horizontal Key Gap)
  const gapX = guideMode ? 4 : 3.5;
  // 2. Giãn nhẹ khoảng cách chiều dọc giữa các hàng phím (Vertical Row Gap: 5.5px)
  // Tạo sự thoáng đãng, chống dính hàng phím, giúp học sinh nhìn rõ từng hàng phím
  const gapY = guideMode ? 6 : 5.5;
  // 3. Khoảng cách cách biệt giữa hàng Function (F1-F12) và hàng phím số
  const fnRowBottomMargin = 8;
  // 4. Khoảng cách giữa các cụm phím chính, điều hướng và phím số
  const sectionGap = Math.max(12, Math.round(unitSize * 0.35));
  const fnKeyHeight = Math.round(keyHeight * 0.76); // function keys have standard ~0.76 profile height
  const mainKeyHeight = keyHeight; // Keycap height boosted for prominent, easy-to-read presentation

  // Section widths calculated with mathematical precision:
  const mainSectionWidth = 15.0 * unitSize + 14 * gapX;
  const navSectionWidth = 3.0 * unitSize + 2 * gapX;
  const numpadSectionWidth = 4.0 * unitSize + 3 * gapX;
  const totalKeyboardWidth = guideMode
    ? mainSectionWidth
    : mainSectionWidth + sectionGap + navSectionWidth + sectionGap + numpadSectionWidth;


  // Helper tính toán kích thước phông chữ chuẩn xác theo từng loại phím
  // Đảm bảo vừa vặn tuyệt đối, không tràn viền hay đè phím lân cận trên mọi độ phân giải (kể cả 1366x768)
  const getKeyTypographyClass = (key: KeyConfig, height: number): string => {
    const code = key.code;
    const label = key.label;

    // 1. Hàng phím chức năng trên cùng (Function Row F1-F12, Esc, Sys keys, Numpad top multimedia)
    if (code === 'Escape') {
      return 'text-[9px] sm:text-[10px] font-bold leading-none tracking-tight';
    }
    if (/^F\d+$/.test(code)) {
      // F1 đến F12: giữ phông chữ gọn gàng để các phím 2 chữ số (F10, F11, F12) không bao giờ bị tràn viền 1U
      return 'text-[8.5px] sm:text-[9.5px] md:text-[10px] font-bold leading-none tracking-tight';
    }
    if (['PrintScreen', 'ScrollLock', 'Pause'].includes(code)) {
      return 'text-[8px] sm:text-[8.5px] font-bold leading-none tracking-tight';
    }
    if (['VolumeMute', 'VolumeDown', 'VolumeUp', 'Calculator'].includes(code)) {
      return 'text-[9px] sm:text-[10px] leading-none';
    }

    // 2. Các phím chức năng / modifier có nhãn văn bản dài
    if (code === 'Backspace') {
      return 'text-[8.5px] sm:text-[9.5px] md:text-[10.5px] font-bold leading-none tracking-tight truncate max-w-full px-0.5';
    }
    if (code === 'CapsLock') {
      return 'text-[8px] sm:text-[9px] md:text-[9.5px] font-bold leading-none tracking-tight truncate max-w-full px-0.5';
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight') {
      return 'text-[9px] sm:text-[10px] md:text-[10.5px] font-bold leading-none tracking-tight truncate max-w-full px-0.5';
    }
    if (code === 'Enter') {
      return 'text-[9px] sm:text-[10px] md:text-[10.5px] font-bold leading-none tracking-tight truncate max-w-full px-0.5';
    }
    if (code === 'NumpadEnter') {
      // Phím Enter trên Numpad chỉ rộng 1.0U -> phông nhỏ gọn để không chạm biên
      return 'text-[8px] sm:text-[8.5px] font-bold leading-tight tracking-tight text-center px-0.5 truncate max-w-full';
    }
    if (code === 'Tab') {
      return 'text-[9px] sm:text-[10px] md:text-[10.5px] font-bold leading-none tracking-tight';
    }
    if (code === 'Space') {
      return 'text-[9.5px] sm:text-[11px] font-semibold leading-none tracking-wider text-slate-300 truncate px-2';
    }
    if (code === 'ControlLeft' || code === 'ControlRight') {
      return 'text-[8.5px] sm:text-[9.5px] font-bold leading-none';
    }
    if (code === 'AltLeft' || code === 'AltRight') {
      return 'text-[8.5px] sm:text-[9.5px] font-bold leading-none';
    }
    if (code === 'MetaLeft' || code === 'MetaRight' || code === 'ContextMenu') {
      return 'text-[8px] sm:text-[9px] font-bold leading-none';
    }
    if (['Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(code)) {
      return 'text-[8px] sm:text-[9px] font-bold leading-none';
    }
    if (code === 'NumLock') {
      return 'text-[8px] sm:text-[8.5px] font-bold leading-tight text-center';
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      return 'text-[11px] sm:text-xs font-bold leading-none';
    }

    // 3. Các phím có ký tự phụ (hàng phím số 1..0, dấu ` ~ , . / ; ' [ ] \ )
    if (key.subLabel) {
      if (height >= 50) return 'mt-1 text-[11px] sm:text-xs font-bold leading-none';
      if (height >= 40) return 'mt-0.5 text-[10px] sm:text-[11px] font-bold leading-none';
      return 'mt-0.5 text-[9.5px] sm:text-[10px] font-bold leading-none';
    }

    // 4. Các phím chữ cái thông thường (A-Z)
    if (label.length === 1) {
      if (height >= 50) return 'text-xs sm:text-sm md:text-base font-bold leading-none tracking-tight';
      if (height >= 40) return 'text-[11px] sm:text-xs md:text-sm font-bold leading-none tracking-tight';
      return 'text-[10.5px] sm:text-[11.5px] font-bold leading-none tracking-tight';
    }

    // Mặc định cho các phím khác
    return 'text-[8.5px] sm:text-[9.5px] font-bold leading-none truncate max-w-full px-0.5';
  };

  // Render individual keycap with true real-world aspect ratios
  const renderKey = (
    key?: KeyConfig,
    customHeight: number = mainKeyHeight,
    options?: {
      overrideWidth?: number;
      customStyle?: React.CSSProperties;
    }
  ) => {
    if (!key) return null;

    const fingerInfo = FINGER_DATA[key.finger];
    const isDualShiftKey = !!(symbolGuideInfo && symbolGuideInfo.targetShiftCodes.includes(key.code));
    const isDualBaseKey = !!(symbolGuideInfo && symbolGuideInfo.baseKeyCode === key.code);

    let isTarget = targetKey?.code === key.code;
    let targetLabelText = 'BẤM ĐÂY ⬇';
    let targetBgColor: string | undefined = undefined;

    // Special Target Overrides for Shift, Backspace, Enter, Symbol Dual-Key Highlighting
    if (isBackspaceTarget && key.code === 'Backspace') {
      isTarget = true;
      targetLabelText = 'XÓA LÙI ⌫';
      targetBgColor = '#f59e0b'; // Amber
    } else if (isEnterTarget && (key.code === 'Enter' || key.code === 'NumpadEnter')) {
      isTarget = true;
      targetLabelText = 'XUỐNG DÒNG ↵';
      targetBgColor = '#10b981'; // Emerald
    } else if (symbolGuideInfo) {
      // CƠ CHẾ DUAL-KEY HIGHLIGHTING ĐỒNG THỜI CHO KÝ TỰ ĐẶC BIỆT KẾT HỢP SHIFT
      if (isDualShiftKey) {
        isTarget = true;
        targetLabelText = symbolGuideInfo.shiftLabel;
        targetBgColor = '#ec4899'; // Pink/Fuchsia rực rỡ
      } else if (isDualBaseKey) {
        isTarget = true;
        targetLabelText = symbolGuideInfo.baseKeyBadge;
        targetBgColor = fingerInfo ? fingerInfo.color : '#0284c7';
      }
      // Lưu ý: CapsLock không tác dụng với ký tự đặc biệt hàng phím số nên không highlight CapsLock
    } else if (isShiftTarget && (key.code === 'ShiftLeft' || key.code === 'ShiftRight') && (!guideMode || key.code === guideShiftCode)) {
      // Chế độ hướng dẫn: chỉ tô phím Shift TAY ĐỐI DIỆN (khớp với ngón út đang giữ Shift)
      isTarget = true;
      targetLabelText = 'GIỮ SHIFT ⇧';
      targetBgColor = '#ec4899'; // Pink
    } else if (isShiftTarget && key.code === 'CapsLock') {
      isTarget = true;
      targetLabelText = 'HOẶC CAPS ⇪';
      targetBgColor = '#8b5cf6'; // Violet
    } else if (isCapsOffTarget && key.code === 'CapsLock') {
      isTarget = true;
      targetLabelText = 'TẮT CAPS ⇪';
      targetBgColor = '#f43f5e'; // Rose
    } else if (isTarget && (key.code === 'Comma' || key.code === 'Period' || key.code === 'Semicolon' || key.code === 'Slash' || key.code === 'Quote' || key.code === 'Minus' || key.code === 'Equal')) {
      targetLabelText = `GÕ [ ${key.label} ] ⬇`;
      targetBgColor = fingerInfo ? fingerInfo.color : '#0284c7';
    }

    // Phím phải gõ liên tiếp nhiều lần (Telex dd/oo/aa/ee): ghi rõ lần bấm
    const isRepeatTarget = isTarget && key.code === targetKey?.code && targetPressTotal >= 2;
    if (isRepeatTarget && !guideMode) {
      targetLabelText = `LẦN ${targetPressNumber}/${targetPressTotal} ⬇`;
      if (targetPressNumber >= 2) targetBgColor = '#f97316';
    }

    const isWrong = wrongKeyCode === key.code;
    const isPressed = isKeyPressed(key.code);
    const isBlueCap = key.type === 'modifier';

    // Skin theme specific keycap classes
    const themeKeycapClass = guideMode
      ? GUIDE_KEYCAP_CLASS
      : isBlueCap
      ? activeTheme.modifierKeycapClass
      : activeTheme.alphaKeycapClass;

    // Dynamic style when key is target
    if (isTarget && !targetBgColor) {
      targetBgColor = fingerInfo ? fingerInfo.color : activeTheme.themeColor;
    }

    // Chế độ hướng dẫn: phím cần bấm tô xanh lá, phím Shift cần giữ tô hồng (đồng bộ với viền ngón tay)
    const guideTargetBg = isDualShiftKey || (isShiftTarget && (key.code === 'ShiftLeft' || key.code === 'ShiftRight'))
      ? '#f9a8d4'
      : key.code === 'CapsLock'
      ? '#c4b5fd' // Caps Lock cần bấm để tắt chữ hoa
      : isRepeatTarget && targetPressNumber >= 2
      ? '#fb923c' // lần bấm thứ 2 cùng một phím: đổi sang màu cam
      : '#34c759';
    const targetStyle = isTarget
      ? guideMode
        ? key.code === 'CapsLock' && !isCapsOffTarget
          ? undefined // chỉ tô Caps Lock khi cần bấm để tắt chữ hoa; chữ hoa thông thường dùng Shift tay đối diện
          : // backgroundImage: none -> bỏ lớp nền chuyển sắc của phím, nếu không màu xanh/hồng bị che mất
            { backgroundColor: guideTargetBg, backgroundImage: 'none', color: '#0f172a', borderColor: '#4f5fc9' }
        : {
            backgroundColor: targetBgColor,
            color: '#ffffff',
            borderColor: '#ffffff',
          }
      : undefined;

    const shapeRadiusClass = guideMode
      ? 'rounded-[3px]'
      : activeTheme.keycapShape === 'round'
      ? 'rounded-full'
      : activeTheme.keycapShape === 'chiclet'
      ? 'rounded-md'
      : 'rounded-xl';

    // Authentic key width based on unitRatio
    // If widthRatio = 1: width = unitSize
    // If widthRatio = N: width = N * unitSize + (N - 1) * gapX
    const keyWidth = options?.overrideWidth ?? Math.round(key.widthRatio * unitSize + (key.widthRatio - 1) * gapX);
    const isEsc = key.code === 'Escape';

    const styleObj: React.CSSProperties = {
      width: `${keyWidth}px`,
      minWidth: `${keyWidth}px`,
      maxWidth: `${keyWidth}px`,
      height: `${customHeight}px`,
      minHeight: `${customHeight}px`,
      flexShrink: 0,
      flexGrow: 0,
      ...targetStyle,
      ...options?.customStyle,
    };

    return (
      <button
        key={key.code}
        type="button"
        onClick={() => {
          if (key.code === 'CapsLock') {
            setInternalCapsLockActive((prev) => !prev);
            onToggleCapsLock?.();
          } else if (key.code === 'NumLock') {
            setNumLockActive((prev) => !prev);
          }
          onKeyClick?.(key);
        }}
        style={styleObj}
        // Lớp bàn tay đọc 2 thuộc tính này để biết tâm phím và ngón phụ trách
        data-key-code={key.code}
        data-finger={key.finger}
        className={`
          relative select-none ${shapeRadiusClass} flex flex-col items-center justify-center p-0.5
          font-bold text-[10px] sm:text-xs tracking-tight transition-all duration-75 cursor-pointer
          ${isWrong ? 'key-wrong-shake' : isTarget ? (guideMode ? GUIDE_KEYCAP_CLASS : 'key-target-pop') : themeKeycapClass}
          ${isPressed && !isTarget ? 'key-pressed' : ''}
          ${isEsc ? 'ring-1 ring-black/15 font-black text-rose-300' : ''}
          ${key.code === 'CapsLock' && capsLockActive ? 'ring-2 ring-amber-400 bg-amber-950/80' : ''}
          ${key.code === 'NumLock' && numLockActive ? 'ring-2 ring-emerald-400 bg-emerald-950/80' : ''}
          ${!guideMode && isDualShiftKey ? 'ring-4 ring-pink-400 shadow-[0_0_24px_rgba(236,72,153,0.95)] animate-pulse z-30' : ''}
          ${!guideMode && isDualBaseKey ? 'ring-4 ring-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.95)] z-30' : ''}
          ${guideMode ? '' : 'hover:scale-102 hover:brightness-105'}
        `}
        title={`Phím ${key.label}: ${fingerInfo ? fingerInfo.nameVi : ''} (${fingerInfo?.hand === 'left' ? 'Bàn tay trái' : 'Bàn tay phải'})`}
      >
        {/* Đèn LED chỉ báo phần cứng ngay trên phím Caps Lock */}
        {key.code === 'CapsLock' && (
          <div
            className={`absolute top-0.5 right-1 flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-black font-mono transition-all ${
              capsLockActive
                ? 'bg-amber-400 text-slate-950 shadow-[0_0_6px_#fbbf24] animate-pulse ring-1 ring-amber-300'
                : 'bg-slate-700/60 text-slate-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${capsLockActive ? 'bg-amber-900' : 'bg-slate-500'}`} />
            <span>{capsLockActive ? 'ON' : 'OFF'}</span>
          </div>
        )}

        {/* Đèn LED chỉ báo phần cứng ngay trên phím Num Lock */}
        {key.code === 'NumLock' && (
          <div
            className={`absolute top-0.5 right-1 flex items-center gap-0.5 px-1 py-0.2 rounded text-[7px] font-black font-mono transition-all ${
              numLockActive
                ? 'bg-emerald-400 text-slate-950 shadow-[0_0_6px_#34d399] ring-1 ring-emerald-300'
                : 'bg-slate-700/60 text-slate-400'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${numLockActive ? 'bg-emerald-900' : 'bg-slate-500'}`} />
            <span>{numLockActive ? 'ON' : 'OFF'}</span>
          </div>
        )}

        {/* Animated Bouncing Pointer Arrow on Target Key */}
        {isTarget && !guideMode && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none animate-guide-arrow z-40 whitespace-nowrap">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black font-sans shadow-lg transition-all ${
              isDualShiftKey
                ? 'text-white bg-pink-600 border-2 border-pink-300 shadow-pink-500/60 ring-2 ring-pink-400 animate-pulse'
                : isDualBaseKey
                ? 'text-slate-950 bg-amber-300 border-2 border-amber-400 shadow-amber-500/60 ring-2 ring-amber-300'
                : 'text-slate-950 bg-amber-300 border-2 border-amber-400'
            }`}>
              {targetLabelText}
            </span>
          </div>
        )}

        {guideMode && isTarget && (isRepeatTarget || (isCapsOffTarget && key.code === 'CapsLock')) && (
          <span
            className={`absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-px rounded-full text-[10px] font-black whitespace-nowrap shadow-sm z-40 ${
              key.code === 'CapsLock'
                ? 'bg-violet-600 text-white'
                : targetPressNumber >= 2
                ? 'bg-orange-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {key.code === 'CapsLock' ? 'Tắt Caps' : `Lần ${targetPressNumber}`}
          </span>
        )}

        {/* Wrong Key Badge */}
        {isWrong && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white bg-rose-600 shadow-lg border border-rose-400 font-sans z-40 whitespace-nowrap">
            SAI ❌
          </div>
        )}

        {/* Sub-label */}
        {key.subLabel && (
          <span
            className={`absolute top-0.5 left-1 leading-none font-mono transition-all pointer-events-none ${
              isDualBaseKey
                ? 'text-[9px] sm:text-[10px] font-black text-slate-950 bg-amber-300 px-1 py-0.2 rounded ring-1 ring-amber-400 shadow-xs scale-105'
                : isTarget
                ? 'text-[7.5px] sm:text-[8px] text-white font-bold'
                : 'text-[7.5px] sm:text-[8px] opacity-70'
            }`}
          >
            {key.subLabel}
          </span>
        )}

        {/* Main Key Label - Tối ưu hóa kích thước chữ vừa vặn, không tràn viền */}
        <span
          className={`font-mono-key max-w-full px-0.5 text-center truncate ${
            guideMode
              ? // Viền sáng quanh chữ: chữ trên phím vẫn đọc rõ khi ngón tay ảo đè lên
                `${guideTypography(key, unitSize)} relative z-[36] [text-shadow:0_0_2px_#fff,0_0_4px_#fff,0_0_6px_#fff]`
              : `${getKeyTypographyClass(key, customHeight)}${showHands ? ' relative z-[36]' : ''}`
          } ${
            guideMode
              ? ''
              : isTarget && key.label.length === 1
              ? 'font-black scale-110 drop-shadow-md text-white'
              : isTarget
              ? 'font-black text-white'
              : ''
          }`}
        >
          {key.code === 'NumpadEnter' ? '↵ Enter' : key.label}
        </span>

        {/* Tactile bump for Home keys (F, J and Numpad 5) */}
        {key.isHomeKey && (
          <div
            className={`absolute bottom-0.5 w-3 sm:w-3.5 h-0.5 sm:h-1 rounded-full shadow-inner ${
              isTarget ? 'bg-white ring-1 ring-sky-300' : 'bg-slate-700/60'
            }`}
            title="Gờ định vị ngón tay"
          />
        )}

        {/* Finger color badge dot */}
        {showFingerDots && !guideMode && fingerInfo && key.code !== 'Space' && !isTarget && !isWrong && (
          <div
            className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full border border-black/20"
            style={{ backgroundColor: fingerInfo.color }}
            title={fingerInfo.nameVi}
          />
        )}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="w-full mx-auto overflow-x-auto overflow-y-hidden pb-1 custom-scrollbar">
      {/* Keyboard Outer 3D Playful Frame - Spans 100% full width to eliminate blank gaps */}
      <div
        className={`w-full relative ${
          isCompactHeight ? 'p-1 sm:p-1.5 rounded-xl' : 'p-1.5 sm:p-2 rounded-2xl'
        } shadow-lg transition-all duration-300 ${guideMode ? GUIDE_FRAME_CLASS : activeTheme.outerFrameClass}`}
      >
        {/* Inner Switch Plate with locked real-world physical proportions - Stretches 100% full width */}
        <div
          className={`w-full relative ${
            isCompactHeight ? 'p-1 rounded-lg gap-0.5 sm:gap-1' : 'p-1.5 sm:p-2 rounded-xl gap-1 sm:gap-1.5'
          } flex flex-col transition-all duration-300 ${guideMode ? GUIDE_PLATE_CLASS : activeTheme.plateClass}`}
        >
          {!guideMode && (
          <>
          {/* ========================================================================= */}
          {/* BẢNG ĐÈN LED CHỈ BÁO TRẠNG THÁI: NUM LOCK, CAPS LOCK, SCROLL LOCK          */}
          {/* ========================================================================= */}
          <div
            className="flex items-center justify-between mx-auto px-2.5 py-0.5 rounded-lg bg-slate-950/90 border border-slate-700/80 shadow-inner select-none"
            style={{ width: `${totalKeyboardWidth}px` }}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-mono font-black text-slate-300 tracking-tight">
                BÀN PHÍM THẬT FULL SIZE 108 PHÍM
              </span>
            </div>

            {/* LED Status Indicators */}
            <div className="flex items-center gap-2 text-[10px] font-mono">
              {/* NUM LOCK */}
              <button
                type="button"
                onClick={() => setNumLockActive((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-black transition-all cursor-pointer ${
                  numLockActive
                    ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.35)]'
                    : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-400'
                }`}
                title="Bấm để bật/tắt Num Lock"
              >
                <span className={`w-2 h-2 rounded-full transition-all ${numLockActive ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-slate-600'}`} />
                <span>1 NUM LOCK: {numLockActive ? 'BẬT 🟢' : 'TẮT ⚪'}</span>
              </button>

              {/* CAPS LOCK */}
              <button
                type="button"
                onClick={() => {
                  setInternalCapsLockActive((prev: boolean) => !prev);
                  onToggleCapsLock?.();
                }}
                className={`flex items-center gap-1 px-2 py-0.5 rounded font-black transition-all cursor-pointer ${
                  capsLockActive
                    ? 'bg-amber-950 text-amber-200 border border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] ring-1 ring-amber-400 animate-pulse'
                    : 'bg-slate-900 text-slate-500 border border-slate-800 hover:text-slate-400'
                }`}
                title="Bấm để bật/tắt Caps Lock"
              >
                <span className={`w-2 h-2 rounded-full transition-all ${capsLockActive ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-slate-600'}`} />
                <span>A CAPS LOCK: {capsLockActive ? 'BẬT (IN HOA) 🟡' : 'TẮT ⚪'}</span>
              </button>

              {/* SCROLL LOCK */}
              <div
                className={`hidden md:flex items-center gap-1 px-2 py-0.5 rounded font-black ${
                  scrollLockActive
                    ? 'bg-emerald-950 text-emerald-200 border border-emerald-400/80'
                    : 'bg-slate-900 text-slate-500 border border-slate-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${scrollLockActive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                <span>↓ SCROLL: {scrollLockActive ? 'BẬT' : 'TẮT'}</span>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 1. TOP FUNCTION ROW (ESC, F1-F12, PRTSC/SCRLK/PAUSE, 108TH EXTRA KEYS)     */}
          {/* ========================================================================= */}
          <div
            className="flex items-center justify-center mx-auto"
            style={{
              width: `${totalKeyboardWidth}px`,
              gap: `${sectionGap}px`,
              marginBottom: `${fnRowBottomMargin}px`,
            }}
          >
            {/* Main Alphanumeric Function Row (Esc, F1-F4, F5-F8, F9-F12) */}
            <div
              className="flex items-center justify-between"
              style={{ width: `${mainSectionWidth}px` }}
            >
              {/* ESC Key (1U width, standard function height) */}
              {renderKey(FUNCTION_ROW[0], fnKeyHeight)}

              {/* F1 - F4 Block */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {FUNCTION_ROW.slice(1, 5).map((k) => renderKey(k, fnKeyHeight))}
              </div>

              {/* F5 - F8 Block */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {FUNCTION_ROW.slice(5, 9).map((k) => renderKey(k, fnKeyHeight))}
              </div>

              {/* F9 - F12 Block */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {FUNCTION_ROW.slice(9, 13).map((k) => renderKey(k, fnKeyHeight))}
              </div>
            </div>

            {/* Nav Function Row (PrtSc, ScrLk, Pause) */}
            <div
              className="flex"
              style={{ width: `${navSectionWidth}px`, gap: `${gapX}px` }}
            >
              {SYSTEM_TOP_KEYS.map((k) => renderKey(k, fnKeyHeight))}
            </div>

            {/* Numpad Top Area: 4 phím đa phương tiện (🔇 Tắt tiếng, 🔉 Vol-, 🔊 Vol+, 🖩 Máy tính) => Chuẩn Full Size 108 Phím */}
            <div
              className="flex"
              style={{ width: `${numpadSectionWidth}px`, gap: `${gapX}px` }}
            >
              {NUMPAD_TOP_EXTRA_KEYS.map((k) => renderKey(k, fnKeyHeight))}
            </div>
          </div>

          </>
          )}

          {/* ========================================================================= */}
          {/* 2. MAIN KEYBOARD BODY (Main ANSI 15U + Nav Cluster 3U + Numpad 4U)        */}
          {/* ========================================================================= */}
          <div
            className="flex justify-center items-start mx-auto"
            style={{ width: `${totalKeyboardWidth}px`, gap: `${sectionGap}px` }}
          >
            {/* 1. Main ANSI Alphanumeric Section (15.0 U wide, exactly 5 rows) */}
            {/* Khoảng cách giữa các hàng phím (gapY = 5.5px) được giãn nhẹ tạo sự thoáng đãng */}
            <div
              className="relative flex flex-col"
              style={{ width: `${mainSectionWidth}px`, gap: `${gapY}px` }}
            >
              {KEYBOARD_ROWS.map((row, rIdx) => (
                <div
                  key={`main-row-${rIdx}`}
                  className="flex"
                  style={{ gap: `${gapX}px`, width: `${mainSectionWidth}px` }}
                >
                  {row.map((k) => renderKey(k, mainKeyHeight))}
                </div>
              ))}

              {/* Hands Overlay covering the Main ANSI section perfectly */}
              <KeyHandsOverlay
                visible={showHands}
                opacity={handsOpacity}
                style={handsStyle}
                // Ký hiệu cần Shift (!, @, *...): phím gốc lấy từ bảng ký hiệu
                targetCode={symbolGuideInfo?.baseKeyCode ?? targetKey?.code}
                targetFinger={
                  (symbolGuideInfo ? CODE_TO_KEY_MAP.get(symbolGuideInfo.baseKeyCode)?.finger : undefined) ??
                  targetKey?.finger ??
                  activeFinger
                }
                needShift={!!isShiftTarget || !!symbolGuideInfo}
                shiftCodes={symbolGuideInfo?.targetShiftCodes}
                isBackspace={isBackspaceTarget}
                isEnter={isEnterTarget}
                layoutKey={`${unitSize}-${keyHeight}-${activeTheme.id}`}
                pressedKeys={pressedKeys}
              />
            </div>

            {!guideMode && (
            <>
            {/* 2. Navigation Cluster Section (3.0 U wide, true inverted-T arrows) */}
            <div
              className="flex flex-col justify-between"
              style={{ width: `${navSectionWidth}px`, height: `${5 * mainKeyHeight + 4 * gapY}px` }}
            >
              {/* Row 1: Ins, Home, PgUp */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {NAV_CLUSTER_ROWS[0].map((k) => renderKey(k, mainKeyHeight))}
              </div>

              {/* Row 2: Del, End, PgDn */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {NAV_CLUSTER_ROWS[1].map((k) => renderKey(k, mainKeyHeight))}
              </div>

              {/* Spacer matching authentic keyboard gap */}
              <div className="flex-1" />

              {/* Row 4: Up Arrow Centered */}
              <div className="flex justify-center" style={{ width: `${navSectionWidth}px`, marginBottom: `${gapY}px` }}>
                {NAV_CLUSTER_ROWS[3].map((k) => renderKey(k, mainKeyHeight))}
              </div>

              {/* Row 5: Left, Down, Right */}
              <div className="flex" style={{ gap: `${gapX}px` }}>
                {NAV_CLUSTER_ROWS[4].map((k) => renderKey(k, mainKeyHeight))}
              </div>
            </div>

            {/* 3. Numpad Cluster Section (4.0 U wide, 4 cols x 5 rows standard grid) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(4, ${unitSize}px)`,
                gridTemplateRows: `repeat(5, ${mainKeyHeight}px)`,
                columnGap: `${gapX}px`,
                rowGap: `${gapY}px`,
                width: `${numpadSectionWidth}px`,
              }}
            >
              {/* Row 1: Num, /, *, - */}
              {renderKey(CODE_TO_KEY_MAP.get('NumLock'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadDivide'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadMultiply'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadSubtract'), mainKeyHeight)}

              {/* Row 2: 7, 8, 9, + (spans 2 rows tall) */}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad7'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad8'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad9'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadAdd'), 2 * mainKeyHeight + gapY, {
                customStyle: { gridRow: 'span 2' },
              })}

              {/* Row 3: 4, 5, 6 */}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad4'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad5'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad6'), mainKeyHeight)}

              {/* Row 4: 1, 2, 3, Enter (spans 2 rows tall) */}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad1'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad2'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad3'), mainKeyHeight)}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadEnter'), 2 * mainKeyHeight + gapY, {
                customStyle: { gridRow: 'span 2' },
              })}

              {/* Row 5: 0 (spans 2 cols wide), . */}
              {renderKey(CODE_TO_KEY_MAP.get('Numpad0'), mainKeyHeight, {
                overrideWidth: 2 * unitSize + gapX,
                customStyle: { gridColumn: 'span 2' },
              })}
              {renderKey(CODE_TO_KEY_MAP.get('NumpadDecimal'), mainKeyHeight)}
            </div>
            </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
