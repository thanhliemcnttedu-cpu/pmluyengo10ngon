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
