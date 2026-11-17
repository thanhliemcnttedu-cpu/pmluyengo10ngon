import React, { useState, useEffect } from 'react';
import { Lesson } from '../types/typing';
import { Maximize2, X, Sparkles, BookOpen, Upload, Volume2, Bookmark, GraduationCap, Feather } from 'lucide-react';
import { DEFAULT_BOOK_COVER, STATIC_DEFAULT_COVER, createFallbackCoverSvg, resolvePublicAssetUrl } from '../utils/imageUtils';

interface TextbookIllustrationCardProps {
  lesson: Lesson;
  onOpenTeacherModal?: () => void;
  onOpenCurriculumModal?: () => void;
  onVoiceSpeak?: (text: string) => void;
  isCompactHeight?: boolean;
}

export const TextbookIllustrationCard: React.FC<TextbookIllustrationCardProps> = ({
  lesson,
  onOpenTeacherModal,
  onOpenCurriculumModal,
  onVoiceSpeak,
  isCompactHeight = false,
}) => {
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  
  // Xác định nguồn ảnh hợp lệ ban đầu
  const getInitialImage = () => {
    if (lesson.imageUrl && lesson.imageUrl.trim() && !lesson.imageUrl.startsWith('/src/')) {
      return resolvePublicAssetUrl(lesson.imageUrl);
    }
    return STATIC_DEFAULT_COVER || DEFAULT_BOOK_COVER;
  };

  const [currentImgSrc, setCurrentImgSrc] = useState<string>(getInitialImage());

  // Khi bài học thay đổi, cập nhật lại đường dẫn ảnh tương ứng
  useEffect(() => {
    setCurrentImgSrc(getInitialImage());
  }, [lesson.id, lesson.imageUrl]);

  const handleImageError = () => {
    // Nếu ảnh bị lỗi 404 hoặc mạng chặn, tự động chuyển sang ảnh SVG minh họa bài học chất lượng cao
    // Thứ tự dự phòng: ảnh gốc/ảnh public -> ảnh đóng gói sẵn (luôn có trong bundle) -> SVG
    if (currentImgSrc !== DEFAULT_BOOK_COVER) {
      setCurrentImgSrc(DEFAULT_BOOK_COVER);
    } else {
      setCurrentImgSrc(createFallbackCoverSvg(lesson.title, lesson.gradeLevel || 3));
    }
  };

  const handleReadAloud = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onVoiceSpeak) {
      onVoiceSpeak(lesson.text);
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(lesson.text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0 bg-white rounded-2xl border-2 border-emerald-400 shadow-sm overflow-hidden text-slate-800">
      {/* 1. THANH TIÊU ĐỀ KHUNG TRANH SGK */}
      <div className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-100 via-teal-50 to-amber-50 border-b border-emerald-200 flex items-center justify-between gap-1.5 shrink-0 select-none">
        {/* Tên bài & lớp đã hiện ở vùng gõ và thanh trên -> ở đây chỉ ghi nhãn ngắn */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-lg leading-none shrink-0">📖</span>
          <h3 className="text-emerald-950 font-black text-sm truncate">Sách giáo khoa</h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Nút nghe đọc mẫu */}
          <button
            type="button"
            onClick={handleReadAloud}
            className="min-h-[32px] px-2.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-800 text-sm font-bold border border-emerald-300 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Bấm để nghe đọc diễn cảm nội dung bài gõ"
          >
            <Volume2 className="w-4 h-4 text-emerald-700" />
            <span>Đọc mẫu</span>
          </button>

        </div>
      </div>

      {/* 2. ẢNH SGK CHIẾM TOÀN BỘ THẺ. Lời bài đã hiện ở vùng luyện gõ nên không nhắc lại ở đây */}
      <div className="flex-1 min-h-[220px] flex flex-col gap-1.5 p-2 bg-slate-50/50">
        <div
          onClick={() => setIsZoomed(true)}
          data-testid="sgk-image-frame"
          className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden bg-gradient-to-b from-sky-50 to-emerald-50 border-2 border-emerald-300 shadow-inner flex items-center justify-center cursor-pointer select-none group"
          title="Bấm vào tranh để phóng to xem rõ nét"
        >
          <img
            src={currentImgSrc}
            alt={`Ảnh sách giáo khoa: ${lesson.title}`}
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-contain p-1 transition-transform duration-300 group-hover:scale-102"
            loading="eager"
          />

          {/* Huy hiệu SGK Tiếng Việt */}
          <div className="absolute top-1.5 left-1.5 bg-emerald-700/90 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-300" />
            <span>SGK Tiếng Việt</span>
          </div>

          {/* Nút Phóng to nổi */}
          <div className="absolute bottom-1.5 right-1.5 bg-slate-950/80 hover:bg-slate-950 text-white text-xs font-black px-2 py-1 rounded-lg shadow-md border border-white/20 flex items-center gap-1 transition-all opacity-85 group-hover:opacity-100">
            <Maximize2 className="w-2.5 h-2.5 text-amber-300" />
            <span>Phóng to 🔍</span>
          </div>
        </div>

        {/* Lời cô dặn (nếu có): giữ 1 dòng ngắn, không chiếm chỗ của ảnh */}
        {lesson.teacherNote && (
          <p
            className="shrink-0 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[13px] text-amber-900 italic font-semibold truncate"
            title={lesson.teacherNote}
          >
            💡 <strong>Lời cô dặn:</strong> {lesson.teacherNote}
          </p>
        )}
      </div>

      {/* 3. MODAL PHÓNG TO TOÀN MÀN HÌNH (FULLSCREEN LIGHTBOX) */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setIsZoomed(false)}
        >
          <div
            className="relative max-w-4xl max-h-[92vh] bg-white rounded-3xl border-4 border-emerald-500 shadow-2xl p-4 flex flex-col items-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h4 className="font-black text-slate-900 text-sm sm:text-base">
                  Ảnh Sách Giáo Khoa: {lesson.title}
                </h4>
                {lesson.gradeLevel && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    Khối Lớp {lesson.gradeLevel}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-600 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center p-1">
              <img
                src={currentImgSrc}
                alt={lesson.title}
                onError={handleImageError}
                className="max-h-[72vh] w-auto object-contain rounded-2xl shadow-md"
              />
            </div>

            <div className="w-full mt-2 pt-2 border-t border-slate-200 text-center text-xs text-slate-600 font-medium">
              Học sinh nhìn vào hình ảnh và nội dung bài đọc để luyện gõ 10 ngón chuẩn xác.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
