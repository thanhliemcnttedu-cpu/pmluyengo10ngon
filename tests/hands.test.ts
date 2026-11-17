// Test lõi bàn tay bám phím thật (src/utils/fingerGeometry.ts).
// Dựng tọa độ phím giả theo đúng công thức của Keyboard.tsx (bề rộng = widthRatio*U + (widthRatio-1)*gap)
// rồi kiểm tra đầu ngón luôn nằm trong ô phím đích, ở nhiều cỡ bàn phím khác nhau.
import assert from 'node:assert/strict';
import { test } from './harness';
import { KEYBOARD_ROWS } from '../src/data/keyboardLayout';
import {
  ALL_FINGERS,
  HOME_KEY,
  KeyRectMap,
  PHALANX_SCALE,
  Point,
  assignFingers,
  fingerWidth,
  handBases,
  handPose,
  fingerBase,
  fingerShape,
  targetTips,
  unitWidth,
} from '../src/utils/fingerGeometry';

function buildRects(unit: number, keyH: number): { rects: KeyRectMap; w: number; h: number } {
  const gapX = 3.5;
  const gapY = 5.5;
  const rects: KeyRectMap = {};
  let y = 0;
  let maxW = 0;
  for (const row of KEYBOARD_ROWS) {
    let x = 0;
    for (const k of row) {
      const w = Math.round(k.widthRatio * unit + (k.widthRatio - 1) * gapX);
      rects[k.code] = { x, y, w, h: keyH };
      x += w + gapX;
    }
    maxW = Math.max(maxW, x - gapX);
    y += keyH + gapY;
  }
  return { rects, w: maxW, h: y - gapY };
}

const inside = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

const TYPING_ROWS = KEYBOARD_ROWS.slice(0, 4).flat();
const SCALES: [number, number][] = [
  [30, 32], // máy tính bảng / màn nhỏ
  [44, 50], // 1366x768
  [60, 66], // màn lớn
];

for (const [u, h] of SCALES) {
  test(`hands: đầu ngón nằm trong ô phím đích với mọi phím gõ (U=${u})`, () => {
    const { rects } = buildRects(u, h);
    const has = (c: string) => !!rects[c];
    for (const k of [...TYPING_ROWS, KEYBOARD_ROWS[4].find((x) => x.code === 'Space')!]) {
      const as = assignFingers({ targetCode: k.code, targetFinger: k.finger }, has);
      assert.ok(as.length > 0, `không có ngón nào cho phím ${k.code}`);
      const tips = targetTips(as, rects);
      for (const a of as) {
        const tip = tips[a.finger]!;
        assert.ok(inside(tip, rects[a.code]), `${a.finger} không chạm phím ${a.code}`);
      }
    }
  });

  // Gốc ngón nằm dưới mép bàn phím nên đo TỈ LỆ duỗi so với lúc đặt ở phím nhà (0,6–2 lần là tự nhiên)
  test(`hands: độ duỗi/co ngón hợp lý so với tư thế ở hàng cơ sở (U=${u})`, () => {
    const { rects, w, h: fh } = buildRects(u, h);
    const has = (c: string) => !!rects[c];
    const rest = targetTips([], rects);
    for (const k of TYPING_ROWS) {
      const as = assignFingers({ targetCode: k.code, targetFinger: k.finger }, has);
      const tips = targetTips(as, rects);
      for (const a of as) {
        const base = fingerBase(a.finger, rects, { w, h: fh })!;
        const len = Math.hypot(tips[a.finger]!.x - base.x, tips[a.finger]!.y - base.y);
        const homeLen = Math.hypot(rest[a.finger]!.x - base.x, rest[a.finger]!.y - base.y);
        const ratio = len / homeLen;
        assert.ok(ratio > 0.6 && ratio < 2, `${a.finger}->${a.code} duỗi ${ratio.toFixed(2)} lần`);
      }
    }
    assert.ok(unitWidth(rects, w) === u);
  });
}

