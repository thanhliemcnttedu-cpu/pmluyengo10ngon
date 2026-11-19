import React, { useState, useEffect } from 'react';
import { Lesson } from '../types/typing';
import { LESSONS } from '../data/lessons';
import { X, CheckCircle2, Star, Sparkles, BookOpen, UserCheck, Image as ImageIcon, GraduationCap, Feather, Search } from 'lucide-react';

export const TEACHER_CODE_KEY = 'typing_kids_teacher_code_filter_v1';
import { isSystemLesson, lessonOwnerKey } from '../utils/lessonNumbering';
import { lessonGroupOf, lessonGroupRank, LESSON_GROUP_LABEL, GROUP_TONE, type LessonGroup } from '../utils/lessonGroups';
import { fetchTeacherAssignments, type TeacherGradeAssignment } from '../lib/supabase';

/** Chuẩn hoá mã cô giáo học sinh gõ: "gv1", "GV001", "1", "001" -> "GV001"; "admin" -> "ADMIN" */
export function normalizeTeacherCode(raw: string): string {
  const t = (raw || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!t) return '';
  if (t === 'ADMIN' || t === 'QUANTRI') return 'ADMIN';
  const m = t.match(/^(?:GV)?-?0*(\d{1,6})$/);
  if (m) return 'GV' + m[1].padStart(3, '0');
  return t;
}

/** Bài có thuộc mã cô giáo này không (bài cũ chưa ghi người tạo được tính là của quản trị) */
const lessonOfCode = (l: Lesson, code: string) => lessonOwnerKey(l) === code;

interface CurriculumModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLessonId: string;
  onSelectLesson: (lesson: Lesson) => void;
  completedLessons: Record<string, { stars: number; bestWpm: number }>;
  allLessons?: Lesson[];
  teacherLessons?: Lesson[];
  onOpenTeacherModal?: () => void;
  initialGradeFilter?: number;
  /** Mã cô giáo học sinh đang theo (do App giữ để dải bài ngoài màn hình cũng theo mã) */
  teacherCode?: string;
  onTeacherCodeChange?: (code: string) => void;
}

/**
 * Trích xuất chỉ số thứ tự bài học từ tiêu đề (ví dụ: 'Bài 1: ...' -> 1, 'Bài 12: ...' -> 12, 'Bài Numpad 2' -> 1002)
 * Đảm bảo sắp xếp tự động từ trái sang phải: Bài 1, Bài 2, Bài 3... đến bài có số lớn nhất.
 */
export function extractLessonOrder(title: string, level?: number): number {
  if (!title) return level ? level * 10 : 9999;
  const numpadMatch = title.match(/Bài\s+Numpad\s+(\d+)/i);
  if (numpadMatch) {
    return 1000 + parseInt(numpadMatch[1], 10);
  }
  const match = title.match(/Bài\s+(\d+)/i);
  if (match) {
    let num = parseInt(match[1], 10);
    if (/Bài\s+\d+B/i.test(title)) num += 0.5;
    return num;
  }
  const generalNum = title.match(/(\d+)/);
  if (generalNum) {
    return parseInt(generalNum[1], 10);
  }
  return level ? level : 999;
}

