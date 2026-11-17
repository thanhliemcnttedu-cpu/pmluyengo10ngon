import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Coffee,
  Heart,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Building2,
  CreditCard,
  User,
  Download,
  Share2,
} from 'lucide-react';

// Sao chép an toàn: trên http qua mạng LAN, navigator.clipboard có thể không tồn tại,
// nên dùng textarea + execCommand('copy') làm dự phòng.
const copyTextSafely = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Bị chặn quyền: thử cách dự phòng bên dưới
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
};

interface AuthorDonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthorDonateModal: React.FC<AuthorDonateModalProps> = ({ isOpen, onClose }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(20000);
  const [imgLoadError, setImgLoadError] = useState<boolean>(false);
  const [copyFailed, setCopyFailed] = useState<boolean>(false);
  // Mã QR phóng to giữa màn hình: rê chuột (tạm thời) hoặc bấm (giữ nguyên, có nút đóng)
  const [bigQr, setBigQr] = useState<{ src: string; title: string; note: string; link?: string; linkLabel?: string } | null>(null);
  const [bigQrPinned, setBigQrPinned] = useState<boolean>(false);
  // Mã QR Zalo tạo ngay trên máy (thư viện qrcode), không gọi dịch vụ ngoài
  const [zaloQr, setZaloQr] = useState<Record<string, string>>({});

  // THÔNG TIN TÁC GIẢ & TÀI KHOẢN BIDV CHÍNH THỨC
  const authorName = 'Nguyễn Thanh Liêm';
  const authorNameUpper = 'NGUYỄN THANH LIÊM';
  const authorNameNoAccent = 'NGUYEN THANH LIEM';
  const schoolName = 'Trường Tiểu học số 1 Tân Uyên';
  
  // SỐ TÀI KHOẢN / SĐT NHẬN & NGÂN HÀNG CHÍNH XÁC
  const accountNumber = '0977058363';
  const accountNumberFormatted = '0977.058.363';
  const bankName = 'BIDV - Chi nhánh Tân Uyên';
  const bankFullName = 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)';
  const bankBranch = 'Chi nhánh Tân Uyên';
  
  // SỐ ĐIỆN THOẠI & ZALO LIÊN HỆ
  const contactPhone1 = '0888.358.363';
  const contactPhone1Raw = '0888358363';
  const contactPhone2 = '0977.058.363';
  const contactPhone2Raw = '0977058363';

  const transferMessage = 'Ung ho phan mem Luyen go SGK';

  // Copy helper
  const copyToClipboard = async (text: string, fieldName: string) => {
    const ok = await copyTextSafely(text);
    // Không chép được thì báo rõ để người dùng tự chép tay, tránh tưởng đã chép.
    setCopyFailed(!ok);
    setCopiedField(ok ? fieldName : null);
    setTimeout(() => {
      setCopiedField(null);
      setCopyFailed(false);
    }, 2500);
  };

  // VietQR URL chính thức từ hệ thống VietQR Napas 24/7 (Ngân hàng BIDV)
  const vietQrUrl = `https://img.vietqr.io/image/BIDV-${accountNumber}-compact2.png?amount=${selectedAmount}&addInfo=${encodeURIComponent(
    transferMessage
  )}&accountName=${encodeURIComponent(authorNameNoAccent)}`;

  // Bỏ mã QR dự phòng tự tạo: chuỗi "2|99|..." không phải chuẩn VietQR nên app ngân hàng không đọc được.
  // Khi ảnh VietQR lỗi (mất mạng) thì hiện số tài khoản dạng chữ để chuyển khoản tay.
  // Đổi số tiền thì thử tải lại ảnh VietQR.
  useEffect(() => {
    setImgLoadError(false);
  }, [selectedAmount]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    Promise.all(
      [contactPhone1Raw, contactPhone2Raw].map((p) =>
        QRCode.toDataURL(`https://zalo.me/${p}`, { width: 640, margin: 2, errorCorrectionLevel: 'M' }).then((url) => [p, url] as const)
      )
    )
      .then((pairs) => alive && setZaloQr(Object.fromEntries(pairs)))
      .catch(() => {
        // Không tạo được QR thì vẫn còn nút "Mở Zalo"
      });
    return () => {
      alive = false;
    };
  }, [isOpen]);

  // VỪA MÀN HÌNH: phóng cả trang theo tỉ lệ (giữ bố cục 2 cột) cho đỡ trống, tối đa 1,5 lần
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isOpen) return;
    const el = panelRef.current;
    if (!el) return;
    // Chỉ cho chuyển động độ mờ & phóng/thu, không cho zoom "trượt dần" làm đo sai
    el.style.transitionProperty = 'opacity, transform';
    const fit = () => {
      el.style.zoom = '1';
      // Màn hẹp (dưới 768px, 1 cột) giữ nguyên cỡ
      if (window.innerWidth < 768) return;
      const parent = el.parentElement;
      const cs = parent ? getComputedStyle(parent) : null;
      const availW = parent && cs ? parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) : window.innerWidth;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (!w || !h) return;
      const z = Math.min(1.5, (availW - 8) / w, (window.innerHeight * 0.94) / h);
      el.style.zoom = z > 1.02 ? z.toFixed(3) : '1';
    };
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    };
    fit();
    schedule();
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!bigQr) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setBigQr(null);
        setBigQrPinned(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [bigQr]);

  const openZalo = (raw: string, pretty: string) => {
    setBigQr({
      src: zaloQr[raw] || '',
      title: `Zalo: ${pretty}`,
      note: 'Mở app Zalo trên điện thoại → Quét mã QR → nhắn tin cho tác giả',
      link: `https://zalo.me/${raw}`,
      linkLabel: 'Mở Zalo trên máy này',
    });
    setBigQrPinned(true);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        data-testid="author-panel"
        className="relative w-full max-w-2xl md:max-w-[min(96vw,1280px)] bg-white rounded-3xl shadow-2xl border-4 border-amber-400 overflow-hidden text-slate-800 animate-in zoom-in-95 duration-200 max-h-[96vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ======================================================== */}
        {/* BANNER TIÊU ĐỀ RỰC RỠ                                    */}
        {/* ======================================================== */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-4 sm:px-6 py-3.5 text-white text-center shadow-md relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/35 text-white transition-all cursor-pointer shadow-xs"
            title="Đóng bảng thông tin"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-white/25 backdrop-blur-md rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase mb-1 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
            <span>KẾT NỐI & ỦNG HỘ NHÀ PHÁT TRIỂN</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-200" />
          </div>

          <h2 className="text-base sm:text-xl font-black tracking-tight text-white drop-shadow-sm flex items-center justify-center gap-2">
            <span>👨‍🏫 THÔNG TIN TÁC GIẢ & DONATE CÀ PHÊ</span>
            <Coffee className="w-5 h-5 text-amber-200 animate-bounce" />
          </h2>
        </div>

        {/* ======================================================== */}
        {/* THÂN MODAL (SCROLLABLE CONTAINER)                        */}
        {/* ======================================================== */}
        <div data-testid="author-body" className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start text-slate-800 custom-scrollbar flex-1 min-h-0 bg-gradient-to-b from-amber-50/50 via-white to-orange-50/30">
          {copyFailed && (
            <div role="alert" className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              Trình duyệt không cho sao chép tự động. Hãy bôi đen và chép tay thông tin bên dưới.
            </div>
          )}
          
          {/* CỘT TRÁI (màn rộng): lời ngỏ + thông tin liên hệ */}
          <div className="space-y-3.5">
          {/* Lời ngỏ chân thành của tác giả */}
          <div className="bg-gradient-to-r from-amber-100/90 to-orange-100/80 border-2 border-amber-400 rounded-2xl p-3 sm:p-4 shadow-2xs flex items-start gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs border-2 border-white">
              ☕
            </div>
            <div className="space-y-1 min-w-0">
              <p className="text-xs sm:text-sm font-black text-amber-950 leading-snug">
                "Để duy trì hoạt động của phần mềm bạn có thể cho tác giả xin 1 ly cà phê nhé. Hãy Donate theo số tài khoản đính kèm."
              </p>
              <p className="text-[11px] text-amber-900/90 leading-relaxed font-medium">
                Sự đồng hành và ủng hộ từ Quý Thầy Cô, Phụ huynh và các em học sinh là nguồn động viên vô giá giúp phần mềm tiếp tục hoàn thiện và cập nhật thêm nhiều bài học SGK chất lượng!
              </p>
            </div>
          </div>

          {/* Khối Thông tin cá nhân & Đơn vị công tác */}
          <div className="bg-white rounded-2xl border-2 border-amber-200 p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-base shadow-2xs">
                  👨‍🏫
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                      {authorName}
                    </h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Giáo viên Tiểu học</span>
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 font-bold mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Trường: <strong>{schoolName}</strong></span>
                  </p>
                </div>
              </div>
            </div>

            {/* Các kênh liên hệ: SĐT & Zalo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2 text-xs">
              {/* SĐT 1 */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-bold block">SĐT &amp; Zalo chính:</span>
                    <button
                      type="button"
                      onClick={() => openZalo(contactPhone1Raw, contactPhone1)}
                      className="font-black text-slate-900 truncate block hover:text-sky-700 hover:underline cursor-pointer text-left"
                      title="Bấm để hiện mã QR Zalo"
                    >
                      {contactPhone1}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contactPhone1Raw, 'phone1')}
                    className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                    title="Sao chép SĐT 0888.358.363"
                  >
                    {copiedField === 'phone1' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    data-zalo={contactPhone1Raw}
                    onClick={() => openZalo(contactPhone1Raw, contactPhone1)}
                    className="px-1.5 py-0.8 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-black text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="Hiện mã QR Zalo và nút mở Zalo"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Zalo</span>
                  </button>
                </div>
              </div>

              {/* SĐT 2 (Nhận chuyển khoản BIDV) */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-sky-50 border border-sky-200">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] text-sky-700 font-bold block">SĐT &amp; Zalo (STK BIDV):</span>
                    <button
                      type="button"
                      onClick={() => openZalo(contactPhone2Raw, contactPhone2)}
                      className="font-black text-sky-950 truncate block hover:text-sky-700 hover:underline cursor-pointer text-left"
                      title="Bấm để hiện mã QR Zalo"
                    >
                      {contactPhone2}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(contactPhone2Raw, 'phone2')}
                    className="p-1 rounded-lg bg-sky-200 hover:bg-sky-300 text-sky-900 transition-colors cursor-pointer"
                    title="Sao chép SĐT 0977.058.363"
                  >
                    {copiedField === 'phone2' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    data-zalo={contactPhone2Raw}
                    onClick={() => openZalo(contactPhone2Raw, contactPhone2)}
                    className="px-1.5 py-0.8 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-black text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="Hiện mã QR Zalo và nút mở Zalo"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>Zalo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          </div>

          {/* ======================================================== */}
          {/* KHỐI DONATE CÀ PHÊ: MÃ QR BIDV CHÍNH XÁC & CHI TIẾT TÀI KHOẢN */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-amber-50/70 rounded-2xl border-3 border-emerald-400 p-3.5 sm:p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-sm">
                  💳
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    TÀI KHOẢN NHẬN DONATE: NGÂN HÀNG BIDV
                  </h4>
                  <p className="text-[11px] text-emerald-800 font-bold">
                    BIDV Chi nhánh Tân Uyên • Quét QR VietQR Napas 24/7
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-950 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>Napas 24/7 Miễn Phí</span>
              </span>
            </div>

            {/* Nút chọn nhanh các mức ủng hộ ly cà phê */}
            <div className="flex items-center gap-2">
              {[
                { amount: 15000, label: '☕ 1 Ly Cà Phê', price: '15.000đ' },
                { amount: 20000, label: '☕ Cà Phê Sữa', price: '20.000đ' },
                { amount: 50000, label: '🧋 2 Ly Cà Phê', price: '50.000đ' },
                { amount: 100000, label: '💖 Tùy Tâm', price: '100.000đ' },
              ].map((item) => (
                <button
                  key={item.amount}
                  type="button"
                  onClick={() => setSelectedAmount(item.amount)}
                  className={`flex-1 py-1.5 px-1.5 rounded-xl font-black text-[11px] sm:text-xs transition-all border cursor-pointer flex flex-col items-center justify-center text-center ${
                    selectedAmount === item.amount
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-102 ring-2 ring-emerald-300'
                      : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-300'
                  }`}
                >
                  <span className="truncate w-full">{item.label}</span>
                  <span className={`text-[10px] font-bold ${selectedAmount === item.amount ? 'text-amber-200' : 'text-slate-500'}`}>
                    {item.price}
                  </span>
                </button>
              ))}
            </div>

            {/* Chi tiết tài khoản ngân hàng BIDV & Mã QR chính xác */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-center">
              
              {/* CỘT MÃ QR BIDV CHÍNH XÁC */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center bg-white p-3 rounded-2xl border-2 border-emerald-300 shadow-sm space-y-1.5">
                <div
                  data-testid="bank-qr"
                  role="button"
                  tabIndex={0}
                  aria-label="Phóng to mã QR ngân hàng"
                  title="Rê chuột hoặc bấm để phóng to mã QR"
                  onMouseEnter={() => {
                    if (imgLoadError || bigQrPinned) return;
                    setBigQr({
                      src: vietQrUrl,
                      title: `Ủng hộ ${selectedAmount.toLocaleString('vi-VN')}đ • BIDV ${accountNumberFormatted}`,
                      note: 'Mở app ngân hàng → Quét QR (tự điền số tài khoản, người nhận & số tiền)',
                    });
                  }}
                  onMouseLeave={() => {
                    if (!bigQrPinned) setBigQr(null);
                  }}
                  onClick={() => {
                    if (imgLoadError) return;
                    setBigQr({
                      src: vietQrUrl,
                      title: `Ủng hộ ${selectedAmount.toLocaleString('vi-VN')}đ • BIDV ${accountNumberFormatted}`,
                      note: 'Mở app ngân hàng → Quét QR (tự điền số tài khoản, người nhận & số tiền)',
                    });
                    setBigQrPinned(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      (e.currentTarget as HTMLDivElement).click();
                    }
                  }}
                  className="relative w-44 h-44 sm:w-48 sm:h-48 md:w-40 md:h-40 lg:w-48 lg:h-48 max-w-full rounded-xl overflow-hidden bg-white flex items-center justify-center border border-slate-200 p-1 cursor-zoom-in group"
                >
                  <span className="pointer-events-none absolute bottom-1 right-1 z-10 bg-slate-900/75 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md opacity-80 group-hover:opacity-100">
                    🔍 Phóng to
                  </span>
                  {!imgLoadError ? (
                    <img
                      src={vietQrUrl}
                      alt={`Mã QR BIDV ủng hộ tác giả ${authorName}`}
                      onError={() => setImgLoadError(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-3 text-xs flex flex-col items-center gap-1.5">
                      <QrCode className="w-12 h-12 text-slate-400" />
                      <span className="font-bold text-slate-800">Chưa tải được mã QR</span>
                      <span className="text-[10px] text-slate-600">Chuyển khoản tay tới BIDV, STK:</span>
                      <span className="text-sm text-slate-900 font-mono font-black">{accountNumberFormatted}</span>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-emerald-950 font-black">
                    📱 Quét mã bằng App BIDV SmartBanking / Mọi App Ngân Hàng
                  </p>
                  <span className="text-[9px] text-slate-500 block">
                    (Tự động điền số tài khoản, người nhận &amp; số tiền)
                  </span>
                </div>
              </div>

              {/* CỘT THÔNG TIN VĂN BẢN VÀ CÁC NÚT SAO CHÉP NHANH */}
              <div className="lg:col-span-7 space-y-2 text-xs">
                
                {/* 1. SỐ TÀI KHOẢN / SĐT NHẬN (0977058363) */}
                <div className="bg-white p-2.5 rounded-xl border-2 border-emerald-300 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Số tài khoản / SĐT nhận:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base sm:text-lg font-black text-emerald-700 tracking-wider font-mono">
                        {accountNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 font-semibold">({accountNumberFormatted})</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(accountNumber, 'stk')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs shrink-0 active:scale-95"
                    title="Sao chép số tài khoản BIDV"
                  >
                    {copiedField === 'stk' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Đã chép!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Sao Chép</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2. NGÂN HÀNG (BIDV CHI NHÁNH TÂN UYÊN) */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Ngân hàng:
                    </span>
                    <strong className="text-slate-900 block truncate text-xs">
                      {bankName}
                    </strong>
                    <span className="text-[10px] text-slate-500 block leading-snug">
                      {bankFullName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bankName, 'bank')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
                    title="Sao chép tên ngân hàng"
                  >
                    {copiedField === 'bank' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* 3. TÊN CHỦ TÀI KHOẢN (NGUYỄN THANH LIÊM) */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Chủ tài khoản:
                    </span>
                    <span className="font-black text-slate-900 uppercase block text-xs tracking-wide">
                      {authorNameUpper}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(authorNameUpper, 'name')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
                    title="Sao chép tên chủ tài khoản"
                  >
                    {copiedField === 'name' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* 4. NỘI DUNG CHUYỂN KHOẢN */}
                <div className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">
                      Nội dung chuyển khoản:
                    </span>
                    <span className="font-bold text-amber-900 truncate block text-[11px] font-mono">
                      {transferMessage}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(transferMessage, 'msg')}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0 cursor-pointer"
                    title="Sao chép nội dung chuyển khoản"
                  >
                    {copiedField === 'msg' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* Lời cảm ơn tri ân */}
          <div className="text-center pt-1 text-slate-600 text-xs md:col-span-2">
            <p className="flex items-center justify-center gap-1.5 font-bold text-amber-900">
              <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse shrink-0" />
              <span>Chân thành cảm ơn sự đồng hành và ủng hộ quý báu của Quý Thầy Cô và các bạn nhỏ!</span>
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* NÚT ĐÓNG                                                 */}
        {/* ======================================================== */}
        <div className="p-3 bg-white border-t border-amber-200 text-center shrink-0 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-sm shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
          >
            <span>Đã Hiểu &amp; Quay Lại Luyện Gõ ➜</span>
          </button>
        </div>
      </div>

      {/* MÃ QR PHÓNG TO GIỮA MÀN HÌNH */}
      {bigQr && (
        <div
          data-testid="big-qr"
          className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${bigQrPinned ? 'bg-slate-950/70' : 'pointer-events-none'}`}
          onClick={(e) => {
            e.stopPropagation();
            if (bigQrPinned) {
              setBigQr(null);
              setBigQrPinned(false);
            }
          }}
        >
          <div
            // Chỉ rê chuột: khung không nhận chuột, nếu không nó che ô QR nhỏ -> "rời chuột" -> tắt ngay (nhấp nháy)
            className={`${bigQrPinned ? 'pointer-events-auto' : 'pointer-events-none'} bg-white rounded-3xl border-4 border-emerald-400 shadow-2xl p-[clamp(12px,2vh,24px)] flex flex-col items-center gap-2 max-w-[94vw]`}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-black text-slate-900 text-center text-[clamp(1rem,2.2vh,1.5rem)]">{bigQr.title}</p>
            {bigQr.src ? (
              <img
                src={bigQr.src}
                alt={bigQr.title}
                className="w-[min(70vh,80vw,640px)] h-[min(70vh,80vw,640px)] object-contain bg-white"
              />
            ) : (
              <div className="w-[min(50vh,80vw)] h-[min(50vh,80vw)] flex items-center justify-center text-slate-500 font-bold">Đang tạo mã QR…</div>
            )}
            <p className="text-slate-600 font-semibold text-center text-[clamp(0.85rem,1.8vh,1.15rem)] max-w-[60ch]">{bigQr.note}</p>
            {bigQrPinned && (
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {bigQr.link && (
                  <a
                    href={bigQr.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-5 rounded-full bg-sky-600 hover:bg-sky-500 text-white font-black flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-5 h-5" />
                    {bigQr.linkLabel}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setBigQr(null);
                    setBigQrPinned(false);
                  }}
                  className="min-h-[44px] px-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-black cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
