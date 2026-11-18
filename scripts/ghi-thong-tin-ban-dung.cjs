// Ghi phiên bản và thời điểm dựng bộ cài vào electron/build-info.json (preload đọc để hiện trong phần mềm).
// Chạy ngay trước electron-builder (xem lệnh build:exe trong package.json).
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const info = { version: pkg.version, buildTime: new Date().toISOString() };
fs.writeFileSync(path.join(__dirname, '..', 'electron', 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
console.log('[build-info]', info.version, info.buildTime);
