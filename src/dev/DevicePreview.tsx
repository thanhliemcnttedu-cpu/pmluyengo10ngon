// ============================================================================
// TRANG XEM THỬ THEO THIẾT BỊ (chỉ dùng khi phát triển: npm run dev)
// Mở: http://localhost:3000/#/devices?d=all&p=/
//   d = desktop | tablet | phone | all | matrix   (matrix = bộ 10 khung tỉ lệ phổ biến + kiểm tra tự động)
//   p = đường dẫn trang cần xem (mặc định "/")
//   r = 1 khi xoay ngang (máy tính bảng / điện thoại)
// Mỗi thiết bị là một iframe kích thước thật, thu nhỏ cho vừa màn hình nên
// bố cục bên trong y hệt khi chạy trên thiết bị đó.
// ============================================================================
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Columns3,
  LayoutGrid,
  ExternalLink,
  Monitor,
  RefreshCw,
  RotateCw,
  Smartphone,
  Tablet,
} from 'lucide-react';
import { CheckResult, SCREEN_MATRIX, checkFrame, prepareFrame } from './screenChecks';

type DeviceId = 'desktop' | 'tablet' | 'phone';
type ViewMode = DeviceId | 'all' | 'matrix';

const DEVICES: Record<DeviceId, { label: string; w: number; h: number; Icon: typeof Monitor }> = {
  desktop: { label: 'Máy tính', w: 1366, h: 768, Icon: Monitor },
  tablet: { label: 'Máy tính bảng', w: 820, h: 1180, Icon: Tablet },
  phone: { label: 'Điện thoại (19,5:9)', w: 390, h: 845, Icon: Smartphone },
};
const DEVICE_ORDER: DeviceId[] = ['desktop', 'tablet', 'phone'];

const LABEL_H = 30; // chiều cao dòng tên thiết bị phía trên mỗi khung
const GAP = 20;

function readParams() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const d = q.get('d');
  const mode: ViewMode = d === 'tablet' || d === 'phone' || d === 'all' || d === 'matrix' ? d : 'desktop';
  let path = q.get('p') || '/';
  // Không cho trang xem thử tự nhúng chính nó (lặp vô hạn) và chỉ nhận đường dẫn cùng máy chủ
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('#/devices')) path = '/';
  return { mode, path, rotated: q.get('r') === '1' };
}

function frameSize(id: DeviceId, rotated: boolean) {
  const { w, h } = DEVICES[id];
  // Máy tính đã nằm ngang sẵn, chỉ xoay máy tính bảng và điện thoại
  return rotated && id !== 'desktop' ? { w: h, h: w } : { w, h };
}

