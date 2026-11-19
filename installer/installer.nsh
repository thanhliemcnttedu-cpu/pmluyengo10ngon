; ============================================================================
; BỘ CÀI "BÉ LUYỆN GÕ 10 NGÓN" - chỉ 2 lần bấm: Next (trang Chào mừng) -> Finish (tự mở phần mềm)
; electron-builder chèn tệp này vào bộ cài NSIS (xem "nsis.include" trong electron-builder.json).
; Ảnh bên trái lấy từ installer/sidebar.bmp, ảnh đầu trang từ installer/header.bmp.
; ============================================================================

; Dòng "Phiên bản Vx.x.x · phát hành ngày … · vào lúc …" do scripts/ghi-thong-tin-ban-dung.cjs ghi trước khi đóng gói
!if /FileExists "${BUILD_RESOURCES_DIR}\build-info.nsh"
  !include "${BUILD_RESOURCES_DIR}\build-info.nsh"
!endif
!ifndef LUYENGO_VERSION_LINE
  !define LUYENGO_VERSION_LINE "Phiên bản V${VERSION}"
!endif

; Trang Chào mừng (có ảnh thương hiệu bên trái) + chữ cho trang Hoàn tất
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Chào mừng đến với Bé Luyện Gõ 10 Ngón!"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "${LUYENGO_VERSION_LINE}$\r$\n$\r$\nPhần mềm luyện gõ bàn phím 10 ngón cho học sinh Tiểu học (Lớp 3 - 4 - 5).$\r$\n$\r$\nBấm Next để cài đặt. Phần mềm tự cài vào máy, tạo biểu tượng ngoài màn hình Desktop và trong menu Start.$\r$\n$\r$\nNếu máy đã có bản cũ, bộ cài sẽ tự gỡ bản cũ và thay bằng bản mới.$\r$\n$\r$\nTác giả: Nguyễn Thanh Liêm - Zalo 0888 358 363"
  !insertmacro MUI_PAGE_WELCOME

  ; Các dòng dưới được trang Hoàn tất (MUI_PAGE_FINISH) dùng sau khi cài xong
  !define MUI_FINISHPAGE_TITLE "Chúc mừng bạn đã cài đặt xong!"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "Bé Luyện Gõ 10 Ngón đã được cài đặt trên máy tính này.$\r$\n${LUYENGO_VERSION_LINE}$\r$\n$\r$\nBấm Finish để khởi động phần mềm.$\r$\n$\r$\nLần sau mở phần mềm bằng biểu tượng $\"Luyện Gõ 10 Ngón Tiểu Học$\" ngoài màn hình."
  !define MUI_FINISHPAGE_RUN_TEXT "Khởi động Bé Luyện Gõ 10 Ngón ngay"
!macroend
