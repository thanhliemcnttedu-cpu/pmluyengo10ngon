// ============================================================================
// KIỂM TRA TỰ ĐỘNG BỐ CỤC TRÊN MỘT KHUNG MÀN HÌNH (chỉ dùng khi phát triển)
// Chạy bên trong iframe cùng nguồn của trang /#/devices: tự đóng thông báo, chọn lớp,
// rồi đo các lỗi người dùng nhìn thấy ngay (tràn ngang, bàn phím bị che, phím quá nhỏ...).
// ============================================================================

export interface ScreenSize {
  id: string;
  group: string; // nhóm tỉ lệ để hiển thị
  label: string;
  w: number;
  h: number;
}

// Bộ khung màn hình phổ biến (điểm ảnh CSS) – theo yêu cầu: 16:9, 16:10, 3:2, máy tính bảng 4:3 và 16:10
export const SCREEN_MATRIX: ScreenSize[] = [
  { id: 'hd', group: '16:9', label: 'Laptop HD', w: 1366, h: 768 },
  { id: 'fhd125', group: '16:9', label: 'Laptop Full HD (125%)', w: 1536, h: 864 },
  { id: 'fhd', group: '16:9', label: 'Màn Full HD', w: 1920, h: 1080 },
  { id: 'mac', group: '16:10', label: 'MacBook Air/Pro', w: 1440, h: 900 },
  { id: 'surface', group: '3:2', label: 'Surface Pro/Laptop', w: 1368, h: 912 },
  { id: 'ipad-l', group: '4:3', label: 'iPad ngang', w: 1024, h: 768 },
  { id: 'ipad-p', group: '4:3', label: 'iPad dọc', w: 768, h: 1024 },
  { id: 'tab-l', group: '16:10', label: 'Tablet Android ngang', w: 1280, h: 800 },
  { id: 'tab-p', group: '16:10', label: 'Tablet Android dọc', w: 800, h: 1280 },
  { id: 'ipadair', group: 'iPad Air', label: 'iPad Air dọc', w: 820, h: 1180 },
];

