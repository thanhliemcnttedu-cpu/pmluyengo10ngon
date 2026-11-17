# Luyện Gõ Bàn Phím 10 Ngón – Tiểu học

Phần mềm giúp học sinh tiểu học (lớp 3–5) luyện gõ bàn phím 10 ngón và gõ tiếng Việt (Telex / VNI) theo nội dung sách giáo khoa. Dùng trên **máy tính** và **máy tính bảng có bàn phím rời**; chạy được trên trình duyệt (web) và bản cài đặt Windows (`.exe`, chạy offline).

## Tính năng chính
- Bàn phím ảo tô màu theo ngón tay, hình bàn tay chỉ ngón cần dùng, cảnh báo sai chữ hoa/thường.
- Bộ máy gõ tiếng Việt: chấp nhận gõ dấu trước/sau, nhận diện khi máy đang bật Unikey/EVKey.
- Lộ trình bài: hàng phím cơ sở → hàng trên/dưới/số → ký hiệu → tiếng Việt có dấu → thơ/văn SGK → phím số Numpad.
- 5 trò chơi luyện gõ, chấm sao, huy hiệu.
- Góc Giáo Viên: soạn/sửa bài, chụp trang SGK để AI trích nội dung (Gemini), giao bài cho từng khối lớp, nhập/xuất dữ liệu qua USB.

## Công nghệ
React 19 + TypeScript + Vite + Tailwind 4 · Express (máy chủ dev/API) · Supabase (CSDL + ảnh + realtime) · Electron (bản Windows).

## Chạy trên máy (môi trường phát triển)
Yêu cầu: Node.js 20 trở lên.

```bash
npm install
```

Tạo tệp `.env.local` (không đưa lên kho mã) từ mẫu `.env.example`:

| Biến | Ý nghĩa |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Dự án Supabase dùng chung giữa giáo viên và học sinh |
| `GEMINI_API_KEY` | Khóa Gemini cho chức năng chụp SGK (bỏ trống thì chức năng này báo lỗi rõ ràng, phần còn lại vẫn chạy) |
| `PORT` | Cổng máy chủ, mặc định 3000 |

```bash
npm run dev
```
Mở http://localhost:3000.

> Khi thử nghiệm mà không muốn ghi vào CSDL thật, đặt `VITE_SUPABASE_URL` trỏ tới một địa chỉ không tồn tại (ví dụ `http://127.0.0.1:54399`): ứng dụng tự chuyển sang lưu cục bộ (`localStorage` + `/api/lessons`).

## Kiểm tra
```bash
npm run lint
```
(kiểm tra kiểu TypeScript)

```bash
npx tsx tests/run-all.ts
```
(test bộ máy gõ tiếng Việt, ký hiệu, dữ liệu bài học)

## Đóng gói
```bash
npm run build
```
Bản web ra thư mục `dist/` (triển khai Vercel theo `vercel.json`).

```bash
npm run build:exe
```
Bản cài Windows ra thư mục `dist_electron/` (NSIS + portable). Bản `.exe` không có máy chủ Express, nên chức năng AI chụp SGK chỉ chạy ở bản web.

## Cấu trúc thư mục
| Đường dẫn | Nội dung |
|---|---|
| `src/App.tsx` | Trạng thái chính, xử lý phím, đồng bộ dữ liệu |
| `src/components/` | Bàn phím, bàn tay, vùng gõ, trò chơi, Góc Giáo Viên, các hộp thoại |
| `src/utils/vietnamese*.ts` | Bộ máy Telex/VNI, tách chữ thành chuỗi phím |
| `src/data/` | Bài học, sơ đồ bàn phím, chủ đề bàn phím, từ cho trò chơi |
| `src/lib/supabase.ts` | Đọc/ghi Supabase, tải ảnh, realtime |
| `server.ts` | Máy chủ Express: API bài học, giao bài, AI trích SGK |
| `electron/` | Tiến trình chính của bản Windows |
| `supabase_schema.sql` | Lệnh tạo bảng, quyền và kho ảnh trên Supabase |
| `tests/` | Test tự động (chạy bằng `tsx`, không cần thư viện test) |

## Lưu ý bảo mật (cần xử lý trước khi dùng rộng rãi)
- Mật khẩu Góc Giáo Viên đang nằm trong mã phía trình duyệt, ai xem mã nguồn trang cũng đọc được.
- Chính sách Supabase hiện cho phép mọi người có khóa công khai thêm/sửa/xóa bài học và ảnh.

Hướng khắc phục khuyến nghị: dùng Supabase Auth cho tài khoản giáo viên và chỉ cho phép ghi khi đã đăng nhập.

## Tác giả
Nguyễn Thanh Liêm.