// Hai đoạn thẳng AB và CD có cắt nhau không (dùng cho xương sống ngón: gốc -> đầu ngón)
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

for (const [u, h] of SCALES) {
  test(`hands: KHÔNG ngón nào đan chéo ngón bên cạnh khi gõ bất kỳ phím nào (U=${u})`, () => {
    const { rects, w, h: fh } = buildRects(u, h);
    const has = (c: string) => !!rects[c];
    const left = ['left-pinky', 'left-ring', 'left-middle', 'left-index'] as const;
    const right = ['right-index', 'right-middle', 'right-ring', 'right-pinky'] as const;
    const keys = [...TYPING_ROWS];
    const cases = [
      ...keys.map((k) => ({ code: k.code, finger: k.finger, needShift: false })),
      ...keys.filter((k) => /^Key/.test(k.code)).map((k) => ({ code: k.code, finger: k.finger, needShift: true })),
    ];
    for (const c of cases) {
      const as = assignFingers({ targetCode: c.code, targetFinger: c.finger, needShift: c.needShift }, has);
      const tips = targetTips(as, rects);
      const bases = handBases(as, rects, { w, h: fh });
      for (const hand of [left, right]) {
        for (let i = 0; i < hand.length; i++) {
          for (let j = i + 1; j < hand.length; j++) {
            const f = hand[i], g = hand[j];
            assert.ok(
              !segmentsCross(bases[f]!, tips[f]!, bases[g]!, tips[g]!),
              `${c.needShift ? 'Shift+' : ''}${c.code}: ${f} đan chéo ${g}`
            );
          }
        }
      }
      // Hai ngón cái không chạm nhau trên phím cách
      assert.ok(tips['right-thumb']!.x - tips['left-thumb']!.x > u * 0.8, 'hai ngón cái quá sát nhau');
    }
  });
}