export function DevicePreview() {
  const initial = useMemo(readParams, []);
  const [mode, setMode] = useState<ViewMode>(initial.mode);
  const [rotated, setRotated] = useState(initial.rotated);
  const [path] = useState(initial.path);
  const [reloadKey, setReloadKey] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 1200, h: 700 });

  // Ghi trạng thái lên địa chỉ để tải lại / chia sẻ link vẫn giữ đúng chế độ xem
  useEffect(() => {
    const q = new URLSearchParams({ d: mode, p: path });
    if (rotated) q.set('r', '1');
    history.replaceState(null, '', `#/devices?${q.toString()}`);
  }, [mode, path, rotated]);

  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    document.title = 'Xem thử theo thiết bị – Luyện gõ 10 ngón';
    return () => link.remove();
  }, []);

  const shown: DeviceId[] = mode === 'all' ? DEVICE_ORDER : mode === 'matrix' ? [] : [mode];
  const sizes = shown.map((id) => ({ id, ...frameSize(id, rotated) }));

  // ---- Bộ 10 khung tỉ lệ màn hình phổ biến + kiểm tra tự động ----
  const MATRIX_COLS = 5;
  const matrixScale = Math.max(0.08, (stage.w - 40 - (MATRIX_COLS - 1) * 14) / MATRIX_COLS / 1920);
  const frameRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const [results, setResults] = useState<Record<string, CheckResult | 'running'>>({});
  const [checking, setChecking] = useState(false);
  const runChecks = useCallback(async () => {
    setChecking(true);
    const all: Record<string, CheckResult> = {};
    for (const sz of SCREEN_MATRIX) {
      const win = frameRefs.current[sz.id]?.contentWindow;
      if (!win) continue;
      setResults((r) => ({ ...r, [sz.id]: 'running' }));
      try {
        await prepareFrame(win);
        all[sz.id] = await checkFrame(win, sz.w, sz.h);
      } catch (err) {
        all[sz.id] = { errors: [`Không kiểm tra được: ${String(err)}`], warnings: [], metrics: {} };
      }
      setResults((r) => ({ ...r, [sz.id]: all[sz.id] }));
    }
    // Để công cụ tự động (và người phát triển) đọc kết quả từ bảng điều khiển trình duyệt
    (window as any).__matrixResults = all;
    setChecking(false);
  }, []);
  const passCount = SCREEN_MATRIX.filter((sz) => {
    const r = results[sz.id];
    return r && r !== 'running' && r.errors.length === 0;
  }).length;
  const doneCount = SCREEN_MATRIX.filter((sz) => results[sz.id] && results[sz.id] !== 'running').length;

  // Một tỉ lệ thu nhỏ CHUNG cho mọi khung để so sánh kích thước thật giữa các thiết bị
  const scale = useMemo(() => {
    if (!sizes.length) return 1;
    const totalW = sizes.reduce((s, f) => s + f.w, 0) + GAP * (sizes.length - 1);
    const maxH = Math.max(...sizes.map((f) => f.h));
    const sw = (stage.w - 32) / totalW;
    const sh = (stage.h - 32 - LABEL_H) / maxH;
    return Math.max(0.1, Math.min(1, sw, sh));
  }, [sizes, stage]);

  const reloadAll = useCallback(() => setReloadKey((k) => k + 1), []);

  // Phím tắt: 1/2/3/4 đổi thiết bị, R xoay, F5 bị trình duyệt dùng nên dùng phím L để tải lại khung
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const map: Record<string, ViewMode> = { '1': 'desktop', '2': 'tablet', '3': 'phone', '4': 'all', '5': 'matrix' };
      if (map[e.key]) setMode(map[e.key]);
      else if (e.key.toLowerCase() === 'r') setRotated((v) => !v);
      else if (e.key.toLowerCase() === 'l') reloadAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reloadAll]);

  const canRotate = mode !== 'desktop' && mode !== 'matrix';

  return (
    <div className="dvp-page">
      <style>{CSS}</style>
      <header className="dvp-bar" role="toolbar" aria-label="Điều khiển xem thử theo thiết bị">
        <button type="button" className="dvp-btn" onClick={() => (window.location.href = path)}>
          <ArrowLeft size={18} aria-hidden /> Trang chủ
        </button>
        <span className="dvp-title">Xem thử theo thiết bị</span>
        {DEVICE_ORDER.map((id) => {
          const { label, Icon } = DEVICES[id];
          return (
            <button
              key={id}
              type="button"
              className={`dvp-btn ${mode === id ? 'is-active' : ''}`}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              title={`${label} – ${frameSize(id, rotated).w}×${frameSize(id, rotated).h}`}
            >
              <Icon size={18} aria-hidden /> {label}
            </button>
          );
        })}
        <button
          type="button"
          className={`dvp-btn ${mode === 'all' ? 'is-active' : ''}`}
          aria-pressed={mode === 'all'}
          onClick={() => setMode('all')}
        >
          <Columns3 size={18} aria-hidden /> Cả ba
        </button>
        <button
          type="button"
          className={`dvp-btn ${mode === 'matrix' ? 'is-active' : ''}`}
          aria-pressed={mode === 'matrix'}
          onClick={() => setMode('matrix')}
          title="10 khung: 16:9, 16:10 (MacBook), 3:2 (Surface), máy tính bảng 4:3 và 16:10 dọc/ngang (phím 5)"
        >
          <LayoutGrid size={18} aria-hidden /> Bộ tỉ lệ (10)
        </button>
        {mode === 'matrix' && (
          <button type="button" className="dvp-btn dvp-check" onClick={runChecks} disabled={checking}>
            <CheckCircle2 size={18} aria-hidden />
            {checking ? `Đang kiểm tra ${doneCount}/10…` : doneCount ? `Kiểm tra lại (${passCount}/10 đạt)` : 'Kiểm tra tự động'}
          </button>
        )}
        <span className="dvp-spacer" />
        <button
          type="button"
          className={`dvp-btn dvp-soft ${rotated ? 'is-on' : ''}`}
          aria-pressed={rotated}
          disabled={!canRotate}
          onClick={() => setRotated((v) => !v)}
          title={canRotate ? 'Xoay máy tính bảng / điện thoại (phím R)' : 'Chọn máy tính bảng hoặc điện thoại để xoay'}
        >
          <RotateCw size={18} aria-hidden /> {rotated ? 'Xoay dọc' : 'Xoay ngang'}
        </button>
        <button type="button" className="dvp-btn dvp-soft" onClick={reloadAll} title="Tải lại mọi khung (phím L)">
          <RefreshCw size={18} aria-hidden /> Tải lại
        </button>
        <button
          type="button"
          className="dvp-btn dvp-soft"
          onClick={() => window.open(path, '_blank', 'noopener')}
          title="Mở trang trong thẻ mới, kích thước thật"
        >
          <ExternalLink size={18} aria-hidden /> Mở riêng
        </button>
      </header>

      <main ref={stageRef} className={`dvp-stage ${mode === 'matrix' ? 'is-matrix' : ''}`}>
        {mode === 'matrix' && (
          <div className="dvp-grid" style={{ gridTemplateColumns: `repeat(${MATRIX_COLS}, ${1920 * matrixScale}px)` }}>
            {SCREEN_MATRIX.map((sz) => {
              const r = results[sz.id];
              const state = !r ? 'idle' : r === 'running' ? 'running' : r.errors.length ? 'fail' : r.warnings.length ? 'warn' : 'pass';
              return (
                <figure key={sz.id} className="dvp-cell" data-screen={sz.id} data-state={state}>
                  <figcaption className="dvp-cell-head">
                    <span className="dvp-ratio">{sz.group}</span>
                    <span className="dvp-cell-name">
                      {sz.label} · {sz.w}×{sz.h}
                    </span>
                    <span className={`dvp-state is-${state}`}>
                      {state === 'idle' ? 'Chưa thử' : state === 'running' ? 'Đang thử…' : state === 'fail' ? 'Lỗi' : state === 'warn' ? 'Lưu ý' : 'Đạt'}
                    </span>
                  </figcaption>
                  <div className="dvp-screen" style={{ width: sz.w * matrixScale, height: sz.h * matrixScale }}>
                    <iframe
                      ref={(el) => {
                        frameRefs.current[sz.id] = el;
                      }}
                      key={`${sz.id}-${reloadKey}`}
                      title={`Xem thử ${sz.label} ${sz.w}×${sz.h}`}
                      src={path}
                      style={{ width: sz.w, height: sz.h, transform: `scale(${matrixScale})` }}
                    />
                  </div>
                  {r && r !== 'running' && (r.errors.length > 0 || r.warnings.length > 0) && (
                    <ul className="dvp-issues">
                      {r.errors.map((e) => (
                        <li key={e} className="is-err">{e}</li>
                      ))}
                      {r.warnings.map((e) => (
                        <li key={e} className="is-warn">{e}</li>
                      ))}
                    </ul>
                  )}
                </figure>
              );
            })}
          </div>
        )}
        <div className="dvp-row" style={{ gap: GAP * scale, display: mode === 'matrix' ? 'none' : undefined }}>
          {sizes.map((f) => (
            <figure key={f.id} className="dvp-frame" style={{ width: f.w * scale }}>
              <figcaption className="dvp-label" style={{ height: LABEL_H }}>
                <span title={`${DEVICES[f.id].label} · ${f.w}×${f.h}`}>
                  {DEVICES[f.id].label} · {f.w}×{f.h}
                </span>
                {scale < 1 && <span className="dvp-zoom">{Math.round(scale * 100)}%</span>}
              </figcaption>
              <div className="dvp-screen" style={{ width: f.w * scale, height: f.h * scale }}>
                <iframe
                  key={`${f.id}-${reloadKey}-${rotated}`}
                  title={`Xem thử trên ${DEVICES[f.id].label}`}
                  src={path}
                  style={{ width: f.w, height: f.h, transform: `scale(${scale})` }}
                />
              </div>
            </figure>
          ))}
        </div>
      </main>
    </div>
  );
}

