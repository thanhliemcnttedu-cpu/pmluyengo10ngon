// ============================================================================
// THÔNG TIN PHIÊN BẢN: bản web đang chạy và (nếu mở bằng phần mềm cài trên máy) bản cài
// ============================================================================

declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

/** Phiên bản web đang chạy (lấy từ package.json lúc dựng) */
export const WEB_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
/** Thời điểm dựng bản web (ISO) */
export const WEB_BUILD_TIME: string = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : '';

export interface InstalledAppInfo {
  version: string;
  buildTime: string;
}

/** Thông tin bản cài trên máy; null khi đang mở bằng trình duyệt */
export function getInstalledAppInfo(): InstalledAppInfo | null {
  const env = (globalThis as any).electronEnv;
  if (!env || !env.isElectron) return null;
  return { version: String(env.appVersion || ''), buildTime: String(env.buildTime || '') };
}

/** "18/11/2026 16:50" theo giờ máy */
export function formatBuildTime(iso: string): string {
  if (!iso) return 'không rõ';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'không rõ';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Tách ngày và giờ theo giờ Việt Nam (máy đặt sai múi giờ vẫn hiện đúng) */
function vnParts(iso: string): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return { date: `${get('day')}/${get('month')}/${get('year')}`, time: `${get('hour')}h${get('minute')}p` };
}

/** Ngày phát hành: "19/11/2026" */
export const formatReleaseDate = (iso: string): string => vnParts(iso)?.date ?? 'không rõ';
/** Giờ phát hành: "08h15p" */
export const formatReleaseTime = (iso: string): string => vnParts(iso)?.time ?? 'không rõ';
