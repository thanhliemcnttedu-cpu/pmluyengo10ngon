// ============================================================================
// TỰ ĐÁNH SỐ BÀI THEO TỪNG BỘ BÀI VÀ KHỐI LỚP
// Mỗi bộ bài đánh số riêng: bài hệ thống (quản trị) Lớp 3 là Bài 1…N; bài của GV001 ở Lớp 3 cũng từ Bài 1…M.
// Học sinh chỉ thấy bài hệ thống, gõ mã cô giáo mới thấy bài của cô -> mỗi bộ luôn liền số, không nhảy cóc.
// Số "Bài N" do hệ thống tự đếm theo thứ tự trong khối lớp, không phụ thuộc số người soạn gõ tay:
//  - Thêm bài mới: bài mới đứng cuối khối, nhận số = số bài hiện có + 1.
//  - Xoá bài: các bài phía sau tự lùi số (đếm lại khi hiển thị).
// Tên bài người soạn gõ chỉ là phần sau dấu hai chấm ("Bài 18: <tên bài>").
// Bài phím số Numpad có dãy số riêng ("Bài Numpad N") nên không đánh số chung.
// MỖI NHÓM ĐÁNH SỐ RIÊNG: trong một khối lớp, nhóm Luyện phím, nhóm Thơ SGK, nhóm Văn SGK đều bắt đầu từ Bài 1
// (thêm/bớt bài ở nhóm này không làm đổi số bài ở nhóm khác).
// ============================================================================
import type { Lesson } from '../types/typing';

/** "Bài 18: ", "Bài 3B - ", "bài 7." ở đầu tên bài */
const LEADING_NUMBER_RE = /^\s*bài\s+\d+\s*[a-z]?\s*[:：.\-–—]\s*/i;
/** Số bài ghi trong tên (dùng để giữ đúng thứ tự cũ khi sắp xếp) */
const ANY_NUMBER_RE = /(?:Bài|bài)\s*(\d+)/i;

/** Bộ bài của một bài: 'ADMIN' (bài hệ thống, kể cả bài cũ chưa ghi người tạo) hoặc mã giáo viên 'GV001'… */
export const lessonOwnerKey = (l: Lesson): string => {
  const c = (l?.ownerCode || '').toUpperCase();
  return c && c !== 'ADMIN' ? c : 'ADMIN';
};
export const isSystemLesson = (l: Lesson): boolean => lessonOwnerKey(l) === 'ADMIN';

