// ============================================================================
// TAB "LÀM QUEN BÀN PHÍM": tên các HÀNG PHÍM và các KHU VỰC của bàn phím, có hình minh họa.
// Hình vẽ trực tiếp từ sơ đồ bàn phím 108 phím của phần mềm (khớp bàn phím trên màn hình).
// Bấm vào một hàng / một khu vực để tô sáng trên bàn phím mẫu.
// ============================================================================
import React, { useLayoutEffect, useRef, useState } from 'react';
import { KeyConfig } from '../types/typing';
import {
  FUNCTION_ROW,
  KEYBOARD_ROWS,
  NAV_CLUSTER_ROWS,
  NUMPAD_ROWS,
  NUMPAD_TOP_EXTRA_KEYS,
  SYSTEM_TOP_KEYS,
} from '../data/keyboardLayout';
import { KEYBOARD_ROW_INFO, KEYBOARD_ZONES, RowInfo, ZoneInfo, rowOf, zoneOf } from '../data/keyboardAnatomy';

type Paint = { bg: string; border: string; text: string; dim?: boolean };

/** Bề rộng (theo đơn vị U) của toàn bộ bàn phím 108 phím: chính 15U + điều hướng 3U + phím số 4U + 2 khe */
const FULL_UNITS = 15 + 3 + 4 + 1.2;

function useUnit(min: number, max: number, units: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [u, setU] = useState(28);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setU(Math.max(min, Math.min(max, Math.floor((el.clientWidth - 32) / (units * 1.1)))));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [min, max, units]);
  return { ref, u };
}

const MiniKey: React.FC<{ k: KeyConfig; u: number; paint: Paint; style?: React.CSSProperties; wrap?: boolean }> = ({ k, u, paint, style, wrap }) => {
  const gap = Math.max(2, Math.round(u * 0.1));
  const w = Math.round(k.widthRatio * u + (k.widthRatio - 1) * gap);
  const single = k.label.length <= 2;
  return (
    <div
      title={k.label}
      style={{
        width: w,
        minWidth: w,
        height: Math.round(u * 0.9),
        background: paint.bg,
        borderColor: paint.border,
        color: paint.text,
        opacity: paint.dim ? 0.35 : 1,
        // Phím hẹp cho xuống dòng thì dùng chữ nhỏ hơn một chút để "Enter" nằm gọn trong 1U
        fontSize: wrap ? Math.max(7, Math.round(u * 0.24)) : Math.max(8, Math.round(u * (single ? 0.42 : 0.3))),
        paddingInline: wrap ? 0 : undefined,
        ...style,
      }}
      className={`rounded-[4px] border-2 flex items-center justify-center font-bold leading-none overflow-hidden px-0.5 transition-opacity ${
        wrap ? 'whitespace-normal text-center break-words' : 'whitespace-nowrap'
      }`}
    >
      {k.code === 'Space' ? 'Phím cách' : k.label}
    </div>
  );
};

