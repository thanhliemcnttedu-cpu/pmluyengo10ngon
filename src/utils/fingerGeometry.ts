// ============================================================================
// HÌNH HỌC BÀN TAY BÁM PHÍM THẬT (phương án B)
// Mỗi ngón tay như một chiếc com-pa: GỐC ngón cố định phía dưới bàn phím,
// ĐẦU ngón đặt đúng tâm phím. Muốn bấm phím khác thì ngón xoay quanh gốc và
// duỗi dài/co ngắn tới tâm phím đó. Tọa độ phím đo trực tiếp trên giao diện,
// nên luôn khớp mọi cỡ màn hình và mọi chủ đề bàn phím.
// Tệp này thuần tính toán (không React) để test tự động được.
// ============================================================================
import { FingerId } from '../types/typing';

export interface KeyRect {
  x: number; // mép trái, tính trong khung khối phím chính
  y: number; // mép trên
  w: number;
  h: number;
}
export type KeyRectMap = Record<string, KeyRect>;
export interface Point {
  x: number;
  y: number;
}

export const ALL_FINGERS: FingerId[] = [
  'left-pinky',
  'left-ring',
  'left-middle',
  'left-index',
  'left-thumb',
  'right-thumb',
  'right-index',
  'right-middle',
  'right-ring',
  'right-pinky',
];

// Phím "nhà" của từng ngón trên hàng cơ sở (ngón cái đặt trên Space)
export const HOME_KEY: Record<FingerId, string> = {
  'left-pinky': 'KeyA',
  'left-ring': 'KeyS',
  'left-middle': 'KeyD',
  'left-index': 'KeyF',
  'left-thumb': 'Space',
  'right-thumb': 'Space',
  'right-index': 'KeyJ',
  'right-middle': 'KeyK',
  'right-ring': 'KeyL',
  'right-pinky': 'Semicolon',
};

// Độ rộng ngón so với bề rộng 1 phím (ngón tay trẻ em đặt trên phím thật rộng khoảng 0,5–0,6 phím).
// Ngón cái nhìn từ trên xuống là cạnh bên nên mảnh hơn ngón trỏ.
const WIDTH_RATIO: Record<FingerId, number> = {
  'left-pinky': 0.5,
  'left-ring': 0.56,
  'left-middle': 0.6,
  'left-index': 0.6,
  'left-thumb': 0.6,
  'right-thumb': 0.6,
  'right-index': 0.6,
  'right-middle': 0.6,
  'right-ring': 0.56,
  'right-pinky': 0.5,
};

// Chiều dài đốt ngón so với ngón giữa (ngón út có đốt ngắn nhất)
export const PHALANX_SCALE: Record<FingerId, number> = {
  'left-pinky': 0.82,
  'left-ring': 0.95,
  'left-middle': 1,
  'left-index': 0.95,
  'left-thumb': 1,
  'right-thumb': 1,
  'right-index': 0.95,
  'right-middle': 1,
  'right-ring': 0.95,
  'right-pinky': 0.82,
};

// Gốc ngón lệch ra ngoài so với phím nhà (tính theo bề rộng phím): bàn tay đặt chéo,
// các ngón chụm vào giữa giống tay thật khi đặt lên hàng cơ sở
// (giữ nhỏ: gốc lệch xa sẽ khiến ngón với vào trong phải chạy chéo qua ngón bên cạnh -> trông như đan chéo)
const BASE_SPREAD: Record<FingerId, number> = {
  'left-pinky': 0.38,
  'left-ring': 0.28,
  'left-middle': 0.2,
  'left-index': 0.12,
  'left-thumb': 0,
  'right-thumb': 0,
  'right-index': 0.12,
  'right-middle': 0.2,
  'right-ring': 0.28,
  'right-pinky': 0.38,
};

export const isThumb = (f: FingerId) => f === 'left-thumb' || f === 'right-thumb';

export const handOf = (f: FingerId): 'left' | 'right' => (f.startsWith('left') ? 'left' : 'right');

export const center = (r: KeyRect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// Đầu ngón đặt hơi cao hơn tâm phím một chút cho giống tay thật (móng chạm nửa trên phím)
export const tipOnKey = (r: KeyRect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h * 0.42 });

/** Bề rộng một phím chuẩn (1U), lấy từ phím A; thiếu thì ước lượng theo khung. */
export function unitWidth(rects: KeyRectMap, frameWidth: number): number {
  return rects.KeyA?.w || rects.KeyJ?.w || frameWidth / 15;
}

