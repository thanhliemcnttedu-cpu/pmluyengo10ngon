import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  stripLessonNumber,
  isNumpadLesson,
  displayedLessonNumber,
  nextLessonNumber,
  lessonOwnerKey,
  isSystemLesson,
  teacherDirectory,
  lessonGroupRank,
} from '../utils/lessonNumbering';
import { lessonGroupOf, LESSON_GROUP_LABEL, GROUP_TONE, type LessonGroup } from '../utils/lessonGroups';
import {
  loginTeacher,
  logoutTeacher,
  loadTeacherSession,
  checkCloudSession,
  SESSION_EXPIRED_NOTICE,
  type TeacherSession,
} from '../lib/adminAuth';
import { TeacherAccountsPanel } from './TeacherAccountsPanel';
import { ChangeOwnPasswordPanel } from './ChangeOwnPasswordPanel';
import { AdminPasswordRecovery } from './AdminPasswordRecovery';
import {
  X,
  Upload,
  Plus,
  BookOpen,
  Image as ImageIcon,
  Trash2,
  CheckCircle2,
  UserCheck,
  Send,
  Save,
  Sparkles,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Edit3,
  Search,
  Check,
  AlertCircle,
  RotateCcw,
  Feather,
  SlidersHorizontal,
  Layers,
  ArrowDownAZ,
  GraduationCap,
  ScrollText,
  Globe,
  Unlock,
  Lock,
  BookmarkCheck,
  ShieldCheck,
  Download,
  HardDrive,
  KeyRound,
} from 'lucide-react';
import { Lesson, GradeAssignment } from '../types/typing';
import { compressImageFile } from '../utils/imageUtils';
import {
  uploadImageToSupabaseStorage,
  bulkUpsertLessonsToSupabase,
  fetchTeacherAssignments,
  fetchAllTeacherAssignments,
  saveTeacherAssignment,
  type TeacherGradeAssignment,
} from '../lib/supabase';
import { LESSONS } from '../data/lessons';
import { analyzeTextbookImageInBrowser, OcrError } from '../lib/geminiOcr';

// Callback có thể trả false (hoặc Promise<false>) để báo lưu thất bại; void vẫn hợp lệ cho App cũ
type MaybeResult = void | boolean | Promise<void | boolean>;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Tên giáo viên điền sẵn ở ô "Tên Thầy / Cô" (theo yêu cầu tác giả)
const DEFAULT_TEACHER_NAME = 'Thầy Liêm';
const GEMINI_KEY_STORAGE = 'typing_kids_gemini_key';
const GEMINI_KEY_PAGE = 'https://aistudio.google.com/apikey';
// Khoá Gemini có 2 dạng: cũ "AIza…" (~39 ký tự) và mới "AQ.…" (có dấu chấm, dài hơn).
// Chỉ kiểm tra thô để bắt lỗi dán thiếu/thừa hoặc dính dấu cách
const looksLikeGeminiKey = (k: string) => /^[A-Za-z0-9._-]{30,200}$/.test(k.trim());

// Chuẩn hoá 1 bài nhập từ USB: thiếu id/text thì bỏ, thiếu trường phụ thì điền mặc định
const normalizeImportedLesson = (raw: unknown): Lesson | null => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, any>;
  if (typeof r.id !== 'string' || !r.id.trim() || typeof r.text !== 'string' || !r.text.trim()) return null;
  const grade = [3, 4, 5].includes(Number(r.gradeLevel)) ? Number(r.gradeLevel) : undefined;
  const validCategories: Lesson['category'][] = [
    'home_row', 'top_row', 'bottom_row', 'number_row', 'numpad_tenkey',
    'animals', 'events_school', 'short_sentences', 'poems_stories',
  ];
  return {
    ...(r as Lesson),
    id: r.id.trim(),
    text: r.text,
    title: typeof r.title === 'string' && r.title.trim() ? r.title : 'Bài học chưa đặt tên',
    subtitle: typeof r.subtitle === 'string' ? r.subtitle : '',
    descriptionVi: typeof r.descriptionVi === 'string' ? r.descriptionVi : '',
    categoryTitleVi: typeof r.categoryTitleVi === 'string' && r.categoryTitleVi ? r.categoryTitleVi : 'Luyện gõ',
    category: validCategories.includes(r.category) ? r.category : 'short_sentences',
    level: Number.isFinite(Number(r.level)) && Number(r.level) > 0 ? Number(r.level) : 1,
    targetWpm: Number.isFinite(Number(r.targetWpm)) && Number(r.targetWpm) > 0 ? Number(r.targetWpm) : 18,
    targetAccuracy:
      Number.isFinite(Number(r.targetAccuracy)) && Number(r.targetAccuracy) > 0 && Number(r.targetAccuracy) <= 100
        ? Number(r.targetAccuracy)
        : 90,
    focusKeys: Array.isArray(r.focusKeys) ? r.focusKeys.filter((k: unknown) => typeof k === 'string') : [],
    badgeName: typeof r.badgeName === 'string' && r.badgeName ? r.badgeName : 'Học Trò Xuất Sắc',
    gradeLevel: grade,
  };
};

// Chuẩn hoá giao bài nhập từ USB: chỉ giữ khối 3/4/5 có danh sách id dạng chuỗi
const normalizeImportedAssignments = (raw: unknown): Record<number, GradeAssignment> | undefined => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<number, GradeAssignment> = {};
  Object.entries(raw as Record<string, any>).forEach(([k, g]) => {
    const grade = Number(k);
    if (![3, 4, 5].includes(grade) || !g || typeof g !== 'object') return;
    const ids: string[] = Array.isArray(g.lessonIds)
      ? g.lessonIds.filter((x: unknown): x is string => typeof x === 'string' && !!x)
      : typeof g.lessonId === 'string' && g.lessonId
      ? [g.lessonId]
      : [];
    if (ids.length === 0) return;
    out[grade] = {
      gradeLevel: grade,
      lessonId: ids[0],
      lessonIds: ids,
      assignedAt: typeof g.assignedAt === 'string' ? g.assignedAt : new Date().toISOString(),
      teacherName: typeof g.teacherName === 'string' ? g.teacherName : 'Giáo viên',
      teacherNote: typeof g.teacherNote === 'string' ? g.teacherNote : undefined,
    };
  });
  return Object.keys(out).length > 0 ? out : undefined;
};

// Phiên đăng nhập giáo viên. Đổi tên khoá (v2) để các máy đã đăng nhập bằng tài khoản/mật khẩu cũ phải đăng nhập lại.
export const TEACHER_AUTH_KEY = 'typing_kids_teacher_auth_v2';

interface TeacherLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveLesson: (updatedLesson: Lesson) => MaybeResult;
  allLessons?: Lesson[];
  teacherLessons?: Lesson[];
  /** Trả false (hoặc Promise<false>) khi máy chủ từ chối quyền xoá */
  onDeleteLesson: (id: string) => void | boolean | Promise<boolean | void>;
  onResetSystemLesson?: (id: string) => void;
  onSelectLesson: (lesson: Lesson) => void;
  gradeAssignments?: Record<number, GradeAssignment>;
  onAssignLessonToGrade: (
    grade: number,
    lessonIds: string[],
    teacherName: string,
    teacherNote: string
  ) => MaybeResult;
  onImportLessons?: (
    importedLessons: Lesson[],
    importedAssignments?: Record<number, GradeAssignment>
  ) => void;
  initialEditingLesson?: Lesson | null;
  /** Admin: ghi số thứ tự bài đang hiển thị lên máy chủ */
  onRenumberLessons?: () => Promise<{ changed: number; ok: boolean }>;
  /** Xoá nhiều bài một lần; trả số bài đã xoá và số bài máy chủ từ chối */
  onBulkDeleteLessons?: (ids: string[]) => Promise<{ deleted: number; denied: number }>;
  /** Gán thứ tự: đưa bài thành "Bài N" trong bộ bài của nó */
  onReorderLesson?: (id: string, newPos: number) => Promise<{ ok: boolean; from: number; to: number } | null>;
  /** Chuyển nhiều bài sang lớp khác / nhóm khác */
  onBulkUpdateLessons?: (
    ids: string[],
    change: { gradeLevel?: number; group?: 'exercise' | 'poem' | 'prose' }
  ) => Promise<{ changed: number; ok: boolean }>;
  /** Cài đặt lớp học (trước đây ở menu thả xuống của nút Giáo viên) */
  classroomSettings?: {
    isTextbookVisible: boolean;
    onToggleTextbook: () => void;
    handsVisible: boolean;
    onToggleHands: () => void;
    startGateEnabled?: boolean;
    onToggleStartGate?: () => void;
    soundType: 'mechanical' | 'bubble' | string;
    onSetSoundType: (t: 'mechanical' | 'bubble') => void;
    onOpenCustomText: () => void;
    onOpenAutoFit: () => void;
    onOpenUnikeyNotice: () => void;
  };
}

// Giữ Cổng Giáo Viên khi tải lại trang (sessionStorage: riêng từng thẻ trình duyệt)
export const TEACHER_PORTAL_OPEN_KEY = 'typing_kids_teacher_portal_open_v1';
const TEACHER_PORTAL_TAB_KEY = 'typing_kids_teacher_portal_tab_v1';
const PORTAL_TABS = ['manage', 'editor', 'assign', 'backup', 'settings', 'accounts', 'password'] as const;
type PortalTab = (typeof PORTAL_TABS)[number];

