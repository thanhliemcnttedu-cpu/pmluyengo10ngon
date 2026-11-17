// ============================================================================
// LỚP BÀN TAY BÁM PHÍM THẬT (phương án B)
// - Đo tâm từng phím ngay trên bàn phím đang hiển thị (thuộc tính data-key-code).
// - Ngón tay xoay quanh gốc và duỗi tới đúng tâm phím đích; các ngón khác nằm ở hàng cơ sở.
// - Chữ hoa: thêm ngón út tay đối diện giữ Shift. Space: hai ngón cái. Gõ sai: út phải tới Backspace.
// Lớp này đặt trong khối phím chính (position: relative) và không nhận chuột (pointer-events: none).
// ============================================================================
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FINGER_DATA, FingerId, HandDisplayStyle } from '../types/typing';
import {
  ALL_FINGERS,
  FingerAssignment,
  PHALANX_SCALE,
  homeTip,
  isThumb,
  HandTargetInput,
  KeyRectMap,
  Point,
  assignFingers,
  handBases,
  handPose,
  fingerShape,
  fingerWidth,
  handOf,
  targetTips,
} from '../utils/fingerGeometry';

interface KeyHandsOverlayProps extends HandTargetInput {
  visible: boolean;
  opacity: number;
  style: HandDisplayStyle;
  /** Thay đổi giá trị này (ví dụ cỡ phím) để buộc đo lại vị trí phím */
  layoutKey?: string | number;
  /** Các phím đang được nhấn (để vẽ hiệu ứng ngón tay ấn xuống – nhả lên) */
  pressedKeys?: Set<string>;
}

const TWEEN_MS = 260;
// Thời gian ngón tay "ấn xuống" trên phím trước khi nhả lên và đi tiếp
const PRESS_MS = 170;

type PointMap = Partial<Record<FingerId, Point>>;
type Pose = { tips: PointMap; bases: PointMap };

// Màu da: giữa sáng, hai mép đậm hơn (đổ bóng hình trụ) để ngón tay nổi khối như thật
const SKIN = {
  light: '#f8e1cd',
  mid: '#f1cfb2',
  edge: '#dfae8a',
  stroke: '#c08259',
  crease: 'rgba(150,92,58,0.55)',
};