// Điểm p có nằm trong đa giác (viền ngón) không
function insidePoly(p: Point, poly: Point[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// Đo đúng thứ mắt nhìn thấy: đường giữa (phần lộ trên bàn phím) của một ngón có chui vào THÂN ngón khác không.
// Ngón tay thật đặt cạnh nhau có thể chạm mép, nhưng không bao giờ ngón này nằm đè ngang lên giữa ngón kia.
for (const [u, h] of SCALES) {
  test(`hands: thân ngón không đè ngang lên ngón bên cạnh (nhìn trên bàn phím, U=${u})`, () => {
    const { rects, w, h: fh } = buildRects(u, h);
    const frame = { w, h: fh };
    const has = (c: string) => !!rects[c];
    const rest = handBases([], rects, frame);
    const restTips = targetTips([], rects);
    const hands = [
      ['left-pinky', 'left-ring', 'left-middle', 'left-index', 'left-thumb'],
      ['right-index', 'right-middle', 'right-ring', 'right-pinky', 'right-thumb'],
    ] as const;
    const shapeOf = (f: (typeof hands)[number][number], bases: any, tips: any) =>
      fingerShape(bases[f], tips[f], fingerWidth(f, rects, w), {
        side: f.startsWith('left') ? 'left' : 'right',
        thumb: f.endsWith('thumb'),
        restLength: Math.hypot(restTips[f]!.x - rest[f]!.x, restTips[f]!.y - rest[f]!.y),
        phalanx: PHALANX_SCALE[f],
      });
    const problems: string[] = [];
    const cases = [{ code: '', finger: undefined as any }, ...TYPING_ROWS.map((k) => ({ code: k.code, finger: k.finger }))];
    for (const c of cases) {
      const as = c.code ? assignFingers({ targetCode: c.code, targetFinger: c.finger }, has) : [];
      const { tips, bases } = handPose(as, rects, frame);
      for (const hand of hands) {
        const shapes = Object.fromEntries(hand.map((f) => [f, shapeOf(f, bases, tips)]));
        for (const f of hand) {
          for (const g of hand) {
            if (f === g) continue;
            // chỉ xét phần lộ ra trên bàn phím, bỏ đoạn sát đầu ngón (đầu ngón có thể chạm mép ngón kề)
            const vis = shapes[g].spine.filter((p, i, arr) => p.y < fh && i < arr.length - 3);
            const hits = vis.filter((p) => insidePoly(p, shapes[f].outline)).length;
            if (hits > 0) problems.push(`${c.code || 'nghỉ'}: thân ${f} đè lên ${g} (${hits} điểm)`);
          }
        }
      }
    }
    assert.equal(problems.length, 0, problems.slice(0, 8).join('; '));
  });
}

test('hands: ngón cái nằm chéo ngắn (25–60 độ so với phương ngang), không nằm dài cả phím cách', () => {
  const { rects, w, h } = buildRects(44, 50);
  const tips = targetTips([], rects);
  const bases = handBases([], rects, { w, h });
  for (const f of ['left-thumb', 'right-thumb'] as const) {
    const dx = Math.abs(tips[f]!.x - bases[f]!.x);
    const dy = Math.abs(tips[f]!.y - bases[f]!.y);
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    assert.ok(deg > 25 && deg < 60, `${f} nghiêng ${deg.toFixed(0)} độ`);
    assert.ok(dx < 2 * 44, `${f} dài ${(dx / 44).toFixed(1)} phím`);
  }
});

test('hands: bàn tay dịch theo khi ngón trỏ với sang H, các ngón khác vẫn trên hàng cơ sở', () => {
  const { rects, w, h } = buildRects(44, 50);
  const as = assignFingers({ targetCode: 'KeyH', targetFinger: 'right-index' }, (c) => !!rects[c]);
  const rest = handBases([], rects, { w, h });
  const moved = handBases(as, rects, { w, h });
  assert.ok(moved['right-middle']!.x < rest['right-middle']!.x, 'tay phải phải dịch sang trái theo ngón trỏ');
  assert.equal(moved['left-index']!.x, rest['left-index']!.x, 'tay trái đứng yên');
  const tips = targetTips(as, rects);
  assert.ok(inside(tips['right-middle']!, rects.KeyK), 'ngón giữa phải vẫn đặt trên K');
});

test('hands: khi nghỉ, 10 ngón nằm đúng phím nhà (ASDF - JKL; và Space)', () => {
  const { rects } = buildRects(44, 50);
  const tips = targetTips([], rects);
  for (const f of ALL_FINGERS) {
    assert.ok(inside(tips[f]!, rects[HOME_KEY[f]]), `${f} không nằm trên ${HOME_KEY[f]}`);
  }
});

test('hands: gốc các ngón xếp từ trái sang phải, ngón không bắt chéo nhau', () => {
  const { rects, w, h } = buildRects(44, 50);
  const order = ['left-pinky', 'left-ring', 'left-middle', 'left-index', 'right-index', 'right-middle', 'right-ring', 'right-pinky'] as const;
  const xs = order.map((f) => fingerBase(f, rects, { w, h })!.x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] > xs[i - 1], `gốc ${order[i]} không nằm bên phải ${order[i - 1]}`);
});

test('hands: chữ hoa dùng Shift TAY ĐỐI DIỆN', () => {
  const { rects } = buildRects(44, 50);
  const has = (c: string) => !!rects[c];
  const p = assignFingers({ targetCode: 'KeyP', targetFinger: 'right-pinky', needShift: true }, has);
  assert.deepEqual(p.map((a) => `${a.finger}:${a.code}`), ['right-pinky:KeyP', 'left-pinky:ShiftLeft']);
  const a = assignFingers({ targetCode: 'KeyA', targetFinger: 'left-pinky', needShift: true }, has);
  assert.deepEqual(a.map((x) => `${x.finger}:${x.code}`), ['left-pinky:KeyA', 'right-pinky:ShiftRight']);
});

test('hands: một ngón không vừa bấm phím vừa giữ Shift', () => {
  const { rects } = buildRects(44, 50);
  const as = assignFingers(
    { targetCode: 'KeyA', targetFinger: 'left-pinky', needShift: true, shiftCodes: ['ShiftLeft'] },
    (c) => !!rects[c]
  );
  assert.equal(as.length, 1);
});

test('hands: gõ sai thì út phải với tới Backspace, Enter thì út phải tới Enter', () => {
  const { rects } = buildRects(44, 50);
  const has = (c: string) => !!rects[c];
  assert.deepEqual(
    assignFingers({ targetCode: 'KeyF', targetFinger: 'left-index', isBackspace: true }, has).map((a) => a.code),
    ['Backspace']
  );
  assert.deepEqual(assignFingers({ isEnter: true }, has).map((a) => `${a.finger}:${a.code}`), ['right-pinky:Enter']);
});

test('hands: phím Space dùng cả hai ngón cái, phím ngoài khối chính không vẽ vươn ngón', () => {
  const { rects } = buildRects(44, 50);
  const has = (c: string) => !!rects[c];
  assert.deepEqual(
    assignFingers({ targetCode: 'Space', targetFinger: 'right-thumb' }, has).map((a) => a.finger).sort(),
    ['left-thumb', 'right-thumb']
  );
  assert.deepEqual(assignFingers({ targetCode: 'Numpad5', targetFinger: 'right-middle' }, has), []);
});

test('hands: hình ngón tay tính đúng góc và chiều dài', () => {
  const up = fingerShape({ x: 100, y: 200 }, { x: 100, y: 100 }, 20);
  assert.ok(Math.abs(up.angleDeg) < 0.01);
  assert.ok(Math.abs(up.length - 100) < 0.01);
  const right = fingerShape({ x: 100, y: 200 }, { x: 150, y: 150 }, 20);
  assert.ok(right.angleDeg > 44 && right.angleDeg < 46, `góc ${right.angleDeg}`);
  // Viền là đường cong mượt khép kín
  assert.match(up.body, /^M .* C .* Z$/);
});

test('hands: đệm đầu ngón chạm đúng điểm đích, có đủ nếp gấp 2 khớp', () => {
  const tip = { x: 100, y: 100 };
  const sh = fingerShape({ x: 80, y: 260 }, tip, 24, { side: 'left', restLength: 160 });
  const nearest = Math.min(...sh.outline.map((p) => Math.hypot(p.x - tip.x, p.y - tip.y)));
  assert.ok(nearest < 24 * 0.15, `đầu ngón cách đích ${nearest.toFixed(1)}px`);
  // 2 khớp x 2 vạch (nếp gấp đôi như da thật)
  assert.equal((sh.creases.match(/M /g) || []).length, 4);
  // Ngón cái chỉ có 1 khớp lộ ra
  const th = fingerShape({ x: 0, y: 120 }, { x: 120, y: 100 }, 20, { side: 'left', thumb: true });
  assert.equal((th.creases.match(/M /g) || []).length, 2);
});

test('hands: đầu ngón nghiêng VÀO TRONG bàn tay (trái nghiêng phải, phải nghiêng trái)', () => {
  const base = { x: 100, y: 300 };
  const tip = { x: 100, y: 100 };
  const midX = (side: 'left' | 'right') => {
    const o = fingerShape(base, tip, 24, { side, restLength: 200 }).outline;
    // điểm viền gần đầu ngón (phần đệm): trung bình x
    const near = o.filter((p) => p.y < 130);
    return near.reduce((a, p) => a + p.x, 0) / near.length;
  };
  // Thân ngón cong: đoạn sát đầu ngón đến từ phía ngoài -> tâm phần đầu lệch ra ngoài so với đích
  assert.ok(midX('left') < 100, 'tay trái: phần đầu ngón phải đi từ bên trái vào');
  assert.ok(midX('right') > 100, 'tay phải: phần đầu ngón phải đi từ bên phải vào');
});