export const TeacherLessonModal: React.FC<TeacherLessonModalProps> = ({
  isOpen,
  onClose,
  onSaveLesson,
  allLessons = [],
  teacherLessons = [],
  onDeleteLesson,
  onResetSystemLesson,
  onRenumberLessons,
  onBulkDeleteLessons,
  onBulkUpdateLessons,
  onReorderLesson,
  onSelectLesson,
  gradeAssignments = {},
  onAssignLessonToGrade,
  onImportLessons,
  initialEditingLesson,
  classroomSettings,
}) => {
  // Phiên đăng nhập (admin hoặc giáo viên phụ, kèm mã GV). Học sinh chưa đăng nhập: null
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(() => loadTeacherSession());
  const isAuthenticated = !!teacherSession;
  const isAdminRole = teacherSession?.role === 'admin';
  // Tên đứng bài mặc định: giáo viên phụ dùng họ tên của mình
  const defaultAuthorName = teacherSession?.role === 'teacher' ? teacherSession.displayName : DEFAULT_TEACHER_NAME;
  /** Được sửa/xoá bài này không: admin mọi bài; giáo viên phụ chỉ bài do chính mình tạo */
  const canModifyLesson = (l: Lesson | null | undefined) =>
    !!l && (isAdminRole || (!!teacherSession?.userId && l.ownerId === teacherSession.userId));
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [authNotice, setAuthNotice] = useState<string>('');
  const [showRecovery, setShowRecovery] = useState<boolean>(false);

  // Thông tin bài vừa được lưu thành công trên máy chủ
  const [lastSavedLesson, setLastSavedLesson] = useState<Lesson | null>(null);

  // Mục đang mở ở menu trái:
  // - 'manage': Danh sách bài học (lọc theo lớp / đang giao / thơ & văn SGK)
  // - 'editor': Soạn bài & phân tích ảnh SGK bằng AI
  // - 'assign': Giao 1 hoặc nhiều bài cho khối lớp
  // - 'backup': Sao lưu USB & đồng bộ Supabase
  const [activeTab, setActiveTab] = useState<PortalTab>(() => {
    try {
      const t = sessionStorage.getItem(TEACHER_PORTAL_TAB_KEY) as PortalTab | null;
      return t && PORTAL_TABS.includes(t) ? t : 'manage';
    } catch {
      return 'manage';
    }
  });
  // Nhớ mục đang xem để tải lại trang vẫn ở đúng mục
  useEffect(() => {
    try {
      sessionStorage.setItem(TEACHER_PORTAL_TAB_KEY, activeTab);
    } catch {
      /* bỏ qua */
    }
  }, [activeTab]);
  // Dòng bài học đang mở phần xem trước
  const [previewLessonId, setPreviewLessonId] = useState<string | null>(null);
  // Máy chủ đã có sẵn khoá Gemini trong .env chưa (null = đang hỏi)
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  // Có máy chủ đi kèm (/api) hay không. Bản web Vercel và bản cài đặt .exe KHÔNG có -> gọi thẳng Gemini từ trình duyệt
  const [aiServer, setAiServer] = useState<boolean | null>(null);
  // Khoá Gemini giáo viên tự nhập (khi máy chủ chưa có). Chỉ lưu trên máy này nếu cô chọn "Nhớ khoá"
  const [geminiKey, setGeminiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [showKeyDialog, setShowKeyDialog] = useState<boolean>(false);
  const [keyDraft, setKeyDraft] = useState<string>('');
  const [rememberKey, setRememberKey] = useState<boolean>(true);
  const [keyDialogError, setKeyDialogError] = useState<string>('');
  const [pasteHint, setPasteHint] = useState<string>('');
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Bộ lọc & sắp xếp phân cấp ở tab 'manage'
  // Lọc kết hợp: "Đang giao" (gradeFilter) + Lớp (subGrade) + Nhóm (groupFilter), chọn cùng lúc được
  const [gradeFilter, setGradeFilter] = useState<'all' | 'assigned'>('all');
  const [groupFilter, setGroupFilter] = useState<'all' | LessonGroup>('all');
  // Ô gán thứ tự đang mở cho bài nào (id) và số đang gõ
  const [reorderId, setReorderId] = useState<string | null>(null);
  const [reorderValue, setReorderValue] = useState('');
  const [reorderBusy, setReorderBusy] = useState(false);
  // Lọc thêm theo lớp khi đang xem Tất cả / Đang giao / Thơ & Văn SGK
  const [subGrade, setSubGrade] = useState<'all' | 3 | 4 | 5>('all');
  // Nguồn bài: admin 'all' | 'system' | 'teachers' | 'GV001'…; giáo viên phụ 'mine' | 'system'
  const [lessonSource, setLessonSource] = useState<string>('all');
  // Xem dần từng 20 bài cho nhẹ khi có hàng trăm bài (30 giáo viên × 20 bài)
  const [visibleLimit, setVisibleLimit] = useState(20);
  // Tích chọn nhiều bài để xoá / chuyển lớp / chuyển nhóm
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkGrade, setBulkGrade] = useState<'' | '3' | '4' | '5'>('');
  const [bulkGroup, setBulkGroup] = useState<'' | 'exercise' | 'poem' | 'prose'>('');
  const subGradeApplies = true;
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [sortBy, setSortBy] = useState<'hierarchy' | 'assigned_first' | 'poems_first' | 'title_az' | 'wpm_asc'>('hierarchy');

  // Editor states
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [renumberBusy, setRenumberBusy] = useState(false);
  const [gradeLevel, setGradeLevel] = useState<number>(3);
  const [teacherName, setTeacherName] = useState(DEFAULT_TEACHER_NAME);
  const [text, setText] = useState('');
  const [teacherNote, setTeacherNote] = useState('Các con nhớ giữ phím Shift để viết hoa đầu câu và gõ đúng dấu nhé!');
  const [imageUrl, setImageUrl] = useState('');
  const [targetWpm, setTargetWpm] = useState<number>(18);
  const [isPoemOrStory, setIsPoemOrStory] = useState<boolean>(false);
  const [genre, setGenre] = useState<'poem' | 'prose' | 'exercise'>('exercise');
  const [isFreePractice, setIsFreePractice] = useState<boolean>(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const [isSyncingAllToSupabase, setIsSyncingAllToSupabase] = useState<boolean>(false);
  const [syncAllMsg, setSyncAllMsg] = useState<string>('');

  // AI OCR Analysis states
  const [isAnalyzingImage, setIsAnalyzingImage] = useState<boolean>(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string>('');
  const [ocrErrorMsg, setOcrErrorMsg] = useState<string>('');

  // Floating Toast Notification states cho nút "Lưu Lại Trực Tuyến & Cập Nhật Hệ Thống"
  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
  const [isToastFading, setIsToastFading] = useState<boolean>(false);
  const [isSavingLesson, setIsSavingLesson] = useState<boolean>(false);
  // Khác rỗng = toast hiển thị lỗi thay vì báo thành công
  const [saveToastError, setSaveToastError] = useState<string>('');
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const toastFadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerSaveToast = (errorMsg = '') => {
    setSaveToastError(errorMsg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastFadeTimerRef.current) clearTimeout(toastFadeTimerRef.current);

    setIsToastFading(false);
    setShowSaveToast(true);

    // Sau 2.5 giây bắt đầu hiệu ứng fade-out nhẹ, đúng 3 giây (3000ms) thì biến mất hoàn toàn
    toastFadeTimerRef.current = setTimeout(() => {
      setIsToastFading(true);
    }, 2500);

    toastTimerRef.current = setTimeout(() => {
      setShowSaveToast(false);
      setIsToastFading(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastFadeTimerRef.current) clearTimeout(toastFadeTimerRef.current);
    };
  }, []);

  // Safe assignments dictionary
  const safeAssignments: Record<number, GradeAssignment> = useMemo(() => {
    return gradeAssignments && typeof gradeAssignments === 'object' ? gradeAssignments : {};
  }, [gradeAssignments]);

  // Assignment states
  const [selectedGradeForAssign, setSelectedGradeForAssign] = useState<number>(3);
  const [selectedLessonIdsForAssign, setSelectedLessonIdsForAssign] = useState<string[]>(() => {
    const existing = safeAssignments[3];
    if (existing) {
      if (Array.isArray(existing.lessonIds) && existing.lessonIds.length > 0) {
        return existing.lessonIds.filter(Boolean);
      }
      if (existing.lessonId) {
        return [existing.lessonId];
      }
    }
    return ['lesson-3-3'];
  });
  const [assignSearchKeyword, setAssignSearchKeyword] = useState<string>('');
  const [assignGradeFilter, setAssignGradeFilter] = useState<number | 'all'>(3);
  // Giao bài: lọc theo nguồn bài (hệ thống / giáo viên) và mục (thơ – văn SGK / luyện phím)
  const [assignSource, setAssignSource] = useState<string>('all');
  const [assignCategory, setAssignCategory] = useState<'all' | LessonGroup>('all');
  // (Quản trị) bài đang được các thầy cô giao theo mã: id bài -> ["GV002 · lớp 3", …]
  const [allCodeAssignments, setAllCodeAssignments] = useState<TeacherGradeAssignment[]>([]);
  const [assignLimit, setAssignLimit] = useState(30);
  // Bài giao của chính giáo viên phụ (theo mã GV…), tách khỏi bài giao của quản trị
  const [myAssignments, setMyAssignments] = useState<Record<number, TeacherGradeAssignment>>({});
  const [assignNote, setAssignNote] = useState<string>('Các con hoàn thành các bài tập này trước tiết học Tin học tiếp theo nhé!');
  const [assignmentSuccessMsg, setAssignmentSuccessMsg] = useState<string>('');

  // Sanitize effective lessons to guarantee valid array of objects
  const effectiveLessons: Lesson[] = useMemo(() => {
    const rawList = Array.isArray(allLessons) && allLessons.length > 0
      ? allLessons
      : Array.isArray(teacherLessons) && teacherLessons.length > 0
      ? teacherLessons
      : LESSONS;

    return rawList
      .filter((l): l is Lesson => !!l && typeof l === 'object' && typeof l.id === 'string' && l.id.length > 0)
      .map((l) => ({
        ...l,
        title: l.title || 'Bài học chưa đặt tên',
        text: l.text || '',
        gradeLevel: l.gradeLevel || 3,
        level: l.level || 1,
        targetWpm: l.targetWpm || 18,
        category: l.category || 'short_sentences',
        categoryTitleVi: l.categoryTitleVi || 'Luyện gõ',
        subtitle: l.subtitle || '',
        descriptionVi: l.descriptionVi || '',
        focusKeys: Array.isArray(l.focusKeys) ? l.focusKeys : [],
        isFreePractice: l.isFreePractice ?? true,
      }));
  }, [allLessons, teacherLessons]);

  // Số "Bài N" sẽ hiện cho bài đang soạn: sửa bài trong cùng khối giữ số cũ, bài mới / đổi khối = số bài trong khối + 1
  const lessonNumberPreview = useMemo(() => {
    const orig = editingLessonId ? effectiveLessons.find((l) => l.id === editingLessonId) : undefined;
    // Bộ bài: sửa bài thì theo người tạo bài đó; bài mới thì theo tài khoản đang soạn
    const owner = orig ? lessonOwnerKey(orig) : teacherSession?.role === 'teacher' ? teacherSession.code : 'ADMIN';
    // Số bài đánh riêng theo nhóm: nhóm của bài đang soạn
    const grp = isPoemOrStory ? (genre === 'prose' ? 'prose' : 'poem') : 'exercise';
    if (orig && orig.gradeLevel === gradeLevel && lessonGroupOf(orig) === grp) {
      return displayedLessonNumber(orig) ?? nextLessonNumber(effectiveLessons, gradeLevel, editingLessonId, owner, grp);
    }
    return nextLessonNumber(effectiveLessons, gradeLevel, editingLessonId, owner, grp);
  }, [effectiveLessons, editingLessonId, gradeLevel, isPoemOrStory, genre, teacherSession?.role, teacherSession?.code]);

  // Lấy danh sách ID của tất cả bài đang được giao bài cho bất kỳ lớp nào (Safely)
  const allAssignedLessonIds = useMemo(() => {
    const ids = new Set<string>();
    try {
      Object.values(safeAssignments).forEach((g) => {
        if (!g) return;
        if (Array.isArray(g.lessonIds) && g.lessonIds.length > 0) {
          g.lessonIds.forEach((id) => {
            if (id && typeof id === 'string') ids.add(id);
          });
        } else if (g.lessonId && typeof g.lessonId === 'string') {
          ids.add(g.lessonId);
        }
      });
    } catch (e) {
      console.warn('Lỗi đọc assignments IDs:', e);
    }
    return ids;
  }, [safeAssignments]);

  // Kiểm tra bài học được giao cho khối lớp nào
  const getAssignedGradesForLesson = (lessonId: string): number[] => {
    const grades: number[] = [];
    try {
      Object.entries(safeAssignments).forEach(([gradeStr, g]) => {
        if (!g) return;
        const gNum = Number(gradeStr);
        const hasId = (Array.isArray(g.lessonIds) && g.lessonIds.includes(lessonId)) || g.lessonId === lessonId;
        if (hasId) {
          grades.push(gNum);
        }
      });
    } catch {
      // Ignore
    }
    return grades;
  };

  // Load lesson data into editor form
  const loadLessonIntoEditor = (lesson: Lesson | null | undefined) => {
    if (!lesson) return;
    setEditingLessonId(lesson.id || null);
    // Ô tên chỉ chứa tên bài; số "Bài N" do hệ thống tự đánh
    setTitle(isNumpadLesson(lesson) ? lesson.title || '' : stripLessonNumber(lesson.title || ''));
    setGradeLevel(lesson.gradeLevel || 3);
    // Luôn điền tên mặc định: người đang sửa bài là giáo viên đứng tên
    setTeacherName(defaultAuthorName);
    setText(lesson.text || '');
    setTeacherNote(lesson.teacherNote || lesson.descriptionVi || '');
    setImageUrl(lesson.imageUrl || '');
    setTargetWpm(lesson.targetWpm || 18);
    setIsPoemOrStory(!!lesson.isPoemOrStory || lesson.category === 'poems_stories');
    setGenre(lesson.genre || (lesson.category === 'poems_stories' ? 'poem' : 'exercise'));
    setIsFreePractice(lesson.isFreePractice ?? true);
    setSaveSuccessMsg('');
    setOcrSuccessMsg('');
    setOcrErrorMsg('');
  };

  // Load initial editing lesson if provided
  useEffect(() => {
    if (initialEditingLesson && isOpen) {
      loadLessonIntoEditor(initialEditingLesson);
      setActiveTab('editor');
    }
  }, [initialEditingLesson, isOpen]);

  // Hỏi trước máy chủ có khoá Gemini chưa để báo ngay, không bắt cô chờ bấm rồi mới thấy lỗi
  useEffect(() => {
    if (!isOpen || activeTab !== 'editor' || aiReady !== null) return;
    let alive = true;
    fetch('/api/ai-status')
      .then(async (r) => {
        // Trang web tĩnh (Vercel) trả về index.html cho mọi đường dẫn -> không phải JSON = không có máy chủ
        const isJson = (r.headers.get('content-type') || '').includes('application/json');
        return r.ok && isJson ? r.json() : null;
      })
      .then((d) => {
        if (!alive) return;
        setAiServer(!!d);
        setAiReady(d ? !!d.ocrReady : false);
      })
      .catch(() => {
        if (!alive) return;
        setAiServer(false);
        setAiReady(false);
      });
    return () => {
      alive = false;
    };
  }, [isOpen, activeTab, aiReady]);

  // Đăng nhập quản trị: DUY NHẤT tài khoản "admin". Mật khẩu kiểm tra trên Supabase (đổi được qua OTP Gmail);
  // mất mạng thì so với lần đăng nhập đúng gần nhất trên máy (xem src/lib/adminAuth.ts).
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError('');
    const result = await loginTeacher(username, password);
    setAuthBusy(false);

    if (result.ok) {
      setTeacherSession(result.session);
      setAuthError('');
      setAuthNotice('');
      setPassword('');
      // Đang soạn dở (vd vừa bị hết phiên khi bấm lưu) thì quay lại ô soạn bài để lưu tiếp
      setActiveTab(text.trim() ? 'editor' : 'manage');
      if (result.session.role === 'teacher') setTeacherName(result.session.displayName);
    } else {
      setAuthError(result.error);
    }
  };

  const handleLogout = () => {
    setTeacherSession(null);
    setActiveTab('manage');
    setUsername('');
    logoutTeacher();
  };

  // Phiên đăng nhập trên máy chủ đã hết (vd mật khẩu vừa đổi): đăng xuất và nhắc đăng nhập lại.
  // Giữ nguyên bài đang soạn và điền sẵn tên đăng nhập.
  const expireSession = () => {
    const name = teacherSession?.username || '';
    setTeacherSession(null);
    logoutTeacher();
    setUsername(name);
    setPassword('');
    setAuthNotice(SESSION_EXPIRED_NOTICE);
  };

  // Quản trị: nạp bài giao theo mã của mọi thầy cô để cột Trạng thái cho biết bài nào đang được giao
  useEffect(() => {
    if (!isOpen || teacherSession?.role !== 'admin') {
      setAllCodeAssignments([]);
      return;
    }
    let alive = true;
    fetchAllTeacherAssignments().then((a) => {
      if (alive) setAllCodeAssignments(a);
    });
    return () => {
      alive = false;
    };
  }, [isOpen, teacherSession?.role]);

  // Giáo viên phụ: nạp bài giao theo mã của mình rồi đưa vào màn Giao bài
  useEffect(() => {
    if (!isOpen || teacherSession?.role !== 'teacher') {
      setMyAssignments({});
      return;
    }
    let alive = true;
    fetchTeacherAssignments(teacherSession.code).then((a) => {
      if (!alive) return;
      setMyAssignments(a);
      handleSelectGradeForAssign(selectedGradeForAssign, a);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teacherSession?.role, teacherSession?.code]);

  // Mở Góc Giáo Viên: kiểm tra phiên trên máy chủ còn dùng được không
  useEffect(() => {
    if (!isOpen || !teacherSession || teacherSession.mode === 'offline') return;
    let alive = true;
    checkCloudSession(teacherSession).then((r) => {
      if (alive && r === 'expired') expireSession();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teacherSession?.userId]);

  // Giáo viên phụ không có mục Giao bài / Sao lưu / Tài khoản: lỡ đang mở thì về danh sách bài
  useEffect(() => {
    if (teacherSession?.role === 'teacher' && (activeTab === 'backup' || activeTab === 'accounts')) {
      setActiveTab('manage');
    }
  }, [teacherSession, activeTab]);

  // Start new lesson from scratch
  const handleStartCreateNew = (asPoemOrProse = false) => {
    setEditingLessonId(null);
    setTitle('');
    setGradeLevel(3);
    setTeacherName(defaultAuthorName);
    setText('');
    setTeacherNote(
      asPoemOrProse
        ? 'Các con nhớ bấm phím Enter sau mỗi câu thơ và giữ phím Shift để viết hoa nhé!'
        : 'Các con luyện gõ đúng dấu tiếng Việt và giữ phím Shift khi viết hoa nhé!'
    );
    setImageUrl('');
    setTargetWpm(asPoemOrProse ? 20 : 18);
    setIsPoemOrStory(asPoemOrProse);
    setGenre(asPoemOrProse ? 'poem' : 'exercise');
    setIsFreePractice(true);
    setSaveSuccessMsg('');
    setOcrSuccessMsg('');
    setOcrErrorMsg('');
    setActiveTab('editor');
  };

  // Handle image upload from computer (FileReader with Auto Compression)
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // Reset để chọn lại cùng một file vẫn kích hoạt onChange
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setOcrSuccessMsg('');
      setOcrErrorMsg('❌ File đã chọn không phải là hình ảnh. Cô chọn ảnh JPG/PNG/WebP nhé.');
      return;
    }
    setIsCompressingImage(true);
    try {
      const compressedBase64 = await compressImageFile(file, 1000, 1000, 0.82);
      setImageUrl(compressedBase64);
      setOcrSuccessMsg('✅ Đã nén và tối ưu hóa ảnh sách giáo khoa thành công! Sẵn sàng phân tích AI hoặc lưu trữ.');
      setOcrErrorMsg('');
    } catch (err: any) {
      console.warn('Lỗi nén ảnh:', err);
      // Không nén được mà file quá lớn thì không lưu base64 khổng lồ (làm nặng localStorage/CSDL)
      if (file.size > MAX_IMAGE_BYTES) {
        setOcrSuccessMsg('');
        setOcrErrorMsg('❌ Không nén được ảnh và ảnh lớn hơn 5MB. Cô chọn ảnh nhỏ hơn hoặc chụp lại nhé.');
        return;
      }
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            setImageUrl(reader.result);
            setOcrSuccessMsg('');
            setOcrErrorMsg('');
          }
          resolve();
        };
        reader.onerror = () => {
          setOcrSuccessMsg('');
          setOcrErrorMsg('❌ Không đọc được file ảnh. Cô thử chọn lại ảnh khác nhé.');
          resolve();
        };
        reader.readAsDataURL(file);
      });
    } finally {
      setIsCompressingImage(false);
    }
  };

  const forgetGeminiKey = () => {
    setGeminiKey('');
    try {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
    } catch {
      // Bỏ qua: trình duyệt chặn bộ nhớ
    }
  };

  const handleSubmitKey = () => {
    const k = keyDraft.trim();
    if (!looksLikeGeminiKey(k)) {
      setKeyDialogError('Khoá chưa đúng dạng (thường bắt đầu bằng "AIza" hoặc "AQ."). Cô kiểm tra đã chép đủ, không dính dấu cách nhé.');
      return;
    }
    setGeminiKey(k);
    try {
      if (rememberKey) localStorage.setItem(GEMINI_KEY_STORAGE, k);
      else localStorage.removeItem(GEMINI_KEY_STORAGE);
    } catch {
      // Không lưu được thì vẫn dùng trong phiên này
    }
    setShowKeyDialog(false);
    setKeyDialogError('');
    void handleAnalyzeImageWithAI(k);
  };

  // Mở ảnh bằng trình duyệt để cô chuột phải -> "Tìm kiếm hình ảnh bằng Google Ống kính".
  // - Bản cài đặt .exe (Electron): nhờ Windows mở bằng trình duyệt mặc định (cửa sổ phần mềm không có Ống kính)
  // - Bản web: mở thẻ mới; Chrome chặn mở trực tiếp data: URL nên đổi sang blob: URL
  const handleOpenImageInNewTab = async () => {
    if (!imageUrl) return;
    const electronApi = (window as any).electronEnv;
    if (electronApi && typeof electronApi.openImageInBrowser === 'function') {
      const r = await electronApi.openImageInBrowser(imageUrl).catch(() => null);
      if (!r || !r.ok) {
        setOcrErrorMsg(`Không mở được ảnh bằng trình duyệt${r?.error ? `: ${r.error}` : ''}. Cô chuột phải trực tiếp lên ảnh nhỏ nhé.`);
      }
      return;
    }
    try {
      let url = imageUrl;
      if (imageUrl.startsWith('data:')) {
        const blob = await (await fetch(imageUrl)).blob();
        url = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(url), 10 * 60 * 1000);
      }
      window.open(url, '_blank', 'noopener');
    } catch {
      setOcrErrorMsg('Không mở được ảnh ở thẻ mới. Cô chuột phải trực tiếp lên ảnh nhỏ bên phải nhé.');
    }
  };

  // Dán chữ đã chép (từ Google Ống kính) vào ô nội dung bài
  const handlePasteText = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        setPasteHint('Bộ nhớ tạm đang trống. Cô bấm "Sao chép văn bản" trong Google Ống kính trước nhé.');
        return;
      }
      setText(clip.replace(/\r\n/g, '\n').trim());
      setPasteHint('✅ Đã dán văn bản vào ô nội dung. Cô đọc lại và sửa dấu nếu cần.');
    } catch {
      // Trình duyệt không cho đọc bộ nhớ tạm: đưa con trỏ vào ô để cô bấm Ctrl+V
      contentTextareaRef.current?.focus();
      setPasteHint('Trình duyệt chưa cho phép dán tự động. Con trỏ đã ở ô nội dung, cô bấm Ctrl+V để dán.');
    }
  };

  // AI OCR: Phân tích hình ảnh sách giáo khoa bằng Gemini AI
  const handleAnalyzeImageWithAI = async (keyOverride?: string) => {
    if (!imageUrl) {
      setOcrErrorMsg('Vui lòng chọn hoặc tải lên một hình ảnh sách giáo khoa trước khi bấm phân tích!');
      return;
    }
    const userKey = (keyOverride ?? geminiKey).trim();
    // Máy chủ chưa có khoá và cô cũng chưa nhập -> hỏi khoá trước, không gửi yêu cầu chắc chắn lỗi
    if (aiReady !== true && !userKey) {
      setKeyDraft('');
      setKeyDialogError('');
      setShowKeyDialog(true);
      return;
    }

    setIsAnalyzingImage(true);
    setOcrSuccessMsg('');
    setOcrErrorMsg('');

    try {
      let extracted: Record<string, any> = {};
      if (aiServer) {
        // CÓ MÁY CHỦ (chạy localhost): gửi qua máy chủ như trước
        const response = await fetch('/api/extract-textbook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Khoá cô tự nhập chỉ dùng khi máy chủ chưa có khoá riêng; máy chủ không lưu, không ghi log
            ...(userKey ? { 'X-Gemini-Key': userKey } : {}),
          },
          body: JSON.stringify({
            // Gửi nguyên data URL/đường dẫn; máy chủ tự xác định mime từ tiền tố
            imageBase64: imageUrl,
          }),
        });
        const resData = await response.json().catch(() => ({} as any));
        if (!response.ok || !resData.success) {
          throw new OcrError(resData.code === 'KEY_INVALID' ? 'KEY_INVALID' : 'OTHER', resData.error || 'Không thể trích xuất văn bản từ hình ảnh');
        }
        extracted = resData.data || {};
      } else {
        // KHÔNG CÓ MÁY CHỦ (bản web Vercel, bản cài đặt .exe): gọi thẳng Google bằng khoá cô đã nhập
        extracted = { ...(await analyzeTextbookImageInBrowser(imageUrl, userKey)) };
      }

      if (typeof extracted.title === 'string' && extracted.title) {
        setTitle(extracted.title);
      }
      if (typeof extracted.content === 'string' && extracted.content) {
        setText(extracted.content);
        // Tự động nhận diện thể loại thơ nếu văn bản có nhiều dòng ngắn
        const lines = String(extracted.content).split('\n').filter((l: string) => l.trim().length > 0);
        if (lines.length >= 3) {
          setIsPoemOrStory(true);
          setGenre('poem');
        }
      }
      // Chỉ nhận khối 3/4/5 (AI có thể trả "Lớp 4", "4", 2...) — sai thì giữ khối hiện tại
      const gradeDigit = Number(String(extracted.gradeLevel ?? '').match(/[3-5]/)?.[0]);
      if (gradeDigit === 3 || gradeDigit === 4 || gradeDigit === 5) {
        setGradeLevel(gradeDigit);
      }
      if (typeof extracted.teacherNote === 'string' && extracted.teacherNote) {
        setTeacherNote(extracted.teacherNote);
      }

      setOcrSuccessMsg('✅ AI đã phân tích và trích xuất thành công nội dung bài đọc từ ảnh SGK! Cô giáo hãy xem lại và chỉnh sửa bên dưới nếu cần trước khi lưu.');
    } catch (err: any) {
      console.error('Error analyzing textbook image:', err?.code || '', err?.message || err);
      // Khoá cô nhập bị sai/thu hồi: xoá khoá đã nhớ và mở lại ô nhập khoá
      if (err instanceof OcrError && err.code === 'KEY_INVALID' && userKey) {
        forgetGeminiKey();
        setKeyDraft('');
        setKeyDialogError('Khoá vừa dùng không đúng hoặc đã bị thu hồi. Cô tạo khoá mới rồi dán lại nhé.');
        setShowKeyDialog(true);
      }
      setOcrErrorMsg(`❌ Lỗi khi phân tích ảnh: ${err?.message || 'Vui lòng thử lại với ảnh rõ nét hơn'}`);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Submit lesson saving
  const handleSaveLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Vui lòng nhập tên bài học!');
      return;
    }
    if (!text.trim()) {
      alert('Vui lòng nhập nội dung bài gõ!');
      return;
    }

    // Giáo viên phụ chỉ được sửa bài của chính mình (máy chủ cũng chặn)
    if (editingLessonId) {
      const editingOriginal =
        (Array.isArray(allLessons) ? allLessons.find((l) => l?.id === editingLessonId) : undefined) ??
        effectiveLessons.find((l) => l.id === editingLessonId);
      if (editingOriginal && !canModifyLesson(editingOriginal)) {
        triggerSaveToast('Bài này do người khác tạo nên tài khoản của thầy/cô không sửa được. Hãy bấm "Soạn bài mới".');
        return;
      }
    }

    setIsSavingLesson(true);

    try {
      // Mã bài gắn mã người tạo: teacher-GV001-1731830000000 (admin: teacher-1731830000000 như trước)
      const lessonId =
        editingLessonId ||
        (teacherSession?.role === 'teacher' ? `teacher-${teacherSession.code}-${Date.now()}` : `teacher-${Date.now()}`);
      const cleanText = text.trim();

      let finalImageUrl = imageUrl.trim() || undefined;

      if (finalImageUrl && finalImageUrl.startsWith('data:image/')) {
        try {
          const uploadResult = await uploadImageToSupabaseStorage(finalImageUrl, title.trim());
          if (uploadResult?.url) {
            finalImageUrl = uploadResult.url;
          }
        } catch (err) {
          console.warn('Lưu ảnh vào bucket không thành công, tiếp tục lưu base64:', err);
        }
      }

      const freshFields: Omit<Lesson, 'id'> = {
        level: 20,
        category: isPoemOrStory ? 'poems_stories' : 'short_sentences',
        categoryTitleVi: isPoemOrStory ? (genre === 'poem' ? `Thơ SGK Lớp ${gradeLevel}` : `Văn SGK Lớp ${gradeLevel}`) : `Bài Lớp ${gradeLevel}`,
        title: title.trim(),
        subtitle: `Do ${teacherName} biên soạn • Khối ${gradeLevel}`,
        descriptionVi: teacherNote.trim() || 'Luyện gõ bài học theo yêu cầu của giáo viên.',
        focusKeys: Array.from(new Set(cleanText.toLowerCase().split(''))).filter((c) => c !== ' ' && c !== '\n').slice(0, 10),
        text: cleanText,
        targetWpm: Number(targetWpm) || 18,
        targetAccuracy: 90,
        badgeName: isPoemOrStory ? (genre === 'poem' ? 'Nhà Thơ Nhí' : 'Cây Bút Trẻ') : 'Học Trò Xuất Sắc',
        imageUrl: finalImageUrl,
        gradeLevel: Number(gradeLevel),
        authorTeacher: teacherName.trim(),
        teacherNote: teacherNote.trim(),
        isPoemOrStory: isPoemOrStory,
        genre: genre,
        isFreePractice: isFreePractice,
      };

      // Sửa bài có sẵn: giữ nguyên level/targetAccuracy/category/bookPage/subtitle... của bài gốc,
      // chỉ ghi đè các trường cô vừa chỉnh (trước đây dựng lại từ đầu làm mất dữ liệu bài hệ thống)
      const original = editingLessonId
        ? (Array.isArray(allLessons) ? allLessons.find((l) => l?.id === editingLessonId) : undefined) ??
          effectiveLessons.find((l) => l.id === editingLessonId)
        : undefined;
      const updatedLesson: Lesson = original
        ? {
            ...original,
            title: freshFields.title,
            text: freshFields.text,
            descriptionVi: freshFields.descriptionVi,
            targetWpm: freshFields.targetWpm,
            imageUrl: freshFields.imageUrl,
            gradeLevel: freshFields.gradeLevel,
            authorTeacher: freshFields.authorTeacher,
            teacherNote: freshFields.teacherNote,
            isPoemOrStory: freshFields.isPoemOrStory,
            genre: freshFields.genre,
            isFreePractice: freshFields.isFreePractice,
            // Chỉ tính lại phím trọng tâm khi nội dung đổi
            focusKeys: original.text === freshFields.text ? original.focusKeys : freshFields.focusKeys,
          }
        : {
            id: lessonId,
            ...freshFields,
            // Hiện ngay mã người tạo trên máy; máy chủ tự ghi lại người tạo thật khi lưu
            ownerId: teacherSession?.userId,
            ownerCode: teacherSession?.code,
          };

      // Đồng bộ hóa logic lưu trữ lên hệ thống đám mây Supabase / cơ sở dữ liệu
      const result = await onSaveLesson(updatedLesson);
      if (result === false) {
        setSaveSuccessMsg('');
        // Lưu hỏng vì phiên đăng nhập đã hết -> báo đúng nguyên nhân và mời đăng nhập lại (bài đang soạn được giữ)
        if ((await checkCloudSession(teacherSession)) === 'expired') {
          expireSession();
          return;
        }
        triggerSaveToast('Chưa lưu được bài lên máy chủ. Cô kiểm tra kết nối mạng rồi bấm lưu lại nhé.');
        return;
      }
      setLastSavedLesson(updatedLesson);
      setSaveSuccessMsg(`🎉 Đã lưu "Bài ${lessonNumberPreview}: ${stripLessonNumber(updatedLesson.title)}" và cập nhật hệ thống thành công!`);
      setEditingLessonId(updatedLesson.id);

      // Kích hoạt ngay bảng thông báo nổi Toast Notification hiển thị trong đúng 3 giây
      triggerSaveToast();

      setTimeout(() => {
        setSaveSuccessMsg('');
      }, 4500);
    } catch (err: any) {
      console.error('Lỗi khi lưu bài học trực tuyến:', err);
      triggerSaveToast(`Lỗi khi lưu bài: ${err?.message || 'không kết nối được máy chủ'}. Cô thử lại nhé.`);
    } finally {
      setIsSavingLesson(false);
    }
  };

  // Toggle Free Practice for a lesson directly
  const handleToggleFreePractice = (lesson: Lesson) => {
    if (!canModifyLesson(lesson)) {
      triggerSaveToast('Bài này do người khác tạo nên không đổi được chế độ mở tự do.');
      return;
    }
    const nextState = !(lesson.isFreePractice ?? true);
    const updated: Lesson = {
      ...lesson,
      isFreePractice: nextState,
    };
    onSaveLesson(updated);
  };

  // Đồng bộ toàn bộ bài học & ảnh mẫu lên Supabase
  const handleSyncAllToSupabase = async () => {
    try {
      setIsSyncingAllToSupabase(true);
      setSyncAllMsg('');
      const success = await bulkUpsertLessonsToSupabase(effectiveLessons);
      if (success) {
        setSyncAllMsg(`🎉 Đã đồng bộ thành công ${effectiveLessons.length} bài học và hình ảnh sách giáo khoa lên Supabase Cloud!`);
      } else {
        setSyncAllMsg('⚠️ Có lỗi khi đồng bộ lên Supabase. Vui lòng kiểm tra quyền bảng lessons.');
      }
    } catch (err: any) {
      setSyncAllMsg(`❌ Lỗi đồng bộ: ${err?.message || 'Không thể kết nối Supabase'}`);
    } finally {
      setIsSyncingAllToSupabase(false);
      setTimeout(() => {
        setSyncAllMsg('');
      }, 5000);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [offlineSyncMsg, setOfflineSyncMsg] = useState<string>('');

  // 1. Xuất file JSON bài học ra USB để mang sang máy học sinh khác (chạy offline)
  const handleExportLessonsToUSB = () => {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0.0',
        appName: 'Phần mềm Luyện gõ 10 ngón Tiểu học',
        teacherName: teacherName || 'Giáo viên',
        totalLessons: effectiveLessons.length,
        lessons: effectiveLessons,
        gradeAssignments: safeAssignments,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute(
        'download',
        `danh_sach_bai_hoc_luyen_go_10ngon_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setOfflineSyncMsg(
        `💾 Đã xuất thành công ${effectiveLessons.length} bài học ra file JSON! Cô hãy copy file này vào USB để cắm sang các máy tính học sinh.`
      );
      setTimeout(() => setOfflineSyncMsg(''), 7000);
    } catch (err: any) {
      alert(`Lỗi khi xuất file: ${err?.message || 'Không thể tạo file'}`);
    }
  };

  // 2. Nạp bài học từ file JSON trong USB vào máy học sinh
  const handleImportLessonsFromUSB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let rawLessons: unknown[] = [];
        let assignmentsToImport: Record<number, GradeAssignment> | undefined;

        if (Array.isArray(parsed)) {
          rawLessons = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.lessons)) {
            rawLessons = parsed.lessons;
          }
          assignmentsToImport = normalizeImportedAssignments(parsed.gradeAssignments);
        }

        // Kiểm tra từng bài: file USB có thể bị sửa tay/hỏng, bài lỗi sẽ làm vỡ màn hình luyện gõ
        const seenIds = new Set<string>();
        const lessonsToImport: Lesson[] = [];
        rawLessons.forEach((raw) => {
          const lesson = normalizeImportedLesson(raw);
          if (lesson && !seenIds.has(lesson.id)) {
            seenIds.add(lesson.id);
            lessonsToImport.push(lesson);
          }
        });
        const skippedCount = rawLessons.length - lessonsToImport.length;

        if (lessonsToImport.length === 0) {
          alert('File JSON không chứa danh sách bài học hợp lệ!');
          return;
        }

        // Bỏ id giao bài trỏ tới bài không tồn tại
        if (assignmentsToImport) {
          const cleaned: Record<number, GradeAssignment> = {};
          Object.entries(assignmentsToImport).forEach(([k, g]) => {
            const ids = g.lessonIds.filter((id) => seenIds.has(id) || effectiveLessons.some((l) => l.id === id));
            if (ids.length > 0) cleaned[Number(k)] = { ...g, lessonId: ids[0], lessonIds: ids };
          });
          assignmentsToImport = Object.keys(cleaned).length > 0 ? cleaned : undefined;
        }

        if (onImportLessons) {
          onImportLessons(lessonsToImport, assignmentsToImport);
        } else {
          localStorage.setItem('typing_kids_all_lessons', JSON.stringify(lessonsToImport));
          if (assignmentsToImport) {
            localStorage.setItem('typing_kids_grade_assignments', JSON.stringify(assignmentsToImport));
          }
          window.location.reload();
        }

        setOfflineSyncMsg(
          `🎉 Nạp thành công ${lessonsToImport.length} bài học từ file USB vào máy tính này! Học sinh trên máy này có thể luyện tập ngay.` +
            (skippedCount > 0 ? ` (Đã bỏ qua ${skippedCount} bài bị lỗi hoặc trùng mã.)` : '')
        );
        setTimeout(() => setOfflineSyncMsg(''), 7000);
      } catch (err: any) {
        alert(`Không thể đọc file JSON: ${err?.message || 'Định dạng file không đúng'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Danh sách đã chọn nhưng chỉ giữ bài còn tồn tại (bài có thể đã bị xoá sau khi chọn)
  const validSelectedLessonIds = useMemo(() => {
    const list = Array.isArray(selectedLessonIdsForAssign) ? selectedLessonIdsForAssign : [];
    const existing = new Set(effectiveLessons.map((l) => l.id));
    return Array.from(new Set(list)).filter((id) => existing.has(id));
  }, [selectedLessonIdsForAssign, effectiveLessons]);

  // Khi đổi khối lớp ở tab Giao bài
  const handleSelectGradeForAssign = (grade: number, source?: Record<number, TeacherGradeAssignment>) => {
    setSelectedGradeForAssign(grade);
    setAssignGradeFilter(grade);
    if (teacherSession?.role === 'teacher') {
      // Giáo viên phụ: nạp bài đang giao theo mã của mình (chưa giao thì để trống)
      const mine = (source ?? myAssignments)[grade];
      setSelectedLessonIdsForAssign(mine ? [...mine.lessonIds] : []);
      if (mine?.teacherNote) setAssignNote(mine.teacherNote);
      return;
    }
    const existing = safeAssignments[grade];
    if (existing) {
      const ids = Array.isArray(existing.lessonIds) && existing.lessonIds.length > 0
        ? existing.lessonIds.filter(Boolean)
        : existing.lessonId ? [existing.lessonId] : [];
      setSelectedLessonIdsForAssign(ids);
      if (existing.teacherNote) setAssignNote(existing.teacherNote);
    } else {
      const defaultLessons = effectiveLessons.filter((l) => l.gradeLevel === grade).slice(0, 2);
      setSelectedLessonIdsForAssign(defaultLessons.map((l) => l.id));
    }
  };

  // Toggle chọn hoặc bỏ chọn một bài học
  const handleToggleLessonSelection = (lessonId: string) => {
    setSelectedLessonIdsForAssign((prev) => {
      const currentList = Array.isArray(prev) ? prev : [];
      if (currentList.includes(lessonId)) {
        return currentList.filter((id) => id !== lessonId);
      } else {
        return [...currentList, lessonId];
      }
    });
  };

  const handleQuickSelectCount = (count: number) => {
    const gradeLessons = effectiveLessons.filter(
      (l) => l.gradeLevel === selectedGradeForAssign || !l.gradeLevel
    );
    const selected = gradeLessons.slice(0, count).map((l) => l.id);
    setSelectedLessonIdsForAssign(selected);
  };

  const handleSelectAllForGrade = () => {
    const gradeLessons = effectiveLessons.filter((l) => l.gradeLevel === selectedGradeForAssign);
    setSelectedLessonIdsForAssign(gradeLessons.map((l) => l.id));
  };

  // Giao bài tập cho khối lớp
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Bỏ id của bài đã bị xoá để không giao bài "ma" cho học sinh
    const safeSelected = validSelectedLessonIds;
    if (safeSelected.length === 0) {
      alert('Cô vui lòng chọn ít nhất 1 bài học để giao cho khối lớp (có thể chọn 2 bài, 3 bài hoặc nhiều bài)!');
      return;
    }

    if (teacherSession?.role === 'teacher') {
      if (!teacherSession.userId) {
        triggerSaveToast('Giao bài cần có mạng và đăng nhập trực tuyến. Thầy cô đăng nhập lại nhé.');
        return;
      }
      const r = await saveTeacherAssignment({
        ownerId: teacherSession.userId,
        ownerCode: teacherSession.code,
        gradeLevel: selectedGradeForAssign,
        lessonIds: safeSelected,
        teacherName: teacherSession.displayName,
        teacherNote: assignNote,
      });
      if (r !== 'ok') {
        if ((await checkCloudSession(teacherSession)) === 'expired') {
          expireSession();
          return;
        }
        triggerSaveToast(
          r === 'denied'
            ? 'Máy chủ chưa cho lưu bài giao (có thể chưa chạy tệp SQL bài giao theo giáo viên). Thầy cô báo quản trị nhé.'
            : 'Chưa giao được bài lên máy chủ. Thầy cô kiểm tra kết nối mạng rồi thử lại nhé.'
        );
        return;
      }
      setMyAssignments((m) => ({
        ...m,
        [selectedGradeForAssign]: {
          ownerCode: teacherSession.code,
          gradeLevel: selectedGradeForAssign,
          lessonIds: safeSelected,
          teacherName: teacherSession.displayName,
          teacherNote: assignNote,
        },
      }));
      setAssignmentSuccessMsg(
        `✅ Đã giao ${safeSelected.length} bài cho Lớp ${selectedGradeForAssign} theo mã ${teacherSession.code}. Học sinh bấm Chọn bài, gõ mã ${teacherSession.code} sẽ thấy mục "Bài cô giao".`
      );
      setTimeout(() => setAssignmentSuccessMsg(''), 6000);
      return;
    }

    try {
      const result = await onAssignLessonToGrade(selectedGradeForAssign, safeSelected, teacherName, assignNote);
      if (result === false) {
        setAssignmentSuccessMsg('');
        triggerSaveToast('Chưa giao được bài lên máy chủ. Cô kiểm tra kết nối mạng rồi thử lại nhé.');
        return;
      }
      setAssignmentSuccessMsg(
        `✅ Đã giao thành công ${safeSelected.length} bài tập cho toàn bộ học sinh Khối Lớp ${selectedGradeForAssign}! Khi học sinh vào học, hệ thống sẽ mở các bài tập này.`
      );
      setTimeout(() => {
        setAssignmentSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error('Lỗi khi giao bài:', err);
      setAssignmentSuccessMsg('');
      triggerSaveToast(`Lỗi khi giao bài: ${err?.message || 'không kết nối được máy chủ'}. Cô thử lại nhé.`);
    }
  };

  // Sắp xếp an toàn danh sách bài học (Auto-sorting)
  const sortLessons = (lessons: Lesson[]): Lesson[] => {
    if (!Array.isArray(lessons)) return [];
    const list = [...lessons];
    // Trong cùng khối: theo số "Bài N" hệ thống đã đánh (Bài 1, Bài 2, …); bài Numpad xếp cuối
    const byGradeThenNumber = (a: Lesson, b: Lesson) => {
      const gradeA = a.gradeLevel || 3;
      const gradeB = b.gradeLevel || 3;
      if (gradeA !== gradeB) return gradeA - gradeB;
      // Cùng lớp: bài hệ thống trước, rồi lần lượt từng giáo viên (GV001, GV002…), mỗi bộ theo số bài
      const ownA = isSystemLesson(a) ? '' : lessonOwnerKey(a);
      const ownB = isSystemLesson(b) ? '' : lessonOwnerKey(b);
      if (ownA !== ownB) return ownA.localeCompare(ownB, undefined, { numeric: true });
      // Trong một bộ bài: nhóm Luyện phím → Thơ → Văn → Numpad, mỗi nhóm theo số bài
      const rk = lessonGroupRank(a) - lessonGroupRank(b);
      if (rk !== 0) return rk;
      const numA = displayedLessonNumber(a) ?? 100000 + (a.level || 0);
      const numB = displayedLessonNumber(b) ?? 100000 + (b.level || 0);
      return numA - numB;
    };
    switch (sortBy) {
      case 'hierarchy':
        // Lớp 3 -> Lớp 4 -> Lớp 5, trong mỗi lớp đúng thứ tự Bài 1, Bài 2, Bài 3…
        return list.sort(byGradeThenNumber);
      case 'assigned_first':
        return list.sort((a, b) => {
          const isAssignedA = allAssignedLessonIds.has(a.id) ? 1 : 0;
          const isAssignedB = allAssignedLessonIds.has(b.id) ? 1 : 0;
          if (isAssignedA !== isAssignedB) return isAssignedB - isAssignedA;
          return byGradeThenNumber(a, b);
        });
      case 'poems_first':
        return list.sort((a, b) => {
          const isPoemA = a.isPoemOrStory || a.category === 'poems_stories' ? 1 : 0;
          const isPoemB = b.isPoemOrStory || b.category === 'poems_stories' ? 1 : 0;
          if (isPoemA !== isPoemB) return isPoemB - isPoemA;
          return byGradeThenNumber(a, b);
        });
      case 'title_az':
        // So số theo giá trị (numeric): "Bài 2" < "Bài 9" < "Bài 10", không xếp kiểu chữ "Bài 10" < "Bài 2"
        return list.sort(
          (a, b) =>
            (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' }) ||
            (a.gradeLevel || 0) - (b.gradeLevel || 0)
        );
      case 'wpm_asc':
        return list.sort((a, b) => (a.targetWpm || 0) - (b.targetWpm || 0));
      default:
        return list;
    }
  };

  // Bài đang được giao theo mã: quản trị thấy của mọi thầy cô, giáo viên thấy của chính mình
  const codeAssignedByLesson = useMemo(() => {
    const m = new Map<string, string[]>();
    const list: TeacherGradeAssignment[] = isAdminRole
      ? allCodeAssignments
      : teacherSession?.role === 'teacher'
      ? Object.values(myAssignments)
      : [];
    for (const a of list) {
      for (const id of a.lessonIds || []) {
        const label = isAdminRole ? `${a.ownerCode} giao lớp ${a.gradeLevel}` : `Đang giao lớp ${a.gradeLevel}`;
        m.set(id, [...(m.get(id) || []), label]);
      }
    }
    return m;
  }, [isAdminRole, allCodeAssignments, myAssignments, teacherSession?.role]);

  // Filter lessons in manage tab
  const isTeacherRole = teacherSession?.role === 'teacher';
  // Bài do chính giáo viên phụ đang đăng nhập soạn
  const isMyLesson = (l: Lesson): boolean =>
    !!teacherSession &&
    !!l &&
    (lessonOwnerKey(l) === teacherSession.code || (!!teacherSession.userId && l.ownerId === teacherSession.userId));
  const myLessonCount = useMemo(
    () => (isTeacherRole ? effectiveLessons.filter(isMyLesson).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveLessons, isTeacherRole, teacherSession?.code, teacherSession?.userId]
  );
  const systemLessonCount = useMemo(() => effectiveLessons.filter((l) => l && isSystemLesson(l)).length, [effectiveLessons]);
  const teacherDir = useMemo(() => teacherDirectory(effectiveLessons), [effectiveLessons]);
  const teacherLessonTotal = useMemo(() => teacherDir.reduce((n, t) => n + t.count, 0), [teacherDir]);

  // Đăng nhập giáo viên phụ: mặc định xem bài của mình; admin: xem tất cả
  useEffect(() => {
    setLessonSource(isTeacherRole ? 'mine' : 'all');
  }, [isTeacherRole, teacherSession?.code]);

  const manageSource = useMemo(() => {
    if (isTeacherRole) {
      // Giáo viên phụ chỉ thấy bài của mình hoặc bài hệ thống, không thấy bài giáo viên khác
      return lessonSource === 'system' ? effectiveLessons.filter((l) => l && isSystemLesson(l)) : effectiveLessons.filter(isMyLesson);
    }
    if (lessonSource === 'system') return effectiveLessons.filter((l) => l && isSystemLesson(l));
    if (lessonSource === 'teachers') return effectiveLessons.filter((l) => l && !isSystemLesson(l));
    if (lessonSource !== 'all') return effectiveLessons.filter((l) => l && lessonOwnerKey(l) === lessonSource);
    return effectiveLessons;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLessons, lessonSource, isTeacherRole, teacherSession?.code, teacherSession?.userId]);

  // Đổi bộ lọc thì quay về 20 bài đầu
  useEffect(() => {
    setVisibleLimit(20);
  }, [lessonSource, gradeFilter, groupFilter, subGrade, searchKeyword, sortBy]);

  const filteredManageLessons = useMemo(() => {
    const result = manageSource.filter((l) => {
      if (subGradeApplies && subGrade !== 'all' && l.gradeLevel !== subGrade) return false;
      if (gradeFilter === 'assigned' && !allAssignedLessonIds.has(l.id) && !codeAssignedByLesson.has(l.id)) return false;
      if (groupFilter !== 'all' && lessonGroupOf(l) !== groupFilter) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const inTitle = (l.title || '').toLowerCase().includes(kw);
        const inText = (l.text || '').toLowerCase().includes(kw);
        return inTitle || inText;
      }
      return true;
    });

    return sortLessons(result);
  }, [manageSource, gradeFilter, groupFilter, subGrade, subGradeApplies, searchKeyword, sortBy, allAssignedLessonIds, codeAssignedByLesson]);

  // Phân nhóm theo hệ thống phân cấp (Hierarchical Grouping)
  const groupedManageLessons = useMemo(() => {
    const assigned = manageSource.filter((l) => allAssignedLessonIds.has(l.id));
    const grade3 = manageSource.filter(
      (l) => (l.gradeLevel === 3 || (!l.gradeLevel && (l.level || 0) <= 6)) && !allAssignedLessonIds.has(l.id)
    );
    const grade4 = manageSource.filter(
      (l) => (l.gradeLevel === 4 || (!l.gradeLevel && (l.level || 0) > 6 && (l.level || 0) <= 10)) && !allAssignedLessonIds.has(l.id)
    );
    const grade5 = manageSource.filter(
      (l) => (l.gradeLevel === 5 || (!l.gradeLevel && (l.level || 0) > 10)) && !allAssignedLessonIds.has(l.id)
    );
    const others = manageSource.filter(
      (l) => !l.gradeLevel && !allAssignedLessonIds.has(l.id) && !grade3.includes(l) && !grade4.includes(l) && !grade5.includes(l)
    );

    const applySearch = (arr: Lesson[]) => {
      if (!searchKeyword.trim()) return arr;
      const kw = searchKeyword.toLowerCase();
      return arr.filter((l) => (l.title || '').toLowerCase().includes(kw) || (l.text || '').toLowerCase().includes(kw));
    };

    return [
      {
        id: 'group-assigned',
        title: '🎯 BÀI TẬP GIÁO VIÊN ĐANG GIAO CHO CÁC KHỐI LỚP',
        badge: 'Ưu tiên làm bài',
        badgeColor: 'bg-rose-500 text-white',
        borderColor: 'border-rose-400 bg-rose-50/40',
        textColor: 'text-rose-900',
        lessons: applySearch(sortLessons(assigned)),
      },
      {
        id: 'group-grade-3',
        title: '📘 BÀI HỌC SGK KHỐI LỚP 3 (HÀNG CƠ SỞ & LÀM QUEN PHÍM)',
        badge: 'Khối Lớp 3',
        badgeColor: 'bg-sky-600 text-white',
        borderColor: 'border-sky-300 bg-sky-50/30',
        textColor: 'text-sky-950',
        lessons: applySearch(sortLessons(grade3)),
      },
      {
        id: 'group-grade-4',
        title: '📗 BÀI HỌC SGK KHỐI LỚP 4 (HÀNG SỐ, CA DAO & TRUYỆN NGỤ NGÔN)',
        badge: 'Khối Lớp 4',
        badgeColor: 'bg-emerald-600 text-white',
        borderColor: 'border-emerald-300 bg-emerald-50/30',
        textColor: 'text-emerald-950',
        lessons: applySearch(sortLessons(grade4)),
      },
      {
        id: 'group-grade-5',
        title: '📙 BÀI HỌC SGK KHỐI LỚP 5 (BÀI THƠ DÀI & ĐOẠN VĂN MẪU TỐC ĐỘ CAO)',
        badge: 'Khối Lớp 5',
        badgeColor: 'bg-amber-600 text-white',
        borderColor: 'border-amber-300 bg-amber-50/30',
        textColor: 'text-amber-950',
        lessons: applySearch(sortLessons(grade5)),
      },
      ...(others.length > 0
        ? [
            {
              id: 'group-others',
              title: '📚 BÀI HỌC KHÁC & BÀI SOẠN MỞ RỘNG',
              badge: 'Mở rộng',
              badgeColor: 'bg-slate-600 text-white',
              borderColor: 'border-slate-300 bg-slate-50/30',
              textColor: 'text-slate-900',
              lessons: applySearch(sortLessons(others)),
            },
          ]
        : []),
    ];
  }, [manageSource, allAssignedLessonIds, searchKeyword, sortBy]);

  const bulkEnabled = !!onBulkDeleteLessons && !!onBulkUpdateLessons;
  // Mọi bài đang khớp bộ lọc mà tài khoản này được sửa (để "Chọn tất cả")
  const selectableInView = useMemo(() => {
    const grouped = gradeFilter === 'all' && groupFilter === 'all' && subGrade === 'all' && sortBy === 'hierarchy' && !searchKeyword.trim();
    const list = grouped ? groupedManageLessons.flatMap((g) => g.lessons) : filteredManageLessons;
    const seen = new Set<string>();
    return list.filter((l) => l && canModifyLesson(l) && !seen.has(l.id) && !!seen.add(l.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedManageLessons, filteredManageLessons, gradeFilter, groupFilter, subGrade, sortBy, searchKeyword, isAdminRole, teacherSession?.userId]);
  // Bỏ khỏi lựa chọn các bài không còn (đã xoá, đổi tài khoản)
  useEffect(() => {
    setBulkSelected((prev) => {
      const next = prev.filter((id) => effectiveLessons.some((l) => l && l.id === id && canModifyLesson(l)));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveLessons, isAdminRole, teacherSession?.userId]);
  const toggleBulk = (id: string) =>
    setBulkSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const allInViewSelected = selectableInView.length > 0 && selectableInView.every((l) => bulkSelected.includes(l.id));
  // Thứ tự xử lý theo đúng thứ tự đang hiện, để bài chuyển lớp giữ nguyên thứ tự trước sau
  const orderedBulkIds = () => {
    const order = sortLessons(effectiveLessons.filter((l) => l && bulkSelected.includes(l.id)));
    return order.map((l) => l.id);
  };
  const BULK_GROUP_LABEL = { exercise: 'Luyện phím', poem: 'Thơ SGK', prose: 'Văn SGK' } as const;

  // Phải còn ít nhất 1 bài: xoá hết thì học sinh không còn bài để luyện,
  // và lần mở sau phần mềm sẽ tự nạp lại toàn bộ bài mặc định lên máy chủ.
  const totalLessonCount = effectiveLessons.filter((l) => l && l.id).length;
  const KEEP_ONE_MSG = 'Cần giữ lại ít nhất 1 bài học. Thầy cô bỏ chọn bớt 1 bài rồi xoá lại nhé.';

  const runBulkDelete = async () => {
    if (!onBulkDeleteLessons || bulkSelected.length === 0) return;
    if (bulkSelected.length >= totalLessonCount) {
      triggerSaveToast(KEEP_ONE_MSG);
      return;
    }
    const assigned = bulkSelected.filter((id) => allAssignedLessonIds.has(id)).length;
    const msg =
      `Xoá ${bulkSelected.length} bài đã chọn? Thao tác này không hoàn tác được.` +
      (assigned > 0 ? `\n\nLưu ý: ${assigned} bài trong số này đang được giao cho học sinh.` : '');
    if (!window.confirm(msg)) return;
    setBulkBusy(true);
    try {
      const r = await onBulkDeleteLessons(orderedBulkIds());
      setBulkSelected([]);
      triggerSaveToast(
        r.denied > 0
          ? `Đã xoá ${r.deleted} bài. ${r.denied} bài máy chủ không cho xoá (không do tài khoản này tạo).`
          : `🗑️ Đã xoá ${r.deleted} bài.`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkMove = async () => {
    if (!onBulkUpdateLessons || bulkSelected.length === 0 || (!bulkGrade && !bulkGroup)) return;
    const parts = [bulkGrade ? `sang Lớp ${bulkGrade}` : '', bulkGroup ? `vào nhóm ${BULK_GROUP_LABEL[bulkGroup]}` : ''].filter(Boolean);
    if (!window.confirm(`Chuyển ${bulkSelected.length} bài đã chọn ${parts.join(' và ')}?`)) return;
    setBulkBusy(true);
    try {
      const r = await onBulkUpdateLessons(orderedBulkIds(), {
        gradeLevel: bulkGrade ? Number(bulkGrade) : undefined,
        group: bulkGroup || undefined,
      });
      setBulkSelected([]);
      setBulkGrade('');
      setBulkGroup('');
      triggerSaveToast(
        r.ok
          ? `✅ Đã chuyển ${r.changed} bài ${parts.join(' và ')}.`
          : `Đã chuyển ${r.changed} bài trên máy này nhưng CHƯA lưu được lên máy chủ. Thầy cô kiểm tra mạng rồi thử lại nhé.`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  // Nhãn nhóm có màu (Luyện phím / Thơ SGK / Văn SGK / Numpad) dùng ở màn Giao bài
  const groupChip = (l: Lesson) => {
    const g = lessonGroupOf(l);
    const t = GROUP_TONE[g ?? 'numpad'];
    return (
      <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md border ${t.chip}`} data-chip-group={g ?? 'numpad'}>
        {g === 'poem' ? '📜 Thơ SGK' : g === 'prose' ? '📝 Văn SGK' : g === 'exercise' ? '⌨️ Luyện phím' : '🖩 Numpad'}
      </span>
    );
  };

  // Một DÒNG bài học (gọn, đọc lướt nhanh); bấm tên bài để xem trước nội dung
  const renderLessonRow = (l: Lesson) => {
    if (!l || !l.id) return null;
    const isTeacherMade = l.id.startsWith('teacher-') || !!l.authorTeacher;
    const assignedGrades = getAssignedGradesForLesson(l.id);
    const isAssigned = assignedGrades.length > 0;
    const codeAssigned = codeAssignedByLesson.get(l.id) || [];
    const isPoem = l.isPoemOrStory || l.category === 'poems_stories';
    const isFree = l.isFreePractice ?? true;
    const isOpenPreview = previewLessonId === l.id;
    const grp = lessonGroupOf(l);
    const kind = grp === 'prose' ? 'Văn SGK' : grp === 'poem' ? 'Thơ SGK' : isNumpadLesson(l) ? 'Numpad' : 'Luyện phím';
    const canModify = canModifyLesson(l);
    const canDelete = canModify && (isAdminRole || l.id.startsWith('teacher-'));
    // Gán thứ tự: bài mình được sửa và có số "Bài N" (bài Numpad có dãy số riêng)
    const curNo = displayedLessonNumber(l);
    const canReorder = !!onReorderLesson && canModify && curNo !== null;
    const isReordering = reorderId === l.id;

    return (
      <li key={`row-${l.id}`} data-lesson-row={l.id} className="border-b border-slate-100 last:border-b-0">
        <div
          className={`grid grid-cols-[auto_1fr_auto] ${bulkEnabled ? 'xl:grid-cols-[100px_1fr_96px_80px_150px_auto]' : 'xl:grid-cols-[64px_1fr_96px_80px_150px_auto]'} items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-slate-50 ${
            bulkSelected.includes(l.id) ? 'bg-amber-50' : ''
          }`}
        >
          <span className="flex items-center gap-1.5">
            {bulkEnabled &&
              (canModify ? (
                <label className="w-8 h-8 -m-1 flex items-center justify-center cursor-pointer" title="Tích để chọn bài này">
                  <input
                    type="checkbox"
                    checked={bulkSelected.includes(l.id)}
                    onChange={() => toggleBulk(l.id)}
                    data-bulk-check={l.id}
                    aria-label={`Chọn bài ${l.title}`}
                    className="w-5 h-5 accent-amber-500 cursor-pointer"
                  />
                </label>
              ) : (
                <span className="w-8 h-8 -m-1 shrink-0" aria-hidden="true" />
              ))}
            <span className="text-xs font-black px-2 py-1 rounded-lg bg-sky-100 text-sky-800 text-center whitespace-nowrap">
              Lớp {l.gradeLevel || '–'}
            </span>
          </span>

          <button
            type="button"
            onClick={() => setPreviewLessonId(isOpenPreview ? null : l.id)}
            className="min-w-0 text-left cursor-pointer group"
            title="Bấm để xem trước nội dung bài"
            aria-expanded={isOpenPreview}
          >
            <span className="block font-bold text-sm text-slate-900 truncate group-hover:text-emerald-700">
              {isOpenPreview ? '▾' : '▸'} {l.title}
              {l.ownerCode && (
                <span
                  className={`ml-2 align-middle text-[11px] font-black px-1.5 py-0.5 rounded-md ${
                    teacherSession?.userId && l.ownerId === teacherSession.userId ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}
                  title="Mã tài khoản đã tạo bài này"
                  data-owner-code={l.ownerCode}
                >
                  {l.ownerCode}
                </span>
              )}
            </span>
            <span className="block text-xs text-slate-500 truncate">
              {(l.text || '').replace(/\s+/g, ' ').slice(0, 90) || '(Chưa có nội dung)'}
            </span>
          </button>

          <span className="hidden xl:inline">
            <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-full border ${GROUP_TONE[grp ?? 'numpad'].chip}`} data-kind-group={grp ?? 'numpad'}>
              {kind}
            </span>
          </span>
          <span className="hidden xl:inline text-xs font-semibold text-slate-600 tabular-nums">{l.targetWpm || 18} WPM</span>

          <span className="hidden xl:flex items-center">
            {codeAssigned.length > 0 && !isAssigned ? (
              <span className="flex flex-col gap-0.5" data-code-assigned={l.id}>
                {codeAssigned.map((t) => (
                  <span key={t} className="text-xs font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 whitespace-nowrap">
                    📌 {t}
                  </span>
                ))}
              </span>
            ) : isAssigned ? (
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-black px-2 py-1 rounded-lg bg-rose-100 text-rose-800">
                  🎯 Đang giao lớp {assignedGrades.join(', ')}
                </span>
                {codeAssigned.map((t) => (
                  <span key={t} className="text-xs font-black px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 whitespace-nowrap">
                    📌 {t}
                  </span>
                ))}
              </span>
            ) : isFree ? (
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-teal-50 text-teal-800 flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Mở tự do
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Chỉ khi giao
              </span>
            )}
          </span>

          <div className="flex items-center gap-1 justify-end">
            {canReorder && (
              <button
                type="button"
                onClick={() => {
                  setReorderId(isReordering ? null : l.id);
                  setReorderValue(String(curNo));
                }}
                data-action="reorder-lesson"
                aria-expanded={isReordering}
                className={`h-8 px-2 rounded-lg font-black text-xs flex items-center gap-1 cursor-pointer border ${
                  isReordering ? 'bg-amber-500 border-amber-500 text-white' : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
                title="Gán lại thứ tự: đổi bài này thành Bài số khác"
              >
                <span aria-hidden="true">#</span>
                <span className="hidden sm:inline">Thứ tự</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!canModify) return;
                loadLessonIntoEditor(l);
                setActiveTab('editor');
              }}
              disabled={!canModify}
              data-action="edit-lesson"
              className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              title={canModify ? 'Sửa nội dung, ảnh SGK của bài này' : 'Bài do người khác tạo: chỉ xem và gõ thử'}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sửa</span>
            </button>
            {isAdminRole && (
            <button
              type="button"
              onClick={() => {
                // Gộp vào lựa chọn hiện có thay vì thay thế
                setSelectedLessonIdsForAssign((prev) =>
                  Array.isArray(prev) && prev.includes(l.id) ? prev : [...(Array.isArray(prev) ? prev : []), l.id]
                );
                if (l.gradeLevel) setSelectedGradeForAssign(l.gradeLevel);
                setActiveTab('assign');
              }}
              className="h-8 px-2.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
              title="Giao bài này cho cả khối lớp"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Giao</span>
            </button>
            )}
            <button
              type="button"
              onClick={() => {
                onSelectLesson(l);
                onClose();
              }}
              className="h-8 w-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
              title="Gõ thử bài này trên màn hình luyện tập"
              aria-label="Gõ thử"
            >
              <Eye className="w-4 h-4" />
            </button>
            {canDelete && (
              <button
                type="button"
                data-action="delete-lesson"
                onClick={async () => {
                  if (totalLessonCount <= 1) {
                    triggerSaveToast(KEEP_ONE_MSG);
                    return;
                  }
                  if (window.confirm(`Thầy/cô có chắc muốn xoá bài "${l.title}"? Thao tác này không hoàn tác được.`)) {
                    const ok = await onDeleteLesson(l.id);
                    if (ok === false) {
                      triggerSaveToast('Máy chủ từ chối xoá: bài này không do tài khoản của thầy/cô tạo.');
                    }
                  }
                }}
                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer"
                title="Xoá bài do cô soạn"
                aria-label="Xoá bài"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isReordering && canReorder && (
          <form
            className="mx-3 mb-2 px-3 py-2 rounded-xl bg-amber-50 border-2 border-amber-300 flex flex-wrap items-center gap-2 text-sm"
            data-testid="reorder-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const n = parseInt(reorderValue, 10);
              if (!Number.isFinite(n) || n < 1) {
                triggerSaveToast('Thầy cô nhập số thứ tự từ 1 trở lên nhé.');
                return;
              }
              if (n === curNo) {
                setReorderId(null);
                return;
              }
              setReorderBusy(true);
              try {
                const r = await onReorderLesson!(l.id, n);
                setReorderId(null);
                if (!r) triggerSaveToast('Bài này không gán thứ tự được.');
                else
                  triggerSaveToast(
                    r.ok
                      ? `✅ Đã chuyển "${stripLessonNumber(l.title)}" từ Bài ${r.from} thành Bài ${r.to}. Danh sách đã xếp lại theo số bài.`
                      : `Đã đổi thứ tự trên máy này nhưng CHƯA lưu được lên máy chủ. Thầy cô kiểm tra mạng rồi thử lại nhé.`
                  );
              } finally {
                setReorderBusy(false);
              }
            }}
          >
            <span className="font-bold text-amber-950">
              Đổi <b>Bài {curNo}</b> thành Bài số
            </span>
            <input
              type="number"
              min={1}
              value={reorderValue}
              onChange={(e) => setReorderValue(e.target.value)}
              autoFocus
              aria-label="Số thứ tự mới"
              data-testid="reorder-input"
              className="w-20 h-9 px-2 rounded-lg border-2 border-amber-400 bg-white text-center text-base font-black focus:outline-none focus:border-amber-600"
            />
            <span className="text-xs text-slate-600">
              (Lớp {l.gradeLevel || '–'} · {kind} · bộ bài {lessonOwnerKey(l)}; các bài khác trong nhóm tự dồn chỗ)
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <button
                type="submit"
                disabled={reorderBusy}
                className="h-9 px-4 rounded-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white font-black cursor-pointer"
              >
                {reorderBusy ? 'Đang lưu…' : 'Gán thứ tự'}
              </button>
              <button type="button" onClick={() => setReorderId(null)} className="h-9 px-3 rounded-full font-bold text-slate-600 hover:bg-white cursor-pointer">
                Huỷ
              </button>
            </span>
          </form>
        )}

        {/* Xem trước: nội dung đầy đủ, ảnh SGK, lời dặn, quyền tự do luyện */}
        {isOpenPreview && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-slate-50 border border-slate-200 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0 space-y-2">
              <p className="font-sgk-text text-sm text-slate-800 whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto">
                {l.text || '(Chưa có nội dung văn bản)'}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="xl:hidden font-semibold">{kind} · {l.targetWpm || 18} WPM</span>
                {isTeacherMade && <span>✍️ {l.authorTeacher || 'Cô soạn'}</span>}
                {l.teacherNote && <span className="italic">💬 {l.teacherNote}</span>}
                <button
                  type="button"
                  onClick={() => handleToggleFreePractice(l)}
                  className={`h-7 px-2 rounded-lg border font-bold flex items-center gap-1 cursor-pointer ${
                    isFree ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-white border-slate-300 text-slate-600'
                  }`}
                  title="Bật/tắt cho học sinh tự mở bài này ngoài giờ"
                >
                  {isFree ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {isFree ? 'Đang mở tự do · bấm để khoá' : 'Đang khoá · bấm để mở tự do'}
                </button>
              </div>
            </div>
            {l.imageUrl && (
              <img src={l.imageUrl} alt={`Ảnh SGK bài ${l.title}`} className="w-40 h-28 object-contain rounded-lg bg-white border border-slate-200" />
            )}
          </div>
        )}
      </li>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-2.5 md:p-3 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* BẢNG THÔNG BÁO NỔI TOAST: "THÔNG BÁO ĐÃ GHI NHẬN YÊU CẦU THÀNH CÔNG"        */}
      {/* TỰ ĐỘNG MỜ DẦN VÀ BIẾN MẤT SAU ĐÚNG 3 GIÂY                                */}
      {/* ========================================================================= */}
      {showSaveToast && (
        <div
          role="alert"
          aria-live="assertive"
          className={`fixed top-5 sm:top-7 left-1/2 -translate-x-1/2 z-[100] w-[94vw] max-w-lg transition-all duration-300 ease-out transform ${
            isToastFading
              ? 'opacity-0 -translate-y-5 scale-95 pointer-events-none'
              : 'opacity-100 translate-y-0 scale-100'
          }`}
        >
          <div
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-r p-4 sm:p-4.5 text-white shadow-2xl border-2 backdrop-blur-md flex items-center gap-3.5 ${
              saveToastError
                ? 'from-rose-600 via-red-600 to-rose-700 shadow-rose-950/50 border-rose-300'
                : 'from-emerald-600 via-teal-600 to-emerald-700 shadow-emerald-950/50 border-emerald-300'
            }`}
          >
            {/* Hiệu ứng tia sáng phản chiếu nhẹ */}
            <div className="absolute -top-10 -right-10 w-28 h-28 bg-white/15 rounded-full blur-xl pointer-events-none" />

            {/* Icon tích xanh thành công */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/20 border-2 border-white/40 flex items-center justify-center shrink-0 shadow-inner">
              {saveToastError ? (
                <AlertCircle className="w-7 h-7 text-white drop-shadow-md" />
              ) : (
                <CheckCircle2 className="w-7 h-7 text-white drop-shadow-md animate-pulse" />
              )}
            </div>

            {/* Nội dung thông báo IN HOA chuẩn xác theo yêu cầu */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black tracking-wider text-white uppercase drop-shadow-xs">
                  {saveToastError ? 'CHƯA LƯU ĐƯỢC DỮ LIỆU' : 'THÔNG BÁO ĐÃ GHI NHẬN YÊU CẦU THÀNH CÔNG'}
                </h4>
              </div>
              <p className="text-[11px] sm:text-xs text-white/90 font-semibold mt-1 leading-snug">
                {saveToastError || 'Dữ liệu bài soạn đã được lưu lại trực tuyến & đồng bộ hóa toàn diện lên máy chủ đám mây!'}
              </p>
            </div>

            {/* Nút đóng thông báo nếu muốn tắt sớm */}
            <button
              type="button"
              onClick={() => {
                setShowSaveToast(false);
                setIsToastFading(false);
              }}
              className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/15 transition-colors cursor-pointer shrink-0"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Thanh tiến trình đếm ngược đúng 3 giây */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/25 overflow-hidden">
              <div className="h-full bg-amber-300 origin-left animate-toast-countdown" />
            </div>
          </div>
        </div>
      )}

      {/* CỬA SỔ QUẢN TRỊ TỐI ƯU HÓA TỐI ĐA KHÔNG GIAN (MAX-W-[1680PX] H-[98VH]) */}
      <div className="relative w-[99vw] max-w-[1680px] h-[98vh] max-h-[98vh] bg-white border-4 border-emerald-400 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800">
        
        {/* THANH TIÊU ĐỀ GỌN: tên cổng + nút đóng (đăng xuất nằm cuối menu trái) */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0" aria-hidden="true">
              👩‍🏫
            </span>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate">Cổng Giáo Viên</h2>
              <p className="text-xs text-emerald-900 font-semibold truncate">Soạn bài, giao bài và sao lưu bài học Lớp 3 – 4 – 5</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer border border-slate-200 shrink-0"
            title="Đóng Cổng Giáo Viên"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* BODY QUẢN TRỊ                                            */}
        {/* ======================================================== */}
        {!isAuthenticated ? (
          /* Teacher Login Form */
          <div className="flex-1 flex items-center justify-center p-4 sm:p-10 overflow-y-auto">
            <div className="p-6 sm:p-10 rounded-3xl bg-slate-50 border-2 border-emerald-300 text-center w-full max-w-[min(640px,100%)] shadow-lg space-y-5" data-testid="login-card">
              <div className="w-20 h-20 rounded-3xl bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center text-4xl shadow-inner mx-auto">
                🔐
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">Đăng Nhập Quản Trị Giáo Viên</h3>
                <p className="text-sm text-slate-600 mt-1.5">
                  Vui lòng đăng nhập để biên soạn bài học SGK, quản lý chuyên đề thơ văn và phân quyền giao bài
                </p>
              </div>

              {showRecovery ? (
                <AdminPasswordRecovery
                  onBack={() => setShowRecovery(false)}
                  onDone={() => {
                    setShowRecovery(false);
                    setPassword('');
                    setAuthError('');
                    setAuthNotice('Đã cập nhật mật khẩu mới. Hãy đăng nhập bằng mật khẩu mới.');
                  }}
                />
              ) : (
              <form onSubmit={handleLogin} className="space-y-4 text-left">
                {authNotice && (
                  <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl p-2.5" data-testid="auth-notice">
                    {authNotice}
                  </p>
                )}
                <div>
                  <label htmlFor="login-username" className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Tên đăng nhập:
                  </label>
                  {/* Phông kiểu máy chữ: chữ i, I, l, 1 và o, O, 0 khác hẳn nhau, khó gõ nhầm tài khoản */}
                  <input
                    id="login-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập"
                    required
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="login-credential w-full text-xl px-4 py-3.5 rounded-2xl bg-white border-2 border-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Mật khẩu:
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu"
                      required
                      autoComplete="current-password"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="login-credential w-full text-xl pl-4 pr-14 py-3.5 rounded-2xl bg-white border-2 border-slate-300 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2 w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded-xl hover:bg-slate-100"
                      title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu để kiểm tra'}
                      aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Eye className="w-6 h-6 text-slate-500" />
                      )}
                    </button>
                  </div>
                  {authError && (
                    <p className="text-sm text-rose-600 font-bold mt-2">{authError}</p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black text-sm shadow-md transition-all cursor-pointer border-b-2 border-emerald-800 active:border-b-0 active:scale-98"
                  >
                    {authBusy ? 'Đang kiểm tra…' : 'Đăng Nhập Quản Trị'}
                  </button>
                  <button
                    type="button"
                    data-testid="forgot-password"
                    onClick={() => {
                      setAuthError('');
                      setAuthNotice('');
                      setShowRecovery(true);
                    }}
                    className="w-full mt-2 min-h-[36px] text-xs font-bold text-sky-700 hover:underline cursor-pointer"
                  >
                    Quên mật khẩu? Khôi phục bằng mã OTP qua Gmail
                  </button>
                </div>
              </form>
              )}
            </div>
          </div>
        ) : (
          /* KHU LÀM VIỆC: MENU DỌC BÊN TRÁI + NỘI DUNG MỤC ĐANG CHỌN */
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
            <nav
              aria-label="Menu Cổng Giáo Viên"
              className="shrink-0 lg:w-56 flex lg:flex-col gap-1 p-2 lg:p-3 bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-x-auto"
            >
              {[
                { id: 'manage' as const, icon: <BookOpen className="w-5 h-5" />, label: 'Bài học', extra: String(effectiveLessons.length) },
                { id: 'editor' as const, icon: <Edit3 className="w-5 h-5" />, label: editingLessonId ? 'Sửa bài' : 'Soạn bài', extra: '' },
                {
                  id: 'assign' as const,
                  icon: <Send className="w-5 h-5" />,
                  label: 'Giao bài',
                  extra: isAdminRole
                    ? allAssignedLessonIds.size > 0 ? String(allAssignedLessonIds.size) : ''
                    : (() => {
                        const n = Object.values(myAssignments).reduce((t, a) => t + a.lessonIds.length, 0);
                        return n > 0 ? String(n) : '';
                      })(),
                },
                ...(isAdminRole
                  ? [{ id: 'backup' as const, icon: <HardDrive className="w-5 h-5" />, label: 'Sao lưu & đồng bộ', extra: '' }]
                  : []),
                ...(classroomSettings
                  ? [{ id: 'settings' as const, icon: <SlidersHorizontal className="w-5 h-5" />, label: 'Cài đặt lớp học', extra: '' }]
                  : []),
                ...(isAdminRole ? [{ id: 'accounts' as const, icon: <UserCheck className="w-5 h-5" />, label: 'Tài khoản giáo viên', extra: '' }] : []),
                { id: 'password' as const, icon: <KeyRound className="w-5 h-5" />, label: 'Đổi mật khẩu', extra: '' },
              ].map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-teacher-nav={item.id}
                    onClick={() => setActiveTab(item.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`shrink-0 min-h-[44px] px-3 rounded-xl flex items-center gap-2.5 text-sm font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white hover:text-emerald-800'
                    }`}
                  >
                    {item.icon}
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.extra && (
                      <span
                        className={`text-xs font-black px-1.5 rounded-md ${
                          active ? 'bg-white/25 text-white' : item.id === 'assign' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.extra}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="flex-1" />
              {teacherSession && (
                <div className="hidden lg:block px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-600" data-testid="teacher-identity">
                  <span className="font-black text-emerald-700">{teacherSession.code}</span> · {teacherSession.displayName}
                  {teacherSession.mode === 'offline' && <span className="block text-amber-700 font-semibold">Đang mất mạng</span>}
                </div>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-white cursor-pointer whitespace-nowrap text-left"
              >
                Đăng xuất
              </button>
            </nav>

            <div className="flex-1 min-w-0 flex flex-col min-h-0">
            {/* Input file ẩn cho chức năng nạp từ USB */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportLessonsFromUSB}
              accept=".json,application/json"
              className="hidden"
            />

            {/* Thông báo sao lưu USB / đồng bộ Cloud (hiện ở mọi mục) */}
            {offlineSyncMsg && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-blue-50 border border-blue-300 text-blue-950 text-sm font-semibold shrink-0" role="status">
                {offlineSyncMsg}
              </div>
            )}
            {syncAllMsg && (
              <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-sm font-semibold shrink-0" role="status">
                {syncAllMsg}
              </div>
            )}

            {/* ======================================================== */}
            {/* NỘI DUNG CHÍNH CỦA CÁC TAB (SCROLLABLE CONTAINER)        */}
            {/* ======================================================== */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 custom-scrollbar">
              
              {/* ========================================================================= */}
              {/* TAB 1: QUẢN LÝ & TỰ ĐỘNG SẮP XẾP BÀI HỌC THEO PHÂN CẤP (MANAGE TAB)      */}
              {/* ========================================================================= */}
              {activeTab === 'manage' && (
                <div className="space-y-3">
                  {/* Mã để học sinh tìm bài: Chọn bài → "Chọn bài theo mã cô giáo" */}
                  {teacherSession && (
                    <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-sm" data-testid="my-teacher-code">
                      <span className="font-bold text-amber-900">Mã để học sinh tìm bài của {teacherSession.role === 'admin' ? 'quản trị' : 'thầy cô'}:</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-slate-950 font-black tracking-wide">{teacherSession.code}</span>
                      <span className="text-xs text-slate-600 font-semibold">
                        Học sinh bấm <b>Chọn bài</b>, gõ mã này vào ô "Chọn bài theo mã cô giáo" rồi Enter.
                      </span>
                    </div>
                  )}
                  {/* Tiêu đề mục + nút chính duy nhất */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="text-lg font-black text-slate-900">Bài học <span className="text-slate-400 font-bold">({filteredManageLessons.length})</span></h3>
                    <div className="flex items-center gap-2 flex-wrap">
                    {isAdminRole && onRenumberLessons && (
                      <button
                        type="button"
                        data-testid="renumber-lessons"
                        disabled={renumberBusy}
                        title="Ghi số thứ tự bài đang hiển thị (Bài 1, Bài 2…) vào tên bài trên máy chủ, dọn các số cũ bị nhảy cóc"
                        onClick={async () => {
                          setRenumberBusy(true);
                          const r = await onRenumberLessons();
                          setRenumberBusy(false);
                          triggerSaveToast(
                            r.changed === 0
                              ? 'Số thứ tự bài trên máy chủ đã đúng, không cần sửa.'
                              : r.ok
                              ? `Đã đánh lại số cho ${r.changed} bài và lưu lên máy chủ.`
                              : `Đã đánh lại số cho ${r.changed} bài trên máy này nhưng chưa lưu được lên máy chủ. Thầy kiểm tra mạng rồi bấm lại.`
                          );
                        }}
                        className="min-h-[40px] px-4 rounded-full bg-white border-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-sm cursor-pointer disabled:opacity-60"
                      >
                        {renumberBusy ? 'Đang đánh số…' : 'Đánh lại số thứ tự bài'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartCreateNew(false)}
                      className="min-h-[40px] px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Soạn bài mới
                    </button>
                    </div>
                  </div>

                  {/* Bộ lọc (gồm cả Thơ & Văn SGK) · tìm kiếm · sắp xếp */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Lọc bài học">
                      {/* NGUỒN BÀI: giáo viên phụ 2 nút; admin ô chọn theo từng giáo viên */}
                      {isTeacherRole ? (
                        <div className="flex items-center gap-1 mr-1" role="group" aria-label="Nguồn bài">
                          {([
                            { val: 'mine', label: `✍️ Bài soạn của tôi (${myLessonCount})` },
                            { val: 'system', label: `📚 Bài hệ thống (${systemLessonCount})` },
                          ]).map((o) => (
                            <button
                              key={o.val}
                              type="button"
                              onClick={() => setLessonSource(o.val)}
                              aria-pressed={lessonSource === o.val}
                              data-testid={o.val === 'mine' ? 'filter-my-lessons' : 'filter-system-lessons'}
                              className={`h-9 px-3 rounded-full text-sm font-black transition-colors cursor-pointer ${
                                lessonSource === o.val
                                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                                  : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <label className="h-9 flex items-center gap-1.5 pl-3 pr-1 mr-1 rounded-full bg-amber-50 border border-amber-300 text-sm font-black text-amber-900">
                          Nguồn bài:
                          <select
                            value={lessonSource}
                            onChange={(e) => setLessonSource(e.target.value)}
                            data-testid="filter-lesson-source"
                            className="h-7 max-w-[260px] px-2 rounded-full bg-white border border-amber-300 text-sm font-bold text-slate-800 cursor-pointer"
                          >
                            <option value="all">Tất cả ({effectiveLessons.length})</option>
                            <option value="system">Bài hệ thống – quản trị ({systemLessonCount})</option>
                            <option value="teachers">Tất cả giáo viên ({teacherLessonTotal})</option>
                            {teacherDir.map((t) => (
                              <option key={t.code} value={t.code}>
                                {t.code}
                                {t.name ? ` – ${t.name}` : ''} ({t.count} bài)
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {/* LỌC KẾT HỢP: chọn Lớp và Nhóm cùng lúc (vd Lớp 3 + Nhóm Thơ SGK), thêm "Đang giao" nếu cần */}
                      <div className="w-full flex flex-col gap-1.5" data-testid="manage-filters">
                        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Lọc theo lớp" data-testid="manage-subgrade">
                          <span className="w-14 text-xs font-black text-slate-500 uppercase">Lớp</span>
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
                              data-filter-grade={g.val}
                              className={`h-9 px-3.5 rounded-full text-sm font-bold transition-colors cursor-pointer ${
                                subGrade === g.val ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setGradeFilter(gradeFilter === 'assigned' ? 'all' : 'assigned')}
                            aria-pressed={gradeFilter === 'assigned'}
                            data-filter-assigned
                            className={`h-9 px-3.5 rounded-full text-sm font-bold transition-colors cursor-pointer ml-1 ${
                              gradeFilter === 'assigned' ? 'bg-rose-600 text-white' : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                            }`}
                            title="Chỉ hiện bài đang giao cho học sinh (bấm lần nữa để bỏ)"
                          >
                            🎯 Đang giao
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Lọc theo nhóm bài" data-testid="manage-group">
                          <span className="w-14 text-xs font-black text-slate-500 uppercase">Nhóm</span>
                          {([
                            { label: 'Mọi nhóm', val: 'all' as const },
                            { label: '⌨️ ' + LESSON_GROUP_LABEL.exercise, val: 'exercise' as const },
                            { label: '📜 ' + LESSON_GROUP_LABEL.poem, val: 'poem' as const },
                            { label: '📝 ' + LESSON_GROUP_LABEL.prose, val: 'prose' as const },
                          ]).map((g) => (
                            <button
                              key={g.val}
                              type="button"
                              onClick={() => setGroupFilter(g.val)}
                              aria-pressed={groupFilter === g.val}
                              data-filter-group={g.val}
                              className={`h-9 px-3.5 rounded-full text-sm font-bold transition-colors cursor-pointer ${
                                groupFilter === g.val ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {g.label}
                            </button>
                          ))}
                          <span className="text-xs font-bold text-slate-500 ml-1" data-testid="manage-filter-count">
                            → {filteredManageLessons.length} bài
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      <label className="h-9 flex items-center gap-1.5 bg-white px-3 rounded-full border border-slate-300 w-48 sm:w-60">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                          type="search"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          placeholder="Tìm tên hoặc nội dung bài…"
                          aria-label="Tìm bài học"
                          className="w-full text-sm bg-transparent focus:outline-none"
                        />
                      </label>
                      <select
                        value={sortBy}
                        onChange={(e: any) => setSortBy(e.target.value)}
                        aria-label="Sắp xếp"
                        className="h-9 px-3 rounded-full bg-white border border-slate-300 text-sm font-semibold text-slate-700 cursor-pointer"
                      >
                        <option value="hierarchy">Theo lớp 3 → 5</option>
                        <option value="assigned_first">Bài đang giao lên đầu</option>
                        <option value="poems_first">Thơ & văn SGK lên đầu</option>
                        <option value="title_az">Tên bài A → Z</option>
                        <option value="wpm_asc">Tốc độ tăng dần</option>
                      </select>
                    </div>
                  </div>

                  {/* Bảng: đầu cột (màn rộng) + các dòng; "Tất cả" + sắp xếp theo lớp thì chia nhóm */}
                  {bulkEnabled && selectableInView.length > 0 && (
                    <div
                      className={`rounded-2xl border-2 px-3 py-2 flex flex-wrap items-center gap-2 ${
                        bulkSelected.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                      }`}
                      data-testid="bulk-bar"
                    >
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer min-h-[36px]">
                        <input
                          type="checkbox"
                          checked={allInViewSelected}
                          onChange={() =>
                            setBulkSelected(
                              allInViewSelected
                                ? bulkSelected.filter((id) => !selectableInView.some((l) => l.id === id))
                                : Array.from(new Set([...bulkSelected, ...selectableInView.map((l) => l.id)]))
                            )
                          }
                          data-testid="bulk-select-all"
                          className="w-5 h-5 accent-amber-500 cursor-pointer"
                        />
                        Chọn tất cả {selectableInView.length} bài đang lọc
                      </label>
                      {bulkSelected.length > 0 ? (
                        <>
                          <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-sm font-black" data-testid="bulk-count">
                            Đã chọn {bulkSelected.length} bài
                          </span>
                          <button
                            type="button"
                            onClick={() => setBulkSelected([])}
                            className="h-9 px-3 rounded-full text-sm font-bold text-slate-600 hover:bg-white cursor-pointer"
                          >
                            Bỏ chọn
                          </button>
                          <span className="flex items-center gap-1.5 flex-wrap ml-auto">
                            <select
                              value={bulkGrade}
                              onChange={(e) => setBulkGrade(e.target.value as typeof bulkGrade)}
                              aria-label="Chuyển sang lớp"
                              data-testid="bulk-grade"
                              className="h-9 px-3 rounded-full bg-white border border-slate-300 text-sm font-semibold cursor-pointer"
                            >
                              <option value="">Giữ lớp</option>
                              <option value="3">Sang Lớp 3</option>
                              <option value="4">Sang Lớp 4</option>
                              <option value="5">Sang Lớp 5</option>
                            </select>
                            <select
                              value={bulkGroup}
                              onChange={(e) => setBulkGroup(e.target.value as typeof bulkGroup)}
                              aria-label="Chuyển sang nhóm"
                              data-testid="bulk-group"
                              className="h-9 px-3 rounded-full bg-white border border-slate-300 text-sm font-semibold cursor-pointer"
                            >
                              <option value="">Giữ nhóm</option>
                              <option value="exercise">Nhóm Luyện phím</option>
                              <option value="poem">Nhóm Thơ SGK</option>
                              <option value="prose">Nhóm Văn SGK</option>
                            </select>
                            <button
                              type="button"
                              disabled={bulkBusy || (!bulkGrade && !bulkGroup)}
                              onClick={runBulkMove}
                              data-testid="bulk-move"
                              className="h-9 px-4 rounded-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-black cursor-pointer"
                            >
                              Chuyển {bulkSelected.length} bài
                            </button>
                            <button
                              type="button"
                              disabled={bulkBusy}
                              onClick={runBulkDelete}
                              data-testid="bulk-delete"
                              className="h-9 px-4 rounded-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-300 text-white text-sm font-black flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" /> Xoá {bulkSelected.length} bài
                            </button>
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          Tích ô vuông đầu mỗi dòng để xoá, chuyển lớp hoặc chuyển nhóm nhiều bài một lúc.
                        </span>
                      )}
                      {bulkBusy && <span className="text-sm font-bold text-sky-700">Đang xử lý…</span>}
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div
                      className={`hidden xl:grid ${bulkEnabled ? 'grid-cols-[100px_1fr_96px_80px_150px_auto]' : 'grid-cols-[64px_1fr_96px_80px_150px_auto]'} gap-x-3 px-3 py-2 bg-slate-100 text-xs font-black text-slate-600 uppercase tracking-wide`}
                    >
                      <span>{bulkEnabled ? 'Chọn · Lớp' : 'Lớp'}</span>
                      <span>Tên bài · nội dung</span>
                      <span>Loại</span>
                      <span>Tốc độ</span>
                      <span>Trạng thái</span>
                      <span className="text-right pr-1">Thao tác</span>
                    </div>
                    {gradeFilter === 'all' && groupFilter === 'all' && subGrade === 'all' && sortBy === 'hierarchy' && !searchKeyword.trim() ? (
                      groupedManageLessons.map((group) =>
                        !group || group.lessons.length === 0 ? null : (
                          <section key={group.id} aria-label={group.badge}>
                            <h4 className={`px-3 py-1.5 text-xs font-black uppercase tracking-wide border-y border-slate-200 ${group.id === 'group-assigned' ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'}`}>
                              {group.id === 'group-assigned' ? '🎯 Đang giao cho học sinh' : group.badge} · {group.lessons.length} bài
                            </h4>
                            <ul>{group.lessons.slice(0, visibleLimit).map((lesson) => renderLessonRow(lesson))}</ul>
                            {group.lessons.length > visibleLimit && (
                              <button
                                type="button"
                                onClick={() => setVisibleLimit((n) => n + 20)}
                                className="w-full py-2 text-sm font-bold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 border-t border-slate-100 cursor-pointer"
                              >
                                Xem thêm 20 bài (còn {group.lessons.length - visibleLimit} bài)
                              </button>
                            )}
                          </section>
                        )
                      )
                    ) : filteredManageLessons.length > 0 ? (
                      <>
                        <ul>{filteredManageLessons.slice(0, visibleLimit).map((lesson) => renderLessonRow(lesson))}</ul>
                        {filteredManageLessons.length > visibleLimit && (
                          <button
                            type="button"
                            onClick={() => setVisibleLimit((n) => n + 20)}
                            data-testid="manage-load-more"
                            className="w-full py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 border-t border-slate-100 cursor-pointer"
                          >
                            Xem thêm 20 bài (đang hiện {visibleLimit}/{filteredManageLessons.length})
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="p-6 text-center text-sm text-slate-500">Không có bài nào khớp bộ lọc hoặc từ khoá.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================================= */}
              {/* TAB 3: SOẠN THẢO BÀI MỚI & PHÂN TÍCH ẢNH SGK BẰNG AI                     */}
              {/* ========================================================================= */}
              {activeTab === 'editor' && (
                <form onSubmit={handleSaveLessonSubmit} className="space-y-4">
                  {/* Status Banner & Detailed Saved Record Card */}
                  {lastSavedLesson && (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 flex flex-col gap-2.5 shadow-md animate-in fade-in">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <span className="font-black text-sm text-emerald-900">
                            🎉 Bài của Thầy/Cô đã được lưu trữ thành công lên hệ thống Server!
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-xs">
                            ✓ Đã Lưu Trực Tuyến
                          </span>
                          <button
                            type="button"
                            onClick={() => setLastSavedLesson(null)}
                            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                            title="Ẩn thông báo này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white/95 p-3 rounded-xl border border-emerald-300 shadow-2xs">
                        <div>
                          <span className="text-slate-500 block text-[10px] font-black">TÊN BÀI HỌC:</span>
                          <strong className="text-slate-900 truncate block text-xs">{lastSavedLesson.title}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-black">KHỐI LỚP:</span>
                          <strong className="text-indigo-700 text-xs">Khối Lớp {lastSavedLesson.gradeLevel}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-black">GIÁO VIÊN BIÊN SOẠN:</span>
                          <strong className="text-emerald-800 text-xs">{lastSavedLesson.authorTeacher}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10px] font-black">MỤC TIÊU &amp; ĐỘ DÀI:</span>
                          <strong className="text-amber-800 text-xs">
                            {lastSavedLesson.targetWpm || 18} WPM ({lastSavedLesson.text?.length || 0} ký tự)
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <p className="text-[11px] text-emerald-900 font-medium flex items-center gap-1.5">
                          <span>📁</span>
                          <span>Đã lưu vào bộ nhớ phần mềm &amp; Supabase Cloud! Học sinh có thể thấy ngay trên giao diện luyện tập.</span>
                        </p>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectLesson(lastSavedLesson);
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Luyện Gõ Bài Này Ngay ➜</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartCreateNew(false)}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 transition-all cursor-pointer"
                          >
                            + Soạn Bài Khác
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {saveSuccessMsg && !lastSavedLesson && (
                    <div className="p-3 rounded-2xl bg-emerald-100 border-2 border-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>{saveSuccessMsg}</span>
                    </div>
                  )}

                  {/* Header info */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                        ✏️
                      </span>
                      <h3 className="font-black text-sm text-slate-900">
                        {editingLessonId ? `Đang chỉnh sửa bài: "${title || editingLessonId}"` : 'Soạn bài luyện gõ mới'}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartCreateNew(true)}
                        className="text-xs text-purple-700 hover:underline font-black cursor-pointer flex items-center gap-1"
                      >
                        <Feather className="w-3 h-3" />
                        <span>+ Soạn Bài Thơ / Văn SGK</span>
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => handleStartCreateNew(false)}
                        className="text-xs text-sky-700 hover:underline font-bold cursor-pointer"
                      >
                        + Soạn bài luyện phím mới
                      </button>
                    </div>
                  </div>

                  {/* VÙNG 1: TẢI ẢNH SGK & PHÂN TÍCH TRÍCH XUẤT CHỮ BẰNG AI */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-indigo-50/40 to-emerald-50 border-2 border-sky-300 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📸</span>
                        <div>
                          <span className="font-black text-slate-900 text-xs sm:text-sm block">
                            Hình Ảnh Bài Gõ Sách Giáo Khoa (SGK)
                          </span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            Tải lên ảnh chụp trang sách hoặc tranh minh họa bài thơ/văn, sau đó bấm nút phân tích AI để tự động lấy văn bản
                          </span>
                        </div>
                      </div>

                      {imageUrl && (
                        <button
                          type="button"
                          disabled={isAnalyzingImage}
                          onClick={() => void handleAnalyzeImageWithAI()}
                          className={`
                            px-4 py-2 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer border-b-2 active:border-b-0
                            ${
                              isAnalyzingImage
                                ? 'bg-indigo-400 text-white cursor-not-allowed opacity-80'
                                : 'bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white border-indigo-900 hover:scale-102 ring-2 ring-indigo-200'
                            }
                          `}
                          title="Bấm để AI đọc trang sách và tự động trích xuất nội dung văn bản"
                        >
                          {isAnalyzingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>AI Đang Phân Tích Ảnh...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                              <span>✨ Phân Tích Hình Ảnh (Lấy Văn Bản AI)</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Image Preview & Upload Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      <div className="sm:col-span-8 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <label className={`flex-1 py-2 px-3 rounded-xl border-2 border-dashed text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs transition-colors ${
                            isCompressingImage
                              ? 'bg-amber-50 border-amber-400 text-amber-800'
                              : 'bg-white hover:bg-sky-50 border-sky-400 text-sky-800'
                          }`}>
                            {isCompressingImage ? (
                              <>
                                <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                                <span>Đang nén &amp; tối ưu hóa ảnh...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 text-sky-600" />
                                <span>Tải ảnh từ máy tính / điện thoại...</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              disabled={isCompressingImage}
                              onChange={handleImageFileChange}
                              className="sr-only"
                            />
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          {imageUrl.startsWith('data:') ? (
                            // Ảnh tải từ máy là chuỗi base64 rất dài: chỉ báo ngắn gọn thay vì hiện cả chuỗi
                            <span className="flex-1 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                              ✓ Đã tải ảnh từ máy ({Math.round((imageUrl.length * 3) / 4 / 1024)} KB)
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={imageUrl}
                              onChange={(e) => setImageUrl(e.target.value)}
                              placeholder="Hoặc dán đường dẫn (URL) ảnh SGK vào đây..."
                              className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs focus:outline-none focus:border-sky-500"
                            />
                          )}
                          {imageUrl && (
                            <button
                              type="button"
                              onClick={() => setImageUrl('')}
                              className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer border border-rose-200"
                            >
                              Xóa ảnh
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Image Thumbnail preview */}
                      <div className="sm:col-span-4 flex items-center justify-center">
                        {imageUrl ? (
                          <div className="relative group rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm max-h-28 bg-white">
                            <img
                              src={imageUrl}
                              alt="Ảnh SGK"
                              className="w-full h-24 object-contain bg-slate-50"
                            />
                            {/* Lớp phủ không nhận chuột (pointer-events-none) để chuột phải trúng ẢNH:
                                Chrome mới hiện mục "Tìm kiếm hình ảnh bằng Google Ống kính" */}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/60 text-[10px] text-white font-bold text-center py-0.5">
                              Chuột phải vào ảnh
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white/70 flex flex-col items-center justify-center text-slate-400 text-[11px] font-bold">
                            <ImageIcon className="w-6 h-6 mb-1 text-slate-300" />
                            <span>Chưa có ảnh</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* HỘP NHẬP KHOÁ GEMINI: chỉ hiện khi bấm Phân tích mà máy chủ và cô đều chưa có khoá */}
                    {showKeyDialog && (
                      <div data-testid="gemini-key-dialog" className="p-3 rounded-xl bg-white border-2 border-indigo-300 space-y-2">
                        <p className="text-sm font-black text-indigo-900">🔑 Nhập khoá Gemini để AI đọc chữ trong ảnh</p>
                        <ol className="text-xs text-slate-700 list-decimal pl-5 space-y-0.5">
                          <li>Bấm <strong>Mở trang lấy khoá</strong>, đăng nhập Gmail, chọn <em>Create API key</em> (miễn phí).</li>
                          <li>Bấm biểu tượng sao chép khoá, quay lại đây dán vào ô bên dưới.</li>
                        </ol>
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={GEMINI_KEY_PAGE}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-10 px-3 rounded-full bg-indigo-50 border border-indigo-300 text-indigo-800 text-sm font-bold flex items-center"
                          >
                            Mở trang lấy khoá ↗
                          </a>
                          <input
                            type="password"
                            value={keyDraft}
                            onChange={(e) => {
                              setKeyDraft(e.target.value);
                              setKeyDialogError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSubmitKey();
                              }
                            }}
                            placeholder="Dán khoá (AIza… hoặc AQ.…) vào đây"
                            aria-label="Khoá Gemini"
                            autoComplete="off"
                            autoFocus
                            className="flex-1 min-w-[220px] h-10 px-3 rounded-xl border-2 border-slate-300 text-sm focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={handleSubmitKey}
                            className="h-10 px-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer"
                          >
                            Lưu &amp; phân tích
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowKeyDialog(false)}
                            className="h-10 px-3 rounded-full text-slate-600 hover:bg-slate-100 text-sm font-semibold cursor-pointer"
                          >
                            Huỷ
                          </button>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                          <input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} className="w-4 h-4" />
                          Nhớ khoá trên máy này (bỏ chọn nếu là máy dùng chung với học sinh)
                        </label>
                        {keyDialogError && <p className="text-xs font-bold text-rose-700">{keyDialogError}</p>}
                      </div>
                    )}

                    {geminiKey && aiReady !== true && !showKeyDialog && (
                      <p className="text-xs text-slate-600">
                        🔑 Đang dùng khoá Gemini cô đã nhập.{' '}
                        <button type="button" onClick={forgetGeminiKey} className="font-bold text-rose-700 hover:underline cursor-pointer">
                          Xoá khoá khỏi máy này
                        </button>
                      </p>
                    )}

                    {/* CÁCH KHÔNG CẦN KHOÁ: Google Ống kính của Chrome */}
                    {imageUrl && (
                      <div data-testid="lens-helper" className="p-2.5 rounded-xl bg-white/80 border border-slate-200 text-xs text-slate-700 flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-800">Không cần khoá:</span>
                        <span>chuột phải vào ảnh → <em>Tìm kiếm hình ảnh bằng Google Ống kính</em> → <em>Văn bản</em> → <em>Sao chép</em>, rồi bấm</span>
                        <button
                          type="button"
                          onClick={() => void handlePasteText()}
                          className="h-8 px-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                        >
                          Dán văn bản đã chép
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenImageInNewTab()}
                          className="h-8 px-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                          title="Mở ảnh to bằng trình duyệt (Chrome/Edge) để chuột phải dùng Google Ống kính"
                        >
                          Mở ảnh to ở thẻ trình duyệt
                        </button>
                        {pasteHint && <span className="w-full font-semibold text-emerald-800">{pasteHint}</span>}
                      </div>
                    )}

                    {/* OCR Message feedback */}
                    {ocrSuccessMsg && (
                      <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{ocrSuccessMsg}</span>
                      </div>
                    )}

                    {ocrErrorMsg && (
                      <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{ocrErrorMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* VÙNG 2: THÔNG TIN BÀI HỌC, CHUYÊN ĐỀ & PHÂN QUYỀN LUYỆN TẬP */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Tên bài học / bài thơ: <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-stretch gap-1.5">
                        {/* Số bài do hệ thống tự đánh theo khối lớp: không sửa tay */}
                        <span
                          data-testid="lesson-number-preview"
                          title="Hệ thống tự đánh số bài theo khối lớp: thêm bài thì cộng 1, xoá bài thì các bài sau tự lùi số"
                          className="shrink-0 px-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-black flex items-center whitespace-nowrap"
                        >
                          Bài {lessonNumberPreview}:
                        </span>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ví dụ: Thơ Mèo Con Đi Học, Quê Hương, Hạt Gạo Làng Ta..."
                          className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 font-semibold mt-1">Số bài do hệ thống tự đánh theo khối lớp, thầy cô chỉ gõ tên bài.</p>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Khối Lớp:
                      </label>
                      <select
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value={3}>Lớp 3</option>
                        <option value={4}>Lớp 4</option>
                        <option value={5}>Lớp 5</option>
                      </select>
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Nhóm bài:
                      </label>
                      <select
                        value={genre}
                        onChange={(e: any) => {
                          const val = e.target.value;
                          setGenre(val);
                          setIsPoemOrStory(val === 'poem' || val === 'prose');
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="exercise">⌨️ Nhóm Luyện phím</option>
                        <option value="poem">📜 Nhóm Thơ SGK (xuống dòng Enter)</option>
                        <option value="prose">📝 Nhóm Văn SGK (đoạn văn liền mạch)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Tốc độ WPM:
                      </label>
                      <select
                        value={targetWpm}
                        onChange={(e) => setTargetWpm(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-black focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value={10}>10 WPM (Cơ bản)</option>
                        <option value={14}>14 WPM</option>
                        <option value={18}>18 WPM (Chuẩn)</option>
                        <option value={22}>22 WPM</option>
                        <option value={26}>26 WPM (Nâng cao)</option>
                      </select>
                    </div>
                  </div>

                  {/* PHÂN QUYỀN TỰ DO LUYỆN TẬP NGOÀI GIỜ */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔓</span>
                      <div>
                        <span className="text-xs font-black text-slate-800 block">
                          Chế độ cho học sinh tự do lựa chọn luyện gõ ngoài giờ:
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Khi bật, học sinh bất kỳ khối lớp nào cũng có thể tự do mở bài này để luyện tập giải trí
                        </span>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isFreePractice}
                        onChange={(e) => setIsFreePractice(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-black text-emerald-800">
                        {isFreePractice ? '✓ Mở tự do cho học sinh' : 'Chỉ mở khi giáo viên giao bài'}
                      </span>
                    </label>
                  </div>

                  {/* VÙNG 3: NỘI DUNG VĂN BẢN BÀI GÕ (TEXTAREA CHỈNH SỬA) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                        Nội dung bài luyện gõ: <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">
                        {text.length} ký tự • {text.trim() ? text.trim().split(/\s+/).length : 0} từ
                      </span>
                    </div>

                    <textarea
                      ref={contentTextareaRef}
                      rows={7}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder="Nhập hoặc chỉnh sửa văn bản tiếng Việt có dấu. Giữ nguyên định dạng xuống dòng của từng câu thơ..."
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-slate-300 text-slate-900 text-sm font-sgk-text font-semibold leading-relaxed tracking-wide focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      💡 Mẹo: Khi trích xuất từ ảnh AI, cô có thể trực tiếp sửa lại các từ ngữ, dấu câu trong ô này trước khi lưu.
                    </p>
                  </div>

                  {/* Lời dặn dò */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-8">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Lời dặn dò của Thầy/Cô gửi tới học sinh:
                      </label>
                      <input
                        type="text"
                        value={teacherNote}
                        onChange={(e) => setTeacherNote(e.target.value)}
                        placeholder="Ví dụ: Các con giữ phím Shift để viết hoa và nhớ bấm Enter xuống dòng nhé!"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-medium focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1">
                        Tên Thầy / Cô:
                      </label>
                      <input
                        type="text"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                        placeholder={DEFAULT_TEACHER_NAME}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('manage')}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Quay lại danh sách
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingLesson}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg border-b-2 border-emerald-800 active:border-b-0 cursor-pointer active:scale-95 transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                    >
                      {isSavingLesson ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Đang Lưu Trực Tuyến...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Lưu Lại Trực Tuyến &amp; Cập Nhật Hệ Thống</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ========================================================================= */}
              {/* TAB 4: GIAO 1 HOẶC NHIỀU BÀI TẬP CÙNG LÚC CHO KHỐI LỚP (ASSIGN TAB)       */}
              {/* ========================================================================= */}
              {activeTab === 'assign' && !!teacherSession && (() => {
                // Danh sách bài để chọn: lọc theo khối, nguồn bài, mục và từ khoá; xếp theo lớp rồi số bài
                const kw = assignSearchKeyword.trim().toLowerCase();
                const pickList = effectiveLessons
                  .filter((l) => {
                    if (!l) return false;
                    if (isTeacherRole) {
                      if (!isMyLesson(l) && !isSystemLesson(l)) return false;
                      if (assignSource === 'mine' && !isMyLesson(l)) return false;
                    }
                    if (assignGradeFilter !== 'all' && l.gradeLevel !== assignGradeFilter) return false;
                    if (assignSource === 'system' && !isSystemLesson(l)) return false;
                    if (assignSource === 'teachers' && isSystemLesson(l)) return false;
                    if (!['all', 'system', 'teachers', 'mine'].includes(assignSource) && lessonOwnerKey(l) !== assignSource) return false;
                    const isPoem = !!l.isPoemOrStory || l.category === 'poems_stories';
                    if (assignCategory !== 'all' && lessonGroupOf(l) !== assignCategory) return false;
                    if (kw && !(l.title || '').toLowerCase().includes(kw) && !(l.text || '').toLowerCase().includes(kw)) return false;
                    return true;
                  })
                  .sort((a, b) => {
                    const g = (a.gradeLevel || 0) - (b.gradeLevel || 0);
                    if (g) return g;
                    const o = (isSystemLesson(a) ? '' : lessonOwnerKey(a)).localeCompare(isSystemLesson(b) ? '' : lessonOwnerKey(b), undefined, { numeric: true });
                    if (o) return o;
                    const rk = lessonGroupRank(a) - lessonGroupRank(b);
                    if (rk) return rk;
                    return (displayedLessonNumber(a) ?? 9999) - (displayedLessonNumber(b) ?? 9999);
                  });
                const chosen = validSelectedLessonIds
                  .map((id) => effectiveLessons.find((l) => l.id === id))
                  .filter((l): l is Lesson => !!l);
                const move = (idx: number, dir: -1 | 1) => {
                  const ids = [...validSelectedLessonIds];
                  const j = idx + dir;
                  if (j < 0 || j >= ids.length) return;
                  [ids[idx], ids[j]] = [ids[j], ids[idx]];
                  setSelectedLessonIdsForAssign(ids);
                };
                const ownerBadge = (l: Lesson) =>
                  isSystemLesson(l) ? (
                    <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">Hệ thống</span>
                  ) : (
                    <span className="text-[11px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900">{lessonOwnerKey(l)}</span>
                  );
                return (
                  <form onSubmit={handleAssignSubmit} className="space-y-4 py-1" data-testid="assign-panel">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">🎯 Giao bài cho khối lớp</h3>
                        <p className="text-sm text-slate-600">
                          {isTeacherRole ? (
                            <>
                              Bài giao theo mã <b>{teacherSession?.code}</b>: học sinh bấm <b>Chọn bài</b>, gõ mã <b>{teacherSession?.code}</b> sẽ thấy mục
                              "Bài cô giao" riêng của thầy cô (không lẫn với bài quản trị giao).
                            </>
                          ) : (
                            <>
                              Chọn khối lớp, tích chọn các bài ở bên trái, sắp thứ tự ở bên phải rồi bấm <b>Giao bài</b>. Học sinh khối đó thấy ngay ở nút
                              "Bài cô giáo giao".
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Thông báo nổi ở đáy màn hình: hiện/ẩn không làm cả màn dịch lên xuống (tránh bấm nhầm) */}
                    {assignmentSuccessMsg && (
                      <div
                        role="status"
                        data-testid="assign-success"
                        className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[70] max-w-[min(720px,92vw)] p-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 shadow-2xl"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
                        <span>{assignmentSuccessMsg}</span>
                      </div>
                    )}

                    {/* 1. Khối lớp */}
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Chọn khối lớp">
                      {[3, 4, 5].map((g) => {
                        const isSel = selectedGradeForAssign === g;
                        const n = isTeacherRole
                          ? myAssignments[g]?.lessonIds.length || 0
                          : Array.isArray(safeAssignments[g]?.lessonIds)
                          ? safeAssignments[g].lessonIds.length
                          : safeAssignments[g]?.lessonId
                          ? 1
                          : 0;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleSelectGradeForAssign(g)}
                            aria-pressed={isSel}
                            className={`min-h-[56px] px-3 rounded-2xl border-2 cursor-pointer transition-colors flex flex-col items-center justify-center ${
                              isSel ? 'bg-emerald-600 border-emerald-700 text-white shadow-md' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-base font-black">Khối Lớp {g}</span>
                            <span className={`text-xs font-bold ${isSel ? 'text-emerald-50' : 'text-slate-500'}`}>
                              {n > 0 ? `Đang giao ${n} bài` : 'Chưa giao bài'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
                      {/* 2. Chọn bài */}
                      <section className="rounded-2xl border-2 border-slate-200 bg-white overflow-hidden" aria-label="Chọn bài để giao">
                        <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-slate-800">Chọn bài ({pickList.length} bài)</h4>
                            <button
                              type="button"
                              onClick={handleSelectAllForGrade}
                              className="text-xs font-bold px-2.5 py-1 rounded-full bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              Chọn toàn bộ Lớp {selectedGradeForAssign}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={assignGradeFilter}
                              onChange={(e) => setAssignGradeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                              aria-label="Lọc theo lớp"
                              className="h-9 px-2 rounded-xl bg-white border border-slate-300 text-sm font-bold cursor-pointer"
                            >
                              <option value="all">Mọi lớp</option>
                              <option value={3}>Lớp 3</option>
                              <option value={4}>Lớp 4</option>
                              <option value={5}>Lớp 5</option>
                            </select>
                            <select
                              value={assignSource}
                              onChange={(e) => setAssignSource(e.target.value)}
                              aria-label="Nguồn bài"
                              data-testid="assign-source"
                              className="h-9 max-w-[220px] px-2 rounded-xl bg-white border border-slate-300 text-sm font-bold cursor-pointer"
                            >
                              {isTeacherRole ? (
                                <>
                                  <option value="all">Bài của tôi + bài hệ thống</option>
                                  <option value="mine">Bài của tôi</option>
                                  <option value="system">Bài hệ thống</option>
                                </>
                              ) : (
                                <>
                                  <option value="all">Mọi nguồn bài</option>
                                  <option value="system">Bài hệ thống</option>
                                  <option value="teachers">Bài của giáo viên</option>
                                </>
                              )}
                              {!isTeacherRole && teacherDir.map((t) => (
                                <option key={t.code} value={t.code}>
                                  {t.code}
                                  {t.name ? ` – ${t.name}` : ''} ({t.count})
                                </option>
                              ))}
                            </select>
                            <select
                              value={assignCategory}
                              onChange={(e) => setAssignCategory(e.target.value as 'all' | LessonGroup)}
                              aria-label="Nhóm bài"
                              data-testid="assign-group"
                              className="h-9 px-2 rounded-xl bg-white border border-slate-300 text-sm font-bold cursor-pointer"
                            >
                              <option value="all">Mọi nhóm</option>
                              <option value="exercise">{LESSON_GROUP_LABEL.exercise}</option>
                              <option value="poem">{LESSON_GROUP_LABEL.poem}</option>
                              <option value="prose">{LESSON_GROUP_LABEL.prose}</option>
                            </select>
                            <label className="h-9 flex-1 min-w-[160px] flex items-center gap-1.5 bg-white px-3 rounded-xl border border-slate-300">
                              <Search className="w-4 h-4 text-slate-400 shrink-0" />
                              <input
                                type="search"
                                value={assignSearchKeyword}
                                onChange={(e) => setAssignSearchKeyword(e.target.value)}
                                placeholder="Tìm tên bài…"
                                aria-label="Tìm bài"
                                className="w-full text-sm bg-transparent focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>
                        <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar" data-testid="assign-pick-list">
                          {pickList.length === 0 && (
                            <li className="p-6 text-center text-sm text-slate-500">Không có bài nào khớp bộ lọc.</li>
                          )}
                          {pickList.slice(0, assignLimit).map((l) => {
                            const order = validSelectedLessonIds.indexOf(l.id);
                            const isChecked = order >= 0;
                            const isPoem = !!l.isPoemOrStory || l.category === 'poems_stories';
                            return (
                              <li key={`assign-pick-${l.id}`}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleLessonSelection(l.id)}
                                  aria-pressed={isChecked}
                                  className={`w-full text-left px-3 py-2.5 flex items-center gap-3 cursor-pointer transition-colors ${
                                    isChecked ? 'bg-emerald-50' : 'hover:bg-slate-50'
                                  }`}
                                >
                                  <span
                                    className={`w-7 h-7 rounded-lg border-2 shrink-0 flex items-center justify-center text-sm font-black ${
                                      isChecked ? 'bg-emerald-600 border-emerald-700 text-white' : 'bg-white border-slate-300 text-transparent'
                                    }`}
                                  >
                                    {isChecked ? order + 1 : ''}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-slate-900 truncate">{l.title}</span>
                                    <span className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800">Lớp {l.gradeLevel || '?'}</span>
                                      {ownerBadge(l)}
                                      {groupChip(l)}
                                      <span className="text-[11px] font-semibold text-slate-500">{l.targetWpm || 18} WPM</span>
                                      {l.imageUrl && <span className="text-[11px] font-semibold text-slate-500">· có ảnh SGK</span>}
                                    </span>
                                  </span>
                                  <span className={`shrink-0 text-xs font-black px-2.5 py-1 rounded-full ${isChecked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                    {isChecked ? 'Đã chọn' : '+ Chọn'}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                          {pickList.length > assignLimit && (
                            <li>
                              <button
                                type="button"
                                onClick={() => setAssignLimit((n) => n + 30)}
                                className="w-full py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                              >
                                Xem thêm 30 bài (còn {pickList.length - assignLimit} bài)
                              </button>
                            </li>
                          )}
                        </ul>
                      </section>

                      {/* 3. Bài sẽ giao + lời dặn + nút giao */}
                      <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-3 space-y-3 lg:sticky lg:top-2" aria-label="Bài sẽ giao">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-black text-emerald-900">
                            Bài sẽ giao cho Lớp {selectedGradeForAssign} ({chosen.length})
                          </h4>
                          {chosen.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setSelectedLessonIdsForAssign([])}
                              className="text-xs font-bold px-2 py-1 rounded-full text-rose-700 hover:bg-rose-50 cursor-pointer"
                            >
                              Bỏ chọn hết
                            </button>
                          )}
                        </div>
                        {chosen.length === 0 ? (
                          <p className="text-sm text-slate-600 bg-white rounded-xl border border-dashed border-emerald-300 p-3">
                            Chưa chọn bài nào. Bấm vào bài ở danh sách bên trái để thêm.
                          </p>
                        ) : (
                          <ol className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar" data-testid="assign-chosen-list">
                            {chosen.map((l, idx) => (
                              <li key={`chosen-${l.id}`} className="flex items-center gap-2 bg-white rounded-xl border border-emerald-200 px-2 py-1.5">
                                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">{idx + 1}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-bold text-slate-900 truncate">{l.title}</span>
                                  <span className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500 font-semibold">
                                    {groupChip(l)}
                                    <span>Lớp {l.gradeLevel || '?'} · {isSystemLesson(l) ? 'Hệ thống' : lessonOwnerKey(l)}</span>
                                  </span>
                                </span>
                                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} title="Lên trên" className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">▲</button>
                                <button type="button" onClick={() => move(idx, 1)} disabled={idx === chosen.length - 1} title="Xuống dưới" className="w-7 h-7 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer">▼</button>
                                <button type="button" onClick={() => handleToggleLessonSelection(l.id)} title="Bỏ bài này" className="w-7 h-7 rounded-lg text-rose-600 hover:bg-rose-50 font-black cursor-pointer">×</button>
                              </li>
                            ))}
                          </ol>
                        )}
                        <div>
                          <label className="block text-xs font-black text-slate-700 mb-1">Lời dặn gửi các con</label>
                          <textarea
                            rows={3}
                            value={assignNote}
                            onChange={(e) => setAssignNote(e.target.value)}
                            placeholder="Ví dụ: Tuần này các con hoàn thành các bài này trước tiết Tin học nhé!"
                            className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={chosen.length === 0}
                          data-testid="assign-submit"
                          className="w-full min-h-[48px] px-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send className="w-4 h-4" />
                          Giao {chosen.length} bài cho Lớp {selectedGradeForAssign}
                        </button>
                      </section>
                    </div>
                  </form>
                );
              })()}

              {activeTab === 'settings' && classroomSettings && (
                <div className="space-y-3 max-w-4xl" data-testid="classroom-settings">
                  <h3 className="text-lg font-black text-slate-900">Cài đặt lớp học</h3>
                  <p className="text-sm text-slate-600 font-semibold">Áp dụng ngay cho máy đang dùng.</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {/* Bật/tắt nhanh */}
                    {[
                      {
                        key: 'hands',
                        title: '✋ Bàn tay hướng dẫn gõ',
                        desc: 'Hiện bàn tay ảo chỉ ngón cần gõ (dùng được cho mọi kiểu bàn phím).',
                        on: classroomSettings.handsVisible,
                        onClick: classroomSettings.onToggleHands,
                      },
                      ...(classroomSettings.onToggleStartGate
                        ? [
                            {
                              key: 'startGate',
                              title: '⏱ Màn chờ "BẮT ĐẦU GÕ"',
                              desc: 'Bật: chọn bài xong hiện nút BẮT ĐẦU GÕ và đếm 3-2-1. Tắt (mặc định): vào bài là tính giờ ngay.',
                              on: !!classroomSettings.startGateEnabled,
                              onClick: classroomSettings.onToggleStartGate,
                            },
                          ]
                        : []),
                      {
                        key: 'textbook',
                        title: '📖 Cột Sách giáo khoa',
                        desc: 'Hiện ảnh trang sách giáo khoa bên phải màn hình luyện gõ.',
                        on: classroomSettings.isTextbookVisible,
                        onClick: classroomSettings.onToggleTextbook,
                      },
                    ].map((c) => (
                      <div key={c.key} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-black text-base text-slate-900">{c.title}</h4>
                          <p className="text-sm text-slate-600">{c.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={c.onClick}
                          data-setting-toggle={c.key}
                          aria-pressed={c.on}
                          className={`shrink-0 min-h-[44px] min-w-[84px] px-4 rounded-full text-sm font-black border-2 cursor-pointer ${
                            c.on ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          {c.on ? 'Đang bật' : 'Đang tắt'}
                        </button>
                      </div>
                    ))}

                    {/* Tiếng gõ phím */}
                    <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-slate-900">🔊 Tiếng gõ phím</h4>
                        <p className="text-sm text-slate-600">Âm thanh phát ra mỗi lần học sinh gõ phím.</p>
                      </div>
                      <div className="shrink-0 grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-full" role="group" aria-label="Tiếng gõ phím">
                        {(['mechanical', 'bubble'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={classroomSettings.soundType === t}
                            onClick={() => classroomSettings.onSetSoundType(t)}
                            className={`min-h-[40px] px-3 rounded-full text-sm font-black cursor-pointer ${
                              classroomSettings.soundType === t ? 'bg-sky-500 text-white' : 'text-slate-600'
                            }`}
                          >
                            {t === 'mechanical' ? 'Phím cơ' : 'Bong bóng'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Các công cụ mở hộp riêng */}
                    {[
                      { key: 'custom', title: '✍️ Tự soạn bài riêng', desc: 'Dán đoạn văn bất kỳ để học sinh luyện gõ ngay, không cần lưu vào danh sách bài.', btn: 'Mở', onClick: classroomSettings.onOpenCustomText },
                      { key: 'fit', title: '🤖 Căn vừa màn hình', desc: 'Tự đo màn hình và chỉnh cỡ bàn phím, chữ cho vừa máy đang dùng.', btn: 'Căn ngay', onClick: classroomSettings.onOpenAutoFit },
                      { key: 'unikey', title: '📢 Nhắc học sinh tắt Unikey', desc: 'Hiện lại thông báo “tắt Unikey hoặc chuyển V sang E” cho cả lớp.', btn: 'Hiện nhắc', onClick: classroomSettings.onOpenUnikeyNotice },
                    ].map((c) => (
                      <div key={c.key} className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-black text-base text-slate-900">{c.title}</h4>
                          <p className="text-sm text-slate-600">{c.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={c.onClick}
                          data-setting-action={c.key}
                          className="shrink-0 min-h-[44px] px-4 rounded-full bg-sky-600 hover:bg-sky-500 text-white text-sm font-black cursor-pointer"
                        >
                          {c.btn}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'accounts' && isAdminRole && <TeacherAccountsPanel offline={teacherSession?.mode === 'offline'} />}

              {activeTab === 'password' && teacherSession && <ChangeOwnPasswordPanel session={teacherSession} />}

              {activeTab === 'backup' && isAdminRole && (
                <div className="space-y-3 max-w-4xl">
                  <h3 className="text-lg font-black text-slate-900">Sao lưu &amp; đồng bộ</h3>
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        key: 'export',
                        icon: <Download className="w-6 h-6 text-blue-600" />,
                        title: 'Xuất file ra USB',
                        desc: `Lưu ${effectiveLessons.length} bài học và bài đang giao thành một file .json để chép sang máy học sinh không có mạng.`,
                        btn: 'Tải file sao lưu',
                        onClick: handleExportLessonsToUSB,
                        cls: 'bg-blue-600 hover:bg-blue-500',
                      },
                      {
                        key: 'import',
                        icon: <HardDrive className="w-6 h-6 text-violet-600" />,
                        title: 'Nạp từ USB',
                        desc: 'Chọn file .json đã xuất để đưa bài học vào máy này. Bài lỗi hoặc trùng mã sẽ tự bỏ qua.',
                        btn: 'Chọn file để nạp',
                        onClick: () => fileInputRef.current?.click(),
                        cls: 'bg-violet-600 hover:bg-violet-500',
                      },
                      {
                        key: 'cloud',
                        icon: <Upload className="w-6 h-6 text-emerald-600" />,
                        title: 'Đồng bộ lên Cloud',
                        desc: 'Đưa toàn bộ bài học và ảnh SGK lên Supabase để các máy có mạng cùng nhận bài mới nhất.',
                        btn: isSyncingAllToSupabase ? 'Đang đồng bộ…' : 'Đồng bộ ngay',
                        onClick: handleSyncAllToSupabase,
                        cls: 'bg-emerald-600 hover:bg-emerald-500',
                      },
                    ].map((c) => (
                      <div key={c.key} data-backup-card={c.key} className="p-4 rounded-2xl border border-slate-200 bg-white flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {c.icon}
                          <h4 className="font-black text-base text-slate-900">{c.title}</h4>
                        </div>
                        <p className="text-sm text-slate-600 flex-1">{c.desc}</p>
                        <button
                          type="button"
                          onClick={c.onClick}
                          disabled={c.key === 'cloud' && isSyncingAllToSupabase}
                          className={`min-h-[44px] px-4 rounded-full text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${c.cls}`}
                        >
                          {c.key === 'cloud' && isSyncingAllToSupabase && <Loader2 className="w-4 h-4 animate-spin" />}
                          {c.btn}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
