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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 680,
    title: 'Luyện Gõ Bàn Phím 10 Ngón - Tiểu Học',
    ...(findWindowIcon() ? { icon: findWindowIcon() } : {}),
    backgroundColor: '#f0f9ff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // RỦI RO: tắt webSecurity bỏ chặn same-origin/CORS cho mọi nội dung trong cửa sổ.
      // Giữ nguyên theo hiện trạng; chủ dự án cân nhắc bật lại (base './' đã đủ để nạp file:// cục bộ).
      webSecurity: false,
    },
    autoHideMenuBar: true,
  });

  // Tắt thanh menu mặc định của Electron để giao diện chuyên nghiệp như ứng dụng bản quyền
  Menu.setApplicationMenu(null);

  // Đường dẫn tới bản dựng tĩnh dist/index.html
  const distIndexPath = path.join(__dirname, '../dist/index.html');

  if (fs.existsSync(distIndexPath)) {
    // Chế độ Production / Offline: Nạp trực tiếp từ file index.html cục bộ
    mainWindow.loadFile(distIndexPath);
  } else {
    // Chế độ Development: Nạp qua local server Vite nếu chưa build.
    // Không nạp index.html nguồn khi lỗi: file đó cần Vite biên dịch, nạp thẳng chỉ ra màn hình trắng khó hiểu
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      dialog.showErrorBox(
        'Chưa có bản dựng phần mềm',
        'Không tìm thấy thư mục dist/index.html và không kết nối được máy chủ phát triển (http://localhost:3000).\n\n' +
          'Hãy chạy "npm run build" để tạo bản dựng, hoặc chạy "npm run dev" rồi mở lại phần mềm.'
      );
      app.quit();
    });
  }

  // Khi cửa sổ đóng
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Khi ứng dụng đã sẵn sàng
app.whenReady().then(() => {
  createWindow();

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
