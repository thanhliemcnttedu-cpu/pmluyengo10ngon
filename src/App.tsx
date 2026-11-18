import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { Lesson, KeyConfig, FingerId, TypingStats, AppSettings, TypingInputMode, KeyboardImeMode, GradeAssignment, TypedKeyRecord, CaseMistakeType } from './types/typing';
import { LESSONS } from './data/lessons';
import { getKeyForChar, CODE_TO_KEY_MAP } from './data/keyboardLayout';
import { buildKeystrokeSteps, KeystrokeStep, evaluateCaseMistake, isUpperCaseChar, isLowerCaseChar, isPunctuationChar } from './utils/vietnameseKeystrokes';
import { getSymbolKeyGuideInfo, SymbolKeyGuideInfo } from './utils/symbolKeyGuide';
import { capsGuidance, repeatPressInfo } from './utils/keyGuidance';
import { MIN_SPEED_SEC, completedWords, formatClock, score10, wordsPerMinute } from './utils/scoring';
import { StartGate } from './components/StartGate';
import { generateValidTelexSequencesForWord, checkKeyInSmartTelexWord, matchUnikeyInputInWord, isVietnameseAccented, VIETNAMESE_CHAR_DECOMPOSITION } from './utils/vietnameseSmartTelex';
import { soundEngine } from './utils/audio';
import { Keyboard } from './components/Keyboard';
import { PracticeArea } from './components/PracticeArea';
import { PostureGuideModal } from './components/PostureGuideModal';
import { VietnameseGuideModal } from './components/VietnameseGuideModal';
import { TypingGuideModal, GuideTabId } from './components/TypingGuideModal';
import { NumpadGuideModal } from './components/NumpadGuideModal';
import { MultiGameHub } from './components/MultiGameHub';
import { CurriculumModal } from './components/CurriculumModal';
import { CustomTextModal } from './components/CustomTextModal';
import { TeacherLessonModal, TEACHER_PORTAL_OPEN_KEY } from './components/TeacherLessonModal';
import { loadTeacherSession } from './lib/adminAuth';
import { TextbookImageViewer, TextbookTab } from './components/TextbookImageViewer';
import { TextbookIllustrationCard } from './components/TextbookIllustrationCard';
import { KeyboardSkinTheme, KEYBOARD_THEMES, DEFAULT_KEYBOARD_THEME, DEFAULT_KEYBOARD_THEME_ID } from './data/keyboardThemes';
import { KeyboardThemeModal } from './components/KeyboardThemeModal';
import { CompletionModal } from './components/CompletionModal';
import { UnikeyNoticeModal } from './components/UnikeyNoticeModal';
import { GradeSelectionModal } from './components/GradeSelectionModal';
import { AuthorCard } from './components/AuthorCard';
import { AuthorDonateModal } from './components/AuthorDonateModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSmartAutoFitViewport } from './utils/smartViewportEngine';
import { SmartViewportModal } from './components/SmartViewportModal';
import { TEACHER_CODE_KEY } from './components/CurriculumModal';
import {
  sortLessonsLogically,
  applyLessonNumbers,
  stripLessonNumber,
  storedLessonNumber,
  isNumpadLesson,
  displayedLessonNumber,
  lessonSortKeys,
  lessonOwnerKey,
  isSystemLesson,
} from './utils/lessonNumbering';
import {
  fetchLessonsFromSupabase,
  upsertLessonToSupabase,
  deleteLessonFromSupabase,
  bulkUpsertLessonsToSupabase,
  fetchAssignmentsFromSupabase,
  saveAssignmentToSupabase,
  subscribeToSupabaseRealtime,
} from './lib/supabase';
import confetti from 'canvas-confetti';
import appLogo from './assets/logo.svg';
import {
  BookOpen,
  Gamepad2,
  Sliders,
  HelpCircle,
  Volume2,
  VolumeX,
  Sparkles,
  UserCheck,
  GraduationCap,
  Bell,
  CheckCircle2,
  RotateCcw,
  Palette,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Minimize2,
  X
} from 'lucide-react';

// Hàm sắp xếp tự động các bài học theo đúng tiến trình logic chuẩn (Bài 1, Bài 2, Bài 3, Bài 4...)
// Sắp xếp bài theo số bài: dùng chung với phần tự đánh số (src/utils/lessonNumbering.ts)
export { sortLessonsLogically };

// Cài đặt mặc định (dùng chung cho lần đầu và khi ghép cài đặt cũ thiếu trường)
const DEFAULT_APP_SETTINGS: AppSettings = {
  soundEnabled: true,
  soundType: 'mechanical',
  soundVolume: 0.7,
  voicePrompt: false,
  handsOverlayEnabled: true, // Bàn phím có bàn tay hướng dẫn là mặc định
  handsVisible: true,
  handsOnRealKeyboards: true, // Mọi kiểu bàn phím mặc định bật bàn tay ngón tay ảo
  realKeyboardCompact: false, // Bàn phím thật mặc định Full size (đủ cụm điều hướng, phím số)
  startGateEnabled: false, // Mặc định vào bài là tính giờ luôn (bật lại trong Đổi phím / Cài đặt lớp học)
  handsOpacity: 0.75,
  handsStyle: 'realistic',
  showFingerGuideText: true,
  highlightMatchingFinger: true,
};

// Supabase chưa có cột cho các cờ này -> giữ lại giá trị cục bộ để không bị mất sau mỗi lần đồng bộ
const LOCAL_ONLY_LESSON_FIELDS = ['isPoemOrStory', 'genre', 'isFreePractice', 'isNumpad'] as const;
const mergeLocalOnlyFields = (fromCloud: Lesson[], local: Lesson[]): Lesson[] => {
  const localById = new Map<string, Lesson>();
  for (const l of [...LESSONS, ...local]) localById.set(l.id, l);
  return fromCloud.map((l) => {
    const old = localById.get(l.id);
    if (!old) return l;
    const merged: Lesson = { ...l };
    for (const f of LOCAL_ONLY_LESSON_FIELDS) {
      if (merged[f] === undefined && old[f] !== undefined) (merged as any)[f] = old[f];
    }
    // Nhóm bài (Luyện phím / Thơ / Văn) suy ra từ cột category trên máy chủ, không lấy cờ cũ của máy này:
    // bài được chuyển nhóm ở máy khác thì máy này cũng thấy đúng nhóm mới.
    if (l.category) {
      const isPoem = l.category === 'poems_stories';
      merged.isPoemOrStory = isPoem;
      if (!isPoem) {
        if (merged.genre === 'poem' || merged.genre === 'prose') merged.genre = 'exercise';
      } else if (/^Văn/i.test(l.categoryTitleVi || '')) merged.genre = 'prose';
      else if (/^Thơ/i.test(l.categoryTitleVi || '')) merged.genre = 'poem';
      else if (merged.genre !== 'prose') merged.genre = 'poem';
    }
    return merged;
  });
};

