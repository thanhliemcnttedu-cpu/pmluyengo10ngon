// ============================================================================
// ELECTRON PRELOAD SCRIPT
// Cung cấp các thông tin môi trường an toàn từ hệ điều hành cho giao diện React
// ============================================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronEnv', {
  isElectron: true,
  platform: process.platform,
  version: process.versions.electron,
  // Mở ảnh SGK bằng trình duyệt mặc định của Windows để dùng Google Ống kính (chuột phải vào ảnh)
  openImageInBrowser: (src) => ipcRenderer.invoke('open-image-in-browser', String(src || '')),
});