export interface CheckResult {
  errors: string[];
  warnings: string[];
  metrics: Record<string, number | string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bấm phần tử nhỏ nhất có chữ bắt đầu bằng `text` (nút giả dạng div vẫn bấm được). */
function clickByText(doc: Document, text: string): boolean {
  const cands = [...doc.querySelectorAll<HTMLElement>('button, [role=button], div, span, a')].filter(
    (e) => e.offsetParent !== null && (e.innerText || '').trim().toUpperCase().startsWith(text.toUpperCase())
  );
  if (!cands.length) return false;
  cands.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
  const el = (cands[0].closest('button, [role=button]') as HTMLElement) || cands[0];
  el.click();
  return true;
}

/** Đưa ứng dụng trong khung về màn hình luyện gõ (đóng thông báo Unikey, chọn Lớp 3). */
export async function prepareFrame(win: Window): Promise<void> {
  const doc = win.document;
  for (let i = 0; i < 20 && !doc.querySelector('[data-key-code="Space"]'); i++) await sleep(250);
  // Nút đóng thông báo Unikey (tên mới "BẮT ĐẦU LUYỆN GÕ", giữ tên cũ để tương thích)
  for (let i = 0; i < 3 && (clickByText(doc, 'BẮT ĐẦU LUYỆN GÕ') || clickByText(doc, 'Tớ Đã Hiểu')); i++) await sleep(700);
  for (let i = 0; i < 3 && clickByText(doc, 'VÀO HỌC LỚP 3'); i++) await sleep(900);
  await sleep(600);
}

/** Đo các lỗi bố cục người dùng nhìn thấy trên khung kích thước w×h. */
export async function checkFrame(win: Window, w: number, h: number): Promise<CheckResult> {
  const doc = win.document;
  const errors: string[] = [];
  const warnings: string[] = [];
  const metrics: Record<string, number | string> = {};

  // 1. Tràn ngang: người dùng phải cuộn ngang hoặc bị mất nội dung bên phải
  const appRoot = doc.querySelector<HTMLElement>('div.w-screen.overflow-hidden');
  if (doc.documentElement.scrollWidth > w + 1) errors.push(`Trang tràn ngang ${doc.documentElement.scrollWidth - w}px`);
  if (appRoot && appRoot.scrollWidth > appRoot.clientWidth + 1) {
    errors.push(`Khung ứng dụng tràn ngang ${appRoot.scrollWidth - appRoot.clientWidth}px`);
  }

  // 2. Bàn phím phải nằm trọn trong màn hình
  const space = doc.querySelector<HTMLElement>('[data-key-code="Space"]');
  const keyA = doc.querySelector<HTMLElement>('[data-key-code="KeyA"]');
  if (!space || !keyA) {
    errors.push('Không thấy bàn phím');
  } else {
    const sr = space.getBoundingClientRect();
    metrics['đáy bàn phím'] = Math.round(sr.bottom);
    if (sr.bottom > h + 1) errors.push(`Bàn phím bị che ${Math.round(sr.bottom - h)}px ở đáy màn hình`);
    const kw = keyA.getBoundingClientRect().width;
    metrics['phím A'] = Math.round(kw);
    if (kw < 30) errors.push(`Phím quá nhỏ (${Math.round(kw)}px), trẻ khó nhìn`);
    else if (kw < 40) warnings.push(`Phím hơi nhỏ (${Math.round(kw)}px)`);
  }

  // 3. Vùng văn bản luyện gõ phải nhìn thấy
  const practice = doc.querySelector<HTMLElement>('section[aria-label^="Khu vực luyện gõ"]');
  if (!practice) {
    errors.push('Không thấy vùng luyện gõ');
  } else {
    const pr = practice.getBoundingClientRect();
    metrics['vùng gõ cao'] = Math.round(pr.height);
    if (pr.bottom > h + 1) errors.push('Vùng luyện gõ bị che');
    if (pr.height < 120) warnings.push(`Vùng luyện gõ thấp (${Math.round(pr.height)}px)`);
    if (space) {
      // Khoảng trống bỏ phí giữa vùng gõ và bàn phím
      const kbTop = doc.querySelector<HTMLElement>('[data-key-code="Backquote"]')?.getBoundingClientRect().top ?? 0;
      const gap = kbTop - pr.bottom;
      metrics['khoảng trống'] = Math.round(gap);
      if (gap > h * 0.18) warnings.push(`Khoảng trống thừa ${Math.round(gap)}px giữa vùng gõ và bàn phím`);
    }
  }

  // 4. Thanh tiêu đề: các nút có vừa không
  const header = doc.querySelector<HTMLElement>('header');
  if (header && header.scrollWidth > header.clientWidth + 1) {
    warnings.push(`Thanh tiêu đề phải vuốt ngang (thiếu ${header.scrollWidth - header.clientWidth}px)`);
  }

  // 5. Bàn tay hướng dẫn (nếu đang bật): đầu ngón phải trúng phím
  const ov = doc.querySelector<HTMLElement>('[data-testid="key-hands-overlay"]');
  const setTarget = (win as any).__handsTarget as ((c: string | null, e?: object) => void) | undefined;
  if (ov && ov.querySelector('svg') && setTarget) {
    const frame = ov.parentElement!;
    const sample = ['KeyQ', 'KeyB', 'KeyP', 'Digit6', 'Backspace', 'Enter', 'KeyZ', 'Slash', 'Space', 'KeyH'];
    let miss = 0;
    for (const code of sample) {
      setTarget(code);
      await sleep(320);
      const el = frame.querySelector<HTMLElement>(`[data-key-code="${code}"]`);
      if (!el) continue;
      let x = el.offsetLeft;
      let y = el.offsetTop;
      let p = el.offsetParent as HTMLElement | null;
      while (p && p !== frame) {
        x += p.offsetLeft;
        y += p.offsetTop;
        p = p.offsetParent as HTMLElement | null;
      }
      for (const g of ov.querySelectorAll<SVGGElement>('g[data-active]')) {
        if (g.dataset.active === 'shift') continue;
        const tx = Number(g.dataset.tipX);
        const ty = Number(g.dataset.tipY);
        if (!(tx >= x && tx <= x + el.offsetWidth && ty >= y && ty <= y + el.offsetHeight)) miss++;
      }
    }
    setTarget(null);
    metrics['bàn tay'] = miss ? `${miss} lần trượt phím` : 'trúng 10/10';
    if (miss) errors.push(`Đầu ngón trượt khỏi phím ${miss} lần`);
  } else {
    metrics['bàn tay'] = 'đang tắt';
  }

  return { errors, warnings, metrics };
}
