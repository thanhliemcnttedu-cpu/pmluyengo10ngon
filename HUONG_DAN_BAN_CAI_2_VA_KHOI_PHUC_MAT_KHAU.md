# Hướng dẫn: Bản cài 2.0, tự cập nhật và khôi phục mật khẩu quản trị

## 1. Bản cài mới có gì khác

- **Tự cập nhật giao diện:** khi máy có mạng, phần mềm mở bản web mới nhất tại `https://luyengo10ngon.vercel.app`. Mỗi lần tác giả đưa bản mới lên web, mọi máy đã cài bản 2.0 có ngay giao diện mới, **không phải cài lại**.
- **Mất mạng vẫn chạy:** phần mềm tự dùng bản đóng gói sẵn trong máy (giao diện tại thời điểm dựng bản cài).
- **Máy đã cài bản cũ (1.0.0):** bản cũ không có cơ chế tự cập nhật, nên phải cài bản 2.0 **một lần**. Bộ cài 2.0 tự gỡ bản cũ.
- Lưu ý: tiến độ và cài đặt lưu trên máy được tách riêng giữa lúc có mạng (bản web) và lúc mất mạng (bản trong máy). Bài học và bài giao vẫn đồng bộ qua Supabase như trước.

## 2. Cài đặt trên máy học sinh / giáo viên

1. Chép tệp `BeLuyenGo10Ngon-Setup-2.0.0.exe` vào máy.
2. Chuột phải vào tệp → **Open** (hoặc **Run as administrator**).
3. Nếu Windows hiện màn xanh "Windows protected your PC": bấm **More info** → **Run anyway**. (Bộ cài chưa có chữ ký số trả phí nên Windows cảnh báo; phần mềm vẫn an toàn.)
4. Hộp hỏi quyền quản trị (UAC): bấm **Yes**.
5. Trang Chào mừng: bấm **Next** (một lần duy nhất).
6. Chờ cài khoảng 10–30 giây → trang **"Chúc mừng bạn đã cài đặt xong!"** → bấm **Finish**, phần mềm tự khởi động.

## 3. Tài khoản quản trị

- Tên đăng nhập duy nhất: `admin`.
- Mật khẩu ban đầu: `Tanuyen@2026`.
- Tài khoản `giaovien` và mật khẩu phụ cũ **đã bị bỏ**.

## 4. Bật chức năng "Quên mật khẩu" (gửi mã OTP về Gmail) — thầy làm 1 lần

Chức năng cần tài khoản admin nằm trên Supabase, gắn với Gmail của tác giả. Làm theo thứ tự:

### Bước 4.1. Tạo tài khoản admin trên Supabase
1. Vào https://supabase.com/dashboard → chọn dự án `nslilflaawfbstlosqkf`.
2. Menu trái **Authentication** → **Users** → nút **Add user** → **Create new user**.
3. Email: Gmail của tác giả. Password: `Tanuyen@2026`. Tick **Auto Confirm User**. Bấm **Create user**.

### Bước 4.2. Cho thư khôi phục hiện mã OTP 6 số
1. **Authentication** → **Emails** (hoặc **Email Templates**) → mẫu **Reset Password**.
2. Thay nội dung thư bằng (giữ nguyên `{{ .Token }}`):

   ```html
   <h2>Mã khôi phục mật khẩu Bé Luyện Gõ 10 Ngón</h2>
   <p>Mã OTP của thầy/cô là: <b style="font-size:24px">{{ .Token }}</b></p>
   <p>Nhập mã này vào phần mềm để đặt mật khẩu mới. Mã hết hạn sau 1 giờ.</p>
   <p>Nếu thầy/cô không yêu cầu đổi mật khẩu, hãy bỏ qua thư này.</p>
   ```
3. Bấm **Save**.

### Bước 4.3. Thư báo "Mật khẩu vừa được đổi" (không ghi mật khẩu)
1. **Authentication** → **Emails** → mục **Security notifications** (Thông báo bảo mật).
2. Bật **Password changed**. Có thể sửa nội dung sang tiếng Việt, ví dụ: "Mật khẩu quản trị Bé Luyện Gõ 10 Ngón vừa được đổi. Nếu không phải thầy/cô đổi, hãy khôi phục lại ngay."

### Bước 4.4. Khai báo Gmail tác giả cho phần mềm
1. **Vercel** → dự án → **Settings** → **Environment Variables** → thêm `VITE_ADMIN_EMAIL` = Gmail tác giả → **Save** → **Redeploy**.
2. Trên máy dựng bản cài: thêm dòng `VITE_ADMIN_EMAIL=...` vào tệp `.env`, rồi dựng lại bản cài nếu muốn bản trong máy (lúc mất mạng) cũng biết Gmail này.

> Chưa làm bước 4.4 thì phần mềm vẫn đăng nhập được bằng `admin` / `Tanuyen@2026` (kiểm tra trên máy), nhưng chưa khôi phục mật khẩu được.

