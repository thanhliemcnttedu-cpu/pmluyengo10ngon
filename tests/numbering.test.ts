// Test tự đánh số bài theo khối lớp: thêm bài +1, xoá bài các bài sau lùi số, số gõ tay bị bỏ.
import assert from 'node:assert/strict';
import { test } from './harness';
import type { Lesson } from '../src/types/typing';
import {
  applyLessonNumbers,
  stripLessonNumber,
  nextLessonNumber,
  displayedLessonNumber,
  lessonSortKeys,
} from '../src/utils/lessonNumbering';

const mk = (id: string, title: string, gradeLevel: number, extra: Partial<Lesson> = {}): Lesson =>
  ({ id, title, gradeLevel, level: 1, text: 'a', category: 'poems_stories' } as unknown as Lesson);

const base = (): Lesson[] => [
  mk('a', 'Bài 1: Hai phím mốc', 3),
  mk('b', 'Bài 2: Hàng cơ sở', 3),
  mk('c', 'Bài 5: Bỏ cách số', 3), // số cũ nhảy cóc
  mk('d', 'Bài luyện gõ: Cô bé bán diêm', 3), // không có số
  mk('x', 'Bài 7: Lớp bốn', 4),
];

const titlesOf = (ls: Lesson[], g: number) => applyLessonNumbers(ls).filter((l) => l.gradeLevel === g).map((l) => l.title);

test('đánh số: liên tục 1..n trong từng khối, bỏ số cũ nhảy cóc', () => {
  const t = applyLessonNumbers(base());
  assert.equal(t.find((l) => l.id === 'c')!.title, 'Bài 3: Bỏ cách số');
  assert.equal(t.find((l) => l.id === 'd')!.title, 'Bài 4: Bài luyện gõ: Cô bé bán diêm');
  assert.equal(t.find((l) => l.id === 'x')!.title, 'Bài 1: Lớp bốn'); // khối khác đếm riêng
});

test('đánh số: xoá một bài thì các bài sau lùi số', () => {
  const ls = base().filter((l) => l.id !== 'b');
  assert.deepEqual(
    applyLessonNumbers(ls).filter((l) => l.gradeLevel === 3).map((l) => displayedLessonNumber(l)),
    [1, 2, 3]
  );
});

test('đánh số: bài mới nhận số = số bài trong khối + 1 và đứng cuối', () => {
  const ls = applyLessonNumbers(base());
  assert.equal(nextLessonNumber(ls, 3), 5);
  assert.equal(nextLessonNumber(ls, 5), 1);
  // Bài mới lưu với số lớn hơn mọi khoá (kể cả bài cũ không ghi số) -> luôn đứng cuối khối
  const g3 = base().filter((l) => l.gradeLevel === 3);
  const maxKey = Math.max(g3.length, ...lessonSortKeys(g3).values());
  const withNew = [...base(), mk('n', `Bài ${maxKey + 1}: Bài mới của cô`, 3)];
  const titles = titlesOf(withNew, 3);
  assert.equal(titles.length, 5);
  assert.equal(titles[titles.length - 1], 'Bài 5: Bài mới của cô');
});

test('đánh số: tách tên bài khỏi "Bài N:" gõ tay', () => {
  assert.equal(stripLessonNumber('Bài 18:  ca dao "TRÂU ƠI"'), 'ca dao "TRÂU ƠI"');
  assert.equal(stripLessonNumber('bài 3B - Thơ'), 'Thơ');
  assert.equal(stripLessonNumber('Thơ Quê hương'), 'Thơ Quê hương');
});

test('đánh số: bài Numpad giữ dãy số riêng', () => {
  const ls = [mk('a', 'Bài 1: Một', 4), { ...mk('np', 'Bài Numpad 1: Phím số', 4), category: 'numpad_tenkey' } as Lesson];
  const t = applyLessonNumbers(ls);
  assert.equal(t.find((l) => l.id === 'np')!.title, 'Bài Numpad 1: Phím số');
  assert.equal(nextLessonNumber(t, 4), 2);
});

test('đánh số: mỗi bộ bài (hệ thống, từng giáo viên) đếm riêng trong cùng lớp', () => {
  const ls = [
    mk('s1', 'Bài 1: Hệ thống một', 3),
    mk('s2', 'Bài 2: Hệ thống hai', 3),
    { ...mk('g1', 'Bài 1001: Bài cô Lan', 3), ownerCode: 'GV001' } as Lesson,
    { ...mk('g2', 'Bài 1002: Bài cô Lan hai', 3), ownerCode: 'GV001' } as Lesson,
    { ...mk('h1', 'Bài 9: Bài cô Hà', 3), ownerCode: 'GV002' } as Lesson,
  ];
  const t = applyLessonNumbers(ls);
  const title = (id: string) => t.find((l) => l.id === id)!.title;
  assert.equal(title('s2'), 'Bài 2: Hệ thống hai');
  assert.equal(title('g1'), 'Bài 1: Bài cô Lan');
  assert.equal(title('g2'), 'Bài 2: Bài cô Lan hai');
  assert.equal(title('h1'), 'Bài 1: Bài cô Hà');
  assert.equal(nextLessonNumber(t, 3), 3);
  assert.equal(nextLessonNumber(t, 3, null, 'GV001'), 3);
  assert.equal(nextLessonNumber(t, 3, null, 'GV002'), 2);
  assert.equal(nextLessonNumber(t, 3, null, 'GV009'), 1);
});
