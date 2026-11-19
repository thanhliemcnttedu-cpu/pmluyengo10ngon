// ============================================================================
// GHI KHỐI "THÔNG TIN PHIÊN BẢN" VÀO GHI CHÚ PHÁT HÀNH (dán lên GitHub Releases)
//
//   node scripts/ghi-chu-phat-hanh.cjs          -> cập nhật release/v<phiên bản>/GHI_CHU_PHAT_HANH.md
//   node scripts/ghi-chu-phat-hanh.cjs --dong   -> chỉ in một dòng để ghi vào thông điệp commit bản web
//
// Thời điểm phát hành = thời điểm dựng bộ cài (electron/build-info.json, do ghi-thong-tin-ban-dung.cjs ghi),
// nên trùng với dòng "Bản cài trên máy … vào lúc …" trong phần mềm. Không có tệp đó thì lấy giờ hiện tại.
// Giờ luôn tính theo giờ Việt Nam.
// ============================================================================
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;

let when = new Date();
// --dong (commit bản web): ghi giờ đẩy lên thực tế; ghi chú bộ cài: lấy giờ dựng bộ cài
if (!process.argv.includes('--dong')) try {
  const info = JSON.parse(fs.readFileSync(path.join(root, 'electron', 'build-info.json'), 'utf8'));
  if (info.version === version && info.buildTime) when = new Date(info.buildTime);
} catch {
  /* chưa dựng bộ cài: dùng giờ hiện tại */
}

const parts = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).formatToParts(when);
const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
const ngay = `${get('day')}/${get('month')}/${get('year')}`;
const gio = `${get('hour')}h${get('minute')}p`;

if (process.argv.includes('--dong')) {
  console.log(`Thông tin phiên bản: ${version} · Ngày phát hành: ${ngay} · Vào lúc: ${gio}`);
  process.exit(0);
}

const BLOCK_START = '### Thông tin phiên bản';
const block = [
  BLOCK_START,
  `- **Phiên bản:** ${version}`,
  `- **Ngày phát hành:** ${ngay}`,
  `- **Vào lúc:** ${gio}`,
  `- **Tệp cài:** BeLuyenGo10Ngon-Setup-${version}.exe`,
  '',
].join('\n');

const dir = path.join(root, 'release', `v${version}`);
const file = path.join(dir, 'GHI_CHU_PHAT_HANH.md');
fs.mkdirSync(dir, { recursive: true });

let text = fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  : `## Bé Luyện Gõ 10 Ngón – bản cập nhật ${version}\n\n### Có gì mới\n- (ghi các tính năng mới ở đây)\n`;

if (text.includes(BLOCK_START)) {
  // Thay khối cũ (từ tiêu đề khối tới tiêu đề "###" kế tiếp)
  text = text.replace(/### Thông tin phiên bản\n[\s\S]*?(?=\n### |\n## |$)/, block.trimEnd() + '\n');
} else {
  // Chèn ngay sau dòng tiêu đề đầu tiên (và đoạn giới thiệu ngay sau nó, nếu có)
  const lines = text.split('\n');
  let at = lines.findIndex((l) => l.startsWith('## '));
  at = at < 0 ? 0 : at + 1;
  while (at < lines.length && !lines[at].startsWith('### ')) at++;
  lines.splice(at, 0, block);
  text = lines.join('\n');
}
fs.writeFileSync(file, text);
console.log(`[ghi-chu] ${path.relative(root, file)}: phiên bản ${version} · ngày ${ngay} · vào lúc ${gio}`);