/** Vị trí đầu ngón khi đặt ở hàng cơ sở. */
export function homeTip(finger: FingerId, rects: KeyRectMap): Point | null {
  if (finger === 'left-thumb' || finger === 'right-thumb') {
    const sp = rects.Space;
    if (!sp) return null;
    // Hai ngón cái đặt nghiêng cạnh trên Space, phía trong ngón trỏ, đầu ngón hướng vào giữa (không chạm nhau)
    const ratio = finger === 'left-thumb' ? 0.43 : 0.57;
    // Đầu ngón cái ở nửa trên phím cách: phần ngón cái lộ ra đủ dài để học sinh nhận ra
    return { x: sp.x + sp.w * ratio, y: sp.y + sp.h * 0.4 };
  }
  const r = rects[HOME_KEY[finger]];
  return r ? tipOnKey(r) : null;
}

/** Khoảng cách giữa hai hàng phím (đo từ phím Q xuống phím A). */
export function rowPitch(rects: KeyRectMap, frameWidth: number): number {
  if (rects.KeyQ && rects.KeyA) return rects.KeyA.y - rects.KeyQ.y;
  return unitWidth(rects, frameWidth);
}

/** Gốc ngón (khớp bàn – ngón) cố định phía dưới mép bàn phím, lệch ra ngoài so với phím nhà. */
export function fingerBase(finger: FingerId, rects: KeyRectMap, frame: { w: number; h: number }): Point | null {
  const u = unitWidth(rects, frame.w);
  const pitch = rowPitch(rects, frame.w);
  const home = homeTip(finger, rects);
  if (!home) return null;
  const side = handOf(finger) === 'left' ? -1 : 1;
  if (isThumb(finger)) {
    // Ngón cái là ngón TRONG CÙNG: mọc từ dưới lòng bàn tay, nằm phía trong ngón trỏ, chếch lên ~45 độ.
    // (Gốc đặt xa ra ngoài sẽ khiến ngón cái cắt ngang thân ngón trỏ -> trông như đan chéo)
    return { x: home.x + side * 1.0 * u, y: frame.h + pitch * 0.35 };
  }
  // Khớp ngón nằm dưới mép bàn phím, gần như thẳng hàng dưới phím nhà
  return { x: home.x + side * BASE_SPREAD[finger] * u, y: frame.h + pitch * 1.1 };
}

