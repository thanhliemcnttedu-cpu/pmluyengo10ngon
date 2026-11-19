// Ghi phiên bản và thời điểm dựng bộ cài vào electron/build-info.json (preload đọc để hiện trong phần mềm).
// Chạy ngay trước electron-builder (xem lệnh build:exe trong package.json).
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const info = { version: pkg.version, buildTime: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, '..', 'electron', 'build-info.json'), JSON.stringify(info, null, 2) + '\n');

// Dòng phiên bản cho trang Chào mừng / Hoàn tất của bộ cài (giờ Việt Nam): installer/build-info.nsh
const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).formatToParts(new Date(info.buildTime));
const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
const line = `Phiên bản V${info.version} · phát hành ngày ${get('day')}/${get('month')}/${get('year')} · vào lúc ${get('hour')}h${get('minute')}p`;
// NSIS đọc tệp .nsh có BOM UTF-8 như văn bản Unicode
fs.writeFileSync(
  path.join(__dirname, '..', 'installer', 'build-info.nsh'),
  '\uFEFF; Tự sinh mỗi lần dựng bộ cài (scripts/ghi-thong-tin-ban-dung.cjs) - không sửa tay\r\n' +
    `!define LUYENGO_VERSION_LINE "${line}"\r\n`
);
console.log('[build-info]', line);
console.log('[build-info]', info.version, info.buildTime);
