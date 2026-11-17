// ============================================================================
// GIẢI PHẪU BÀN PHÍM: tên các HÀNG PHÍM và các KHU VỰC (dùng cho tab "Làm quen bàn phím")
// Lấy thẳng từ sơ đồ bàn phím 108 phím của phần mềm nên luôn khớp với bàn phím trên màn hình.
// ============================================================================
import { KeyConfig } from '../types/typing';
import {
  FUNCTION_ROW,
  KEYBOARD_ROWS,
  NAV_CLUSTER_ROWS,
  NUMPAD_ROWS,
  NUMPAD_TOP_EXTRA_KEYS,
  SYSTEM_TOP_KEYS,
} from './keyboardLayout';

export interface RowInfo {
  id: 'number' | 'top' | 'home' | 'bottom' | 'space';
  name: string;
  short: string;
  rowIndex: number; // vị trí trong KEYBOARD_ROWS (0 = hàng số)
  color: string; // màu tô
  soft: string; // màu nền nhạt
  description: string;
  fingers: string;
}

export const KEYBOARD_ROW_INFO: RowInfo[] = [
  {
    id: 'number',
    name: 'Hàng phím số',
    short: 'Hàng số',
    rowIndex: 0,
    color: '#8b5cf6',
    soft: '#ede9fe',
    description: 'Hàng trên cùng của khu vực chính: các số 1 2 3 … 0 và ký hiệu ! @ # $ % (giữ Shift).',
    fingers: 'Các ngón vươn lên xa nhất từ hàng cơ sở, gõ xong thu tay về ngay.',
  },
  {
    id: 'top',
    name: 'Hàng phím trên',
    short: 'Hàng trên',
    rowIndex: 1,
    color: '#0ea5e9',
    soft: '#e0f2fe',
    description: 'Hàng ngay trên hàng cơ sở: Q W E R T Y U I O P và [ ].',
    fingers: 'Mỗi ngón vươn lên một chút từ phím nhà của mình.',
  },
  {
    id: 'home',
    name: 'Hàng phím cơ sở',
    short: 'Hàng cơ sở',
    rowIndex: 2,
    color: '#16a34a',
    soft: '#dcfce7',
    description: 'Hàng quan trọng nhất: A S D F G H J K L ;. Phím F và J có gờ nổi để tìm bằng tay, không cần nhìn.',
    fingers: '8 ngón đặt sẵn ở đây (A S D F – J K L ;), gõ phím nào xong cũng quay về hàng này.',
  },
  {
    id: 'bottom',
    name: 'Hàng phím dưới',
    short: 'Hàng dưới',
    rowIndex: 3,
    color: '#f59e0b',
    soft: '#fef3c7',
    description: 'Hàng dưới hàng cơ sở: Z X C V B N M , . / và hai phím Shift.',
    fingers: 'Các ngón co xuống một chút; ngón út giữ Shift để gõ chữ hoa.',
  },
  {
    id: 'space',
    name: 'Hàng phím chứa phím cách',
    short: 'Hàng chứa phím cách',
    rowIndex: 4,
    color: '#ec4899',
    soft: '#fce7f3',
    description: 'Hàng dưới cùng: phím cách (Space) dài nhất ở giữa, hai bên là Ctrl, Win, Alt.',
    fingers: 'Hai ngón cái đặt hờ trên phím cách để gõ dấu cách giữa các từ.',
  },
];

export interface ZoneInfo {
  id: 'function' | 'main' | 'nav' | 'numpad';
  name: string;
  color: string;
  soft: string;
  description: string;
  keys: KeyConfig[];
}

const flat = (rows: KeyConfig[][]) => rows.flat();

export const KEYBOARD_ZONES: ZoneInfo[] = [
  {
    id: 'function',
    name: 'Khu vực phím chức năng',
    color: '#ef4444',
    soft: '#fee2e2',
    description: 'Hàng trên cùng: Esc, F1 … F12 và các phím đặc biệt. Dùng để ra lệnh nhanh (ví dụ F5 tải lại trang), không dùng để gõ chữ.',
    keys: [...FUNCTION_ROW, ...SYSTEM_TOP_KEYS, ...NUMPAD_TOP_EXTRA_KEYS],
  },
  {
    id: 'main',
    name: 'Khu vực phím chính (gõ chữ)',
    color: '#16a34a',
    soft: '#dcfce7',
    description: 'Khu vực lớn nhất, gồm 5 hàng phím chữ, số và dấu. Luyện gõ 10 ngón chủ yếu ở khu vực này.',
    keys: flat(KEYBOARD_ROWS),
  },
  {
    id: 'nav',
    name: 'Khu vực phím điều khiển & mũi tên',
    color: '#0ea5e9',
    soft: '#e0f2fe',
    description: 'Insert, Delete, Home, End, Page Up/Down và 4 phím mũi tên ← ↑ → ↓ để di chuyển con trỏ.',
    keys: flat(NAV_CLUSTER_ROWS),
  },
  {
    id: 'numpad',
    name: 'Bàn phím phụ (phím số)',
    color: '#8b5cf6',
    soft: '#ede9fe',
    description: 'Cụm phím số bên phải, xếp như máy tính bỏ túi, giúp gõ số nhanh bằng một tay. Phím 5 có gờ nổi.',
    keys: flat(NUMPAD_ROWS),
  },
];

/** Khu vực chứa phím `code` (dùng để tô màu bàn phím mẫu) */
export function zoneOf(code: string): ZoneInfo | undefined {
  return KEYBOARD_ZONES.find((z) => z.keys.some((k) => k.code === code));
}

/** Hàng phím (trong khu vực chính) chứa phím `code` */
export function rowOf(code: string): RowInfo | undefined {
  const idx = KEYBOARD_ROWS.findIndex((row) => row.some((k) => k.code === code));
  return idx < 0 ? undefined : KEYBOARD_ROW_INFO.find((r) => r.rowIndex === idx);
}