/** Danh sách giáo viên có bài trên hệ thống: mã, tên (lấy từ tên người soạn), số bài */
export function teacherDirectory(lessons: Lesson[]): { code: string; name: string; count: number }[] {
  const map = new Map<string, { code: string; name: string; count: number }>();
  for (const l of lessons) {
    if (!l || isSystemLesson(l)) continue;
    const code = lessonOwnerKey(l);
    const cur = map.get(code) || { code, name: '', count: 0 };
    cur.count += 1;
    if (!cur.name && l.authorTeacher) cur.name = l.authorTeacher;
    map.set(code, cur);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export const isNumpadLesson = (l: Lesson): boolean =>
  !!l.isNumpad || l.category === 'numpad_tenkey' || /Bài\s+Numpad\s+\d+/i.test(l.title || '');

/** Nhóm bài: Luyện phím / Thơ SGK / Văn SGK (bài Numpad không thuộc nhóm nào) */
export type LessonGroup = 'exercise' | 'poem' | 'prose';
export const LESSON_GROUP_ORDER: Record<LessonGroup, number> = { exercise: 0, poem: 1, prose: 2 };

/** Nhóm của một bài; null với bài Numpad */
export function lessonGroupOf(l: Lesson): LessonGroup | null {
  if (!l || isNumpadLesson(l)) return null;
  const isPoemOrProse = !!l.isPoemOrStory || l.category === 'poems_stories';
  if (!isPoemOrProse) return 'exercise';
  if (l.genre === 'prose') return 'prose';
  if (l.genre === 'poem') return 'poem';
  return /^Văn/i.test(l.categoryTitleVi || '') ? 'prose' : 'poem';
}

/** Thứ tự nhóm khi xếp chung một danh sách: Luyện phím → Thơ → Văn → Numpad */
export const lessonGroupRank = (l: Lesson): number => {
  const g = lessonGroupOf(l);
  return g ? LESSON_GROUP_ORDER[g] : 3;
};

/** Bộ đánh số của một bài: cùng người tạo + cùng khối lớp + cùng nhóm thì chung một dãy Bài 1, 2, 3… */
export const numberingSetKey = (l: Lesson): string => `${lessonOwnerKey(l)}|${l.gradeLevel || 0}|${lessonGroupOf(l)}`;

/** Bỏ phần "Bài N:" ở đầu, chỉ còn tên bài */
export function stripLessonNumber(title: string): string {
  const raw = (title || '').trim();
  const name = raw.replace(LEADING_NUMBER_RE, '').trim();
  return name || raw;
}

/** Số bài đang ghi trong tên (null nếu không có) */
export function storedLessonNumber(title: string): number | null {
  const m = (title || '').match(ANY_NUMBER_RE);
  return m ? parseInt(m[1], 10) : null;
}

/** Bài cũ không ghi số trong tên được xếp sau các bài có số, với khoá ảo 1000, 1001…;
 *  bài mới lưu với số lớn hơn mọi khoá (kể cả khoá ảo) nên luôn đứng cuối khối. */
export const UNNUMBERED_BASE = 1000;

const byLevelThenId = (a: Lesson, b: Lesson): number => {
  if (a.level !== undefined && b.level !== undefined && a.level !== b.level) return a.level - b.level;
  return a.id.localeCompare(b.id, undefined, { numeric: true });
};

/** Khoá sắp xếp của từng bài trong danh sách (số ghi trong tên, hoặc khoá ảo cho bài không có số) */
export function lessonSortKeys(lessons: Lesson[]): Map<string, number> {
  const keys = new Map<string, number>();
  const unnumbered: Lesson[] = [];
  for (const l of lessons) {
    const n = storedLessonNumber(l.title);
    if (n !== null) keys.set(l.id, n);
    else unnumbered.push(l);
  }
  [...unnumbered].sort(byLevelThenId).forEach((l, i) => keys.set(l.id, UNNUMBERED_BASE + i));
  return keys;
}

/** Sắp xếp bài trong một khối: theo số bài ghi trong tên (bài không có số xếp sau), rồi cấp độ, rồi mã bài */
export const sortLessonsLogically = (lessons: Lesson[]): Lesson[] => {
  const keys = lessonSortKeys(lessons);
  return [...lessons].sort((a, b) => {
    const r = lessonGroupRank(a) - lessonGroupRank(b);
    if (r !== 0) return r;
    const d = (keys.get(a.id) ?? 0) - (keys.get(b.id) ?? 0);
    return d !== 0 ? d : byLevelThenId(a, b);
  });
};

/**
 * Gắn lại "Bài N: <tên>" cho mọi bài theo vị trí trong khối lớp của nó (N = 1, 2, 3… liên tục).
 * Giữ nguyên thứ tự mảng đầu vào; chỉ đổi tiêu đề hiển thị.
 */
export function applyLessonNumbers(lessons: Lesson[]): Lesson[] {
  const numberById = new Map<string, number>();
  // Đếm riêng theo (bộ bài, khối lớp, nhóm bài)
  const groups = new Map<string, Lesson[]>();
  for (const l of lessons) {
    if (!l || isNumpadLesson(l)) continue;
    const g = numberingSetKey(l);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(l);
  }
  for (const list of groups.values()) {
    sortLessonsLogically(list).forEach((l, i) => numberById.set(l.id, i + 1));
  }
  return lessons.map((l) => {
    const n = l ? numberById.get(l.id) : undefined;
    if (!n) return l;
    const title = `Bài ${n}: ${stripLessonNumber(l.title)}`;
    return title === l.title ? l : { ...l, title };
  });
}

/** Số bài mới sẽ nhận khi thêm vào khối lớp (= số bài cùng bộ bài, cùng khối, cùng nhóm + 1).
 *  Không truyền nhóm thì đếm cả khối (giữ cách dùng cũ). */
export function nextLessonNumber(
  lessons: Lesson[],
  gradeLevel: number,
  excludeId?: string | null,
  ownerKey = 'ADMIN',
  group?: LessonGroup
): number {
  return (
    lessons.filter(
      (l) =>
        l &&
        l.gradeLevel === gradeLevel &&
        !isNumpadLesson(l) &&
        l.id !== excludeId &&
        lessonOwnerKey(l) === ownerKey &&
        (!group || lessonGroupOf(l) === group)
    ).length + 1
  );
}

/** Số bài đang hiển thị (đọc từ tiêu đề đã đánh số) */
export function displayedLessonNumber(l: Lesson): number | null {
  if (!l || isNumpadLesson(l)) return null;
  const m = (l.title || '').match(/^\s*Bài\s+(\d+)\s*:/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * GÁN LẠI THỨ TỰ: đưa một bài tới vị trí `newPos` (1 = Bài 1) trong bộ bài cùng người tạo + cùng khối lớp + cùng nhóm.
 * Các bài khác dồn chỗ, rồi ghi lại "Bài 1, 2, 3…" liên tục vào tên của cả bộ.
 * Trả về danh sách mới (giữ thứ tự mảng) và các bài đã đổi tên (để lưu lên máy chủ).
 * Bài Numpad có dãy số riêng nên không gán được ở đây.
 */
export function moveLessonToPosition(
  lessons: Lesson[],
  lessonId: string,
  newPos: number
): { lessons: Lesson[]; changed: Lesson[]; from: number; to: number } | null {
  const target = lessons.find((l) => l && l.id === lessonId);
  if (!target || isNumpadLesson(target)) return null;
  const setKey = numberingSetKey(target);
  const group = sortLessonsLogically(lessons.filter((l) => l && !isNumpadLesson(l) && numberingSetKey(l) === setKey));
  const from = group.findIndex((l) => l.id === lessonId) + 1;
  const to = Math.min(Math.max(1, Math.round(newPos) || 1), group.length);
  const order = group.filter((l) => l.id !== lessonId);
  order.splice(to - 1, 0, target);
  const newTitle = new Map<string, string>();
  order.forEach((l, i) => newTitle.set(l.id, `Bài ${i + 1}: ${stripLessonNumber(l.title)}`));
  const changed: Lesson[] = [];
  const next = lessons.map((l) => {
    const t = l ? newTitle.get(l.id) : undefined;
    if (!t || t === l.title) return l;
    const u = { ...l, title: t };
    changed.push(u);
    return u;
  });
  return { lessons: next, changed, from, to };
}
