// ============================================================================
// ELECTRON MAIN PROCESS - PHẦN MỀM LUYỆN GÕ BÀN PHÍM 10 NGÓN TIỂU HỌC
// Chạy cục bộ 100% Offline trên hệ điều hành Windows, không cần kết nối Internet
// ============================================================================

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

// ---------------------------------------------------------------------------
// MỞ ẢNH SGK BẰNG TRÌNH DUYỆT MẶC ĐỊNH (để giáo viên chuột phải -> Google Ống kính)
// Cửa sổ Electron không có Google Ống kính nên phải mở ra Chrome/Edge của máy.
// Ảnh được ghi vào thư mục tạm kèm 1 trang HTML nhỏ, rồi nhờ Windows mở trang đó.
// ---------------------------------------------------------------------------
const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

function writeViewerPage(imageFileName, dir) {
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ảnh SGK - chuột phải để dùng Google Ống kính</title>
<style>body{margin:0;background:#0f172a;font-family:'Segoe UI',sans-serif;color:#fff;text-align:center}
p{margin:12px;font-size:16px}img{max-width:96vw;max-height:88vh;background:#fff;border-radius:8px}</style></head>
<body><p>Chuột phải vào ảnh → <b>Tìm kiếm hình ảnh bằng Google Ống kính</b> → <b>Văn bản</b> → <b>Sao chép</b>, rồi quay lại phần mềm bấm <b>Dán văn bản đã chép</b>.</p>
<img src="${imageFileName}" alt="Ảnh sách giáo khoa"></body></html>`;
  const htmlPath = path.join(dir, imageFileName.replace(/\.[a-z]+$/, '.html'));
  fs.writeFileSync(htmlPath, html, 'utf8');
  return htmlPath;
}

ipcMain.handle('open-image-in-browser', async (_event, src) => {
  try {
    if (typeof src !== 'string' || !src) return { ok: false, error: 'Chưa có ảnh' };
    // Ảnh trên mạng: mở thẳng địa chỉ https
    if (/^https:\/\//i.test(src)) {
      await shell.openExternal(src);
      return { ok: true };
    }
    const dir = path.join(os.tmpdir(), 'luyen-go-anh-sgk');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now();
    let buf;
    let ext;
    const m = src.match(/^data:(image\/[a-z+.-]+);base64,/i);
    if (m) {
      ext = IMAGE_EXT[m[1].toLowerCase()];
      if (!ext) return { ok: false, error: 'Định dạng ảnh không hỗ trợ' };
      buf = Buffer.from(src.slice(m[0].length), 'base64');
    } else if (src.startsWith('/') || src.startsWith('./')) {
      // Ảnh có sẵn trong bản dựng (vd /images/meo_con_di_hoc.jpg): chỉ cho đọc trong thư mục dist
      const distDir = path.join(__dirname, '../dist');
      const full = path.resolve(distDir, '.' + src.replace(/^\./, ''));
      if (!full.startsWith(distDir + path.sep) || !fs.existsSync(full)) return { ok: false, error: 'Không tìm thấy ảnh' };
      ext = (path.extname(full).slice(1) || 'png').toLowerCase();
      if (!Object.values(IMAGE_EXT).includes(ext) && ext !== 'jpeg') return { ok: false, error: 'Định dạng ảnh không hỗ trợ' };
      buf = fs.readFileSync(full);
    } else {
      return { ok: false, error: 'Đường dẫn ảnh không hợp lệ' };
    }
    if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: 'Ảnh quá lớn' };
    const imageName = `anh-sgk-${stamp}.${ext}`;
    fs.writeFileSync(path.join(dir, imageName), buf);
    const htmlPath = writeViewerPage(imageName, dir);
    await shell.openExternal(pathToFileURL(htmlPath).href);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
});

let mainWindow = null;

// Windows không hiển thị icon .svg cho cửa sổ: chỉ dùng .ico/.png nếu có, không có thì bỏ trống (Electron dùng icon mặc định)
function findWindowIcon() {
  const candidates = ['icon.ico', 'icon.png', 'favicon.ico', 'favicon.png', 'logo.png'];
  for (const name of candidates) {
    const p = path.join(__dirname, '../public', name);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// TỰ CẬP NHẬT GIAO DIỆN: có mạng thì mở bản web mới nhất (cập nhật ngay khi tác giả đưa bản mới lên),
// mất mạng thì mở bản đóng gói sẵn trong máy. Có thể ép chạy bản trong máy: chạy kèm --offline
// hoặc đặt biến môi trường LUYENGO_OFFLINE=1; đổi địa chỉ web bằng LUYENGO_APP_URL.
// ---------------------------------------------------------------------------
const APP_URL = (process.env.LUYENGO_APP_URL || 'https://luyengo10ngon.vercel.app/').replace(/\/?$/, '/');
const APP_ORIGIN = new URL(APP_URL).origin;
const FORCE_OFFLINE = process.argv.includes('--offline') || process.env.LUYENGO_OFFLINE === '1';
const ONLINE_CHECK_MS = 6000;

async function isWebReachable() {
  if (FORCE_OFFLINE) return false;
  try {
    const { net } = require('electron');
    if (typeof net.isOnline === 'function' && !net.isOnline()) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ONLINE_CHECK_MS);
    const res = await net.fetch(APP_URL, { method: 'GET', signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function buildWindow(mode) {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    title: 'Bé Luyện Gõ 10 Ngón - Tiểu Học',
    ...(findWindowIcon() ? { icon: findWindowIcon() } : {}),
    backgroundColor: '#eef5ff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Bản web (https): bật đầy đủ bảo mật trình duyệt.
      // Bản trong máy (file://): giữ như trước để nạp tệp cục bộ, ảnh SGK và gọi Supabase không vướng CORS.
      webSecurity: mode === 'online',
    },
    autoHideMenuBar: true,
  });

  // Liên kết ra ngoài (Zalo, Google Ống kính, trang khác...) mở bằng trình duyệt của máy, không mở trong phần mềm
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:|^tel:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const isApp = url.startsWith('file://') || url.startsWith(APP_ORIGIN) || url.startsWith('http://localhost');
    if (!isApp) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  return win;
}

function loadOffline(win) {
  const distIndexPath = path.join(__dirname, '../dist/index.html');
  if (fs.existsSync(distIndexPath)) {
    return win.loadFile(distIndexPath);
  }
  // Chế độ phát triển: chưa build thì nạp máy chủ Vite
  return win.loadURL('http://localhost:3000').catch(() => {
    dialog.showErrorBox(
      'Chưa có bản dựng phần mềm',
      'Không tìm thấy thư mục dist/index.html và không kết nối được máy chủ phát triển (http://localhost:3000).\n\n' +
        'Hãy chạy "npm run build" để tạo bản dựng, hoặc chạy "npm run dev" rồi mở lại phần mềm.'
    );
    app.quit();
  });
}

async function createWindow() {
  // Tắt thanh menu mặc định của Electron để giao diện chuyên nghiệp như ứng dụng bản quyền
  Menu.setApplicationMenu(null);

  if (await isWebReachable()) {
    const win = buildWindow('online');
    mainWindow = win;
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || win.isDestroyed()) return;
      fellBack = true;
      // Mạng chập chờn giữa chừng: chuyển sang bản trong máy (mở cửa sổ mới vì cấu hình bảo mật khác nhau)
      console.log('[luyen-go] Ban web loi giua chung -> chuyen sang ban trong may');
      const off = buildWindow('offline');
      mainWindow = off;
      loadOffline(off);
      win.destroy();
    };
    win.webContents.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) fallBack(); // -3 = ABORTED (đổi trang), không phải lỗi mạng
    });
    console.log('[luyen-go] Mo ban web moi nhat:', APP_URL);
    win.loadURL(APP_URL).catch(fallBack);
  } else {
    console.log('[luyen-go] Khong co mang -> mo ban trong may');
    const win = buildWindow('offline');
    mainWindow = win;
    loadOffline(win);
  }
}

// Chỉ cho mở MỘT cửa sổ phần mềm: bấm biểu tượng lần nữa thì đưa cửa sổ đang mở lên trước
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// TỰ CẬP NHẬT PHẦN MỀM TỪ GITHUB RELEASES (electron-updater)
// Tác giả đăng bản mới lên https://github.com/videodayhoctruyenhinhtanuyen-ux/be-luyen-go-10-ngon/releases
// kèm 3 tệp: BeLuyenGo10Ngon-Setup-<phiên bản>.exe, latest.yml, .exe.blockmap.
// Phần mềm đã cài: mở lên một lúc thì tự hỏi GitHub, có bản mới thì tải ngầm (chỉ tải phần thay đổi
// nếu được), tải xong hỏi "Cập nhật ngay?"; chọn "Để sau" thì tự cài khi tắt phần mềm.
// Lỗi mạng / chưa có bản mới: im lặng, không làm phiền học sinh.
// ---------------------------------------------------------------------------
const UPDATE_FIRST_CHECK_MS = 10 * 1000;
const UPDATE_RECHECK_MS = 4 * 60 * 60 * 1000; // để máy mở cả ngày vẫn nhận bản mới

function setupAutoUpdate() {
  if (!app.isPackaged || FORCE_OFFLINE || process.env.LUYENGO_NO_UPDATE === '1') return;
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (err) {
    console.log('[luyen-go] Khong nap duoc electron-updater:', err && err.message);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // Dành cho người phát triển thử trên máy: lấy bản cập nhật từ một thư mục web khác thay cho GitHub
  if (process.env.LUYENGO_UPDATE_URL) {
    autoUpdater.setFeedURL({ provider: 'generic', url: process.env.LUYENGO_UPDATE_URL });
  }
  autoUpdater.logger = {
    info: (m) => console.log('[cap-nhat]', m),
    warn: (m) => console.log('[cap-nhat] canh bao:', m),
    error: (m) => console.log('[cap-nhat] loi:', m),
    debug: () => {},
  };

  let asked = false;
  autoUpdater.on('update-available', (info) => console.log('[luyen-go] Co ban moi', info && info.version, '-> dang tai'));
  autoUpdater.on('update-not-available', () => console.log('[luyen-go] Dang dung ban moi nhat', app.getVersion()));
  autoUpdater.on('error', (err) => console.log('[luyen-go] Loi kiem tra cap nhat:', err && err.message));
  autoUpdater.on('update-downloaded', async (info) => {
    if (asked) return;
    asked = true;
    const version = (info && info.version) || '';
    const opts = {
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Đã tải xong bản cập nhật ${version} của Bé Luyện Gõ 10 Ngón.`,
      detail:
        'Bấm "Cập nhật ngay" để cài (phần mềm tự tắt và mở lại sau khoảng nửa phút; Windows có thể hỏi quyền, bấm Yes).\n' +
        'Bấm "Để sau" thì bản mới sẽ tự cài khi tắt phần mềm.',
      buttons: ['Cập nhật ngay', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
    const { response } = parent ? await dialog.showMessageBox(parent, opts) : await dialog.showMessageBox(opts);
    if (response === 0) {
      // Cài im lặng (không hiện lại các trang Next) rồi tự mở lại phần mềm
      setImmediate(() => autoUpdater.quitAndInstall(true, true));
    }
  });

  const check = () => autoUpdater.checkForUpdates().catch((err) => console.log('[luyen-go] Khong kiem tra duoc cap nhat:', err && err.message));
  setTimeout(check, UPDATE_FIRST_CHECK_MS);
  setInterval(check, UPDATE_RECHECK_MS);
}

// Khi ứng dụng đã sẵn sàng
app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Đóng ứng dụng khi tất cả các cửa sổ đã tắt (trên Windows)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
