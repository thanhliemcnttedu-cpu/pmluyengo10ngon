// ============================================================================
// ELECTRON PRELOAD SCRIPT
// Cung cấp các thông tin môi trường an toàn từ hệ điều hành cho giao diện React
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

// Phiên bản + thời điểm dựng bộ cài (scripts/ghi-thong-tin-ban-dung.cjs ghi ngay trước khi đóng gói)
let buildInfo = { version: '', buildTime: '' };
try {
  buildInfo = require('./build-info.json');
} catch {
  try {
    buildInfo = { version: require('../package.json').version, buildTime: '' };
  } catch {
    /* không đọc được: để trống */
  }
}

contextBridge.exposeInMainWorld('electronEnv', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  appVersion: String(buildInfo.version || ''),
  buildTime: String(buildInfo.buildTime || ''),
  // Mở ảnh SGK bằng trình duyệt mặc định của Windows để dùng Google Ống kính (chuột phải vào ảnh)
  openImageInBrowser: (src) => ipcRenderer.invoke('open-image-in-browser', String(src || '')),
  // Tự cập nhật: hỏi trạng thái hiện tại và bấm "Cập nhật ngay"
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status').then((s) => (s ? JSON.stringify(s) : '')),
  installUpdateNow: () => ipcRenderer.invoke('install-update-now'),
});

// Trạng thái cập nhật gửi sang trang dưới dạng chuỗi JSON (đối tượng không đi qua được ranh giới preload)
ipcRenderer.on('update-status', (_e, status) => {
  try {
    window.dispatchEvent(new CustomEvent('luyengo-update-status', { detail: JSON.stringify(status || {}) }));
  } catch {
    /* bỏ qua */
  }
});