### Giới hạn gửi thư
Máy chủ thư có sẵn của Supabase chỉ gửi **vài thư mỗi giờ**. Muốn gửi nhiều hơn: **Authentication** → **Emails** → **SMTP Settings** → dùng Gmail riêng với "Mật khẩu ứng dụng" (App password) của Google.

## 5. Cách khôi phục khi quên mật khẩu
1. Mở **Giáo viên** → bấm **"Quên mật khẩu? Khôi phục bằng mã OTP qua Gmail"**.
2. Nhập Gmail tác giả và số điện thoại tác giả (0888 358 363 hoặc 0977 058 363) → **Gửi mã OTP về Gmail**.
3. Mở Gmail (xem cả Thư rác) → lấy mã 6 số → nhập mã + mật khẩu mới (ít nhất 8 ký tự) → **Cập nhật mật khẩu mới**.
4. Đăng nhập lại bằng mật khẩu mới. Gmail nhận thêm thư báo "mật khẩu vừa được đổi" (nếu đã bật bước 4.3).

**Khi mất mạng:** máy nào đã từng đăng nhập trực tuyến thì nhận mật khẩu đúng gần nhất trên máy đó; máy chưa từng đăng nhập trực tuyến thì nhận mật khẩu ban đầu. Khôi phục mật khẩu cần có mạng.

## 6. Tài khoản giáo viên phụ (phân quyền kiểm tra trên máy chủ)

**Quyền:**

| Việc | admin | Giáo viên phụ (GV001, GV002…) | Học sinh |
|---|---|---|---|
| Xem, gõ mọi bài | ✔ | ✔ | ✔ |
| Thêm bài mới | ✔ | ✔ (mã bài `teacher-GV001-…`) | ✘ |
| Sửa / xoá bài | Mọi bài | Chỉ bài do mình tạo | ✘ |
| Giao bài cho lớp, sao lưu USB | ✔ | ✘ | ✘ |
| Tạo / xoá / đặt lại mật khẩu giáo viên | ✔ | ✘ | ✘ |
| Đổi mật khẩu của chính mình | ✔ | ✔ | – |

Quy tắc nằm trong cơ sở dữ liệu Supabase nên không ai vượt quyền được kể cả khi sửa phần mềm. Giáo viên phụ cần mạng Internet để đăng nhập và soạn bài.

**Thầy làm 1 lần, theo đúng thứ tự** (làm xong mục 4.1 và 4.4 trước):

1. **Chạy SQL:** Supabase → **SQL Editor** → **New query** → dán toàn bộ tệp `supabase/migrations/20261117_tai_khoan_giao_vien.sql`. Ở mục 7 cuối tệp, thay `GMAIL_TAC_GIA@gmail.com` bằng Gmail tác giả → **Run**. Kết quả cuối phải có 1 dòng `ADMIN … admin`.
2. **Triển khai hàm máy chủ:** Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor** → đặt tên đúng `quan-ly-giao-vien` → dán toàn bộ tệp `supabase/functions/quan-ly-giao-vien/index.ts` → **Deploy**. (Hàm tự có sẵn khoá quản trị của Supabase, thầy không phải dán khoá nào.)
3. Mở phần mềm → **Giáo viên** → đăng nhập `admin` → mục **Tài khoản giáo viên** → tạo tài khoản (tên đăng nhập không dấu, họ tên, mật khẩu ≥ 8 ký tự). Phần mềm tự cấp mã GV001, GV002…
4. Báo tên đăng nhập + mật khẩu cho giáo viên. Giáo viên đăng nhập ở cùng ô đăng nhập, rồi vào **Đổi mật khẩu** để tự đặt mật khẩu riêng.

> **Lưu ý quan trọng:** sau khi chạy SQL ở bước 1, **chỉ ai đăng nhập** mới thêm/sửa bài được. Vì vậy phải làm mục 4.1 (tạo tài khoản admin trên Supabase) và 4.4 (khai báo `VITE_ADMIN_EMAIL` trên Vercel) **trước**, nếu không admin cũng không lưu bài lên máy chủ được.
>
> Xoá tài khoản giáo viên: bài người đó đã tạo **vẫn giữ lại**, admin quản lý tiếp.

## 7. Dựng lại bản cài (dành cho người phát triển)

```bash
npm run build:exe
```

Tệp cài nằm ở `release/BeLuyenGo10Ngon-Setup-<phiên bản>.exe`. Ảnh và biểu tượng bộ cài ở thư mục `installer/`.

Nếu báo lỗi `EPERM: operation not permitted, rename ... win-unpacked.tmp` (ổ D không cho người dùng thường đổi tên/xoá thư mục), xuất bản cài ra ổ C rồi chép tệp `.exe` về:

```bash
npx electron-builder --win --x64 -c.directories.output=C:/Temp/luyengo-release
```