function avgX(rects: KeyRectMap, codes: string[]): number | null {
  const xs = codes.map((c) => rects[c]).filter(Boolean).map((r) => r!.x + r!.w / 2);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

export function fingerWidth(finger: FingerId, rects: KeyRectMap, frameWidth: number): number {
  return unitWidth(rects, frameWidth) * WIDTH_RATIO[finger];
}

// ----------------------------------------------------------------------------
// NGÓN NÀO LÀM VIỆC VỚI PHÍM NÀO
// ----------------------------------------------------------------------------
export interface HandTargetInput {
  targetCode?: string; // phím đích hiện tại (KeyboardEvent.code)
  targetFinger?: FingerId; // ngón phụ trách phím đích
  needShift?: boolean; // chữ hoa / ký hiệu cần Shift
  shiftCodes?: string[]; // phím Shift cụ thể (từ bảng ký hiệu), nếu có
  isBackspace?: boolean; // đang gõ sai -> phải xóa lùi
  isEnter?: boolean; // xuống dòng
}

export interface FingerAssignment {
  finger: FingerId;
  code: string; // phím ngón này phải bấm
  role: 'main' | 'shift' | 'thumb';
}

/**
 * Trả về danh sách ngón cần cử động.
 * - Gõ sai: ngón út phải với tới Backspace (dạy cách sửa lỗi).
 * - Enter: ngón út phải.
 * - Space: cả hai ngón cái cùng nhấn.
 * - Chữ hoa / ký hiệu: ngón chính bấm phím + ngón út TAY ĐỐI DIỆN giữ Shift.
 * Phím nằm ngoài khối phím chính (cụm số Numpad, phím điều hướng) -> không vẽ vươn ngón.
 */
export function assignFingers(input: HandTargetInput, available: (code: string) => boolean): FingerAssignment[] {
  if (input.isBackspace) {
    return available('Backspace') ? [{ finger: 'right-pinky', code: 'Backspace', role: 'main' }] : [];
  }
  if (input.isEnter) {
    return available('Enter') ? [{ finger: 'right-pinky', code: 'Enter', role: 'main' }] : [];
  }
  const code = input.targetCode;
  if (!code || !available(code)) return [];
  if (code === 'Space') {
    return [
      { finger: 'left-thumb', code: 'Space', role: 'thumb' },
      { finger: 'right-thumb', code: 'Space', role: 'thumb' },
    ];
  }
  const finger = input.targetFinger;
  if (!finger) return [];
  const result: FingerAssignment[] = [{ finger, code, role: 'main' }];
  if (input.needShift) {
    // Quy tắc tay đối diện: phím do tay phải bấm thì út trái giữ Shift trái và ngược lại
    const opposite = handOf(finger) === 'right' ? 'ShiftLeft' : 'ShiftRight';
    const shiftCode = input.shiftCodes?.find((c) => c === 'ShiftLeft' || c === 'ShiftRight') ?? opposite;
    const shiftFinger: FingerId = shiftCode === 'ShiftLeft' ? 'left-pinky' : 'right-pinky';
    // Không bao giờ để một ngón vừa bấm phím vừa giữ Shift
    if (shiftFinger !== finger && available(shiftCode)) {
      result.push({ finger: shiftFinger, code: shiftCode, role: 'shift' });
    }
  }
  return result;
}

/** Vị trí đầu ngón mong muốn cho cả 10 ngón (ngón không làm việc thì nằm ở hàng cơ sở). */
export function targetTips(assignments: FingerAssignment[], rects: KeyRectMap): Partial<Record<FingerId, Point>> {
  const tips: Partial<Record<FingerId, Point>> = {};
  for (const f of ALL_FINGERS) {
    const h = homeTip(f, rects);
    if (h) tips[f] = h;
  }
  for (const a of assignments) {
    const r = rects[a.code];
    if (!r) continue;
    if (a.role === 'thumb') {
      // Ngón cái nhấn Space: ấn xuống một chút ngay tại chỗ (không chạy ngang)
      const h = homeTip(a.finger, rects);
      if (h) tips[a.finger] = { x: h.x, y: h.y + r.h * 0.08 };
    } else {
      tips[a.finger] = tipOnKey(r);
    }
  }
  return tips;
}

/**
 * Gốc ngón của cả 10 ngón, có tính độ DỊCH BÀN TAY: khi một ngón phải với xa (H, B, 6, Backspace...),
 * cả bàn tay đó dịch theo một phần quãng đường. Nhờ vậy ngón với không phải vặn chéo qua ngón bên cạnh,
 * còn các ngón khác vẫn đặt trên hàng cơ sở như tay thật.
 */
export const HAND_FOLLOW = 0.42;
export function handShift(assignments: FingerAssignment[], rects: KeyRectMap): Record<'left' | 'right', Point> {
  const shift: Record<'left' | 'right', Point> = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  for (const a of assignments) {
    if (a.role === 'thumb') continue;
    const r = rects[a.code];
    const h = homeTip(a.finger, rects);
    if (!r || !h) continue;
    const t = tipOnKey(r);
    const hand = handOf(a.finger);
    // Ngón út giữ Shift: tay chỉ dịch nhẹ
    const k = a.role === 'shift' ? HAND_FOLLOW * 0.5 : HAND_FOLLOW;
    const dx = (t.x - h.x) * k;
    const dy = (t.y - h.y) * k;
    if (Math.abs(dx) > Math.abs(shift[hand].x)) shift[hand].x = dx;
    if (Math.abs(dy) > Math.abs(shift[hand].y)) shift[hand].y = dy;
  }
  // Giới hạn quãng bàn tay trượt: với phím rất xa (Backspace, Enter) tay chỉ dịch vừa phải,
  // nếu không các ngón còn lại nằm trên hàng cơ sở sẽ bị nghiêng quá mức
  const u = unitWidth(rects, 0);
  const pitch = rects.KeyQ && rects.KeyA ? rects.KeyA.y - rects.KeyQ.y : u;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  for (const hand of ['left', 'right'] as const) {
    shift[hand] = { x: clamp(shift[hand].x, 0.6 * u), y: clamp(shift[hand].y, 0.5 * pitch) };
  }
  return shift;
}

export function handBases(
  assignments: FingerAssignment[],
  rects: KeyRectMap,
  frame: { w: number; h: number }
): Partial<Record<FingerId, Point>> {
  const shift = handShift(assignments, rects);
  const out: Partial<Record<FingerId, Point>> = {};
  for (const f of ALL_FINGERS) {
    const b = fingerBase(f, rects, frame);
    if (!b) continue;
    const s = shift[handOf(f)];
    // Ngón cái gắn với bàn tay nên dịch cùng bàn tay theo chiều ngang (không trượt lên xuống)
    out[f] = isThumb(f) ? { x: b.x + s.x, y: b.y } : { x: b.x + s.x, y: b.y + s.y };
  }
  return out;
}

/**
 * Tư thế đầy đủ của 2 bàn tay (đầu ngón + gốc ngón) cho một lần gõ.
 * Ngón cái không bấm Space thì đi theo bàn tay (tay thật: ngón cái nhấc lên, trượt theo bàn tay),
 * nhưng luôn nằm trong phạm vi phím cách.
 */
export function handPose(
  assignments: FingerAssignment[],
  rects: KeyRectMap,
  frame: { w: number; h: number }
): { tips: Partial<Record<FingerId, Point>>; bases: Partial<Record<FingerId, Point>> } {
  const tips = targetTips(assignments, rects);
  const bases = handBases(assignments, rects, frame);
  const shift = handShift(assignments, rects);
  const sp = rects.Space;
  const pressing = new Set(assignments.map((a) => a.finger));
  for (const f of ['left-thumb', 'right-thumb'] as const) {
    const t = tips[f];
    if (!t || pressing.has(f) || !sp) continue;
    const x = t.x + shift[handOf(f)].x;
    tips[f] = { x: Math.max(sp.x + sp.w * 0.12, Math.min(sp.x + sp.w * 0.88, x)), y: t.y };
  }
  return { tips, bases };
}

// ----------------------------------------------------------------------------
// HÌNH NGÓN TAY (đường viền SVG) từ gốc tới đầu ngón
// ----------------------------------------------------------------------------
export interface FingerShape {
  body: string; // đường viền thân ngón (đường cong khép kín)
  creases: string; // nếp gấp ở khớp ngón
  shade: { x1: number; y1: number; x2: number; y2: number }; // trục đổ bóng hình trụ (mép tối, giữa sáng)
  outline: Point[]; // các điểm viền (dùng để test)
  spine: Point[]; // đường giữa ngón từ gốc tới đầu ngón (dùng để test ngón đè lên nhau)
  angleDeg: number; // góc nghiêng gốc -> đầu ngón so với phương thẳng đứng
  length: number;
}

export interface FingerShapeOptions {
  side?: 'left' | 'right'; // tay nào: quyết định đầu ngón nghiêng vào trong theo hướng nào
  thumb?: boolean;
  restLength?: number; // độ dài khi đặt ở hàng cơ sở (để biết ngón đang duỗi hay co)
  phalanx?: number; // tỉ lệ độ dài đốt ngón
}

const rotate = (v: Point, deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) };
};
const unitVec = (v: Point): Point => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const fmt = (q: Point) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`;

/** Nối các điểm thành đường cong mượt (Catmull-Rom -> Bézier bậc 3). */
function smoothPath(pts: Point[], close: boolean): string {
  if (pts.length < 2) return '';
  let d = `M ${fmt(pts[0])}`;
  const n = pts.length;
  const at = (i: number) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const last = close ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return d + (close ? ' Z' : '');
}

/**
 * Hình ngón tay giải phẫu: xương sống là đường cong Bézier từ gốc tới đầu ngón,
 * đầu ngón nghiêng vào phía trong bàn tay (ngón co nhiều khi gõ hàng dưới, duỗi thẳng dần khi với xa),
 * thân thon dần, đầu ngón là đệm tròn, có 2 khớp (đốt giữa, đốt cuối) với nếp gấp đôi.
 */
export function fingerShape(base: Point, tip: Point, width: number, opts: FingerShapeOptions = {}): FingerShape {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const dir = unitVec({ x: dx, y: dy });
  // Tay trái: đầu ngón nghiêng sang phải (vào trong); tay phải: nghiêng sang trái
  const inward = opts.side === 'right' ? -1 : 1;

  let tipDir: Point;
  let baseDir: Point;
  if (opts.thumb) {
    // Ngón cái chếch lên, cong nhẹ như đang đặt nghiêng cạnh trên phím cách
    tipDir = rotate(dir, -inward * 8);
    baseDir = rotate(dir, inward * 6);
  } else {
    const rest = opts.restLength ?? len;
    const stretch = len / rest;
    // Duỗi càng xa thì ngón càng thẳng; co về hàng dưới thì cong (móc) nhiều hơn
    const lean = 16 * Math.max(0.3, Math.min(1.2, 1.6 - stretch));
    tipDir = rotate(dir, inward * lean);
    baseDir = rotate(dir, -inward * lean * 0.5);
  }
  const c1 = { x: base.x + baseDir.x * len * 0.42, y: base.y + baseDir.y * len * 0.42 };
  const c2 = { x: tip.x - tipDir.x * len * 0.4, y: tip.y - tipDir.y * len * 0.4 };
  const bez = (t: number): Point => {
    const m = 1 - t;
    return {
      x: m * m * m * base.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * tip.x,
      y: m * m * m * base.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * tip.y,
    };
  };

  // Lấy mẫu xương sống, tính độ dài cung tính từ ĐẦU ngón
  const N = 32;
  const spine: Point[] = [];
  for (let i = 0; i <= N; i++) spine.push(bez(i / N));
  const cum: number[] = [0];
  for (let i = 1; i <= N; i++) {
    cum.push(cum[i - 1] + Math.hypot(spine[i].x - spine[i - 1].x, spine[i].y - spine[i - 1].y));
  }
  const total = cum[N];
  const tangentAt = (i: number): Point =>
    unitVec({
      x: spine[Math.min(N, i + 1)].x - spine[Math.max(0, i - 1)].x,
      y: spine[Math.min(N, i + 1)].y - spine[Math.max(0, i - 1)].y,
    });
  // Điểm và tiếp tuyến tại khoảng cách sTip tính từ đầu ngón
  const atS = (sTip: number): { p: Point; t: Point } => {
    const target = Math.max(0, total - sTip);
    let i = 1;
    while (i < N && cum[i] < target) i++;
    const f = (target - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
    const p = {
      x: spine[i - 1].x + (spine[i].x - spine[i - 1].x) * f,
      y: spine[i - 1].y + (spine[i].y - spine[i - 1].y) * f,
    };
    return { p, t: tangentAt(i) };
  };
  // Bề rộng: đầu ngón thon, đốt gần bàn tay to dần (như ngón tay thật nhìn từ trên xuống)
  const widthAt = (sTip: number) => width * (0.86 + 0.3 * Math.min(1, sTip / (3.4 * width)));

  const capR = width * 0.46;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= N; i++) {
    const sTip = total - cum[i];
    if (sTip < capR) continue;
    const t = tangentAt(i);
    const n = { x: -t.y, y: t.x };
    const hw = widthAt(sTip) / 2;
    left.push({ x: spine[i].x + n.x * hw, y: spine[i].y + n.y * hw });
    right.push({ x: spine[i].x - n.x * hw, y: spine[i].y - n.y * hw });
  }
  // Đệm đầu ngón: nửa elip quanh tâm cách đầu ngón một bán kính
  const cap = atS(capR);
  const cn = { x: -cap.t.y, y: cap.t.x };
  const hwCap = widthAt(capR) / 2;
  const capPts: Point[] = [];
  for (let k = 1; k < 12; k++) {
    const th = (k / 12) * Math.PI;
    capPts.push({
      x: cap.p.x + cn.x * hwCap * Math.cos(th) + cap.t.x * capR * Math.sin(th),
      y: cap.p.y + cn.y * hwCap * Math.cos(th) + cap.t.y * capR * Math.sin(th),
    });
  }
  const outline = [...left, ...capPts, ...right.reverse()];
  const body = smoothPath(outline, true);

  // Nếp gấp khớp: vạch đôi cong về phía đầu ngón (khớp đốt cuối DIP và khớp đốt giữa PIP)
  const ph = opts.phalanx ?? 1;
  const jointDists = opts.thumb ? [width * 1.25] : [width * 1.0 * ph, width * 2.25 * ph];
  const creaseParts: string[] = [];
  for (const sj of jointDists) {
    for (const [off, span] of [
      [0, 0.36],
      [width * 0.14, 0.27],
    ] as const) {
      const sTip = sj + off;
      if (sTip > total - width * 0.3) continue;
      const { p, t } = atS(sTip);
      const n = { x: -t.y, y: t.x };
      const hw = widthAt(sTip) * span;
      const a = { x: p.x + n.x * hw, y: p.y + n.y * hw };
      const b = { x: p.x - n.x * hw, y: p.y - n.y * hw };
      const mid = { x: p.x + t.x * width * 0.14, y: p.y + t.y * width * 0.14 };
      creaseParts.push(`M ${fmt(a)} Q ${fmt(mid)} ${fmt(b)}`);
    }
  }

  // Trục đổ bóng: cắt ngang thân ngón ở đốt giữa
  const mid = atS(Math.min(total * 0.4, width * 1.6));
  const mn = { x: -mid.t.y, y: mid.t.x };
  const mhw = widthAt(width * 1.6) / 2;
  const shade = {
    x1: mid.p.x + mn.x * mhw,
    y1: mid.p.y + mn.y * mhw,
    x2: mid.p.x - mn.x * mhw,
    y2: mid.p.y - mn.y * mhw,
  };

  const angleDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { body, creases: creaseParts.join(' '), shade, outline, spine, angleDeg, length: len };
}