export default function App() {
  // Input mode: 'telex' | 'vni' | 'no_accent'
  const [inputMode, setInputMode] = useState<TypingInputMode>('telex');

  // Chế độ bộ gõ bàn phím trên máy tính:
  // - 'unikey_v': Máy tính đang bật Unikey / EVKey chữ [V] (Gõ tiếng Việt tự nhiên, không bị bắt lỗi do ghép dấu)
  // - 'telex_e': Máy tính tắt Unikey hoặc để chế độ [E] (Luyện từng phím Telex quy tắc SGK)
  const [keyboardImeMode, setKeyboardImeMode] = useState<KeyboardImeMode>(() => {
    try {
      const saved = localStorage.getItem('typing_keyboard_ime_mode');
      if (saved === 'unikey_v' || saved === 'telex_e') return saved;
    } catch {
      // Trình duyệt chặn bộ nhớ trang: dùng giá trị mặc định
    }
    return 'unikey_v'; // Mặc định tương thích bộ gõ Unikey [V] của máy tính
  });

  const handleToggleKeyboardImeMode = useCallback((mode?: KeyboardImeMode) => {
    setKeyboardImeMode((prev) => {
      const next = mode !== undefined ? mode : prev === 'unikey_v' ? 'telex_e' : 'unikey_v';
      try {
        localStorage.setItem('typing_keyboard_ime_mode', next);
      } catch {
        // Bỏ qua khi bộ nhớ trang bị chặn
      }
      return next;
    });
  }, []);

  // Active Grade Level chosen by student (3, 4, 5, or 0 = all)
  const [selectedGrade, setSelectedGrade] = useState<number>(3);

  // All lessons on system (default + teacher-edited), persisted online to server & localStorage
  const [allLessons, setAllLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem('typing_kids_all_lessons');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return LESSONS;
  });

  // Specific lesson to load into teacher modal editor
  const [editingLessonForModal, setEditingLessonForModal] = useState<Lesson | null>(null);

  // Trạng thái kết nối Supabase Cloud Database Realtime
  const [isSupabaseOnline, setIsSupabaseOnline] = useState<boolean>(true);

  // Fetch saved lessons from Supabase (với fallback server JSON) & Lắng nghe Realtime
  useEffect(() => {
    let unsubscribeRealtime: (() => void) | null = null;

    const syncLessons = async () => {
      try {
        // 1. Thử tải trực tiếp từ Supabase Cloud
        const supabaseLessons = await fetchLessonsFromSupabase();
        if (supabaseLessons && supabaseLessons.length > 0) {
          let merged: Lesson[] = supabaseLessons;
          setAllLessons((prev) => (merged = mergeLocalOnlyFields(supabaseLessons, prev)));
          localStorage.setItem('typing_kids_all_lessons', JSON.stringify(merged));
          setIsSupabaseOnline(true);
          return;
        }

        // Nếu bảng Supabase đã kết nối nhưng chưa có bài học -> Tự động đẩy danh sách mặc định LESSONS lên Supabase
        if (supabaseLessons && supabaseLessons.length === 0) {
          await bulkUpsertLessonsToSupabase(LESSONS);
          setAllLessons(LESSONS);
          localStorage.setItem('typing_kids_all_lessons', JSON.stringify(LESSONS));
          setIsSupabaseOnline(true);
          return;
        }

        // 2. Fallback sang server route nếu Supabase chưa có bảng
        const res = await fetch('/api/lessons');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.lessons) && data.lessons.length > 0) {
            setAllLessons(data.lessons);
            localStorage.setItem('typing_kids_all_lessons', JSON.stringify(data.lessons));
          } else {
            fetch('/api/lessons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lessons: LESSONS }),
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('Could not sync online lessons:', err);
      }
    };

    const syncAssignments = async () => {
      try {
        // 1. Thử tải từ Supabase Cloud
        const supabaseAssignments = await fetchAssignmentsFromSupabase();
        if (supabaseAssignments && Object.keys(supabaseAssignments).length > 0) {
          setGradeAssignments(supabaseAssignments);
          localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(supabaseAssignments));
          setIsSupabaseOnline(true);
          return;
        }

        // 2. Fallback server
        const res = await fetch('/api/assignments');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.assignments && typeof data.assignments === 'object') {
            setGradeAssignments(data.assignments);
            localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(data.assignments));
          }
        }
      } catch (err) {
        console.warn('Could not sync online assignments:', err);
      }
    };

    syncLessons();
    syncAssignments();

    // 3. ĐĂNG KÝ REALTIME: Tự động cập nhật tức thời khi giáo viên lưu/giao bài từ bất kỳ đâu
    try {
      unsubscribeRealtime = subscribeToSupabaseRealtime(
        async () => {
          const updated = await fetchLessonsFromSupabase();
          if (updated && updated.length > 0) {
            let merged: Lesson[] = updated;
            setAllLessons((prev) => (merged = mergeLocalOnlyFields(updated, prev)));
            try {
              localStorage.setItem('typing_kids_all_lessons', JSON.stringify(merged));
            } catch {
              // Bỏ qua khi bộ nhớ trang đầy hoặc bị chặn
            }
          }
        },
        async () => {
          const updatedAssignments = await fetchAssignmentsFromSupabase();
          if (updatedAssignments) {
            setGradeAssignments(updatedAssignments);
            localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(updatedAssignments));
          }
        }
      );
    } catch (err) {
      console.warn('Không thể khởi tạo Realtime listener:', err);
    }

    return () => {
      if (unsubscribeRealtime) unsubscribeRealtime();
    };
  }, []);

  // Hệ thống tự đánh số "Bài N" theo vị trí trong từng khối lớp (thêm bài +1, xoá bài các bài sau lùi số)
  const allAvailableLessons = useMemo(() => applyLessonNumbers(allLessons), [allLessons]);
  const teacherLessons = useMemo(() => {
    return allAvailableLessons.filter((l) => l.id.startsWith('teacher-') || !!l.authorTeacher);
  }, [allAvailableLessons]);

  // Grade Assignments (Bài tập được giáo viên giao cho từng khối lớp - 1 hoặc nhiều bài)
  const [gradeAssignments, setGradeAssignments] = useState<Record<number, GradeAssignment>>(() => {
    try {
      const saved = localStorage.getItem('typing_kids_grade_assignments');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // fallback
    }
    return {
      3: {
        gradeLevel: 3,
        lessonId: 'lesson-3-3',
        lessonIds: ['lesson-3-3', 'lesson-3-1'],
        assignedAt: new Date().toISOString(),
        teacherName: 'Thầy Liêm',
        teacherNote: 'Bài tập về nhà tuần này: Các con Lớp 3 hoàn thành 2 bài tập này nhé!',
      },
    };
  });

  // Lọc và sắp xếp tự động các bài học của khối lớp theo đúng tiến trình chuẩn (Bài 1, Bài 2, Bài 3, Bài 4...)
  // HỌC SINH: mặc định chỉ thấy bài hệ thống (quản trị). Bài của giáo viên phụ chỉ hiện khi gõ mã cô giáo
  // ở bảng Chọn bài (mã nhớ trên máy). Bài cô đã được giao cho khối lớp vẫn mở qua nút "Bài cô giáo giao".
  const [studentTeacherCode, setStudentTeacherCode] = useState<string>(() => {
    try {
      return localStorage.getItem(TEACHER_CODE_KEY) || '';
    } catch {
      return '';
    }
  });
  const studentVisibleLessons = useMemo(
    () => allAvailableLessons.filter((l) => isSystemLesson(l) || (!!studentTeacherCode && lessonOwnerKey(l) === studentTeacherCode)),
    [allAvailableLessons, studentTeacherCode]
  );

  const gradeFilteredLessons = useMemo(() => {
    const inGrade = studentVisibleLessons.filter((l) => l.gradeLevel === selectedGrade || !l.gradeLevel);
    // Đang theo mã cô giáo và cô có bài ở lớp này: dải bài / bài trước-sau chỉ đi trong bộ bài của cô
    const ofTeacher = studentTeacherCode ? inGrade.filter((l) => lessonOwnerKey(l) === studentTeacherCode) : [];
    const list = ofTeacher.length > 0 ? ofTeacher : inGrade.filter((l) => isSystemLesson(l));
    return sortLessonsLogically(list);
  }, [studentVisibleLessons, studentTeacherCode, selectedGrade]);

  // Curriculum & Current Lesson state - Mặc định bài 3 Mèo Con Đi Học cho Lớp 3
  const [currentLessonIndex, setCurrentLessonIndex] = useState<number>(() => {
    const sorted = sortLessonsLogically(LESSONS.filter((l) => l.gradeLevel === 3));
    const idx = sorted.findIndex((l) => l.id === 'lesson-3-3');
    return idx >= 0 ? idx : 0;
  });
  const [customLesson, setCustomLesson] = useState<Lesson | null>(null);

  // Derive active lesson từ danh sách đã sắp xếp logic
  const activeLesson: Lesson = useMemo(() => {
    if (customLesson) return customLesson;
    // Chặn chỉ số vượt phạm vi (ví dụ sau khi giáo viên xóa bài)
    const safeIdx = Math.min(Math.max(0, currentLessonIndex), Math.max(0, gradeFilteredLessons.length - 1));
    // Không còn bài nào (đã xoá hết): dùng bài mặc định để màn hình luyện gõ không bị lỗi
    return gradeFilteredLessons[safeIdx] || allAvailableLessons[0] || applyLessonNumbers(LESSONS)[0];
  }, [customLesson, gradeFilteredLessons, allAvailableLessons, currentLessonIndex]);

  // Check if current lesson is assigned homework for selected grade
  const isCurrentAssignedHomework = useMemo(() => {
    const currentAssign = gradeAssignments[selectedGrade];
    if (!currentAssign) return false;
    const ids =
      currentAssign.lessonIds && currentAssign.lessonIds.length > 0
        ? currentAssign.lessonIds
        : currentAssign.lessonId
        ? [currentAssign.lessonId]
        : [];
    return ids.includes(activeLesson.id);
  }, [gradeAssignments, selectedGrade, activeLesson.id]);

  // Target text and Keystroke steps sequence
  const targetText = activeLesson.text;
  const keystrokeSteps: KeystrokeStep[] = useMemo(() => {
    return buildKeystrokeSteps(targetText, inputMode);
  }, [targetText, inputMode]);

  // Current step pointer in keystroke sequence
  const [stepIndex, setStepIndex] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  // Pha luyện gõ: chờ bấm "BẮT ĐẦU GÕ" -> đếm ngược 3, 2, 1 -> đang gõ (đồng hồ chạy) -> xong bài (đồng hồ dừng)
  const [typingPhase, setTypingPhase] = useState<'ready' | 'countdown' | 'running'>('ready');
  const typingPhaseRef = useRef(typingPhase);
  typingPhaseRef.current = typingPhase;
  const [countdown, setCountdown] = useState<number>(3);
  const countdownTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [endTime, setEndTime] = useState<number | null>(null);
  // Học sinh bấm ✕ để xem lại bài: chỉ ẨN bảng kết quả, bài vẫn là "đã xong" (đồng hồ không chạy lại)
  const [resultHidden, setResultHidden] = useState<boolean>(false);
  const [clockNow, setClockNow] = useState<number>(() => Date.now());
  // Kết quả lần gõ xong gần nhất (để bảng kết quả báo kỷ lục mới)
  const [lastFinish, setLastFinish] = useState<{ elapsedSec: number; prevBestSec?: number; score: number } | null>(null);
  // TẠM DỪNG: lưu mốc bấm dừng; tiếp tục thì dời mốc bắt đầu đi đúng khoảng đã dừng nên thời gian không bị cộng
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const pausedAtRef = useRef<number | null>(null);
  pausedAtRef.current = pausedAt;
  // Phím vừa dùng để tiếp tục không được tính là lần gõ (ô nhập ẩn có thể nhận lại phím đó ngay sau)
  const resumedAtRef = useRef<number>(0);
  // KẾT THÚC SỚM: bài chưa gõ hết, bảng kết quả chấm theo phần đã gõ
  const [endedEarly, setEndedEarly] = useState<boolean>(false);

  const cancelCountdown = () => {
    countdownTimersRef.current.forEach(clearTimeout);
    countdownTimersRef.current = [];
  };
  // Bấm "BẮT ĐẦU GÕ" (hoặc Enter): đếm 3-2-1 rồi mới tính giờ, cho học sinh đặt tay vào hàng cơ sở
  const startTyping = useCallback(() => {
    if (typingPhaseRef.current !== 'ready') return;
    typingPhaseRef.current = 'countdown';
    setTypingPhase('countdown');
    setCountdown(3);
    const STEP = 700;
    countdownTimersRef.current = [
      setTimeout(() => setCountdown(2), STEP),
      setTimeout(() => setCountdown(1), STEP * 2),
      setTimeout(() => setCountdown(0), STEP * 3),
      setTimeout(() => {
        const t = Date.now();
        typingPhaseRef.current = 'running';
        setTypingPhase('running');
        setStartTime(t);
        setClockNow(t);
      }, STEP * 3 + 450),
    ];
  }, []);

  // Mistake & Backspace guidance state
  const [hasMistake, setHasMistake] = useState<boolean>(false);
  const [mistakeChar, setMistakeChar] = useState<string | null>(null);
  const [mistakeKeyCode, setMistakeKeyCode] = useState<string | null>(null);

  // Phân biệt chế độ gõ chữ hoa / chữ thường
  const [caseMistakeType, setCaseMistakeType] = useState<CaseMistakeType>(null);
  const [caseMistakeMessage, setCaseMistakeMessage] = useState<{ title: string; detail: string } | null>(null);

  // Trạng thái Caps Lock (phát hiện từ bàn phím máy tính hoặc bật/tắt qua bàn phím ảo)
  const [capsLockOn, setCapsLockOn] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyMod = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setCapsLockOn(e.getModifierState('CapsLock'));
      }
    };
    window.addEventListener('keydown', handleKeyMod);
    window.addEventListener('keyup', handleKeyMod);
    return () => {
      window.removeEventListener('keydown', handleKeyMod);
      window.removeEventListener('keyup', handleKeyMod);
    };
  }, []);

  // Pressed physical keys on keyboard (for 3D press effect)
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Real-time typed keystrokes history for visualization in input area
  const [recentTypedKeys, setRecentTypedKeys] = useState<TypedKeyRecord[]>([]);

  // Statistics
  const [stats, setStats] = useState<TypingStats>({
    wpm: 0,
    cpm: 0,
    accuracy: 100,
    totalCharacters: 0,
    correctCharacters: 0,
    mistakes: 0,
    timeSpentSeconds: 0,
    currentStreak: 0,
    bestStreak: 0,
    stars: 0,
  });

  // Persistent completed lessons records
  const [completedLessons, setCompletedLessons] = useState<
    Record<string, { stars: number; bestWpm: number; bestTimeSec?: number; bestScore?: number }>
  >(() => {
    try {
      const saved = localStorage.getItem('typing_kids_completed_lessons');
      const parsed = saved ? JSON.parse(saved) : null;
      // Giá trị hỏng ('null', mảng...) sẽ làm lỗi khi tra cứu -> chỉ nhận object
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  });

  // Modals state
  // Mặc định khi vào phần mềm sẽ hiển thị bảng thông báo nhắc nhở tắt Unikey
  // Tải lại trang khi đang ở Cổng Giáo Viên: không bật lời nhắn Unikey đè lên Cổng (chỉ dành cho học sinh)
  const [isUnikeyNoticeOpen, setIsUnikeyNoticeOpen] = useState<boolean>(() => {
    try {
      return !(sessionStorage.getItem(TEACHER_PORTAL_OPEN_KEY) === '1' && !!loadTeacherSession());
    } catch {
      return true;
    }
  });
  // Menu chọn khối lớp dạng nổi 3D ngay sau khi tắt hộp thoại lời nhắn
  const [isGradeSelectModalOpen, setIsGradeSelectModalOpen] = useState<boolean>(false);

  // Đóng hộp thoại Unikey & ngay lập tức kích hoạt hiển thị Menu nổi 3D chọn khối lớp ở trung tâm
  const handleCloseUnikeyNotice = useCallback(() => {
    setIsUnikeyNoticeOpen(false);
    setIsGradeSelectModalOpen(true);
  }, []);
  const [isPostureModalOpen, setIsPostureModalOpen] = useState<boolean>(false);
  const [isVietnameseGuideOpen, setIsVietnameseGuideOpen] = useState<boolean>(false);
  const [isTypingGuideOpen, setIsTypingGuideOpen] = useState<boolean>(false);
  const [typingGuideTab, setTypingGuideTab] = useState<GuideTabId>('hand_posture');

  const handleOpenTypingGuide = useCallback((tab: GuideTabId = 'hand_posture') => {
    setTypingGuideTab(tab);
    setIsTypingGuideOpen(true);
  }, []);
  const [isNumpadModalOpen, setIsNumpadModalOpen] = useState<boolean>(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState<boolean>(false);
  const [isCurriculumModalOpen, setIsCurriculumModalOpen] = useState<boolean>(false);
  const [isCustomTextModalOpen, setIsCustomTextModalOpen] = useState<boolean>(false);
  // Tải lại trang (F5) khi đang ở Cổng Giáo Viên: mở lại Cổng nếu phiên đăng nhập vẫn còn.
  // Dùng sessionStorage nên chỉ áp cho đúng thẻ trình duyệt đó, mở thẻ mới vẫn vào trang chủ.
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(TEACHER_PORTAL_OPEN_KEY) === '1' && !!loadTeacherSession();
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      if (isTeacherModalOpen) sessionStorage.setItem(TEACHER_PORTAL_OPEN_KEY, '1');
      else sessionStorage.removeItem(TEACHER_PORTAL_OPEN_KEY);
    } catch {
      /* trình duyệt chặn bộ nhớ: bỏ qua */
    }
  }, [isTeacherModalOpen]);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState<boolean>(false);
  // Vị trí đỉnh bảng cài đặt = ngay dưới nút bấm (thanh tiêu đề có thể 1 hoặc 2 hàng)
  const [settingsDropdownTop, setSettingsDropdownTop] = useState<number>(52);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isAuthorDonateModalOpen, setIsAuthorDonateModalOpen] = useState<boolean>(false);
  const [textbookTab, setTextbookTab] = useState<TextbookTab>('curriculum');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(false);
  // Full-width keyboard toggle: cho phép ẩn cột bên phải để bàn phím mở rộng phủ kín 100% màn hình 1920x1080
  const [isRightColumnVisible, setIsRightColumnVisible] = useState<boolean>(true);

  // Smart Auto-Fit Viewport Engine (Tự động nhận diện độ phân giải màn hình & co dãn layout thông minh không cuộn dọc)
  const {
    metrics: smartViewport,
    aiDetectedBanner,
    isAiModalOpen,
    openAiModal,
    closeAiModal,
    refreshViewport,
    dismissBanner,
  } = useSmartAutoFitViewport();

  // Screen Adaptive & Fullscreen Fit Mode
  const [isFullscreenAdaptive, setIsFullscreenAdaptive] = useState<boolean>(false);
  const [screenFitToast, setScreenFitToast] = useState<string | null>(null);

  // Kích hoạt chế độ XEM TOÀN MÀN HÌNH
  const enterFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
      }
      setIsFullscreenAdaptive(true);
      refreshViewport();
      setScreenFitToast(
        `🖥️ Đã tự động kích hoạt chế độ XEM TOÀN MÀN HÌNH! (Bấm phím ESC hoặc rê chuột vào góc trên để bấm ✕ thoát)`
      );
    } catch {
      setIsFullscreenAdaptive(true);
      refreshViewport();
      setScreenFitToast(`🖥️ Đã tối ưu giao diện toàn màn hình cho học sinh!`);
    }

    setTimeout(() => {
      refreshViewport();
      window.dispatchEvent(new Event('resize'));
    }, 150);

    setTimeout(() => {
      setScreenFitToast(null);
    }, 4500);
  }, [refreshViewport]);

  // Thoát chế độ XEM TOÀN MÀN HÌNH
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch {
      // Ignore
    }
    setIsFullscreenAdaptive(false);
    refreshViewport();
    setScreenFitToast(`🖥️ Đã trở về chế độ hiển thị cửa sổ tiêu chuẩn.`);

    setTimeout(() => {
      refreshViewport();
      window.dispatchEvent(new Event('resize'));
    }, 150);

    setTimeout(() => {
      setScreenFitToast(null);
    }, 3000);
  }, [refreshViewport]);

  // TỰ VÀO LẠI TOÀN MÀN HÌNH: đã thoát toàn màn hình (Esc, nút thu nhỏ...) mà học sinh gõ một phím bất kỳ
  // -> phóng to lại để thấy đủ bàn phím. Trình duyệt chỉ cho phép khi có thao tác thật (phím vừa bấm).
  // Trình duyệt/máy không cho phép (bị chặn, đang ở khung nhúng) thì thôi, không thử lại mỗi phím.
  const autoFullscreenBlockedRef = useRef(false);
  const autoReenterFullscreen = useCallback(() => {
    if (autoFullscreenBlockedRef.current || document.fullscreenElement) return;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
    if (!document.fullscreenEnabled || !el.requestFullscreen) {
      autoFullscreenBlockedRef.current = true;
      return;
    }
    el.requestFullscreen()
      .then(() => {
        setIsFullscreenAdaptive(true);
        refreshViewport();
        setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
      })
      .catch(() => {
        autoFullscreenBlockedRef.current = true;
      });
  }, [refreshViewport]);

  // Xử lý nút lệnh XEM TOÀN MÀN HÌNH: tự động điều chỉnh kích thước và chế độ hiển thị của toàn bộ trang web
  // để tương thích với độ phân giải của máy tính hiện tại
  const handleToggleFullscreenFit = async () => {
    if (isFullscreenAdaptive || !!document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  };

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isFullscreenAdaptive || !!document.fullscreenElement)) {
        exitFullscreen();
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullscreenAdaptive, exitFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreenAdaptive(isFs);
      refreshViewport();
      window.dispatchEvent(new Event('resize'));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [refreshViewport]);

  const [smartTelexFreeMode, setSmartTelexFreeMode] = useState<boolean>(true);
  const [wordTypedKeys, setWordTypedKeys] = useState<string[]>([]);
  const [transformingWordEffect, setTransformingWordEffect] = useState<{
    rawKeys: string;
    finalWord: string;
    wordStart: number;
    timestamp: number;
  } | null>(null);

  // Keyboard theme skin state - Mặc định: Bàn phím Cơ Keychron 2 Tone
  const [currentKeyboardTheme, setCurrentKeyboardTheme] = useState<KeyboardSkinTheme>(() => {
    try {
      const savedId = localStorage.getItem('typing_kids_keyboard_theme');
      // Nếu có lưu và không phải là mẫu mặc định cũ ('dell_kb216_black')
      if (savedId && savedId !== 'dell_kb216_black') {
        const found = KEYBOARD_THEMES.find((t) => t.id === savedId);
        if (found) return found;
      }
      return DEFAULT_KEYBOARD_THEME;
    } catch {
      return DEFAULT_KEYBOARD_THEME;
    }
  });

  const handleSelectTheme = (theme: KeyboardSkinTheme) => {
    // Chọn "Bàn phím có hướng dẫn tay gõ" -> bật bàn tay; chọn mẫu bàn phím khác -> tắt bàn tay để hiện đúng mẫu đó
    // Bàn tay bật/tắt riêng được trên mọi kiểu; đổi sang kiểu bàn phím nào cũng mặc định bật lại
    if (theme.isHandsGuideTheme) {
      setSettings((s) => ({ ...s, handsOverlayEnabled: true, handsVisible: true }));
      return;
    }
    // Chọn bàn phím nào cũng mặc định BẬT bàn tay ngón tay ảo (tắt được bằng nút "Bàn tay" trong hộp này)
    // Chọn bàn phím thật nào cũng bắt đầu ở Full size; muốn thu gọn thì bấm nút "Thu gọn" trên bàn phím
    setSettings((s) => ({ ...s, handsOverlayEnabled: false, handsVisible: true, handsOnRealKeyboards: true, realKeyboardCompact: false }));
    setCurrentKeyboardTheme(theme);
    try {
      localStorage.setItem('typing_kids_keyboard_theme', theme.id);
    } catch {
      // Ignore
    }
  };

  // Settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('typing_kids_settings');
      const parsed = saved ? JSON.parse(saved) : null;
      // Ghép với mặc định để cài đặt cũ thiếu trường mới vẫn chạy đúng
      // Mỗi lần mở phần mềm luôn bắt đầu bằng bàn phím có bàn tay hướng dẫn (học sinh có thể đổi trong "Đổi Phím")
      if (parsed && typeof parsed === 'object') return { ...DEFAULT_APP_SETTINGS, ...parsed, handsOverlayEnabled: true, handsVisible: true, handsOnRealKeyboards: true };
    } catch {
      // Fallback
    }
    return DEFAULT_APP_SETTINGS;
  });

  // Bàn tay hướng dẫn: hiện trên mọi kiểu bàn phím. Cài đặt cũ chưa có trường này -> theo kiểu đang dùng
  const handsVisible = settings.handsVisible ?? settings.handsOverlayEnabled;
  const toggleHandsVisible = useCallback(() => {
    setSettings((s) => {
      const next = !(s.handsVisible ?? s.handsOverlayEnabled);
      // Đang dùng kiểu 108 phím thì nhớ lựa chọn này cho lần chọn kiểu 108 phím sau
      return s.handsOverlayEnabled ? { ...s, handsVisible: next } : { ...s, handsVisible: next, handsOnRealKeyboards: next };
    });
  }, []);

  // Bật/tắt màn chờ "BẮT ĐẦU GÕ" (đếm 3-2-1)
  const setRealKeyboardCompact = useCallback((compact: boolean) => {
    setSettings((s) => ({ ...s, realKeyboardCompact: compact }));
  }, []);

  const toggleStartGate = useCallback(() => {
    setSettings((s) => ({ ...s, startGateEnabled: !s.startGateEnabled }));
  }, []);

  // Audio settings sync
  useEffect(() => {
    soundEngine.setMuted(!settings.soundEnabled);
    soundEngine.setVolume(settings.soundVolume);
    try {
      localStorage.setItem('typing_kids_settings', JSON.stringify(settings));
    } catch {
      // Ignore
    }
  }, [settings]);

  // When lesson, input mode, or grade changes, reset practice state
  useEffect(() => {
    setStepIndex(0);
    setIsCompleted(false);
    setStartTime(null);
    setHasMistake(false);
    setMistakeChar(null);
    setMistakeKeyCode(null);
    setCaseMistakeType(null);
    setCaseMistakeMessage(null);
    setRecentTypedKeys([]);
    setWordTypedKeys([]);
    setTransformingWordEffect(null);
    setStats({
      wpm: 0,
      cpm: 0,
      accuracy: 100,
      totalCharacters: 0,
      correctCharacters: 0,
      mistakes: 0,
      timeSpentSeconds: 0,
      currentStreak: 0,
      bestStreak: 0,
      stars: 0,
    });
    // Đổi bài: quay về màn chờ "BẮT ĐẦU GÕ", đồng hồ về 00:00
    cancelCountdown();
    setTypingPhase('ready');
    setEndTime(null);
    setLastFinish(null);
    setResultHidden(false);
    setPausedAt(null);
    setEndedEarly(false);
    // Phụ thuộc id + nội dung thay vì cả object: realtime tải lại danh sách sẽ tạo object mới
    // cho cùng một bài, nếu phụ thuộc cả object thì học sinh đang gõ dở bị xóa tiến độ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLesson.id, activeLesson.text, inputMode]);

  // Teacher Assigns 1 or Multiple Lessons to Grade
  const handleAssignLessonToGrade = async (
    grade: number,
    lessonIdsOrId: string[] | string,
    teacherName: string,
    teacherNote: string
  ) => {
    const lessonIdsArray: string[] = Array.isArray(lessonIdsOrId)
      ? lessonIdsOrId
      : [lessonIdsOrId];
    const primaryId = lessonIdsArray[0] || '';

    const newAssignment: GradeAssignment = {
      gradeLevel: grade,
      lessonId: primaryId,
      lessonIds: lessonIdsArray,
      assignedAt: new Date().toISOString(),
      teacherName,
      teacherNote,
    };

    const updated = { ...gradeAssignments, [grade]: newAssignment };
    setGradeAssignments(updated);
    let savedSomewhere = false;
    try {
      localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(updated));
      // 1. Lưu trực tiếp lên Supabase Cloud Database Realtime
      savedSomewhere = await saveAssignmentToSupabase(newAssignment);
      // 2. Fallback server
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: updated }),
      }).catch(() => null);
      savedSomewhere = savedSomewhere || !!res?.ok;
    } catch (err) {
      console.warn('Lỗi khi lưu giao bài lên server:', err);
    }

    // If current selected grade is this grade, immediately activate the first assigned lesson
    if (selectedGrade === grade && primaryId) {
      const assigned = allAvailableLessons.find((l) => l.id === primaryId);
      if (assigned) {
        setCustomLesson(assigned);
        handleRestart();
      }
    }
    return savedSomewhere;
  };

  // Student selects Grade (Lớp 3 / 4 / 5)
  const handleSelectGrade = (grade: number) => {
    setSelectedGrade(grade);
    setCurrentLessonIndex(0);

    // Tự động kích hoạt chế độ XEM TOÀN MÀN HÌNH ngay sau khi chọn lớp
    enterFullscreen();

    // If teacher has assigned homework for this grade, automatically load the first one
    const assigned = gradeAssignments[grade];
    if (assigned) {
      const primaryId = assigned.lessonIds?.[0] || assigned.lessonId;
      const targetLesson = allAvailableLessons.find((l) => l.id === primaryId);
      if (targetLesson) {
        setCustomLesson(targetLesson);
        handleRestart();
        return;
      }
    }
    setCustomLesson(null);
    handleRestart();
  };

  // Save teacher lessons persistently online to server & localStorage
  const handleSaveTeacherLesson = async (incoming: Lesson) => {
    // Số bài lưu kèm tên chỉ để giữ THỨ TỰ; số hiển thị luôn được đếm lại theo vị trí.
    //  - Bài mới / chuyển sang khối khác: đứng cuối khối (số lớn hơn mọi bài đang có).
    //  - Sửa bài trong cùng khối: giữ nguyên số cũ để bài không đổi chỗ.
    const raw = allLessons.find((l) => l.id === incoming.id);
    let newLesson: Lesson = incoming;
    if (!isNumpadLesson(incoming)) {
      const name = stripLessonNumber(incoming.title);
      let storedTitle: string;
      if (raw && raw.gradeLevel === incoming.gradeLevel) {
        const n = storedLessonNumber(raw.title);
        storedTitle = n !== null ? `Bài ${n}: ${name}` : name;
      } else {
        // Cùng bộ bài (hệ thống hoặc cùng mã giáo viên) và cùng khối lớp
        const owner = lessonOwnerKey(raw ?? incoming);
        const same = allLessons.filter(
          (l) => l.gradeLevel === incoming.gradeLevel && !isNumpadLesson(l) && l.id !== incoming.id && lessonOwnerKey(l) === owner
        );
        // Lớn hơn mọi khoá sắp xếp trong khối (kể cả khoá ảo của bài cũ không ghi số) -> đứng cuối
        const maxKey = Math.max(0, same.length, ...lessonSortKeys(same).values());
        storedTitle = `Bài ${maxKey + 1}: ${name}`;
      }
      newLesson = { ...incoming, title: storedTitle };
    }
    let updatedList: Lesson[];
    const exists = allLessons.some((l) => l.id === newLesson.id);
    if (exists) {
      updatedList = allLessons.map((l) => (l.id === newLesson.id ? newLesson : l));
    } else {
      updatedList = [newLesson, ...allLessons];
    }

    setAllLessons(updatedList);
    try {
      localStorage.setItem('typing_kids_all_lessons', JSON.stringify(updatedList));
    } catch {
      // Ignore
    }

    // 1. Lưu trực tiếp lên Supabase Cloud Database Realtime
    let cloudOk = false;
    try {
      cloudOk = await upsertLessonToSupabase(newLesson);
    } catch (err) {
      console.warn('Lỗi khi lưu bài học lên Supabase:', err);
    }

    // 2. Persist server fallback
    let serverOk = false;
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: updatedList }),
      });
      serverOk = res.ok;
    } catch (err) {
      console.error('Lỗi khi lưu bài học trực tuyến:', err);
    }

    // Bài đang luyện hiện đúng số bài hệ thống vừa đánh
    setCustomLesson(applyLessonNumbers(updatedList).find((l) => l.id === newLesson.id) ?? newLesson);
    handleRestart();
    // Báo cho Góc Giáo Viên biết bài không lưu được ở đâu ngoài máy này (để hiện cảnh báo đỏ)
    return cloudOk || serverOk;
  };

  // Admin: ghi số thứ tự đang hiển thị vào tên bài trên máy chủ (dọn số cũ bị nhảy cóc / thiếu số)
  const handleRenumberLessons = async (): Promise<{ changed: number; ok: boolean }> => {
    const normalized = applyLessonNumbers(allLessons);
    const changed = normalized.filter((l, i) => l.title !== allLessons[i].title);
    if (changed.length === 0) return { changed: 0, ok: true };
    setAllLessons(normalized);
    try {
      localStorage.setItem('typing_kids_all_lessons', JSON.stringify(normalized));
    } catch {
      // Ignore
    }
    let ok = false;
    try {
      ok = await bulkUpsertLessonsToSupabase(changed);
    } catch (err) {
      console.warn('Lỗi khi lưu số thứ tự bài lên Supabase:', err);
    }
    return { changed: changed.length, ok };
  };

  // Trả về false khi máy chủ TỪ CHỐI QUYỀN xoá (giáo viên phụ xoá bài không phải của mình):
  // khi đó giữ nguyên bài trên máy. Mất mạng thì vẫn xoá trên máy như trước.
  const handleDeleteTeacherLesson = async (id: string): Promise<boolean> => {
    // 1. Xóa trên Supabase trước để biết có quyền hay không
    try {
      const cloud = await deleteLessonFromSupabase(id);
      if (cloud === 'denied') return false;
    } catch (err) {
      console.warn('Lỗi khi xóa bài học trên Supabase:', err);
    }

    const updatedList = allLessons.filter((l) => l.id !== id);
    setAllLessons(updatedList);
    try {
      localStorage.setItem('typing_kids_all_lessons', JSON.stringify(updatedList));
    } catch {
      // Ignore
    }

    // 2. Server fallback
    try {
      await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: updatedList }),
      });
    } catch (err) {
      console.error('Lỗi khi xóa bài học trực tuyến:', err);
    }
    if (customLesson?.id === id) {
      setCustomLesson(null);
      handleRestart();
    }
    return true;
  };

  // ---- THAO TÁC HÀNG LOẠT trong Góc Giáo Viên ----
  // Làm trên cả danh sách một lần (không gọi lần lượt từng bài) để các lần lưu không ghi đè lên nhau.
  const persistLessonList = async (updatedList: Lesson[]) => {
    setAllLessons(updatedList);
    try {
      localStorage.setItem('typing_kids_all_lessons', JSON.stringify(updatedList));
    } catch {
      // Ignore
    }
    try {
      const res = await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: updatedList }),
      });
      return res.ok;
    } catch (err) {
      console.error('Lỗi khi lưu danh sách bài học trực tuyến:', err);
      return false;
    }
  };

  // Xoá nhiều bài: bài nào máy chủ từ chối (không phải của tài khoản này) thì giữ lại
  const handleBulkDeleteLessons = async (ids: string[]): Promise<{ deleted: number; denied: number }> => {
    const removed = new Set<string>();
    let denied = 0;
    for (const id of ids) {
      let cloud: Awaited<ReturnType<typeof deleteLessonFromSupabase>> = 'error';
      try {
        cloud = await deleteLessonFromSupabase(id);
      } catch (err) {
        console.warn('Lỗi khi xóa bài học trên Supabase:', err);
      }
      if (cloud === 'denied') denied++;
      else removed.add(id);
    }
    if (removed.size > 0) {
      await persistLessonList(allLessons.filter((l) => !removed.has(l.id)));
      if (customLesson && removed.has(customLesson.id)) {
        setCustomLesson(null);
        handleRestart();
      }
    }
    return { deleted: removed.size, denied };
  };

  // Chuyển nhiều bài sang lớp khác và/hoặc nhóm khác (Luyện phím / Thơ SGK / Văn SGK)
  const handleBulkUpdateLessons = async (
    ids: string[],
    change: { gradeLevel?: number; group?: 'exercise' | 'poem' | 'prose' }
  ): Promise<{ changed: number; ok: boolean }> => {
    let working = [...allLessons];
    const changedIds = new Set<string>();
    for (const id of ids) {
      const idx = working.findIndex((l) => l.id === id);
      if (idx < 0) continue;
      const orig = working[idx];
      const grade = change.gradeLevel ?? orig.gradeLevel ?? 3;
      let next: Lesson = { ...orig, gradeLevel: grade };
      // Đổi nhóm: đúng các trường mà màn Soạn bài vẫn ghi
      const group = change.group ?? (orig.isPoemOrStory || orig.category === 'poems_stories' ? (orig.genre === 'prose' ? 'prose' : 'poem') : null);
      if (change.group) {
        const isPoem = change.group !== 'exercise';
        next = {
          ...next,
          isPoemOrStory: isPoem,
          genre: change.group,
          category: isPoem ? 'poems_stories' : orig.category === 'poems_stories' ? 'short_sentences' : orig.category,
        };
      }
      if (group === 'poem') next.categoryTitleVi = `Thơ SGK Lớp ${grade}`;
      else if (group === 'prose') next.categoryTitleVi = `Văn SGK Lớp ${grade}`;
      else if (/Lớp \d/.test(next.categoryTitleVi || '')) next.categoryTitleVi = next.categoryTitleVi.replace(/Lớp \d/, `Lớp ${grade}`);
      if (/Khối \d/.test(next.subtitle || '')) next.subtitle = next.subtitle.replace(/Khối \d/, `Khối ${grade}`);
      // Sang lớp khác: đứng cuối bộ bài cùng người tạo ở lớp mới (số hiển thị được đếm lại)
      if (grade !== orig.gradeLevel && !isNumpadLesson(next)) {
        const owner = lessonOwnerKey(orig);
        const same = working.filter(
          (l) => l.gradeLevel === grade && !isNumpadLesson(l) && l.id !== id && lessonOwnerKey(l) === owner
        );
        const maxKey = Math.max(0, same.length, ...lessonSortKeys(same).values());
        next.title = `Bài ${maxKey + 1}: ${stripLessonNumber(orig.title)}`;
      }
      working[idx] = next;
      changedIds.add(id);
    }
    if (changedIds.size === 0) return { changed: 0, ok: true };
    const changed = working.filter((l) => changedIds.has(l.id));
    let cloudOk = false;
    try {
      cloudOk = await bulkUpsertLessonsToSupabase(changed);
    } catch (err) {
      console.warn('Lỗi khi lưu bài chuyển lớp/nhóm lên Supabase:', err);
    }
    const serverOk = await persistLessonList(working);
    if (customLesson && changedIds.has(customLesson.id)) {
      setCustomLesson(applyLessonNumbers(working).find((l) => l.id === customLesson.id) ?? null);
      handleRestart();
    }
    return { changed: changedIds.size, ok: cloudOk || serverOk };
  };

  // Nạp danh sách bài học và bài tập từ file USB (Offline)
  const handleImportLessonsFromUSB = useCallback(
    async (
      importedLessons: Lesson[],
      importedAssignments?: Record<number, GradeAssignment>
    ) => {
      if (Array.isArray(importedLessons) && importedLessons.length > 0) {
        setAllLessons(importedLessons);
        try {
          localStorage.setItem('typing_kids_all_lessons', JSON.stringify(importedLessons));
        } catch {
          // ignore
        }
        // Thử đồng bộ dự phòng lên Supabase và server nếu có mạng
        bulkUpsertLessonsToSupabase(importedLessons).catch(() => {});
        fetch('/api/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lessons: importedLessons }),
        }).catch(() => {});
      }

      if (importedAssignments && typeof importedAssignments === 'object') {
        setGradeAssignments(importedAssignments);
        try {
          localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(importedAssignments));
        } catch {
          // ignore
        }
        Object.values(importedAssignments).forEach((a) => {
          if (a && typeof a === 'object') saveAssignmentToSupabase(a).catch(() => {});
        });
        fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignments: importedAssignments }),
        }).catch(() => {});
      }
    },
    []
  );

  const handleResetSystemLesson = async (id: string) => {
    const defaultOriginal = LESSONS.find((l) => l.id === id);
    if (!defaultOriginal) return;

    const updatedList = allLessons.map((l) => (l.id === id ? defaultOriginal : l));
    setAllLessons(updatedList);
    try {
      localStorage.setItem('typing_kids_all_lessons', JSON.stringify(updatedList));
      await upsertLessonToSupabase(defaultOriginal);
      await fetch('/api/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: updatedList }),
      });
    } catch (err) {
      console.error('Lỗi khi khôi phục bài học trực tuyến:', err);
    }
    if (customLesson?.id === id) {
      setCustomLesson(defaultOriginal);
      handleRestart();
    }
  };

  // Current active step
  const currentStep: KeystrokeStep | undefined = keystrokeSteps[stepIndex];

  // Kiểm tra xem ký tự mục tiêu có phải là chữ HOA hay không
  const isTargetUpper = useMemo(() => {
    if (!currentStep) return false;
    return isUpperCaseChar(currentStep.keyChar);
  }, [currentStep]);

  // Ký tự đặc biệt cần giữ phím Shift (Dual-Key Highlighting cho hàng phím số & ký hiệu)
  const currentSymbolGuide: SymbolKeyGuideInfo | null = useMemo(() => {
    if (hasMistake || !currentStep) return null;
    const ch = currentStep.keyChar || currentStep.targetChar || '';
    return getSymbolKeyGuideInfo(ch);
  }, [hasMistake, currentStep]);

  // Derive target key configuration on keyboard
  const isBackspaceTarget = hasMistake;
  // Caps Lock chỉ đổi hoa/thường cho PHÍM CHỮ CÁI. Phím dấu thanh/mũ Telex (s f r x j, w, aa...) hoa hay thường đều được,
  // ký hiệu (! @ ? ...) vẫn cần Shift dù Caps Lock bật.
  const capsInfo = capsGuidance(currentStep, capsLockOn, { hasMistake, isSymbol: !!currentSymbolGuide });
  // Caps Lock đang bật + cần chữ HOA: chỉ bấm phím chữ, không cần Shift
  const isCapsCoveringUpper = capsInfo.capsCoversUpper;
  // Caps Lock đang bật + chữ tiếp theo là chữ THƯỜNG: hướng dẫn bấm Caps Lock để tắt trước
  const isCapsOffTarget = capsInfo.capsOffNeeded;
  const isShiftTarget =
    !hasMistake &&
    !isCapsOffTarget &&
    (!!currentSymbolGuide || ((currentStep?.isShiftRequired || isTargetUpper) && !isCapsCoveringUpper));
  const isEnterTarget = !hasMistake && currentStep?.keyChar === 'Enter';

  // Active Word details for Smart Telex
  const currentWordInfo = useMemo(() => {
    if (!currentStep) return null;
    const charIdx = currentStep.charIndex;
    if (charIdx >= targetText.length) return null;
    const ch = targetText[charIdx];
    if (ch === ' ' || ch === '\n') return null;

    // NẾU KÝ TỰ HIỆN TẠI LÀ DẤU CÂU / KÝ TỰ ĐẶC BIỆT DÍNH LIỀN VỚI TỪ (như ',' trong "bi," hay '.' trong "khoa."):
    // Dấu câu là ký tự độc lập, không phải là âm tiết chữ cái tiếng Việt cần bộ gõ Smart Telex!
    // Trả về null để hệ thống nhận diện chính xác 100% phím dấu câu đó, không bị gợi ý nhầm sang chữ cái đầu từ!
    const charAtCursor = targetText[charIdx];
    if (
      isPunctuationChar(ch) ||
      isPunctuationChar(currentStep.keyChar) ||
      isPunctuationChar(currentStep.targetChar) ||
      isPunctuationChar(charAtCursor)
    ) {
      return null;
    }

    let wordStart = charIdx;
    while (
      wordStart > 0 &&
      targetText[wordStart - 1] !== ' ' &&
      targetText[wordStart - 1] !== '\n' &&
      !isPunctuationChar(targetText[wordStart - 1])
    ) {
      wordStart--;
    }
    let wordEnd = charIdx;
    while (
      wordEnd < targetText.length &&
      targetText[wordEnd] !== ' ' &&
      targetText[wordEnd] !== '\n' &&
      !isPunctuationChar(targetText[wordEnd])
    ) {
      wordEnd++;
    }
    const targetWord = targetText.slice(wordStart, wordEnd);

    let wordStepStart = 0;
    while (wordStepStart < keystrokeSteps.length && keystrokeSteps[wordStepStart].charIndex < wordStart) {
      wordStepStart++;
    }
    let wordStepEnd = wordStepStart;
    while (wordStepEnd < keystrokeSteps.length && keystrokeSteps[wordStepEnd].charIndex < wordEnd) {
      wordStepEnd++;
    }

    return {
      targetWord,
      wordStart,
      wordEnd,
      wordStepStart,
      wordStepEnd,
    };
  }, [currentStep, targetText, keystrokeSteps]);

  // Next acceptable keys in Smart Telex Mode
  const smartTelexNextInfo = useMemo(() => {
    if (!smartTelexFreeMode || inputMode !== 'telex' || !currentWordInfo) {
      return null;
    }
    return checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, '');
  }, [smartTelexFreeMode, inputMode, currentWordInfo, wordTypedKeys]);

  const targetKeyConfig: KeyConfig | undefined = useMemo(() => {
    const isNumpadLesson = !!(activeLesson?.isNumpad || activeLesson?.category === 'numpad_tenkey');

    if (isBackspaceTarget) {
      return getKeyForChar('Backspace') || { code: 'Backspace', label: 'Backspace', widthRatio: 2, type: 'modifier', finger: 'right-pinky' };
    }
    if (isEnterTarget) {
      return getKeyForChar('Enter', isNumpadLesson) || { code: isNumpadLesson ? 'NumpadEnter' : 'Enter', label: 'Enter', widthRatio: 2.25, type: 'modifier', finger: 'right-pinky' };
    }
    if (!currentStep) return undefined;

    // 0. Caps Lock đang bật mà cần chữ thường: phím cần bấm là Caps Lock (ngón út trái) để tắt chữ hoa
    if (isCapsOffTarget) {
      return CODE_TO_KEY_MAP.get('CapsLock');
    }

    // 1. Ký tự đặc biệt kết hợp phím Shift (Dual-Key Highlighting):
    // Ưu tiên phím cơ sở (phím số [1], phím số [8], phím [;] cho dấu [:], phím [/] cho dấu [?], v.v.)
    if (currentSymbolGuide) {
      return CODE_TO_KEY_MAP.get(currentSymbolGuide.baseKeyCode) || getKeyForChar(currentSymbolGuide.baseKeyChar, isNumpadLesson);
    }

    // 2. ƯU TIÊN TUYỆT ĐỐI CHO DẤU CÂU VÀ KÝ TỰ ĐẶC BIỆT DÍNH LIỀN VỚI TỪ (như dấu phẩy ',', chấm '.', hai chấm ':', v.v.):
    // Khi con trỏ đang yêu cầu gõ dấu câu, BẮT BUỘC nhận diện chính xác 100% phím dấu câu trên bàn phím,
    // TUYỆT ĐỐI KHÔNG để bộ gõ Smart Telex can thiệp gợi ý nhảy nhầm sang chữ cái đầu từ (như chữ B hoặc chữ K)!
    const charAtCursor = targetText[currentStep.charIndex];
    const isPunct =
      isPunctuationChar(currentStep.keyChar) ||
      isPunctuationChar(currentStep.targetChar) ||
      isPunctuationChar(charAtCursor);
    if (isPunct) {
      const punctChar =
        (isPunctuationChar(currentStep.keyChar)
          ? currentStep.keyChar
          : isPunctuationChar(charAtCursor)
          ? charAtCursor
          : currentStep.targetChar) || currentStep.keyChar;
      return getKeyForChar(punctChar, isNumpadLesson) || (currentStep.code ? CODE_TO_KEY_MAP.get(currentStep.code) : undefined);
    }

    // 3. Trong chế độ gõ tự do: gợi ý phím ưu tiên tiếp theo nếu có (CHỈ KHI ĐANG GÕ TỪ CHỮ CÁI TIẾNG VIỆT)
    if (smartTelexFreeMode && inputMode === 'telex' && smartTelexNextInfo?.recommendedNextKey) {
      const rec = smartTelexNextInfo.recommendedNextKey;
      return getKeyForChar(rec, isNumpadLesson) || getKeyForChar(currentStep.keyChar, isNumpadLesson);
    }

    return getKeyForChar(currentStep.keyChar, isNumpadLesson);
  }, [isBackspaceTarget, isEnterTarget, isCapsOffTarget, currentStep, currentSymbolGuide, smartTelexFreeMode, inputMode, smartTelexNextInfo, activeLesson, targetText]);

  // ---- Yêu cầu 15b: phím phải gõ NHIỀU LẦN LIÊN TIẾP (Telex dd -> đ, oo -> ô, aa -> â, ee -> ê) ----
  // n = đây là lần bấm thứ mấy, total = tổng số lần liên tiếp. Lần 2 tô màu khác để học sinh biết phải gõ lại phím đó.
  const targetPressInfo = useMemo(
    () => (hasMistake || isCapsOffTarget ? { n: 1, total: 1 } : repeatPressInfo(keystrokeSteps, stepIndex)),
    [hasMistake, isCapsOffTarget, stepIndex, keystrokeSteps]
  );

  const activeFinger: FingerId | undefined = targetKeyConfig?.finger;

  // Văn bản học sinh đã nhập theo thời gian thực (được đưa vào ô nhập văn bản)
  const userTypedText = useMemo(() => {
    const charIdx = currentStep ? currentStep.charIndex : targetText.length;
    const correctPortion = targetText.slice(0, charIdx);
    if (hasMistake && mistakeChar) {
      const displayM = mistakeChar === 'Space' ? ' ' : mistakeChar;
      return correctPortion + displayM;
    }
    return correctPortion;
  }, [targetText, currentStep, hasMistake, mistakeChar]);

  // Deduplicate rapid duplicate events (e.g. from keydown + input onChange)
  const lastKeyProcessedRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const lastPhysicalKeyHandledRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const pendingBackspaceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (pendingBackspaceTimerRef.current) {
        clearTimeout(pendingBackspaceTimerRef.current);
      }
    };
  }, []);

  // Tự động dọn sạch wordTypedKeys khi bắt đầu một từ mới
  useEffect(() => {
    if (!currentWordInfo || stepIndex === currentWordInfo.wordStepStart) {
      setWordTypedKeys([]);
    }
  }, [stepIndex, currentWordInfo]);

  // Hiệu ứng hiển thị chuyển đổi từ gõ phím thô sang chữ có dấu (ví dụ: mays ➜ máy)
  const triggerWordTransformEffect = useCallback(
    (
      wordInfo: {
        targetWord: string;
        wordStart: number;
        wordEnd: number;
        wordStepStart: number;
        wordStepEnd: number;
      } | null,
      keys: string[],
      lastKey: string
    ) => {
      if (!wordInfo) return;
      const rawTyped = [...keys, lastKey].join('');
      if (rawTyped.toLowerCase() !== wordInfo.targetWord.toLowerCase()) {
        const timestamp = Date.now();
        setTransformingWordEffect({
          rawKeys: rawTyped,
          finalWord: wordInfo.targetWord,
          wordStart: wordInfo.wordStart,
          timestamp,
        });
        setTimeout(() => {
          setTransformingWordEffect((prev) => (prev && prev.timestamp === timestamp ? null : prev));
        }, 280);
      }
    },
    []
  );

  // Process key input
  const handleInputEvent = useCallback(
    (keyChar: string, keyCode?: string) => {
      if (isCompleted || !currentStep) return;

      setTransformingWordEffect((prev) => (prev ? null : prev));

      const now = Date.now();

      // Nếu có phím Backspace đang bị hoãn do nghi vấn là Unikey synthetic Backspace,
      // mà ngay sau đó có một phím ký tự tới (đặc biệt là ký tự có dấu hoặc phím tiếp theo) -> HỦY BACKSPACE ĐÓ!
      if (keyChar !== 'Backspace' && keyCode !== 'Backspace') {
        if (pendingBackspaceTimerRef.current) {
          clearTimeout(pendingBackspaceTimerRef.current);
          pendingBackspaceTimerRef.current = null;
        }
      }

      // Xử lý chuỗi nhiều ký tự (ví dụ khi dán, gõ bộ gõ Android/iOS hoặc IME gửi toàn từ "trời" hoặc chuỗi "ời")
      if (keyChar.length > 1 && keyChar !== 'Backspace' && keyChar !== 'Enter') {
        const lowerStr = keyChar.toLowerCase();
        if (currentWordInfo) {
          const stepsInCurrentWord = keystrokeSteps.slice(currentWordInfo.wordStepStart, currentWordInfo.wordStepEnd);
          const stepInWordIdx = Math.max(0, stepIndex - currentWordInfo.wordStepStart);
          const unikeyRes = matchUnikeyInputInWord(currentWordInfo.targetWord, stepInWordIdx, keyChar, stepsInCurrentWord, wordTypedKeys);
          if (unikeyRes.isMatch) {
            if (unikeyRes.isWordCompleted || stepIndex + unikeyRes.advanceCount >= currentWordInfo.wordStepEnd) {
              setWordTypedKeys([]);
            }
            // Dùng chung phần ghi thống kê + kiểm tra hoàn thành bài với phím đơn
            commitKeyResult(true, unikeyRes.advanceCount, keyChar, keyCode, now, startTime ?? now);
            return;
          }
        }

        // Xử lý lần lượt từng phần với trạng thái MỚI NHẤT: flushSync cập nhật state ngay,
        // handlerRef trỏ tới hàm của lần render sau đó (closure cũ sẽ so mọi ký tự với cùng một bước).
        // Tách khoảng trắng riêng để từng từ có dấu (vd " nắng") vẫn được khớp kiểu Unikey.
        const parts = keyChar.includes(' ') ? keyChar.split(/( )/).filter(Boolean) : Array.from(keyChar);
        for (const part of parts) {
          lastKeyProcessedRef.current = { key: '', time: 0 }; // không coi "oo" là phím trùng
          flushSync(() => handlerRef.current(part));
        }
        return;
      }

      // Tránh xử lý trùng lặp nếu cả window.keydown và input.onChange cùng kích hoạt cho 1 phím vật lý
      if (
        keyChar !== 'Backspace' &&
        keyChar.toLowerCase() === lastKeyProcessedRef.current.key &&
        now - lastKeyProcessedRef.current.time < 50
      ) {
        return;
      }
      lastKeyProcessedRef.current = { key: keyChar.toLowerCase(), time: now };

      const currentStartTime = startTime ?? now;
      if (!startTime) setStartTime(now);

      // Đưa phím vào bàn phím (chiếu sáng phím vừa bấm trên bàn phím ảo theo thời gian thực)
      const flashCode =
        keyCode ||
        (keyChar === 'Backspace'
          ? 'Backspace'
          : keyChar === 'Enter'
          ? 'Enter'
          : keyChar === ' '
          ? 'Space'
          : getKeyForChar(keyChar)?.code);
      if (flashCode) {
        setPressedKeys((prev) => new Set(prev).add(flashCode));
        setTimeout(() => {
          setPressedKeys((prev) => {
            const next = new Set(prev);
            next.delete(flashCode);
            return next;
          });
        }, 180);
      }

      // CASE 1: In MISTAKE state
      if (hasMistake) {
        if (keyChar === 'Backspace' || keyCode === 'Backspace') {
          setHasMistake(false);
          setMistakeChar(null);
          setMistakeKeyCode(null);
          setCaseMistakeType(null);
          setCaseMistakeMessage(null);
          setRecentTypedKeys((prev) => [
            ...prev.slice(-14),
            {
              id: `${now}-${Math.random()}`,
              keyLabel: '⌫ Xóa',
              isCorrect: true,
              timestamp: now,
              isBackspace: true,
            },
          ]);
          if (settings.soundEnabled) soundEngine.playMechanicalClick('backspace');
          return;
        }

        // TỰ ĐỘNG KHÔI PHỤC NẾU HỌC SINH BẤM ĐÚNG PHÍM TIẾP THEO (VÀ ĐÚNG CHỮ HOA/THƯỜNG):
        const isCurrentWordAllUpper = !!currentWordInfo && currentWordInfo.targetWord.length > 0 && currentWordInfo.targetWord === currentWordInfo.targetWord.toUpperCase() && /[A-Z\u00C0-\u1EF9]/.test(currentWordInfo.targetWord);

        const caseEvalRecovery = evaluateCaseMistake(currentStep.keyChar, keyChar, {
          isAuxiliaryKey: currentStep.isHatHookKey || currentStep.isToneMarkKey,
          isHatHookKey: currentStep.isHatHookKey,
          isToneMarkKey: currentStep.isToneMarkKey,
          isWordAllUpper: isCurrentWordAllUpper,
          targetChar: currentStep.targetChar,
        });
        let isCorrectNow = false;

        if (!caseEvalRecovery.isCaseMismatch) {
          if (currentStep.keyChar === 'Enter') {
            isCorrectNow = keyChar === 'Enter' || keyCode === 'Enter' || keyCode === 'NumpadEnter';
          } else if (currentStep.keyChar === ' ') {
            isCorrectNow = keyChar === ' ' || keyCode === 'Space';
          } else if (keyChar === currentStep.keyChar) {
            isCorrectNow = true;
          } else if (currentWordInfo && inputMode === 'telex') {
            const stepsInCurrentWord = keystrokeSteps.slice(currentWordInfo.wordStepStart, currentWordInfo.wordStepEnd);
            const stepInWordIdx = Math.max(0, stepIndex - currentWordInfo.wordStepStart);
            const unikeyCheck = matchUnikeyInputInWord(currentWordInfo.targetWord, stepInWordIdx, keyChar, stepsInCurrentWord, wordTypedKeys);
            if (unikeyCheck.isMatch) {
              isCorrectNow = true;
            } else {
              const smartCheck = checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, keyChar);
              if (smartCheck.isValid) isCorrectNow = true;
            }
          }
        } else if (currentWordInfo && inputMode === 'telex') {
          // Kiểm tra thông minh bằng Smart Telex cho chữ in hoa tiếng Việt
          const smartCheck = checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, keyChar);
          if (smartCheck.isValid) {
            isCorrectNow = true;
          }
        }

        if (isCorrectNow) {
          // Bỏ trạng thái lỗi và tiếp tục xử lý phím này bên dưới
          setHasMistake(false);
          setMistakeChar(null);
          setMistakeKeyCode(null);
          setCaseMistakeType(null);
          setCaseMistakeMessage(null);
        } else {
          // Cập nhật chẩn đoán lỗi nếu bé vẫn gõ sai chữ hoa/thường
          if (caseEvalRecovery.isCaseMismatch) {
            setCaseMistakeType(caseEvalRecovery.mistakeType);
            setCaseMistakeMessage({ title: caseEvalRecovery.title, detail: caseEvalRecovery.detail });
          }
          setMistakeChar(keyChar === ' ' ? 'Space' : keyChar);
          setMistakeKeyCode(keyCode || null);
          setRecentTypedKeys((prev) => [
            ...prev.slice(-14),
            {
              id: `${now}-${Math.random()}`,
              keyLabel: keyChar === ' ' ? '␣ Cách' : keyChar,
              isCorrect: false,
              timestamp: now,
              expectedKey: currentStep.keyChar === ' ' ? '␣' : currentStep.keyChar,
            },
          ]);
          if (settings.soundEnabled) soundEngine.playWrongKey();
          return;
        }
      }

      // CASE 2: Xử lý phím Backspace với Unikey Synthetic Backspace Suppression
      if (keyChar === 'Backspace' || keyCode === 'Backspace') {
        const executeNormalBackspace = () => {
          if (wordTypedKeys.length > 0) {
            setWordTypedKeys((prev) => prev.slice(0, -1));
          }
          if (stepIndex > 0) {
            setStepIndex((idx) => idx - 1);
            setRecentTypedKeys((prev) => [
              ...prev.slice(-14),
              {
                id: `${Date.now()}-${Math.random()}`,
                keyLabel: '⌫ Xóa',
                isCorrect: true,
                timestamp: Date.now(),
                isBackspace: true,
              },
            ]);
            if (settings.soundEnabled) soundEngine.playMechanicalClick('backspace');
          }
        };

        // Nếu máy tính đang bật Unikey [V] hoặc đang gõ dở một từ trong chế độ Telex:
        // Hoãn 55ms để lọc bỏ synthetic Backspace của Unikey phát ra trước khi gửi ký tự có dấu!
        if (keyboardImeMode === 'unikey_v' || (inputMode === 'telex' && wordTypedKeys.length > 0)) {
          if (pendingBackspaceTimerRef.current) {
            clearTimeout(pendingBackspaceTimerRef.current);
          }
          pendingBackspaceTimerRef.current = setTimeout(() => {
            pendingBackspaceTimerRef.current = null;
            executeNormalBackspace();
          }, 55);
          return;
        }

        executeNormalBackspace();
        return;
      }

      // Tự động nhận diện nếu người dùng gõ ký tự có dấu từ Unikey:
      const lowerKey = keyChar.toLowerCase();
      if (isVietnameseAccented(lowerKey) && keyboardImeMode === 'telex_e') {
        setKeyboardImeMode('unikey_v');
        try {
          localStorage.setItem('typing_keyboard_ime_mode', 'unikey_v');
        } catch {
          // Bỏ qua khi bộ nhớ trang bị chặn
        }
      }

      // Check matching
      let isMatch = false;
      let advanceCount = 1;

      // 1. Phím Enter
      if (currentStep.keyChar === 'Enter') {
        isMatch = keyChar === 'Enter' || keyCode === 'Enter' || keyCode === 'NumpadEnter';
        if (isMatch) setWordTypedKeys([]);
      }
      // 2. Phím Space (Dấu cách)
      else if (keyChar === ' ' || keyCode === 'Space') {
        if (currentStep.keyChar === ' ') {
          isMatch = true;
          setWordTypedKeys([]);
        }
        // Trường hợp đặc biệt: Người dùng bật Unikey [V] gõ xong từ (ví dụ "trời", "nắng", "học")
        // Unikey đã nuốt phím dấu thanh để biến thành chữ tiếng Việt hoàn chỉnh, và người dùng bấm Space!
        else if (currentWordInfo && inputMode === 'telex') {
          // Nếu bước tiếp theo là dấu câu -> KHÔNG cho phép bấm Space để nhảy qua dấu câu!
          const nextStepIsPunct = keystrokeSteps[stepIndex] && (
            isPunctuationChar(keystrokeSteps[stepIndex].keyChar) ||
            isPunctuationChar(keystrokeSteps[stepIndex].targetChar) ||
            isPunctuationChar(targetText[keystrokeSteps[stepIndex].charIndex])
          );
          if (!nextStepIsPunct) {
            const stepsInCurrentWord = keystrokeSteps.slice(currentWordInfo.wordStepStart, currentWordInfo.wordStepEnd);
            const stepInWordIdx = Math.max(0, stepIndex - currentWordInfo.wordStepStart);
            const unikeyCheck = matchUnikeyInputInWord(currentWordInfo.targetWord, stepInWordIdx, ' ', stepsInCurrentWord, wordTypedKeys);
            if (unikeyCheck.isMatch) {
              isMatch = true;
              const remainingInWord = Math.max(1, currentWordInfo.wordStepEnd - stepIndex);
              const nextStepIsSpace = keystrokeSteps[currentWordInfo.wordStepEnd]?.keyChar === ' ';
              advanceCount = remainingInWord + (nextStepIsSpace ? 1 : 0);
              setWordTypedKeys([]);
            }
          }
        }
      } else {
        // 0. KIỂM TRA PHÂN BIỆT CHỮ HOA / CHỮ THƯỜNG
        const isCurrentWordAllUpper = !!currentWordInfo && currentWordInfo.targetWord.length > 0 && currentWordInfo.targetWord === currentWordInfo.targetWord.toUpperCase() && /[A-Z\u00C0-\u1EF9]/.test(currentWordInfo.targetWord);

        const caseEval = evaluateCaseMistake(currentStep.keyChar, keyChar, {
          isAuxiliaryKey: currentStep.isHatHookKey || currentStep.isToneMarkKey,
          isHatHookKey: currentStep.isHatHookKey,
          isToneMarkKey: currentStep.isToneMarkKey,
          isWordAllUpper: isCurrentWordAllUpper,
          targetChar: currentStep.targetChar,
        });

        if (caseEval.isCaseMismatch) {
          // Nếu ở chế độ Telex tiếng Việt, kiểm tra xem phím vừa gõ có tạo thành từ tiếng Việt có dấu hợp lệ không
          if (inputMode === 'telex' && currentWordInfo) {
            const smartCheck = checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, keyChar);
            if (smartCheck.isValid) {
              isMatch = true;
              const nextKeys = [...wordTypedKeys, keyChar];
              if (smartCheck.isWordCompleted) {
                advanceCount = Math.max(1, currentWordInfo.wordStepEnd - stepIndex);
                triggerWordTransformEffect(currentWordInfo, wordTypedKeys, keyChar);
                setWordTypedKeys([]);
              } else {
                setWordTypedKeys(nextKeys);
                advanceCount = 1;
              }
            } else {
              isMatch = false;
            }
          } else {
            isMatch = false;
          }
        } else {
          // 3. Khớp chính xác ký tự (bao gồm chữ hoa và chữ thường)
          if (keyChar === currentStep.keyChar) {
            isMatch = true;
          }

          // 4. KIỂM TRA BỘ GÕ UNIKEY / EVKEY TRÊN MÁY TÍNH
          if (!isMatch && inputMode === 'telex' && currentWordInfo) {
            const stepsInCurrentWord = keystrokeSteps.slice(currentWordInfo.wordStepStart, currentWordInfo.wordStepEnd);
            const stepInWordIdx = Math.max(0, stepIndex - currentWordInfo.wordStepStart);
            const unikeyCheck = matchUnikeyInputInWord(currentWordInfo.targetWord, stepInWordIdx, keyChar, stepsInCurrentWord, wordTypedKeys);
            if (unikeyCheck.isMatch) {
              isMatch = true;
              advanceCount = unikeyCheck.advanceCount;
              if (unikeyCheck.isWordCompleted || stepIndex + advanceCount >= currentWordInfo.wordStepEnd) {
                triggerWordTransformEffect(currentWordInfo, wordTypedKeys, keyChar);
                setWordTypedKeys([]);
              } else {
                setWordTypedKeys((prev) => [...prev, keyChar]);
              }
            }
          }

          // 5. CHẾ ĐỘ GÕ DẤU TỰ DO TELEX (Dấu trước hoặc dấu sau)
          if (!isMatch && inputMode === 'telex' && currentWordInfo) {
            const smartCheck = checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, keyChar);
            if (smartCheck.isValid) {
              isMatch = true;
              const nextKeys = [...wordTypedKeys, keyChar];
              if (smartCheck.isWordCompleted) {
                advanceCount = Math.max(1, currentWordInfo.wordStepEnd - stepIndex);
                triggerWordTransformEffect(currentWordInfo, wordTypedKeys, keyChar);
                setWordTypedKeys([]);
              } else {
                setWordTypedKeys(nextKeys);
                advanceCount = 1;
              }
            }
          } else if (isMatch && currentWordInfo) {
            // Trùng khớp tuần tự
            const smartCheck = checkKeyInSmartTelexWord(currentWordInfo.targetWord, wordTypedKeys, keyChar);
            if (smartCheck.isWordCompleted || stepIndex + 1 >= currentWordInfo.wordStepEnd) {
              triggerWordTransformEffect(currentWordInfo, wordTypedKeys, keyChar);
              setWordTypedKeys([]);
            } else {
              setWordTypedKeys((prev) => [...prev, keyChar]);
            }
          }

          // 6. HỖ TRỢ BỔ SUNG CÁC BIẾN THỂ PHÂN RÃ KÝ TỰ CÓ DẤU
          if (!isMatch && inputMode === 'telex') {
            const decomp = VIETNAMESE_CHAR_DECOMPOSITION[lowerKey];
            if (decomp) {
              const expectedLower = currentStep.keyChar.toLowerCase();
              if (decomp.hatHook && (expectedLower === decomp.hatHook || decomp.base === expectedLower)) {
                isMatch = true;
                advanceCount = expectedLower === decomp.base ? 2 : 1;
                if (currentWordInfo) {
                  setWordTypedKeys((prev) => [...prev, decomp.hatHook!]);
                }
              } else if (decomp.tone && (expectedLower === decomp.tone || currentWordInfo?.targetWord.toLowerCase().includes(lowerKey))) {
                isMatch = true;
                advanceCount = currentStep.isToneMarkKey ? 1 : Math.max(1, (currentWordInfo?.wordStepEnd ?? stepIndex + 1) - stepIndex);
                if (currentWordInfo) {
                  setWordTypedKeys([]);
                }
              } else if (keyChar === currentStep.targetChar) {
                isMatch = true;
                let nextIdx = stepIndex + 1;
                while (
                  nextIdx < keystrokeSteps.length &&
                  keystrokeSteps[nextIdx].charIndex === currentStep.charIndex
                ) {
                  nextIdx++;
                }
                advanceCount = Math.max(1, nextIdx - stepIndex);
                setWordTypedKeys([]);
              }
            }
          }
        }
      }

      commitKeyResult(isMatch, advanceCount, keyChar, keyCode, now, currentStartTime);
    },
    [
      isCompleted,
      currentStep,
      startTime,
      hasMistake,
      stepIndex,
      settings,
      keystrokeSteps,
      smartTelexFreeMode,
      inputMode,
      keyboardImeMode,
      currentWordInfo,
      wordTypedKeys,
      triggerWordTransformEffect,
      targetText,
      stats,
      activeLesson,
    ]
  );

  // Ghi một lần gõ: lịch sử phím, thống kê, chuyển bước, hoàn thành bài
  function commitKeyResult(
    isMatch: boolean,
    advanceCount: number,
    keyChar: string,
    keyCode: string | undefined,
    now: number,
    currentStartTime: number
  ) {
      if (!currentStep) return;
      if (!startTime) setStartTime(currentStartTime);
      // Record this keystroke in real-time visual history
      const formattedKeyLabel =
        keyChar === ' '
          ? '␣ Cách'
          : keyChar === 'Enter'
          ? '↵ Enter'
          : keyChar;

      setRecentTypedKeys((prev) => [
        ...prev.slice(-14),
        {
          id: `${now}-${Math.random()}`,
          keyLabel: formattedKeyLabel,
          isCorrect: isMatch,
          timestamp: now,
          expectedKey: currentStep.keyChar === ' ' ? '␣' : currentStep.keyChar,
        },
      ]);

      // Tính thống kê mới một lần, dùng chung cho màn hình và bản ghi sao (tránh lưu giá trị cũ)
      const computeNextStats = (prev: TypingStats): TypingStats => {
        const total = prev.totalCharacters + 1;
        const correct = prev.correctCharacters + (isMatch ? 1 : 0);
        const mistakes = prev.mistakes + (isMatch ? 0 : 1);
        const streak = isMatch ? prev.currentStreak + 1 : 0;
        const bestStreak = Math.max(prev.bestStreak, streak);
        const accuracy = Math.round((correct / total) * 100);

        const elapsedSec = Math.max(1, Math.round((now - currentStartTime) / 1000));
        const words = correct / 5;
        const wpm = Math.round((words / elapsedSec) * 60);
        const cpm = Math.round((correct / elapsedSec) * 60);

        let stars = 1;
        if (wpm >= activeLesson.targetWpm && accuracy >= activeLesson.targetAccuracy) {
          stars = 3;
        } else if (wpm >= activeLesson.targetWpm * 0.75 || accuracy >= 85) {
          stars = 2;
        }

        return {
          wpm,
          cpm,
          accuracy,
          totalCharacters: total,
          correctCharacters: correct,
          mistakes,
          timeSpentSeconds: elapsedSec,
          currentStreak: streak,
          bestStreak,
          stars,
        };
      };
      const nextStats = computeNextStats(stats);
      setStats(nextStats);

      if (isMatch) {
        setHasMistake(false);
        setMistakeChar(null);
        setMistakeKeyCode(null);
        setCaseMistakeType(null);
        setCaseMistakeMessage(null);

        if (settings.soundEnabled) {
          if (settings.soundType === 'bubble') {
            soundEngine.playBubblePop();
          } else {
            soundEngine.playMechanicalClick(
              currentStep.keyChar === ' ' ? 'space' : currentStep.keyChar === 'Enter' ? 'enter' : 'normal'
            );
          }
        }

        // Không cho vượt quá cuối bài (nhánh khớp Unikey có thể nhảy nhiều bước)
        const nextStepIndex = Math.min(stepIndex + advanceCount, keystrokeSteps.length);
        setStepIndex(nextStepIndex);

        if (nextStepIndex >= keystrokeSteps.length) {
          setIsCompleted(true);
          setEndTime(now);
          // Điểm & thời gian hoàn thành theo đúng công thức của bảng điểm
          const finishSec = Math.max(1, Math.floor((now - currentStartTime) / 1000));
          const totalWords = completedWords(targetText, targetText.length).total;
          const finishScore = score10(nextStats.accuracy, Math.round((totalWords * 60) / finishSec), activeLesson.targetWpm);
          setLastFinish({ elapsedSec: finishSec, prevBestSec: completedLessons[activeLesson.id]?.bestTimeSec, score: finishScore });
          if (settings.soundEnabled) soundEngine.playVictoryFanfare();

          confetti({
            particleCount: 130,
            spread: 90,
            origin: { y: 0.6 },
          });

          setCompletedLessons((prev) => {
            const currentRecord = prev[activeLesson.id];
            const newStars = Math.max(currentRecord?.stars ?? 0, nextStats.stars);
            const newWpm = Math.max(currentRecord?.bestWpm ?? 0, nextStats.wpm);
            const finishSecRec = Math.max(1, Math.floor((now - currentStartTime) / 1000));
            const totalWordsRec = completedWords(targetText, targetText.length).total;
            const scoreRec = score10(nextStats.accuracy, Math.round((totalWordsRec * 60) / finishSecRec), activeLesson.targetWpm);
            const updated = {
              ...prev,
              [activeLesson.id]: {
                stars: newStars,
                bestWpm: newWpm,
                // Kỷ lục: thời gian NGẮN nhất và điểm CAO nhất của bài này
                bestTimeSec: Math.min(currentRecord?.bestTimeSec ?? Infinity, finishSecRec),
                bestScore: Math.max(currentRecord?.bestScore ?? 0, scoreRec),
              },
            };
            try {
              localStorage.setItem('typing_kids_completed_lessons', JSON.stringify(updated));
            } catch {
              // Ignore
            }
            return updated;
          });
        }
      } else {
        setHasMistake(true);
        setMistakeChar(keyChar === ' ' ? 'Space' : keyChar);
        setMistakeKeyCode(keyCode || null);
        const evalCase = evaluateCaseMistake(currentStep.keyChar, keyChar);
        if (evalCase.isCaseMismatch) {
          setCaseMistakeType(evalCase.mistakeType);
          setCaseMistakeMessage({ title: evalCase.title, detail: evalCase.detail });
        } else {
          setCaseMistakeType(null);
          setCaseMistakeMessage(null);
        }
        if (settings.soundEnabled) soundEngine.playWrongKey();
      }
  }

  // TẮT màn chờ (mặc định): bài đang ở trạng thái chờ và không có hộp nào che -> vào bài, đồng hồ chạy ngay.
  // Có hộp đang mở (chọn lớp, nhắc Unikey, chọn bài...) thì đợi đóng hộp rồi mới tính giờ.
  const anyBlockingModalOpen =
    isUnikeyNoticeOpen ||
    isAuthorDonateModalOpen ||
    isCustomTextModalOpen ||
    isTeacherModalOpen ||
    isGameModalOpen ||
    isCurriculumModalOpen ||
    isPostureModalOpen ||
    isVietnameseGuideOpen ||
    isNumpadModalOpen ||
    isThemeModalOpen ||
    isGradeSelectModalOpen ||
    isTypingGuideOpen ||
    isAiModalOpen;
  useEffect(() => {
    if (settings.startGateEnabled || isCompleted || anyBlockingModalOpen) return;
    if (typingPhaseRef.current !== 'ready') return;
    const t = Date.now();
    typingPhaseRef.current = 'running';
    setTypingPhase('running');
    setStartTime(t);
    setClockNow(t);
  }, [settings.startGateEnabled, isCompleted, anyBlockingModalOpen, typingPhase]);

  // Đồng hồ: cập nhật mỗi 0,5 giây khi đang gõ, dừng khi xong bài
  useEffect(() => {
    if (typingPhase !== 'running' || isCompleted || pausedAt !== null) return;
    const id = setInterval(() => setClockNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [typingPhase, isCompleted, pausedAt]);

  const pauseTyping = useCallback(() => {
    if (typingPhaseRef.current !== 'running' || isCompleted || pausedAtRef.current !== null) return;
    const t = Date.now();
    pausedAtRef.current = t;
    setPausedAt(t);
    setClockNow(t);
  }, [isCompleted]);

  const resumeTyping = useCallback(() => {
    const p = pausedAtRef.current;
    if (p === null) return;
    const t = Date.now();
    pausedAtRef.current = null;
    resumedAtRef.current = t;
    setStartTime((s) => (s === null ? s : s + (t - p)));
    setClockNow(t);
    setPausedAt(null);
  }, []);
  useEffect(() => () => cancelCountdown(), []);

  // Luôn trỏ tới hàm xử lý của lần render mới nhất (dùng khi xử lý chuỗi nhiều ký tự)
  const handlerRef = useRef(handleInputEvent);
  useLayoutEffect(() => {
    handlerRef.current = handleInputEvent;
  });

  // Global Keyboard event listener
  useEffect(() => {
    if (
      isUnikeyNoticeOpen ||
      isAuthorDonateModalOpen ||
      isCustomTextModalOpen ||
      isTeacherModalOpen ||
      isGameModalOpen ||
      isCurriculumModalOpen ||
      isPostureModalOpen ||
      isVietnameseGuideOpen ||
      isNumpadModalOpen ||
      isThemeModalOpen ||
      isGradeSelectModalOpen ||
      isTypingGuideOpen ||
      isAiModalOpen
    ) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Đang gõ vào ô nhập khác (ô tìm bài SGK, ô cài đặt...) -> để ô đó nhận phím
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest?.('input, textarea, select, [contenteditable="true"]') &&
        !target.classList.contains('sr-only')
      ) {
        return;
      }
      // Phím tắt (Ctrl+R, Ctrl+C, Cmd+Tab...) không phải là lần gõ -> không chặn, không tính lỗi
      if (e.ctrlKey || e.metaKey || (e.altKey && !e.getModifierState?.('AltGraph'))) {
        return;
      }
      // Đã thoát toàn màn hình mà gõ phím -> tự phóng to lại (trừ phím Esc dùng để thoát)
      if (!e.repeat && e.key !== 'Escape' && !document.fullscreenElement) {
        autoReenterFullscreen();
      }

      // Đang tạm dừng: bấm phím bất kì để tiếp tục, phím đó không tính là lần gõ
      if (pausedAtRef.current !== null) {
        e.preventDefault();
        if (!e.repeat) resumeTyping();
        return;
      }

      // Giữ phím lâu sinh nhiều sự kiện lặp -> không tính thành nhiều lỗi
      if (e.repeat && e.key.length === 1) {
        e.preventDefault();
        return;
      }

      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.add(e.code);
        return next;
      });

      if (['Alt', 'Control', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      if (e.key === 'Shift') {
        return;
      }

      if (e.key === 'Escape') {
        handleRestart();
        return;
      }

      // Chưa bấm "BẮT ĐẦU GÕ": Enter hoặc phím cách để bắt đầu, các phím khác chưa tính
      if (typingPhaseRef.current !== 'running' && !isCompleted) {
        if (typingPhaseRef.current === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          startTyping();
          return;
        }
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        lastPhysicalKeyHandledRef.current = { key: 'Backspace', time: Date.now() };
        handleInputEvent('Backspace', 'Backspace');
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        lastPhysicalKeyHandledRef.current = { key: 'Enter', time: Date.now() };
        handleInputEvent('Enter', 'Enter');
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        lastPhysicalKeyHandledRef.current = { key: e.key.toLowerCase(), time: Date.now() };
        handleInputEvent(e.key, e.code);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setPressedKeys((prev) => {
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    };

    // Rời cửa sổ khi đang đè phím (Alt+Tab...) sẽ không nhận được keyup -> xoá hết để Shift không bị "kẹt" sáng
    const handleBlur = () => setPressedKeys(new Set());

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    handleInputEvent,
    autoReenterFullscreen,
    startTyping,
    resumeTyping,
    isCompleted,
    isUnikeyNoticeOpen,
    isAuthorDonateModalOpen,
    isCustomTextModalOpen,
    isTeacherModalOpen,
    isGameModalOpen,
    isCurriculumModalOpen,
    isPostureModalOpen,
    isVietnameseGuideOpen,
    isNumpadModalOpen,
    isThemeModalOpen,
    isGradeSelectModalOpen,
    isTypingGuideOpen,
    isAiModalOpen,
  ]);

  // Xử lý đầu vào thủ công từ ô gõ (input ẩn) với lọc trùng lặp thông minh
  const handleManualInput = useCallback(
    (inputVal: string, code?: string) => {
      if (!inputVal) return;
      if (typingPhaseRef.current !== 'running') return; // chưa bấm BẮT ĐẦU GÕ
      if (pausedAtRef.current !== null) {
        resumeTyping();
        return;
      }
      const now = Date.now();
      if (now - resumedAtRef.current < 200) return; // phím vừa dùng để tiếp tục
      // Bỏ qua nếu là phím đơn và vừa được xử lý bởi keydown vật lý trong vòng 150ms
      if (
        inputVal.length === 1 &&
        inputVal !== 'Backspace' &&
        inputVal !== 'Enter' &&
        now - lastPhysicalKeyHandledRef.current.time < 150 &&
        inputVal.toLowerCase() === lastPhysicalKeyHandledRef.current.key
      ) {
        return;
      }
      handleInputEvent(inputVal, code);
    },
    [handleInputEvent, resumeTyping]
  );

  const handleRestart = () => {
    cancelCountdown();
    setPausedAt(null);
    setEndedEarly(false);
    setTypingPhase('ready');
    setEndTime(null);
    setLastFinish(null);
    setResultHidden(false);
    setStepIndex(0);
    setIsCompleted(false);
    setStartTime(null);
    setHasMistake(false);
    setMistakeChar(null);
    setMistakeKeyCode(null);
    setCaseMistakeType(null);
    setCaseMistakeMessage(null);
    setRecentTypedKeys([]);
    setWordTypedKeys([]);
    setTransformingWordEffect(null);
    setStats({
      wpm: 0,
      cpm: 0,
      accuracy: 100,
      totalCharacters: 0,
      correctCharacters: 0,
      mistakes: 0,
      timeSpentSeconds: 0,
      currentStreak: 0,
      bestStreak: 0,
      stars: 0,
    });
  };

  // ---- Số liệu cho BẢNG ĐIỂM (đồng hồ, điểm thang 10, từ đúng, chính xác, tốc độ từ/phút) ----
  const elapsedSec = startTime
    ? Math.max(0, Math.floor(((isCompleted && endTime ? endTime : pausedAt ?? clockNow) - startTime) / 1000))
    : 0;
  const cursorCharIndex =
    isCompleted && !endedEarly ? targetText.length : currentStep ? currentStep.charIndex : targetText.length;
  const wordProgress = useMemo(() => completedWords(targetText, cursorCharIndex), [targetText, cursorCharIndex]);
  const liveWordsPerMin = wordsPerMinute(wordProgress.done, elapsedSec);
  // 10 giây đầu chưa đo được tốc độ: điểm tạm tính theo độ chính xác (quy về thang 10)
  const liveScore =
    stats.totalCharacters === 0
      ? 0
      : elapsedSec < MIN_SPEED_SEC
      ? Math.round(stats.accuracy) / 10
      : score10(stats.accuracy, liveWordsPerMin, activeLesson.targetWpm);

  // Kết thúc bài sớm: dừng đồng hồ, chấm điểm theo số từ đã gõ đúng, không ghi kỷ lục (bài chưa xong)
  const handleFinishEarly = () => {
    if (typingPhaseRef.current !== 'running' || isCompleted || startTime === null) return;
    const now = pausedAtRef.current ?? Date.now();
    const finishSec = Math.max(1, Math.floor((now - startTime) / 1000));
    const done = wordProgress.done;
    // Điểm phần đã gõ nhân tỉ lệ số từ hoàn thành: gõ 1 từ rồi dừng không được điểm như gõ cả bài
    const ratio = wordProgress.total > 0 ? done / wordProgress.total : 0;
    const finishScore =
      stats.totalCharacters === 0
        ? 0
        : Math.round(score10(stats.accuracy, Math.round((done * 60) / finishSec), activeLesson.targetWpm) * ratio * 10) / 10;
    pausedAtRef.current = null;
    setPausedAt(null);
    setEndedEarly(true);
    setEndTime(now);
    setLastFinish({ elapsedSec: finishSec, score: finishScore });
    setIsCompleted(true);
  };
  const isPaused = pausedAt !== null && !isCompleted;
  const canControlTyping = typingPhase === 'running' && !isCompleted;

  // Vị trí của bài đang hiển thị (kể cả bài chọn từ mục lục / bài cô giao) trong danh sách của lớp
  const activeLessonPos = gradeFilteredLessons.findIndex((l) => l.id === activeLesson.id);
  const hasPrev = activeLessonPos > 0;
  const hasNext = activeLessonPos >= 0 && activeLessonPos < gradeFilteredLessons.length - 1;

  const handlePrevLesson = () => {
    if (hasPrev) {
      setCustomLesson(null);
      setCurrentLessonIndex(activeLessonPos - 1);
    }
  };

  const handleNextLesson = () => {
    if (hasNext) {
      setCustomLesson(null);
      setCurrentLessonIndex(activeLessonPos + 1);
    }
  };

  const handleKeyClick = (key: KeyConfig) => {
    if (key.code === 'CapsLock') {
      setCapsLockOn((prev) => !prev);
      return;
    }
    if (typingPhaseRef.current !== 'running') return; // chưa bấm BẮT ĐẦU GÕ
    if (pausedAtRef.current !== null) {
      resumeTyping();
      return;
    }

    if (hasMistake) {
      if (key.code === 'Backspace') {
        handleInputEvent('Backspace', 'Backspace');
      }
      return;
    }

    if (key.code === 'Backspace') {
      handleInputEvent('Backspace', 'Backspace');
    } else if (key.code === 'Enter') {
      handleInputEvent('Enter', 'Enter');
    } else if (key.code === 'Space') {
      handleInputEvent(' ', 'Space');
    } else if (key.code === 'ShiftLeft' || key.code === 'ShiftRight') {
      if (settings.soundEnabled) soundEngine.playMechanicalClick();
      setPressedKeys((prev) => new Set(prev).add(key.code));
      setTimeout(() => {
        setPressedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key.code);
          return next;
        });
      }, 300);
    } else if (key.char) {
      let charToSend = key.char;
      if (isShiftTarget) {
        charToSend = key.shiftChar || (key.char.toUpperCase() !== key.char ? key.char.toUpperCase() : key.char);
      } else if (capsLockOn) {
        charToSend = key.char.toUpperCase();
      } else {
        charToSend = key.char.toLowerCase();
      }
      handleInputEvent(charToSend, key.code);
    }
  };

  const handleVoiceSpeak = (txt: string) => {
    soundEngine.speak(txt);
  };

  // Assigned homework object for currently selected grade
  const currentGradeHomework = gradeAssignments[selectedGrade];

  // List of all assigned lessons for the selected grade
  const assignedLessonsList = useMemo(() => {
    if (!currentGradeHomework) return [];
    const ids =
      currentGradeHomework.lessonIds && currentGradeHomework.lessonIds.length > 0
        ? currentGradeHomework.lessonIds
        : currentGradeHomework.lessonId
        ? [currentGradeHomework.lessonId]
        : [];
    return ids
      .map((id) => allAvailableLessons.find((l) => l.id === id))
      .filter((l): l is Lesson => !!l);
  }, [currentGradeHomework, allAvailableLessons]);

  const handleSelectAssignedHomework = (targetLessonId?: string) => {
    const hw = gradeAssignments[selectedGrade];
    if (hw) {
      const chosenId =
        targetLessonId ||
        (hw.lessonIds && hw.lessonIds.length > 0 ? hw.lessonIds[0] : hw.lessonId);
      const assigned = allAvailableLessons.find((l) => l.id === chosenId);
      if (assigned) {
        setCustomLesson(assigned);
        setTextbookTab('homework');
        setIsRightPanelOpen(true);
        handleRestart();
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
        });
        return;
      }
    }
    const defaultForGrade = allAvailableLessons.find((l) => l.gradeLevel === selectedGrade);
    if (defaultForGrade) {
      setCustomLesson(defaultForGrade);
      setTextbookTab('curriculum');
      setIsRightPanelOpen(true);
      handleRestart();
    }
  };

  return (
    <div
      className="h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-gradient-to-b from-sky-100 via-sky-50 to-amber-50 text-slate-800 flex flex-col justify-between selection:bg-amber-300 selection:text-slate-900 font-sans"
    >
      {/* BANNER AI TỰ ĐỘNG NHẬN DIỆN ĐỘ PHÂN GIẢI & CĂN CHỈNH VỪA KHÍT (SMART AUTO-FIT VIEWPORT) */}
      {aiDetectedBanner && (
        <div
          onClick={openAiModal}
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white px-4 py-2 rounded-2xl shadow-2xl border-2 border-indigo-400 backdrop-blur-md flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-300 max-w-xl text-center select-none cursor-pointer hover:border-indigo-300 transition-all"
          title="Bấm để xem chi tiết thông số AI Auto-Fit"
        >
          <span className="text-xl shrink-0 animate-bounce">🤖</span>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
              <span>AI Smart Auto-Fit: Đã tự động nhận diện màn hình ({smartViewport.detectedResolutionLabel})</span>
              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold">Vừa Khít 100%</span>
            </span>
            <span className="text-[11px] text-slate-200 font-medium">
              Tự động co dãn tỷ lệ layout, font chữ & bàn phím ảo vừa khít hoàn hảo trong một khung nhìn • Không cuộn trang!
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissBanner();
            }}
            className="ml-2 text-slate-400 hover:text-white text-xs font-black p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast thông báo khi tự động điều chỉnh hiển thị XEM TOÀN MÀN HÌNH tương thích độ phân giải */}
      {screenFitToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 text-white px-4 py-1.5 rounded-xl shadow-2xl border border-indigo-400 backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200 select-none">
          <span className="text-base">🖥️</span>
          <span className="text-xs font-black text-indigo-200">{screenFitToast}</span>
        </div>
      )}



      {/* ======================================================== */}
      {/* 1. TOP HEADER (COMPACT SINGLE-ROW, FIT-TO-SCREEN 1366px) */}
      {/* ======================================================== */}
      {/* Thanh tiêu đề: 1 hàng trên máy tính; màn hẹp (máy tính bảng) tự xuống 2 hàng để mọi nút đều thấy, không phải vuốt ngang */}
      <header className="min-h-[40px] sm:min-h-[44px] w-full bg-white/95 border-b border-sky-200 z-40 px-2 sm:px-3 py-1 flex flex-wrap items-center justify-between gap-x-1.5 sm:gap-x-2.5 gap-y-1 shrink-0 select-none shadow-xs">
        {/* CLUSTER 1: LOGO + KHỐI LỚP (LỚP 3 / 4 / 5) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full overflow-hidden shadow-xs border border-sky-300 flex items-center justify-center select-none bg-white shrink-0 hover:scale-105 transition-transform">
            <img
              src={appLogo}
              alt="Logo Luyện Gõ Bàn Phím 10 Ngón"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = './logo.svg';
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Màn 1366px thiếu chỗ cho thanh công cụ: ẩn chữ (vẫn đọc được bằng trình đọc màn hình), logo vẫn hiện */}
            <h1 className="sr-only min-[1760px]:not-sr-only text-xs sm:text-sm font-black text-slate-900 tracking-tight whitespace-nowrap">
              Bé Luyện Gõ 10 Ngón
            </h1>
            <span className="text-[9px] bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full shadow-2xs border border-amber-300 hidden min-[1760px]:inline">
              Tiểu Học
            </span>
          </div>

          {/* GRADE SELECTOR TABS (LỚP 3 / LỚP 4 / LỚP 5) */}
          <div className="flex items-center gap-0.5 p-0.5 bg-sky-100/90 rounded-lg border border-sky-300 shadow-inner ml-0.5">
            <button
              type="button"
              onClick={() => setIsGradeSelectModalOpen(true)}
              className="text-sm font-black text-sky-900 px-1.5 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors"
              title="Bấm để mở Menu chọn khối lớp"
            >
              <GraduationCap className="w-4 h-4 text-sky-700" />
              <span>Khối:</span>
            </button>

            {[3, 4, 5].map((grade) => (
              <button
                key={`top-grade-${grade}`}
                type="button"
                onClick={() => handleSelectGrade(grade)}
                className={`min-h-[34px] px-3 rounded-md font-black text-sm transition-all cursor-pointer flex items-center gap-1 ${
                  selectedGrade === grade
                    ? 'bg-sky-600 text-white shadow-xs scale-102 ring-1 ring-sky-300'
                    : 'text-slate-700 hover:bg-white hover:text-sky-900'
                }`}
              >
                <span>Lớp {grade}</span>
                {gradeAssignments[grade] && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" title="Có bài tập cô giáo giao" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CLUSTER 2: CHẾ ĐỘ TELEX/VNI, HƯỚNG DẪN GÕ & BÀI CÔ GIÁO GIAO (màn hẹp khít khoảng cách để không xuống thêm dòng) */}
        <div className="flex items-center gap-1 lg:gap-2 shrink-0">
          {/* Vietnamese Mode Selector (Telex / VNI) */}
          <div className="flex items-center gap-0.5 bg-amber-50 p-0.5 rounded-lg border border-amber-300 shadow-2xs">
            <button
              type="button"
              onClick={() => setInputMode('telex')}
              className={`min-h-[30px] px-2.5 rounded text-sm font-black transition-all cursor-pointer ${
                inputMode === 'telex'
                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kiểu gõ Telex"
            >
              TELEX
            </button>
            <button
              type="button"
              onClick={() => setInputMode('vni')}
              className={`min-h-[30px] px-2.5 rounded text-sm font-black transition-all cursor-pointer ${
                inputMode === 'vni'
                  ? 'bg-emerald-500 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kiểu gõ VNI"
            >
              VNI
            </button>
          </div>

          {/* Nút HƯỚNG DẪN GÕ trên thanh Header (Bao gồm Đặt tay, Dấu Tiếng Việt & Phím số Numpad) */}
          <button
            type="button"
            // Mở tab "Làm quen bàn phím" trước: biết tên hàng phím, khu vực rồi mới học đặt tay
            onClick={() => handleOpenTypingGuide('keyboard_map')}
            className="min-h-[36px] px-2 lg:px-3 rounded-lg bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer border-2 border-amber-400 shadow-2xs hover:shadow-xs hover:scale-103 active:scale-95 whitespace-nowrap"
            title="Sổ tay Hướng dẫn gõ 10 ngón: Đặt tay đúng, Gõ dấu Tiếng Việt & Bàn phím số Numpad"
          >
            <span className="text-xs hidden lg:inline" aria-hidden="true">📖</span>
            <span className="font-extrabold tracking-wide">HƯỚNG DẪN GÕ</span>
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
          </button>

          {/* Nút BÀI CÔ GIÁO GIAO (trước là "Chi tiết" ở dải xanh): mở ngăn xem các bài cô giao cho lớp */}
          <button
            type="button"
            data-testid="header-homework-button"
            onClick={() => {
              setTextbookTab('homework');
              setIsRightPanelOpen(true);
            }}
            className="min-h-[36px] px-2 lg:px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer border-2 border-emerald-500 shadow-2xs hover:scale-103 active:scale-95 whitespace-nowrap"
            title="Xem các bài cô giáo giao cho lớp"
          >
            <span className="text-xs hidden lg:inline" aria-hidden="true">📋</span>
            {/* Màn hẹp (máy tính bảng dọc) dùng chữ ngắn để thanh trên cùng không xuống thêm một dòng */}
            <span className="font-extrabold tracking-wide hidden min-[1360px]:inline">BÀI CÔ GIÁO GIAO</span>
            <span className="font-extrabold tracking-wide min-[1360px]:hidden">BÀI GIAO</span>
            {assignedLessonsList.length > 0 && (
              <span className="min-w-[20px] h-5 px-1 rounded-full bg-white text-emerald-700 text-xs font-black flex items-center justify-center">
                {assignedLessonsList.length}
              </span>
            )}
          </button>

        </div>

        {/* CỤM 3 (HỌC SINH): Đổi phím, Trò chơi, Âm thanh, Toàn màn hình.
            Mọi công cụ & cài đặt của giáo viên gom vào 1 nút "Giáo viên" – bấm mới sổ ra. */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 max-w-full">
          <button
            type="button"
            onClick={() => setIsThemeModalOpen(true)}
            className="min-h-[36px] px-3 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
            title="Chọn kiểu bàn phím (mặc định: bàn phím có bàn tay hướng dẫn)"
          >
            <Palette className="w-4 h-4" />
            <span>Đổi phím</span>
          </button>

          <button
            type="button"
            onClick={() => setIsGameModalOpen(true)}
            className="min-h-[36px] px-3 rounded-lg bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-white text-sm font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap"
            title="Trò chơi luyện gõ"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Trò chơi</span>
          </button>

          <button
            type="button"
            onClick={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
            className={`min-h-[36px] min-w-[36px] rounded-lg transition-colors cursor-pointer border shadow-2xs flex items-center justify-center ${
              settings.soundEnabled
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
            }`}
            title={settings.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            aria-label={settings.soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {settings.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          {isFullscreenAdaptive ? (
            <button
              type="button"
              onClick={exitFullscreen}
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
              title="Thoát toàn màn hình (phím ESC)"
              aria-label="Thoát toàn màn hình"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleToggleFullscreenFit}
              className="min-h-[36px] min-w-[36px] px-2 rounded-lg bg-white hover:bg-slate-100 text-indigo-900 border border-indigo-200 flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
              title="Xem toàn màn hình"
              aria-label="Xem toàn màn hình"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}

          {/* NÚT GIÁO VIÊN: mở thẳng Cổng Giáo Viên (chưa đăng nhập thì hiện màn đăng nhập).
              Các cài đặt lớp học trước đây ở menu thả xuống nay nằm trong mục "Cài đặt lớp học" của Cổng. */}
          <button
            type="button"
            data-testid="header-teacher-button"
            onClick={() => setIsTeacherModalOpen(true)}
            className="min-h-[36px] px-3 rounded-lg text-sm font-black flex items-center gap-1.5 cursor-pointer shadow-2xs border transition-colors bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
            title="Mở Cổng Giáo Viên (đăng nhập để soạn bài, giao bài, cài đặt lớp học)"
          >
            <UserCheck className="w-4 h-4" />
            <span>Giáo viên</span>
            {isSupabaseOnline && <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" title="Đã kết nối dữ liệu trực tuyến" />}
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. NOTIFICATION BANNER: TINH GỌN 1 DÒNG (HEIGHT ~24px)   */}
      {/* ======================================================== */}
      {(() => {
        const hasHomework = !!currentGradeHomework && assignedLessonsList.length > 0;
        return (
        <div
          data-testid="top-strip"
          className={`min-h-[34px] w-full px-2.5 sm:px-4 py-0.5 flex items-center justify-between gap-2 text-sm font-bold shrink-0 border-b select-none overflow-hidden ${
            hasHomework
              ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-white border-white/20'
              : 'bg-white/70 text-slate-700 border-sky-100'
          }`}
        >
          {hasHomework && currentGradeHomework ? (
          <>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 text-xs">🔔</span>
            <span className="shrink-0 text-sm">
              <strong>BÀI CÔ GIAO (LỚP {selectedGrade}):</strong>
            </span>
            {currentGradeHomework.teacherNote && (
              <span className="italic text-emerald-50 hidden md:inline truncate max-w-md text-sm">
                "{currentGradeHomework.teacherNote}"
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto shrink-0">
            {assignedLessonsList.map((item, idx) => {
              const isCurrent = activeLesson.id === item.id;
              return (
                <button
                  key={`banner-hw-${item.id}`}
                  type="button"
                  onClick={() => {
                    setCustomLesson(item);
                    handleRestart();
                  }}
                  className={`min-h-[28px] px-3 rounded-lg text-sm font-black transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-amber-300 text-slate-950 shadow-xs'
                      : 'bg-white/80 hover:bg-white text-emerald-950'
                  }`}
                  title={item.title}
                >
                  Bài {displayedLessonNumber(item) ?? idx + 1} {isCurrent && '⭐'}
                </button>
              );
            })}
          </div>
          </>
          ) : (
            <span className="min-w-0 truncate text-sm text-slate-600 font-semibold">
              👩‍🏫 Thầy cô muốn dùng vai trò Giáo viên (soạn bài, giao bài)? Bấm thông tin tác giả bên phải để liên hệ.
            </span>
          )}

          {/* THÔNG TIN TÁC GIẢ: ngay dưới nút Giáo viên, bấm mở trang tác giả (liên hệ, ủng hộ) */}
          <button
            type="button"
            data-testid="top-author-button"
            onClick={() => setIsAuthorDonateModalOpen(true)}
            className="ml-auto shrink-0 min-h-[30px] px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-200 to-orange-200 hover:from-amber-300 hover:to-orange-300 text-amber-950 border border-amber-400 shadow-2xs transition-colors whitespace-nowrap"
            title="Liên hệ tác giả Nguyễn Thanh Liêm (Zalo 0888358363) để được dùng vai trò Giáo viên • Ủng hộ tác giả"
          >
            <span className="font-black text-sm">👨‍🏫 Tác giả: Nguyễn Thanh Liêm</span>
            <span className="font-black text-sm hidden min-[1200px]:inline">• Zalo 0888358363</span>
            <span className="bg-amber-600 text-white text-xs font-black px-1.5 py-0.5 rounded-md">☕ Ủng hộ</span>
          </button>
        </div>
        );
      })()}

      {/* ======================================================== */}
      {/* 3. MAIN WORKSPACE: FIT-TO-SCREEN 1366x768 (NO SCROLLING) */}
      {/* ======================================================== */}
      <main className="flex-1 w-full px-2 sm:px-2.5 py-0.5 sm:py-1 min-h-0 overflow-hidden">
        <div className="h-full grid grid-cols-12 gap-1.5 sm:gap-2 items-stretch min-h-0 overflow-hidden">
          {/* ======================================================== */}
          {/* CỘT TRÁI (LEFT COLUMN): Ô LUYỆN GÕ & BÀN PHÍM 108 PHÍM   */}
          {/* ======================================================== */}
          <div
            className={`
              ${isRightColumnVisible ? 'col-span-12 lg:col-span-9 xl:col-span-8 2xl:col-span-8' : 'col-span-12'}
              relative h-full flex flex-col justify-between gap-1 min-w-0 min-h-0 overflow-hidden transition-all duration-300
            `}
          >
            {/* Màn chờ "BẮT ĐẦU GÕ" + đếm 3-2-1 (đồng hồ chỉ chạy sau khi đếm xong) */}
            {!isCompleted && typingPhase !== 'running' && (settings.startGateEnabled || typingPhase === 'countdown') && (
              <StartGate
                phase={typingPhase}
                count={countdown}
                lessonTitle={activeLesson.title}
                onStart={startTyping}
                onChooseLesson={() => setIsCurriculumModalOpen(true)}
                onOpenAuthor={() => setIsAuthorDonateModalOpen(true)}
              />
            )}
            {/* Màn TẠM DỪNG: đồng hồ đứng yên; gõ phím bất kì hoặc bấm Tiếp tục để gõ tiếp */}
            {isPaused && (
              <div
                className="absolute inset-0 z-[45] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px] rounded-2xl p-3"
                role="dialog"
                aria-modal="true"
                aria-label="Đang tạm dừng"
                data-testid="pause-overlay"
              >
                <div className="w-full max-w-md rounded-3xl border-2 border-sky-200 bg-white p-5 sm:p-6 text-center shadow-2xl">
                  <div className="text-4xl" aria-hidden="true">⏸</div>
                  <h2 className="mt-1 text-2xl font-black text-slate-900">Đang tạm dừng</h2>
                  <p className="mt-1 text-base font-bold text-slate-600">
                    Đồng hồ đã dừng ở <span className="tabular-nums text-sky-700">{formatClock(elapsedSec)}</span>.
                    <br />
                    Gõ phím bất kì hoặc bấm <b>Tiếp tục</b> để gõ tiếp.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={resumeTyping}
                      autoFocus
                      className="min-h-[48px] px-6 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white text-lg font-black shadow-md hover:brightness-110 active:scale-95 cursor-pointer"
                    >
                      ▶ Tiếp tục
                    </button>
                    <button
                      type="button"
                      onClick={handleFinishEarly}
                      className="min-h-[48px] px-5 rounded-full border-2 border-rose-300 bg-rose-50 text-rose-800 text-base font-black hover:bg-rose-100 active:scale-95 cursor-pointer"
                    >
                      🏁 Kết thúc bài, xem điểm
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* 1. Khu vực luyện gõ & ô nhập văn bản (PracticeArea) */}
            <section aria-label="Khu vực luyện gõ và ô nhập văn bản" className="shrink-0">
              <PracticeArea
                lesson={activeLesson}
                targetText={targetText}
                currentCharIndex={currentStep ? currentStep.charIndex : targetText.length}
                currentSubStepIndex={currentStep?.subStepIndex}
                currentSubStepTotal={currentStep?.subStepTotal}
                currentDisplayHint={currentStep?.displayHint}
                currentKeyChar={currentStep?.keyChar}
                targetKey={targetKeyConfig}
                activeFinger={activeFinger}
                stats={stats}
                scoreBoard={{
                  elapsedSec,
                  running: canControlTyping && !isPaused,
                  paused: isPaused,
                  // Kết thúc sớm: bảng điểm hiện đúng điểm đã chấm (nhân tỉ lệ phần đã gõ)
                  score: endedEarly && lastFinish ? lastFinish.score : liveScore,
                  doneWords: wordProgress.done,
                  totalWords: wordProgress.total,
                  accuracy: stats.accuracy,
                  wpm: liveWordsPerMin,
                  targetWpm: activeLesson.targetWpm,
                }}
                isCompleted={isCompleted}
                hasMistake={hasMistake}
                mistakeChar={mistakeChar}
                typingControl={
                  canControlTyping
                    ? { paused: isPaused, onPause: pauseTyping, onResume: resumeTyping, onFinish: handleFinishEarly }
                    : undefined
                }
                onRestart={handleRestart}
                onNextLesson={handleNextLesson}
                onPrevLesson={handlePrevLesson}
                hasPrevLesson={hasPrev}
                hasNextLesson={hasNext}
                onVoiceSpeak={handleVoiceSpeak}
                inputMode={inputMode}
                onManualInput={handleManualInput}
                onOpenCurriculumModal={() => {
                  setIsCurriculumModalOpen(true);
                }}

                hasTeacherAssignedHomework={!!currentGradeHomework}
                assignedHomeworkTitle={currentGradeHomework?.teacherNote}
                onOpenTeacherModal={() => setIsTeacherModalOpen(true)}
                onOpenVietnameseGuide={() => handleOpenTypingGuide('vietnamese_accent')}
                recentTypedKeys={recentTypedKeys}
                userTypedText={userTypedText}
                smartTelexFreeMode={smartTelexFreeMode}
                onToggleSmartTelexFreeMode={() => setSmartTelexFreeMode((prev) => !prev)}
                keyboardImeMode={keyboardImeMode}
                onToggleKeyboardImeMode={handleToggleKeyboardImeMode}
                alternativeAllowedKeys={smartTelexNextInfo?.nextAcceptableKeys}
                smartHintExplanation={smartTelexNextInfo?.hintExplanationVi}
                sgkBoxHeight={smartViewport.sgkBoxHeight}
                inputBoxHeight={smartViewport.inputBoxHeight}
                isCompactHeight={smartViewport.isCompactHeight}
                caseMistakeType={caseMistakeType}
                caseMistakeMessage={caseMistakeMessage}
                isTargetUpper={isTargetUpper}
                capsLockOn={capsLockOn}
                symbolGuideInfo={currentSymbolGuide}
                currentWordInfo={currentWordInfo}
                wordTypedKeys={wordTypedKeys}
                transformingWordEffect={transformingWordEffect}
              />
            </section>

            {/* 2. Bàn phím cơ học Full Size 104/108 phím chuẩn 1:1 */}
            {/* Màn dọc dưới 1024px: bàn phím nằm sát dưới vùng gõ (portrait:max-lg), phần còn lại dành cho thẻ SGK bên dưới */}
            <section aria-label="Bàn phím cơ học Full Size 104 phím chuẩn" className="flex-1 portrait:max-lg:flex-none min-h-0 flex flex-col justify-center overflow-hidden">
              <Keyboard
                targetKey={targetKeyConfig}
                activeFinger={activeFinger}
                pressedKeys={pressedKeys}
                wrongKeyCode={mistakeKeyCode}
                isShiftTarget={isShiftTarget}
                isBackspaceTarget={isBackspaceTarget}
                isEnterTarget={isEnterTarget}
                isCapsOffTarget={isCapsOffTarget}
                targetPressNumber={targetPressInfo.n}
                targetPressTotal={targetPressInfo.total}
                symbolGuideInfo={currentSymbolGuide}
                onKeyClick={handleKeyClick}
                handsOverlayEnabled={settings.handsOverlayEnabled}
                handsVisible={handsVisible}
                handsOpacity={settings.handsOpacity}
                handsStyle={settings.handsStyle}
                theme={currentKeyboardTheme}
                onOpenThemeModal={() => setIsThemeModalOpen(true)}
                isCompactHeight={smartViewport.isCompactHeight}
                maxUnitSize={smartViewport.keyboardMaxUnitSize}
                suggestedKeyHeight={smartViewport.keyboardKeyHeight}
                capsLockOn={capsLockOn}
                onToggleCapsLock={() => setCapsLockOn((prev) => !prev)}
                compactLayout={!!settings.realKeyboardCompact}
                onSetCompactLayout={setRealKeyboardCompact}
              />
            </section>

            {/* Máy tính bảng dọc: cột SGK bên phải bị ẩn, nên đưa thẻ ảnh + nội dung bài SGK xuống dưới bàn phím */}
            {isRightColumnVisible && (
              <section
                aria-label="Ảnh sách giáo khoa và nội dung bài gõ (màn dọc)"
                className="hidden portrait:max-lg:flex flex-1 min-h-[180px] overflow-hidden"
              >
                <div className="w-full h-full">
                  <TextbookIllustrationCard
                    lesson={activeLesson}
                    isCompactHeight={smartViewport.isCompactHeight}
                    onVoiceSpeak={handleVoiceSpeak}
                    onOpenTeacherModal={() => {
                      setEditingLessonForModal(activeLesson);
                      setIsTeacherModalOpen(true);
                    }}
                    onOpenCurriculumModal={() => setIsCurriculumModalOpen(true)}
                  />
                </div>
              </section>
            )}

            {/* 5. Mẹo nhỏ cho bé (Footer) - Tinh gọn 1 dòng */}
            <footer className="min-h-[26px] flex items-center justify-between gap-2 text-[13px] text-slate-700 bg-amber-50/90 py-0.5 px-2.5 rounded-lg border border-amber-200 shadow-2xs select-none shrink-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-amber-800 font-black shrink-0">💡 Mẹo nhỏ:</span>
                <span className="truncate">
                  Đặt 2 ngón trỏ lên phím có gờ <strong className="text-sky-700 font-black">F</strong> và{' '}
                  <strong className="text-sky-700 font-black">J</strong> để xuất phát chuẩn 10 ngón mà không cần nhìn phím!
                </span>
              </div>

            </footer>
          </div>

          {/* ======================================================== */}
          {/* CỘT PHẢI (RIGHT COLUMN): ẢNH SGK, BÀI CÔ GIAO & NỘI DUNG */}
          {/* ======================================================== */}
          {isRightColumnVisible && (
            <div className="hidden lg:flex lg:col-span-3 xl:col-span-4 2xl:col-span-4 h-full flex-col gap-1 min-w-0 min-h-0 overflow-hidden">
              {/* 1. KHUNG ẢNH SÁCH GIÁO KHOA & NỘI DUNG BÀI GÕ TRỌN VẸN (CHIẾM TRỌN CỘT PHẢI) */}
              <section aria-label="Ảnh sách giáo khoa và nội dung bài gõ" className="w-full flex-1 min-h-0 overflow-hidden">
                <TextbookIllustrationCard
                  lesson={activeLesson}
                  isCompactHeight={smartViewport.isCompactHeight}
                  onVoiceSpeak={handleVoiceSpeak}
                  onOpenTeacherModal={() => {
                    setEditingLessonForModal(activeLesson);
                    setIsTeacherModalOpen(true);
                  }}
                  onOpenCurriculumModal={() => setIsCurriculumModalOpen(true)}
                />
              </section>

              {/* Bài cô giao: đã hiện ở dải trên cùng. Tác giả: nút ở chân trang (tránh lặp thông tin) */}
            </div>
          )}
        </div>
      </main>


      {/* ======================================================== */}
      {/* GÓC BÊN PHẢI MÀN HÌNH: CHỌN BÀI ĐỂ GÕ & BÀI CÔ GIAO (SGK) */}
      {/* ======================================================== */}
      <TextbookImageViewer
        isDrawer={true}
        isOpen={isRightPanelOpen}
        onClose={() => setIsRightPanelOpen(false)}
        lesson={activeLesson}
        imageUrl={activeLesson.imageUrl}
        lessonTitle={activeLesson.title}
        teacherName={activeLesson.authorTeacher}
        teacherNote={activeLesson.teacherNote}
        gradeLevel={activeLesson.gradeLevel}
        onOpenTeacherUpload={() => setIsTeacherModalOpen(true)}
        isAssignedHomework={isCurrentAssignedHomework}
        activeTab={textbookTab}
        onTabChange={setTextbookTab}
        allLessons={studentVisibleLessons}
        onSelectLesson={(l) => {
          setCustomLesson(l);
          handleRestart();
        }}
        completedLessons={completedLessons}
        currentGradeHomework={currentGradeHomework}
        onSelectAssignedHomework={handleSelectAssignedHomework}
        onVoiceSpeak={handleVoiceSpeak}
        selectedGrade={selectedGrade}
        onSelectGrade={handleSelectGrade}
        onOpenCurriculumModal={() => setIsCurriculumModalOpen(true)}
      />

      {/* ======================================================== */}
      {/* THANH TRUY CẬP NHANH GÓC PHẢI MÀN HÌNH (KHI ẨN CỘT SGK)  */}
      {/* ======================================================== */}
      {!isRightColumnVisible && !isRightPanelOpen && (
        <aside
          aria-label="Thanh truy cập nhanh góc phải màn hình"
          className="fixed right-0 top-1/3 -translate-y-1/2 z-40 flex flex-col items-end gap-1.5 pr-0 pointer-events-auto shadow-2xl"
        >
          {/* Nút 1: Chọn bài để gõ (Góc Phải) */}
          <button
            type="button"
            onClick={() => {
              setTextbookTab('curriculum');
              setIsRightPanelOpen(true);
            }}
            className="flex items-center gap-1.5 py-2.5 px-3 rounded-l-2xl bg-gradient-to-l from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-black text-xs shadow-xl border-y border-l border-white/30 cursor-pointer hover:translate-x-0 translate-x-1.5 transition-all"
            title="Góc bên phải: Chọn bài để luyện gõ (SGK Lớp 3, 4, 5)"
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">📚 Chọn Bài</span>
          </button>

          {/* Nút 2: Luyện bài cô giao (Góc Phải) */}
          <button
            type="button"
            onClick={() => handleSelectAssignedHomework()}
            className={`flex items-center gap-1.5 py-2.5 px-3 rounded-l-2xl font-black text-xs shadow-xl border-y border-l border-white/30 cursor-pointer hover:translate-x-0 translate-x-1.5 transition-all ${
              isCurrentAssignedHomework
                ? 'bg-gradient-to-l from-amber-500 to-emerald-500 text-slate-950'
                : 'bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white'
            }`}
            title="Góc bên phải: Luyện đúng bài cô giao"
          >
            <UserCheck className="w-4 h-4" />
            <span className="hidden sm:inline">🎯 Bài Cô Giao</span>
            {currentGradeHomework && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300 ring-2 ring-white animate-ping" />
            )}
          </button>

          {/* Nút 3: Ảnh SGK (Góc Phải) */}
          <button
            type="button"
            onClick={() => {
              setTextbookTab('image');
              setIsRightPanelOpen(true);
            }}
            className="flex items-center gap-1.5 py-2 px-3 rounded-l-2xl bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-xl border-y border-l border-white/30 cursor-pointer hover:translate-x-0 translate-x-1.5 transition-all"
            title="Góc bên phải: Xem ảnh Sách Giáo Khoa (SGK)"
          >
            <ImageIcon className="w-4 h-4" />
            <span className="hidden sm:inline">📸 Ảnh SGK</span>
          </button>
        </aside>
      )}

      {/* ======================================================== */}
      {/* 5. MODALS                                                */}
      {/* ======================================================== */}
      {/* Teacher Portal Modal */}
      {isTeacherModalOpen && (
        <ErrorBoundary
          fallbackTitle="Đã ngăn chặn lỗi trắng màn hình khi mở Cổng Quản Trị Giáo Viên"
          onReset={() => setIsTeacherModalOpen(false)}
        >
          <TeacherLessonModal
            isOpen={isTeacherModalOpen}
            onClose={() => {
              setIsTeacherModalOpen(false);
              setEditingLessonForModal(null);
            }}
            onSaveLesson={handleSaveTeacherLesson}
            onRenumberLessons={handleRenumberLessons}
            allLessons={allAvailableLessons}
            teacherLessons={teacherLessons}
            onDeleteLesson={handleDeleteTeacherLesson}
            onBulkDeleteLessons={handleBulkDeleteLessons}
            onBulkUpdateLessons={handleBulkUpdateLessons}
            onResetSystemLesson={handleResetSystemLesson}
            onSelectLesson={(lesson) => setCustomLesson(lesson)}
            gradeAssignments={gradeAssignments}
            onAssignLessonToGrade={handleAssignLessonToGrade}
            onImportLessons={handleImportLessonsFromUSB}
            initialEditingLesson={editingLessonForModal}
            classroomSettings={{
              isTextbookVisible: isRightColumnVisible,
              onToggleTextbook: () => setIsRightColumnVisible((prev) => !prev),
              handsVisible,
              onToggleHands: toggleHandsVisible,
              startGateEnabled: !!settings.startGateEnabled,
              onToggleStartGate: toggleStartGate,
              soundType: settings.soundType,
              onSetSoundType: (t) => setSettings((st) => ({ ...st, soundType: t })),
              // Các hộp dưới đây nằm ngoài Cổng: đóng Cổng trước để hộp hiện lên trên cùng
              onOpenCustomText: () => {
                setIsTeacherModalOpen(false);
                setIsCustomTextModalOpen(true);
              },
              onOpenAutoFit: () => {
                setIsTeacherModalOpen(false);
                openAiModal();
              },
              onOpenUnikeyNotice: () => {
                setIsTeacherModalOpen(false);
                setIsUnikeyNoticeOpen(true);
              },
            }}
          />
        </ErrorBoundary>
      )}

      {/* BẢNG THÔNG BÁO TỚI BẠN NHỎ: TẮT UNIKEY ĐỂ CÓ TRẢI NGHIỆM TỐT NHẤT */}
      <UnikeyNoticeModal
        isOpen={isUnikeyNoticeOpen}
        onClose={handleCloseUnikeyNotice}
        onOpenAuthor={() => setIsAuthorDonateModalOpen(true)}
      />

      {/* MENU CHỌN KHỐI LỚP DẠNG NỔI 3D (LỚP 3, LỚP 4, LỚP 5) */}
      <GradeSelectionModal
        isOpen={isGradeSelectModalOpen}
        onClose={() => setIsGradeSelectModalOpen(false)}
        onSelectGrade={handleSelectGrade}
        currentGrade={selectedGrade}
        gradeAssignments={gradeAssignments}
        onOpenTypingGuide={() => handleOpenTypingGuide('keyboard_map')}
        onOpenAuthor={() => setIsAuthorDonateModalOpen(true)}
      />

      {/* THÔNG TIN TÁC GIẢ & DONATE CÀ PHÊ: Nguyễn Thanh Liêm - Tiểu học số 1 Tân Uyên */}
      <AuthorDonateModal
        isOpen={isAuthorDonateModalOpen}
        onClose={() => setIsAuthorDonateModalOpen(false)}
      />

      {/* SỔ TAY HƯỚNG DẪN GÕ 10 NGÓN TRỰC QUAN (3 Phần: Đặt tay đúng, Gõ dấu Tiếng Việt, Phím số & Ký tự Shift) */}
      <TypingGuideModal
        isOpen={isTypingGuideOpen || isVietnameseGuideOpen || isPostureModalOpen}
        onClose={() => {
          setIsTypingGuideOpen(false);
          setIsVietnameseGuideOpen(false);
          setIsPostureModalOpen(false);
        }}
        activeMode={inputMode}
        onSelectMode={(m) => setInputMode(m)}
        initialTab={typingGuideTab}
      />

      {/* Vietnamese Rules Guide Modal (Legacy fallback) */}
      <VietnameseGuideModal
        isOpen={false}
        onClose={() => setIsVietnameseGuideOpen(false)}
        activeMode={inputMode}
        onSelectMode={(m) => setInputMode(m)}
      />

      {/* Posture Guide Modal (Legacy fallback) */}
      <PostureGuideModal
        isOpen={false}
        onClose={() => setIsPostureModalOpen(false)}
      />

      {/* Numpad Ten-Key Typing Guide Modal */}
      <NumpadGuideModal
        isOpen={isNumpadModalOpen}
        onClose={() => setIsNumpadModalOpen(false)}
        onSelectLesson={(lesson) => {
          setCustomLesson(lesson);
          if (lesson.gradeLevel) setSelectedGrade(lesson.gradeLevel);
          setIsNumpadModalOpen(false);
        }}
      />

      {/* 5 Typing Games Hub (Chú khỉ leo núi, Bóng bay, Khu vườn âm nhạc, Kho báu, Giao hàng) */}
      {isGameModalOpen && (
        <MultiGameHub
          soundEnabled={settings.soundEnabled}
          onClose={() => setIsGameModalOpen(false)}
        />
      )}

      {/* Curriculum Modal by Grade */}
      <CurriculumModal
        isOpen={isCurriculumModalOpen}
        onClose={() => setIsCurriculumModalOpen(false)}
        currentLessonId={activeLesson.id}
        onSelectLesson={(lesson) => {
          setCustomLesson(lesson);
          if (lesson.gradeLevel) setSelectedGrade(lesson.gradeLevel);
          handleRestart();
        }}
        completedLessons={completedLessons}
        allLessons={allAvailableLessons}
        teacherLessons={teacherLessons}
        onOpenTeacherModal={() => setIsTeacherModalOpen(true)}
        initialGradeFilter={selectedGrade}
        teacherCode={studentTeacherCode}
        onTeacherCodeChange={setStudentTeacherCode}
      />

      {/* Custom Text Practice Modal */}
      <CustomTextModal
        isOpen={isCustomTextModalOpen}
        onClose={() => setIsCustomTextModalOpen(false)}
        onApplyCustomText={(text, title) => {
          setCustomLesson({
            id: 'custom-' + Date.now(),
            level: 99,
            category: 'short_sentences',
            categoryTitleVi: 'Tự chọn',
            title: title,
            subtitle: 'Bài do thầy cô hoặc học sinh tự nhập',
            descriptionVi: 'Luyện tập nội dung tự chọn theo yêu cầu riêng.',
            focusKeys: Array.from(new Set(text.toLowerCase().split(''))).filter((c) => c !== ' ' && c !== '\n').slice(0, 10),
            text: text,
            targetWpm: 20,
            targetAccuracy: 90,
            badgeName: 'Nhà Thám Hiểm Tự Do',
            gradeLevel: selectedGrade,
          });
        }}
      />

      {/* 8 Keyboards Theme Modal */}
      <KeyboardThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        // Đang bật bàn tay hướng dẫn thì đánh dấu mẫu "có hướng dẫn tay gõ" là mẫu đang dùng
        currentThemeId={
          settings.handsOverlayEnabled
            ? KEYBOARD_THEMES.find((t) => t.isHandsGuideTheme)?.id ?? currentKeyboardTheme.id
            : currentKeyboardTheme.id
        }
        onSelectTheme={handleSelectTheme}
        handsVisible={handsVisible}
        onToggleHands={toggleHandsVisible}
        isGuideLayout={settings.handsOverlayEnabled}
        startGateEnabled={!!settings.startGateEnabled}
        onToggleStartGate={toggleStartGate}
      />

      {/* AI Smart Auto-Fit Viewport Details Modal */}
      <SmartViewportModal
        isOpen={isAiModalOpen}
        onClose={closeAiModal}
        metrics={smartViewport}
        onRefresh={refreshViewport}
        onToggleFullscreen={handleToggleFullscreenFit}
        isFullscreen={isFullscreenAdaptive}
      />

      {/* MÀN HÌNH TỔNG KẾT & KHEN THƯỞNG KHI HOÀN THÀNH BÀI GÕ (Điểm số, Kỹ năng, Hoa rơi & Tiếng vỗ tay) */}
      <CompletionModal
        isOpen={isCompleted && !resultHidden}
        onClose={() => setResultHidden(true)}
        lesson={activeLesson}
        stats={stats}
        result={{
          elapsedSec: lastFinish?.elapsedSec ?? elapsedSec,
          score: lastFinish?.score ?? liveScore,
          wordsPerMin: Math.round(
            ((endedEarly ? wordProgress.done : wordProgress.total) * 60) / Math.max(1, lastFinish?.elapsedSec ?? elapsedSec)
          ),
          totalWords: wordProgress.total,
          doneWords: endedEarly ? wordProgress.done : wordProgress.total,
          endedEarly,
          prevBestSec: lastFinish?.prevBestSec,
          bestScore: completedLessons[activeLesson.id]?.bestScore,
        }}
        onRestart={handleRestart}
        onNextLesson={handleNextLesson}
        hasNextLesson={hasNext}
        onOpenCurriculumModal={() => {
          setIsCurriculumModalOpen(true);
        }}
      />
    </div>
  );
}