function measureKeys(frame: HTMLElement): { rects: KeyRectMap; w: number; h: number } {
  const rects: KeyRectMap = {};
  frame.querySelectorAll<HTMLElement>('[data-key-code]').forEach((el) => {
    // offsetLeft/Top không tính phép phóng to (scale) của hiệu ứng phím đích -> vị trí ổn định
    let x = el.offsetLeft;
    let y = el.offsetTop;
    let p = el.offsetParent as HTMLElement | null;
    while (p && p !== frame) {
      x += p.offsetLeft;
      y += p.offsetTop;
      p = p.offsetParent as HTMLElement | null;
    }
    rects[el.dataset.keyCode!] = { x, y, w: el.offsetWidth, h: el.offsetHeight };
  });
  return { rects, w: frame.clientWidth, h: frame.clientHeight };
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const KeyHandsOverlay: React.FC<KeyHandsOverlayProps> = ({
  visible,
  opacity,
  style,
  layoutKey,
  pressedKeys,
  ...targetInput
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ rects: KeyRectMap; w: number; h: number } | null>(null);

  // Công cụ thử khi phát triển: window.__handsTarget('KeyB', {needShift:true}) để ép phím đích
  const [devOverride, setDevOverride] = useState<HandTargetInput | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as any;
    w.__handsTarget = (code: string | null, extra: Partial<HandTargetInput> = {}) =>
      setDevOverride(code ? { targetCode: code, ...extra } : null);
    return () => {
      delete w.__handsTarget;
    };
  }, []);

  // Đo lại khi khung đổi kích thước (đổi cỡ màn hình, ẩn/hiện cột, đổi chủ đề phím)
  useLayoutEffect(() => {
    if (!visible) return;
    const frame = rootRef.current?.parentElement;
    if (!frame) return;
    const update = () => setLayout(measureKeys(frame));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [visible, layoutKey]);

  const input: HandTargetInput = devOverride
    ? {
        ...devOverride,
        targetFinger:
          devOverride.targetFinger ??
          (rootRef.current?.parentElement?.querySelector<HTMLElement>(`[data-key-code="${devOverride.targetCode}"]`)
            ?.dataset.finger as FingerId | undefined),
      }
    : targetInput;

  const assignments: FingerAssignment[] = useMemo(() => {
    if (!layout) return [];
    return assignFingers(input, (c) => !!layout.rects[c]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, input.targetCode, input.targetFinger, input.needShift, input.isBackspace, input.isEnter, (input.shiftCodes || []).join(',')]);

  // Đích của đầu ngón và của gốc ngón (bàn tay dịch theo khi một ngón với xa)
  // ---- Hiệu ứng ẤN XUỐNG – NHẢ LÊN mỗi lần gõ phím ----
  // pressing: ngón nào đang ấn phím nào (giữ PRESS_MS rồi tự nhả)
  const [pressing, setPressing] = useState<Partial<Record<FingerId, string>>>({});
  const prevPressedRef = useRef<Set<string>>(new Set());
  const pressTimers = useRef<Partial<Record<FingerId, ReturnType<typeof setTimeout>>>>({});
  useEffect(() => {
    const now = pressedKeys ?? new Set<string>();
    const prev = prevPressedRef.current;
    prevPressedRef.current = new Set(now);
    if (!layout || !visible) return;
    const frame = rootRef.current?.parentElement;
    for (const code of now) {
      if (prev.has(code) || !layout.rects[code]) continue; // chỉ xét phím MỚI nhấn, nằm trong khối phím chính
      const fingers: FingerId[] =
        code === 'Space'
          ? ['left-thumb', 'right-thumb']
          : ([frame?.querySelector<HTMLElement>(`[data-key-code="${code}"]`)?.dataset.finger].filter(Boolean) as FingerId[]);
      for (const f of fingers) {
        if (pressTimers.current[f]) clearTimeout(pressTimers.current[f]);
        setPressing((p) => ({ ...p, [f]: code }));
        pressTimers.current[f] = setTimeout(() => {
          setPressing((p) => {
            const next = { ...p };
            delete next[f];
            return next;
          });
        }, PRESS_MS);
      }
    }
  }, [pressedKeys, layout, visible]);
  useEffect(() => () => Object.values(pressTimers.current).forEach((t) => t && clearTimeout(t)), []);

  const goal = useMemo(() => {
    if (!layout) return { tips: {}, bases: {} } as Pose;
    const pose = handPose(assignments, layout.rects, layout);
    // Ngón đang ấn: đầu ngón nằm trên phím vừa bấm và lún xuống một chút (nhìn từ trên: đầu ngón dịch về phía người gõ)
    for (const [f, code] of Object.entries(pressing) as [FingerId, string][]) {
      const r = layout.rects[code];
      if (!r) continue;
      const cx = f.endsWith('thumb') ? pose.tips[f]?.x ?? r.x + r.w / 2 : r.x + r.w / 2;
      pose.tips[f] = { x: cx, y: r.y + r.h * 0.42 + r.h * 0.14 };
    }
    return pose;
  }, [layout, assignments, pressing]);
  const restBases = useMemo(() => (layout ? handBases([], layout.rects, layout) : {}), [layout]);

  // Nội suy CẢ đầu ngón lẫn gốc ngón trong cùng một nhịp: ngón duỗi tới phím và bàn tay trượt theo mượt mà
  const [pose, setPose] = useState<Pose>({ tips: {}, bases: {} });
  const poseRef = useRef(pose);
  poseRef.current = pose;
  useEffect(() => {
    const from = poseRef.current;
    const hasFrom = ALL_FINGERS.some((f) => from.tips[f] && from.bases[f]);
    if (!hasFrom || prefersReducedMotion()) {
      setPose(goal);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const lerpMap = (a: PointMap, b: PointMap, e: number): PointMap => {
      const out: PointMap = {};
      for (const f of ALL_FINGERS) {
        const p = a[f] ?? b[f];
        const q = b[f];
        if (!p || !q) continue;
        out[f] = { x: p.x + (q.x - p.x) * e, y: p.y + (q.y - p.y) * e };
      }
      return out;
    };
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / TWEEN_MS);
      const e = 1 - Math.pow(1 - t, 3); // chậm dần ở cuối như ngón tay thật
      setPose({ tips: lerpMap(from.tips, goal.tips, e), bases: lerpMap(from.bases, goal.bases, e) });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [goal]);
  const tips = pose.tips;

  if (!visible) return <div ref={rootRef} className="hidden" />;

  const activeRole = new Map<FingerId, FingerAssignment['role']>(assignments.map((a) => [a.finger, a.role]));
  const isColor = style === 'color_coded';

  // Thứ tự lớp: ngón cái dưới cùng (tay thật: ngón cái nằm dưới lòng bàn tay), ngón đang làm việc trên cùng
  const layer = (f: FingerId) => (activeRole.has(f) ? 2 : isThumb(f) ? 0 : 1);
  const order = [...ALL_FINGERS].sort((a, b) => layer(a) - layer(b));

  return (
    <div
      ref={rootRef}
      // z-[35]: nằm trên phím đích đang nổi (z-30, ví dụ phím Shift) nhưng dưới nhãn "BẤM ĐÂY" (z-40)
      className="absolute inset-0 pointer-events-none z-[35]"
      aria-hidden="true"
      data-testid="key-hands-overlay"
    >
      <style>{`
        @keyframes kho-pulse { 0% { r: 3; opacity: .95 } 100% { r: 16; opacity: 0 } }
        .kho-pulse { animation: kho-pulse 1.1s ease-out infinite; }
        @keyframes kho-tap { 0% { r: 4; opacity: 1 } 100% { r: 20; opacity: 0 } }
        .kho-tap { animation: kho-tap 0.32s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .kho-pulse, .kho-tap { animation: none; opacity: .6 } }
      `}</style>
      {layout && (
        <svg width={layout.w} height={layout.h} viewBox={`0 0 ${layout.w} ${layout.h}`} style={{ overflow: 'hidden', display: 'block' }}>
          {/* Không để bàn tay mờ quá mức 0,45: học sinh nhỏ cần nhìn rõ ngón */}
          <g opacity={0.55 + 0.45 * Math.max(0, Math.min(1, opacity))}>
            {order.map((f) => {
              const base = pose.bases[f];
              const tip = tips[f];
              const home = homeTip(f, layout.rects);
              const rest = restBases[f];
              if (!base || !tip || !home || !rest) return null;
              const width = fingerWidth(f, layout.rects, layout.w);
              const shape = fingerShape(base, tip, width, {
                side: handOf(f),
                thumb: isThumb(f),
                restLength: Math.hypot(home.x - rest.x, home.y - rest.y),
                phalanx: PHALANX_SCALE[f],
              });
              const role = activeRole.get(f);
              const color = FINGER_DATA[f].color;
              const active = !!role;
              const isPressing = !!pressing[f];
              const gid = `kho-skin-${f}`;
              return (
                <g key={f} data-finger={f} data-tip-x={tip.x.toFixed(1)} data-tip-y={tip.y.toFixed(1)} data-active={active ? role : undefined}>
                  <defs>
                    {/* Đổ bóng ngang thân ngón: mép tối – giữa sáng – mép tối */}
                    <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={shape.shade.x1} y1={shape.shade.y1} x2={shape.shade.x2} y2={shape.shade.y2}>
                      <stop offset="0" stopColor={isColor ? color : SKIN.edge} stopOpacity={isColor ? 0.55 : 1} />
                      <stop offset="0.45" stopColor={isColor ? color : SKIN.light} stopOpacity={isColor ? 0.3 : 1} />
                      <stop offset="1" stopColor={isColor ? color : SKIN.mid} stopOpacity={isColor ? 0.55 : 1} />
                    </linearGradient>
                  </defs>
                  <path
                    d={shape.body}
                    fill={`url(#${gid})`}
                    // Ngón trong mờ nhẹ để vẫn đọc được chữ trên phím và thấy phím đích xanh bên dưới
                    // Ngón trong suốt vừa phải: thấy rõ hình bàn tay nhưng vẫn đọc được chữ trên phím bên dưới
                    fillOpacity={isPressing ? 0.75 : active ? 0.5 : 0.55}
                    stroke={active ? color : SKIN.stroke}
                    strokeWidth={active ? 2.4 : 1}
                    strokeLinejoin="round"
                  />
                  {shape.creases && (
                    <path d={shape.creases} fill="none" stroke={SKIN.crease} strokeOpacity={0.6} strokeWidth={0.9} strokeLinecap="round" />
                  )}
                  {isPressing && (
                    // Đang ấn phím: phủ màu da đậm hơn + vòng gợn ở đầu ngón (phím lún xuống)
                    <>
                      <path d={shape.body} fill="#d99a6c" fillOpacity={0.35} stroke="none" />
                      <circle className="kho-tap" cx={tip.x} cy={tip.y} r={8} fill="none" stroke="#f97316" strokeWidth={3} />
                    </>
                  )}
                  {active && !isPressing && role !== 'thumb' && (
                    // Vòng lan tỏa ở đầu ngón: "bấm ở đây"
                    <circle className="kho-pulse" cx={tip.x} cy={tip.y} r={6} fill="none" stroke={color} strokeWidth={2.5} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
      {/* Nhãn nhỏ cho biết TAY nào đang làm việc (học sinh tiểu học hay nhầm trái/phải) */}
      {layout && assignments.length > 0 && (
        // Đặt ở hai góc dưới (vùng Ctrl/Win) để không che các phím chữ, phím số
        <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-1 text-[10px] font-black">
          {(['left', 'right'] as const).map((hand) => {
            const used = assignments.filter((a) => handOf(a.finger) === hand);
            return (
              <span
                key={hand}
                className={`px-1.5 py-px rounded-full shadow-sm transition-opacity text-[9px] leading-tight ${
                  used.length ? 'opacity-100 bg-white/90 text-slate-900' : 'opacity-0'
                }`}
              >
                {/* Nhãn ngắn để không che ngón cái trên Space; tên ngón đã có ở thanh hướng dẫn phía trên */}
                {hand === 'left' ? '✋ Tay trái' : 'Tay phải 🤚'}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
