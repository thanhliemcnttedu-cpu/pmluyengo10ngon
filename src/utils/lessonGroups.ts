// ============================================================================
// NHÓM BÀI mà học sinh và giáo viên lọc: Luyện phím / Thơ SGK / Văn SGK (bài Numpad là mục riêng)
// Hàm xác định nhóm nằm ở lessonNumbering.ts vì số bài cũng đánh riêng theo từng nhóm.
// ============================================================================
import type { LessonGroup } from './lessonNumbering';
export { lessonGroupOf, lessonGroupRank, type LessonGroup } from './lessonNumbering';

/** MÀU THEO NHÓM: mỗi nhóm một màu để học sinh nhận ra ngay (khớp màu các nút lọc nhóm).
 *  Luyện phím: xanh dương · Thơ SGK: tím · Văn SGK: hồng đỏ · Numpad: xanh lá */
export interface GroupTone {
  card: string; // nền + viền thẻ bài
  badge: string; // ô số "BÀI N"
  chip: string; // nhãn nhóm nhỏ
  text: string; // chữ nhấn (tiêu đề khi rê chuột, "Luyện ngay")
}
export const GROUP_TONE: Record<LessonGroup | 'numpad', GroupTone> = {
  exercise: {
    card: 'bg-sky-50 border-sky-300 hover:border-sky-500',
    badge: 'bg-sky-600 text-white',
    chip: 'bg-sky-100 text-sky-800 border-sky-300',
    text: 'text-sky-700',
  },
  poem: {
    card: 'bg-purple-50 border-purple-300 hover:border-purple-500',
    badge: 'bg-purple-600 text-white',
    chip: 'bg-purple-100 text-purple-800 border-purple-300',
    text: 'text-purple-700',
  },
  prose: {
    card: 'bg-rose-50 border-rose-300 hover:border-rose-500',
    badge: 'bg-rose-600 text-white',
    chip: 'bg-rose-100 text-rose-800 border-rose-300',
    text: 'text-rose-700',
  },
  numpad: {
    card: 'bg-emerald-50 border-emerald-300 hover:border-emerald-500',
    badge: 'bg-emerald-600 text-white',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    text: 'text-emerald-700',
  },
};

export const LESSON_GROUP_LABEL: Record<LessonGroup, string> = {
  exercise: 'Nhóm Luyện phím',
  poem: 'Nhóm Thơ SGK',
  prose: 'Nhóm Văn SGK',
};