// Phong cách mẫu (Quickplay): Be Vietnam Pro, tông xanh dương sáng, nút viên thuốc.
// Viết trong trang để công cụ này độc lập, không đụng vào giao diện của phần mềm.
const CSS = `
.dvp-page{--primary:#1668f2;--primary-ink:#0b4fd0;--primary-soft:#e3eeff;--line:#cfe0fb;--ink:#0a1730;--ink-2:#46556e;
  position:fixed;inset:0;display:flex;flex-direction:column;font-family:'Be Vietnam Pro',system-ui,sans-serif;color:var(--ink);
  background:radial-gradient(900px 400px at 0 0,#d6e7ff,transparent 60%),radial-gradient(900px 400px at 100% 0,#dff0ff,transparent 60%),#eef5ff;
  user-select:none}
.dvp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:12px 16px 0;padding:10px 14px;background:rgba(255,255,255,.92);
  backdrop-filter:blur(10px);border:1.5px solid var(--line);border-radius:24px;box-shadow:0 8px 24px rgba(22,104,242,.08)}
.dvp-title{font-weight:800;font-size:15px;letter-spacing:-.01em;margin:0 4px}
.dvp-spacer{flex:1}
.dvp-btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid var(--line);
  background:#fff;color:var(--ink);font:700 15px/1 'Be Vietnam Pro',system-ui,sans-serif;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s}
.dvp-btn:hover:not(:disabled){transform:scale(1.04);border-color:#9ec3fb}
.dvp-btn:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}
.dvp-btn.is-active{background:linear-gradient(180deg,#2f80ff,#1262f0);color:#fff;border-color:transparent;box-shadow:0 8px 20px rgba(22,104,242,.35)}
.dvp-soft{background:var(--primary-soft);border-color:transparent}
.dvp-soft.is-on{background:#fef3c7;color:#92400e}
.dvp-btn:disabled{opacity:.45;cursor:not-allowed}
.dvp-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:16px;overflow:hidden}
.dvp-row{display:flex;align-items:flex-start;justify-content:center}
.dvp-frame{margin:0;flex:none;display:flex;flex-direction:column;align-items:center;min-width:0}
/* Tên thiết bị không được làm khung rộng hơn màn hình đã thu nhỏ (nếu không khung sẽ tràn ra ngoài) */
.dvp-label{display:flex;align-items:center;justify-content:center;gap:6px;max-width:100%;overflow:hidden;font-weight:700;font-size:13px;color:var(--ink-2);white-space:nowrap}
.dvp-label>span:first-child{overflow:hidden;text-overflow:ellipsis}
.dvp-zoom{font-weight:600;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--primary-soft);color:var(--primary-ink)}
.dvp-screen{position:relative;overflow:hidden;border-radius:14px;background:#fff;border:1.5px solid var(--line);box-shadow:0 14px 34px rgba(10,23,48,.14)}
.dvp-screen iframe{position:absolute;left:0;top:0;border:0;transform-origin:0 0;background:#fff}
.dvp-stage.is-matrix{align-items:flex-start;overflow:auto}
.dvp-grid{display:grid;gap:18px 14px;align-items:start}
.dvp-cell{margin:0;display:flex;flex-direction:column;gap:6px;min-width:0}
.dvp-cell-head{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--ink-2);min-width:0}
.dvp-cell-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dvp-ratio{padding:2px 8px;border-radius:999px;background:var(--primary-soft);color:var(--primary-ink);font-weight:800}
.dvp-state{padding:2px 8px;border-radius:999px;font-weight:800;white-space:nowrap}
.dvp-state.is-idle{background:#eef2f7;color:#64748b}.dvp-state.is-running{background:#e0f2fe;color:#075985}
.dvp-state.is-pass{background:#dcfce7;color:#166534}.dvp-state.is-warn{background:#fef3c7;color:#92400e}.dvp-state.is-fail{background:#fee2e2;color:#991b1b}
.dvp-cell[data-state=fail] .dvp-screen{border-color:#f87171}.dvp-cell[data-state=pass] .dvp-screen{border-color:#4ade80}
.dvp-issues{margin:0;padding:0 0 0 16px;font-size:11.5px;line-height:1.4}
.dvp-issues .is-err{color:#991b1b}.dvp-issues .is-warn{color:#92400e}
.dvp-check{background:linear-gradient(180deg,#22c55e,#16a34a);color:#fff;border-color:transparent}
@media (prefers-reduced-motion:reduce){.dvp-btn{transition:none}.dvp-btn:hover:not(:disabled){transform:none}}
`;