export const CurriculumModal: React.FC<CurriculumModalProps> = ({
  isOpen,
  onClose,
  currentLessonId,
  onSelectLesson,
  completedLessons,
  allLessons,
  teacherLessons = [],
  onOpenTeacherModal,
  initialGradeFilter,
  teacherCode: teacherCodeProp,
  onTeacherCodeChange,
}) => {
  // Lọc thêm theo lớp cho các mục gộp nhiều lớp (Tất cả, Thơ & Văn SGK, Numpad, Bài cô giáo)
  const [subGrade, setSubGrade] = useState<'all' | 3 | 4 | 5>('all');
  // Tìm bài theo mã cô giáo: học sinh gõ mã (vd GV001) rồi Enter -> chỉ còn bài của cô đó.
  // Nhớ mã trên máy này để lần sau mở ra là thấy ngay bài của cô.
  const [codeInput, setCodeInput] = useState('');
  const [teacherCodeLocal, setTeacherCodeLocal] = useState<string>(() => {
    try {
      return localStorage.getItem(TEACHER_CODE_KEY) || '';
    } catch {
      return '';
    }
  });
  const teacherCode = teacherCodeProp ?? teacherCodeLocal;
  const setTeacherCode = (c: string) => {
    setTeacherCodeLocal(c);
    onTeacherCodeChange?.(c);
  };
  const [codeError, setCodeError] = useState('');
  // Bài cô giáo (theo mã) đã giao cho từng lớp: tách khỏi bài quản trị giao
  const [codeAssignments, setCodeAssignments] = useState<Record<number, TeacherGradeAssignment>>({});
  // Nhóm bài lọc riêng, kết hợp được với tab Lớp (vd Khối Lớp 3 + Nhóm Thơ SGK)
  const [groupTab, setGroupTab] = useState<'all' | LessonGroup>('all');
  const [filterTab, setFilterTab] = useState<'all' | '3' | '4' | '5' | 'poems' | 'numpad' | 'teacher'>(
    initialGradeFilter ? String(initialGradeFilter) as any : 'all'
  );

  // useState chỉ lấy giá trị đầu: mở lại modal với khối khác phải đồng bộ lại tab lọc
  useEffect(() => {
    if (isOpen) {
      setFilterTab(initialGradeFilter && [3, 4, 5].includes(initialGradeFilter) ? (String(initialGradeFilter) as '3' | '4' | '5') : 'all');
      setGroupTab('all');
    }
  }, [isOpen, initialGradeFilter]);

  // Áp mã cô giáo: chỉ còn bộ bài của cô, nhớ mã trên máy
  const applyCodeValue = (code: string) => {
    setCodeError('');
    setTeacherCode(code);
    setCodeInput('');
    setFilterTab('all');
    setSubGrade('all');
    try {
      localStorage.setItem(TEACHER_CODE_KEY, code);
    } catch {
      // Bỏ qua khi bộ nhớ trang bị chặn
    }
  };

  // TỰ TÌM KHI GÕ MÃ: gõ xong (dừng tay ~0,7 giây) là tự lọc, không cần bấm nút hay Enter
  useEffect(() => {
    const raw = codeInput.trim();
    if (!isOpen || !raw) return;
    const t = window.setTimeout(() => {
      const all = allLessons && allLessons.length > 0 ? allLessons : [...teacherLessons, ...LESSONS];
      const code = normalizeTeacherCode(raw);
      if (code && all.some((l) => l && lessonOfCode(l, code))) applyCodeValue(code);
      else if (code) setCodeError(`Chưa có bài nào của mã ${code}. Em kiểm tra lại mã cô giáo đã cho nhé.`);
    }, 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeInput, isOpen]);

  useEffect(() => {
    if (!isOpen || !teacherCode || teacherCode === 'ADMIN') {
      setCodeAssignments({});
      return;
    }
    let alive = true;
    fetchTeacherAssignments(teacherCode).then((a) => {
      if (alive) setCodeAssignments(a);
    });
    return () => {
      alive = false;
    };
  }, [isOpen, teacherCode]);

  // Esc để đóng: thao tác quen thuộc, nhất là khi nút X bị khuất trên màn hình nhỏ
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const allEffective = allLessons && allLessons.length > 0 ? allLessons : [...teacherLessons, ...LESSONS];
  // Chưa gõ mã: chỉ bài hệ thống. Gõ mã: chỉ bộ bài của cô giáo đó.
  const effectiveLessons = teacherCode
    ? allEffective.filter((l) => l && lessonOfCode(l, teacherCode))
    : allEffective.filter((l) => l && isSystemLesson(l));
  // Tên cô giáo của mã đang lọc (lấy từ tên người soạn bài)
  const codeTeacherName = teacherCode
    ? effectiveLessons.find((l) => l.authorTeacher)?.authorTeacher || (teacherCode === 'ADMIN' ? 'Quản trị' : '')
    : '';

  const applyCode = () => {
    const code = normalizeTeacherCode(codeInput);
    if (!code) {
      setCodeError('Em hãy gõ mã của cô giáo, ví dụ GV001.');
      return;
    }
    if (!allEffective.some((l) => l && lessonOfCode(l, code))) {
      setCodeError(`Chưa có bài nào của mã ${code}. Em kiểm tra lại mã cô giáo đã cho nhé.`);
      return;
    }
    applyCodeValue(code);
  };
  const clearCode = () => {
    setTeacherCode('');
    setCodeError('');
    try {
      localStorage.removeItem(TEACHER_CODE_KEY);
    } catch {
      // Bỏ qua
    }
  };

  // Filter lessons based on active tab
  const subGradeApplies = filterTab === 'all' || filterTab === 'poems' || filterTab === 'numpad' || filterTab === 'teacher';
  const filteredLessons = effectiveLessons.filter((l) => {
    if (!l) return false;
    if (subGradeApplies && subGrade !== 'all' && l.gradeLevel !== subGrade) return false;
    if (groupTab !== 'all' && lessonGroupOf(l) !== groupTab) return false;
    if (filterTab === 'all') return true;
    if (filterTab === 'teacher') return l.id?.startsWith('teacher-') || !!l.authorTeacher;
    if (filterTab === 'poems') return !!l.isPoemOrStory || l.category === 'poems_stories';
    if (filterTab === 'numpad') return !!l.isNumpad || l.category === 'numpad_tenkey';
    if (filterTab === '3') return l.gradeLevel === 3 || (!l.gradeLevel && (l.level || 0) <= 7);
    if (filterTab === '4') return l.gradeLevel === 4 || (!l.gradeLevel && (l.level || 0) > 7 && (l.level || 0) <= 12);
    if (filterTab === '5') return l.gradeLevel === 5 || (!l.gradeLevel && (l.level || 0) > 12);
    return true;
  });

  // TỰ ĐỘNG SẮP XẾP DANH SÁCH BÀI HỌC THEO THỨ TỰ TĂNG DẦN: BÀI 1, BÀI 2, BÀI 3... ĐẾN BÀI LỚN NHẤT
  const sortedLessons = [...filteredLessons].sort((a, b) => {
    // Lớp 3 -> 4 -> 5 trước, trong mỗi lớp theo số Bài hệ thống đã đánh
    const gradeA = a.gradeLevel || 0;
    const gradeB = b.gradeLevel || 0;
    if (gradeA !== gradeB) return gradeA - gradeB;
    // Mỗi nhóm đánh số riêng: xếp nhóm Luyện phím → Thơ → Văn → Numpad, rồi theo số bài
    const rk = lessonGroupRank(a) - lessonGroupRank(b);
    if (rk !== 0) return rk;
    const orderA = extractLessonOrder(a.title, a.level);
    const orderB = extractLessonOrder(b.title, b.level);
    if (orderA !== orderB) return orderA - orderB;
    return (a.level || 0) - (b.level || 0);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div data-testid="curriculum-panel" className="relative w-[min(96vw,1500px)] h-[94dvh] bg-white border-4 border-sky-400 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        {/* Header - Bright Theme */}
        <div className="flex items-center justify-between p-3.5 sm:p-5 border-b-2 border-sky-100 bg-gradient-to-r from-sky-100 via-sky-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-400 to-indigo-500 border-2 border-white flex items-center justify-center text-2xl shadow-md text-white">
              📚
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-slate-900">
                Chương Trình Luyện Gõ 10 Ngón Theo Khối Lớp
              </h2>
              <p className="text-xs text-sky-800 font-bold">
                Lựa chọn bài học theo Lớp 3, Lớp 4, Lớp 5 &amp; các bài tập do Cô giáo giao
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border border-slate-200 shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TÌM BÀI THEO MÃ CÔ GIÁO */}
        <div className="px-3 pt-3 pb-2 bg-amber-50/70 border-b border-amber-100" data-testid="teacher-code-filter">
          {teacherCode ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 rounded-full bg-amber-500 text-slate-950 text-sm font-black" data-testid="teacher-code-active">
                🔎 Bài của {codeTeacherName ? `${codeTeacherName} · ` : ''}mã {teacherCode}
              </span>
              <span className="text-xs font-bold text-slate-600">{effectiveLessons.length} bài · chọn lớp, nhóm ở các nút bên dưới</span>
              {/* Đổi sang mã thầy cô khác ngay, không phải bấm "Xem tất cả bài" trước */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  applyCode();
                }}
                className="ml-auto flex items-center gap-1.5"
                data-testid="teacher-code-switch"
              >
                <input
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (codeError) setCodeError('');
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Mã khác…"
                  aria-label="Đổi sang mã cô giáo khác"
                  autoComplete="off"
                  className="w-28 min-h-[36px] px-3 rounded-full bg-white border-2 border-amber-300 text-sm font-black uppercase tracking-wide focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="min-h-[36px] px-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Đổi mã
                </button>
              </form>
              <button
                type="button"
                onClick={clearCode}
                className="min-h-[36px] px-3 rounded-full bg-white border-2 border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 cursor-pointer"
              >
                Xem tất cả bài
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyCode();
              }}
              className="flex items-center gap-2 flex-wrap"
            >
              <label htmlFor="teacher-code-input" className="text-sm font-black text-amber-900 flex items-center gap-1">
                <Search className="w-4 h-4" /> Chọn bài theo mã cô giáo:
              </label>
              <input
                id="teacher-code-input"
                data-testid="teacher-code-input"
                value={codeInput}
                onChange={(e) => {
                  setCodeInput(e.target.value);
                  if (codeError) setCodeError('');
                }}
                // Phím gõ trong ô này không được tính là gõ bài
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="vd: GV001"
                autoComplete="off"
                className="w-36 min-h-[38px] px-3 rounded-full bg-white border-2 border-amber-300 text-sm font-black uppercase tracking-wide focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                data-testid="teacher-code-submit"
                className="min-h-[38px] px-4 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-black cursor-pointer"
              >
                Tìm bài
              </button>
              <span className="text-xs text-slate-600 font-semibold">Gõ mã cô giáo cho, phần mềm tự tìm bài</span>
            </form>
          )}
          {codeError && (
            <p className="mt-1.5 text-xs font-bold text-rose-700" data-testid="teacher-code-error">
              {codeError}
            </p>
          )}
        </div>

        {/* Grade Filter Navigation Tabs */}
        <div className="flex items-center gap-2 p-3 bg-sky-50/70 border-b border-sky-100 flex-wrap justify-center sm:justify-start">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
              filterTab === 'all'
                ? 'bg-sky-500 text-white shadow ring-2 ring-sky-300'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Tất cả ({effectiveLessons.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('3')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === '3'
                ? 'bg-indigo-600 text-white shadow ring-2 ring-indigo-300'
                : 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Khối Lớp 3</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('4')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === '4'
                ? 'bg-teal-600 text-white shadow ring-2 ring-teal-300'
                : 'bg-teal-50 text-teal-900 hover:bg-teal-100 border border-teal-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Khối Lớp 4</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('5')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === '5'
                ? 'bg-purple-600 text-white shadow ring-2 ring-purple-300'
                : 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Khối Lớp 5</span>
          </button>



          <button
            type="button"
            onClick={() => setFilterTab('numpad')}
            className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
              filterTab === 'numpad'
                ? 'bg-emerald-600 text-white shadow ring-2 ring-emerald-300'
                : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <span>🖩 Phím Số Numpad</span>
          </button>

          {/* Bài của giáo viên phụ không còn hiện chung: học sinh gõ mã cô giáo ở ô phía trên */}

          {onOpenTeacherModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTeacherModal();
              }}
              className="ml-auto px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black transition-all cursor-pointer shadow border-b-2 border-amber-700 active:border-b-0"
            >
              👩‍🏫 Cô giáo giao bài mới
            </button>
          )}
        </div>

        {/* NHÓM BÀI: kết hợp với Lớp ở trên (vd Khối Lớp 3 + Nhóm Thơ SGK) */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-sky-100 flex-wrap" role="group" aria-label="Lọc theo nhóm bài" data-testid="curriculum-group">
          <span className="text-xs font-black text-slate-600 pr-1">Nhóm bài:</span>
          {(
            [
              { val: 'all' as const, icon: '', on: 'bg-slate-700 text-white', off: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100' },
              { val: 'exercise' as const, icon: '⌨️', on: 'bg-sky-600 text-white shadow ring-2 ring-sky-300', off: 'bg-sky-50 text-sky-900 hover:bg-sky-100 border border-sky-200' },
              { val: 'poem' as const, icon: '📜', on: 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow ring-2 ring-purple-300', off: 'bg-purple-50 text-purple-900 hover:bg-purple-100 border border-purple-200' },
              { val: 'prose' as const, icon: '📝', on: 'bg-rose-600 text-white shadow ring-2 ring-rose-300', off: 'bg-rose-50 text-rose-900 hover:bg-rose-100 border border-rose-200' },
            ]
          ).map((g) => (
            <button
              key={g.val}
              type="button"
              onClick={() => setGroupTab(g.val)}
              data-group-tab={g.val}
              aria-pressed={groupTab === g.val}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${groupTab === g.val ? g.on : g.off}`}
            >
              {g.icon && <span aria-hidden="true">{g.icon}</span>}
              <span>{g.val === 'all' ? 'Mọi nhóm' : LESSON_GROUP_LABEL[g.val]}</span>
            </button>
          ))}
        </div>

        {subGradeApplies && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white border-b border-sky-100 flex-wrap" role="group" aria-label="Lọc theo lớp" data-testid="curriculum-subgrade">
            <span className="text-xs font-black text-slate-600 pr-1">Lọc theo lớp:</span>
            {([
              { label: 'Mọi lớp', val: 'all' as const },
              { label: 'Lớp 3', val: 3 as const },
              { label: 'Lớp 4', val: 4 as const },
              { label: 'Lớp 5', val: 5 as const },
            ]).map((g) => (
              <button
                key={String(g.val)}
                type="button"
                onClick={() => setSubGrade(g.val)}
                aria-pressed={subGrade === g.val}
                className={`min-h-[32px] px-3 rounded-full text-xs font-black cursor-pointer transition-colors ${
                  subGrade === g.val ? 'bg-sky-600 text-white shadow' : 'bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100'
                }`}
              >
                {g.label}
              </button>
            ))}
            <span className="text-[11px] text-slate-500 font-semibold ml-1">({sortedLessons.length} bài)</span>
          </div>
        )}

        {/* Content list - Sắp xếp tự động tăng dần từ trái qua phải */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-3 flex-1 bg-sky-50/20 custom-scrollbar">
          {/* BÀI CÔ GIAO THEO MÃ: chỉ hiện khi học sinh đã gõ mã cô giáo */}
          {teacherCode &&
            (() => {
              const wantGrade =
                filterTab === '3' || filterTab === '4' || filterTab === '5' ? Number(filterTab) : subGrade !== 'all' ? subGrade : null;
              const blocks = [3, 4, 5]
                .filter((g) => (wantGrade ? g === wantGrade : true))
                .map((g) => ({
                  g,
                  a: codeAssignments[g],
                  items: (codeAssignments[g]?.lessonIds || [])
                    .map((id) => allEffective.find((l) => l && l.id === id))
                    .filter((l): l is Lesson => !!l),
                }))
                .filter((b) => b.items.length > 0);
              if (blocks.length === 0) return null;
              return (
                <section className="rounded-2xl border-2 border-amber-400 bg-amber-50/80 p-3 sm:p-4 space-y-3" data-testid="code-assignments">
                  <h3 className="text-base sm:text-lg font-black text-amber-900">
                    📌 Bài {codeTeacherName || `mã ${teacherCode}`} giao
                  </h3>
                  {blocks.map((b) => (
                    <div key={b.g} className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-xs font-black">Lớp {b.g}</span>
                        <span className="text-xs font-bold text-amber-900">{b.items.length} bài</span>
                        {b.a?.teacherNote && <span className="text-sm text-slate-700 font-semibold">💬 {b.a.teacherNote}</span>}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2">
                        {b.items.map((l, i) => {
                          // Mỗi bài giao mang màu nhóm của nó: hai "Bài 1" khác nhóm vẫn phân biệt được
                          const g = lessonGroupOf(l);
                          const tone = GROUP_TONE[g ?? 'numpad'];
                          return (
                            <button
                              key={`giao-${b.g}-${l.id}`}
                              type="button"
                              data-assigned-group={g ?? 'numpad'}
                              onClick={() => {
                                onSelectLesson(l);
                                onClose();
                              }}
                              className={`text-left px-3 py-2.5 rounded-xl border-2 cursor-pointer flex items-center gap-2.5 transition-colors ${tone.card} ${
                                l.id === currentLessonId ? 'ring-4 ring-amber-400' : ''
                              }`}
                            >
                              <span className={`w-8 h-8 rounded-lg text-sm font-black flex items-center justify-center shrink-0 ${tone.badge}`} title="Thứ tự cô giao">
                                {i + 1}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`inline-block mb-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-black border ${tone.chip}`}>
                                  {g === 'poem' ? '📜 Thơ SGK' : g === 'prose' ? '📝 Văn SGK' : g === 'exercise' ? '⌨️ Luyện phím' : '🖩 Numpad'}
                                </span>
                                <span className="block text-sm font-black text-slate-900 line-clamp-2">{l.title}</span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {completedLessons[l.id] ? `Đã luyện · ${completedLessons[l.id].stars}★` : 'Luyện ngay ➜'}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              );
            })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
            {sortedLessons.map((lesson, idx) => {
              const isCurrent = lesson.id === currentLessonId;
              const completion = completedLessons[lesson.id];
              const isDone = !!completion;
              const lessonNum = extractLessonOrder(lesson.title, lesson.level);
              const isNumpad = lesson.id.includes('numpad') || lesson.title.includes('Numpad');
              // Màu cả thẻ theo nhóm bài (Luyện phím / Thơ / Văn / Numpad)
              const grp = lessonGroupOf(lesson);
              const tone = GROUP_TONE[grp ?? 'numpad'];

              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => {
                    onSelectLesson(lesson);
                    onClose();
                  }}
                  data-card-group={grp ?? 'numpad'}
                  className={`
                    text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative group
                    ${tone.card}
                    ${isCurrent
                      ? 'ring-4 ring-amber-400 shadow-md scale-[1.01]'
                      : 'shadow-xs hover:shadow-md hover:-translate-y-0.5'}
                  `}
                >
                  <div className="flex items-start gap-2.5 w-full">
                    {/* HUY HIỆU SỐ THỨ TỰ BÀI HỌC NỔI BẬT */}
                    <div className={`
                      w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-xs font-black
                      ${tone.badge}
                    `}>
                      <span className="text-[10px] uppercase tracking-tighter opacity-90 leading-none">
                        {isNumpad ? 'NUM' : 'BÀI'}
                      </span>
                      <span className="text-lg font-black leading-tight">
                        {isNumpad ? (lessonNum >= 1000 ? lessonNum - 1000 : lessonNum) : lessonNum}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lesson.gradeLevel && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black border bg-white text-slate-700 border-slate-300">
                            Lớp {lesson.gradeLevel}
                          </span>
                        )}
                        {/* Mỗi nhóm đánh số riêng từ Bài 1: ghi rõ nhóm để không nhầm "Bài 1" giữa các nhóm */}
                        {(() => {
                          const g = grp;
                          if (!g) return null;
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-black border ${tone.chip}`} data-lesson-group={g}>
                              {g === 'poem' ? '📜 Thơ SGK' : g === 'prose' ? '📝 Văn SGK' : '⌨️ Luyện phím'}
                            </span>
                          );
                        })()}
                        {lesson.imageUrl && (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[11px] font-bold flex items-center gap-0.5 border border-amber-200">
                            <ImageIcon className="w-3 h-3 text-amber-600" />
                            <span>Ảnh SGK</span>
                          </span>
                        )}
                      </div>

                      <h4 title={lesson.title} className="text-sm sm:text-base font-black text-slate-900 mt-1 leading-snug line-clamp-2 transition-colors">
                        {lesson.title}
                      </h4>

                      <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                        {lesson.subtitle || lesson.descriptionVi}
                      </p>

                      {lesson.authorTeacher && (
                        <span className="text-xs text-emerald-700 font-bold block mt-0.5 truncate">
                          👩‍🏫 {lesson.authorTeacher}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-black/5 flex items-center justify-between text-xs text-slate-500 font-bold w-full">
                    <span className="text-slate-600">🎯 {lesson.targetWpm} WPM</span>
                    {isDone ? (
                      <div className="flex items-center gap-0.5 text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span className="font-black text-slate-800">{completion.stars}★</span>
                      </div>
                    ) : isCurrent ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-black">
                        Đang chọn
                      </span>
                    ) : (
                      <span className={`${tone.text} group-hover:translate-x-0.5 transition-transform`}>
                        Luyện ngay ➜
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