/** Bàn phím 108 phím thu nhỏ; `paintOf` quyết định màu từng phím */
const MiniKeyboard: React.FC<{ u: number; paintOf: (k: KeyConfig) => Paint }> = ({ u, paintOf }) => {
  const gap = Math.max(2, Math.round(u * 0.1));
  const section = Math.round(u * 0.6);
  const keyH = Math.round(u * 0.9);
  const mainW = 15 * u + 14 * gap;
  const navW = 3 * u + 2 * gap;
  const numW = 4 * u + 3 * gap;
  const row = (keys: KeyConfig[]) => (
    <div className="flex" style={{ gap }}>
      {keys.map((k) => (
        <MiniKey key={k.code} k={k} u={u} paint={paintOf(k)} />
      ))}
    </div>
  );
  // Vị trí lưới của cụm phím số (phím + và Enter cao 2 hàng, phím 0 rộng 2 cột)
  const numPos: Record<string, [number, number, number?, number?]> = {
    NumLock: [1, 1], NumpadDivide: [2, 1], NumpadMultiply: [3, 1], NumpadSubtract: [4, 1],
    Numpad7: [1, 2], Numpad8: [2, 2], Numpad9: [3, 2], NumpadAdd: [4, 2, 1, 2],
    Numpad4: [1, 3], Numpad5: [2, 3], Numpad6: [3, 3],
    Numpad1: [1, 4], Numpad2: [2, 4], Numpad3: [3, 4], NumpadEnter: [4, 4, 1, 2],
    Numpad0: [1, 5, 2, 1], NumpadDecimal: [3, 5],
  };
  return (
    <div className="inline-flex flex-col p-2 rounded-xl bg-slate-200/70 border-2 border-slate-300" style={{ gap: section / 2 }}>
      {/* Hàng trên cùng: Esc + F1–F12 | phím hệ thống | phím đa phương tiện */}
      <div className="flex" style={{ gap: section }}>
        <div className="flex justify-between" style={{ width: mainW }}>
          <MiniKey k={FUNCTION_ROW[0]} u={u} paint={paintOf(FUNCTION_ROW[0])} />
          {[FUNCTION_ROW.slice(1, 5), FUNCTION_ROW.slice(5, 9), FUNCTION_ROW.slice(9, 13)].map((g, i) => (
            <div key={i}>{row(g)}</div>
          ))}
        </div>
        <div style={{ width: navW }}>{row(SYSTEM_TOP_KEYS)}</div>
        <div style={{ width: numW }}>{row(NUMPAD_TOP_EXTRA_KEYS)}</div>
      </div>
      {/* Thân bàn phím: khu vực chính | điều hướng & mũi tên | phím số */}
      <div className="flex items-start" style={{ gap: section }}>
        <div className="flex flex-col" style={{ gap, width: mainW }}>
          {KEYBOARD_ROWS.map((r, i) => (
            <div key={i}>{row(r)}</div>
          ))}
        </div>
        <div className="flex flex-col" style={{ gap, width: navW }}>
          {NAV_CLUSTER_ROWS.map((r, i) =>
            r.length === 0 ? (
              <div key={i} style={{ height: keyH }} />
            ) : (
              <div key={i} className="flex justify-center">{row(r)}</div>
            )
          )}
        </div>
        <div
          className="grid"
          style={{ gap, gridTemplateColumns: `repeat(4, ${u}px)`, gridTemplateRows: `repeat(5, ${keyH}px)`, width: numW }}
        >
          {NUMPAD_ROWS.flat().map((k) => {
            const [c, r, cs = 1, rs = 1] = numPos[k.code] ?? [1, 1];
            return (
              <MiniKey
                key={k.code}
                k={{ ...k, widthRatio: cs }}
                u={u}
                paint={paintOf(k)}
                // Phím cao 2 hàng (Enter, +) hẹp: cho chữ xuống dòng để không bị cắt "Enter"
                wrap={rs > 1}
                style={{ gridColumn: `${c} / span ${cs}`, gridRow: `${r} / span ${rs}`, height: '100%' }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const NEUTRAL: Paint = { bg: '#ffffff', border: '#cbd5e1', text: '#334155' };

export const KeyboardAnatomy: React.FC = () => {
  const [rowSel, setRowSel] = useState<RowInfo['id']>('home');
  const [zoneSel, setZoneSel] = useState<ZoneInfo['id'] | null>(null);
  const big = useUnit(14, 62, FULL_UNITS);
  const strip = useUnit(14, 50, 15.5);

  const rowPaint = (k: KeyConfig): Paint => {
    const r = rowOf(k.code);
    if (!r) return { ...NEUTRAL, dim: true }; // phím ngoài khu vực chính: làm mờ
    if (r.id === rowSel) return { bg: r.color, border: r.color, text: '#ffffff' };
    return { bg: r.soft, border: r.color, text: '#334155' };
  };
  const zonePaint = (k: KeyConfig): Paint => {
    const z = zoneOf(k.code);
    if (!z) return NEUTRAL;
    const on = zoneSel === null || zoneSel === z.id;
    return on ? { bg: zoneSel ? z.color : z.soft, border: z.color, text: zoneSel ? '#ffffff' : '#1e293b' } : { ...NEUTRAL, dim: true };
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* ---------------- PHẦN 1: CÁC HÀNG PHÍM ---------------- */}
      <section className="rounded-3xl border-2 border-emerald-200 bg-white p-4 sm:p-5 shadow-xs">
        <h3 className="text-lg sm:text-xl xl:text-2xl font-black text-emerald-900">⌨️ 1. Tên gọi các hàng phím</h3>
        <p className="text-sm sm:text-base xl:text-lg font-semibold text-slate-600 mt-1">
          Khu vực gõ chữ có <b>5 hàng phím</b>. Bấm vào tên một hàng để xem hàng đó trên bàn phím.
        </p>

        <div ref={big.ref} className="mt-3 w-full overflow-x-auto flex justify-center" data-testid="anatomy-rows-board">
          <MiniKeyboard u={big.u} paintOf={rowPaint} />
        </div>

        <div ref={strip.ref} className="mt-4 grid gap-3">
          {KEYBOARD_ROW_INFO.map((r, i) => {
            const active = r.id === rowSel;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRowSel(r.id)}
                data-row={r.id}
                aria-pressed={active}
                className="text-left rounded-2xl border-2 p-3 transition-shadow cursor-pointer focus-visible:outline-4 focus-visible:outline-sky-300"
                style={{ borderColor: r.color, background: active ? r.soft : '#ffffff', boxShadow: active ? `0 6px 18px ${r.color}33` : undefined }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-8 h-8 rounded-full text-white font-black flex items-center justify-center shrink-0" style={{ background: r.color }}>
                    {i + 1}
                  </span>
                  <span className="text-lg xl:text-xl font-black" style={{ color: r.color }}>
                    {r.name}
                  </span>
                </div>
                {/* Hình hàng phím */}
                <div className="mt-2 overflow-x-auto">
                  <div className="flex" style={{ gap: Math.max(2, Math.round(strip.u * 0.1)) }}>
                    {KEYBOARD_ROWS[r.rowIndex].map((k) => (
                      <MiniKey key={k.code} k={k} u={strip.u} paint={{ bg: r.color, border: r.color, text: '#ffffff' }} />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-[15px] xl:text-lg font-semibold text-slate-700">{r.description}</p>
                <p className="text-sm xl:text-base font-semibold text-slate-500">✋ {r.fingers}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------------- PHẦN 2: CÁC KHU VỰC BÀN PHÍM ---------------- */}
      <section className="rounded-3xl border-2 border-sky-200 bg-white p-4 sm:p-5 shadow-xs">
        <h3 className="text-lg sm:text-xl xl:text-2xl font-black text-sky-900">🗺️ 2. Các khu vực của bàn phím</h3>
        <p className="text-sm sm:text-base xl:text-lg font-semibold text-slate-600 mt-1">
          Bàn phím đầy đủ chia thành <b>4 khu vực</b>, mỗi khu vực một màu. Bấm vào tên khu vực để làm nổi khu vực đó.
        </p>

        <div className="mt-3 w-full overflow-x-auto flex justify-center" data-testid="anatomy-zones-board">
          <MiniKeyboard u={big.u} paintOf={zonePaint} />
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {KEYBOARD_ZONES.map((z, i) => {
            const active = zoneSel === z.id;
            return (
              <button
                key={z.id}
                type="button"
                data-zone={z.id}
                aria-pressed={active}
                onClick={() => setZoneSel(active ? null : z.id)}
                className="text-left rounded-2xl border-2 p-3 cursor-pointer transition-shadow focus-visible:outline-4 focus-visible:outline-sky-300"
                style={{ borderColor: z.color, background: active ? z.soft : '#ffffff', boxShadow: active ? `0 6px 18px ${z.color}33` : undefined }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg shrink-0 border-2" style={{ background: z.soft, borderColor: z.color }} />
                  <span className="text-lg xl:text-xl font-black" style={{ color: z.color }}>
                    {String.fromCharCode(65 + i)}. {z.name}
                  </span>
                </div>
                <p className="mt-1.5 text-[15px] xl:text-lg font-semibold text-slate-700">{z.description}</p>
              </button>
            );
          })}
        </div>
        {zoneSel && (
          <button
            type="button"
            onClick={() => setZoneSel(null)}
            className="mt-3 min-h-[40px] px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-black cursor-pointer"
          >
            Hiện lại cả 4 khu vực
          </button>
        )}
      </section>
    </div>
  );
};
