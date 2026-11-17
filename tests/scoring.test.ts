// Test điểm thang 10, số từ đúng, tốc độ từ/phút, đồng hồ
import assert from 'node:assert/strict';
import { test } from './harness';
import {
  completedWords,
  describeDuration,
  formatClock,
  formatScore,
  score10,
  splitWords,
  wordsPerMinute,
} from '../src/utils/scoring';

const POEM = 'Hôm nay trời nắng chang chang\nMèo con đi học chẳng mang thứ gì';

test('điểm: đếm đúng số từ tiếng Việt, kể cả xuống dòng', () => {
  assert.equal(splitWords(POEM).length, 14); // 6 từ + 8 từ
  assert.equal(splitWords('Với một viên bi tròn xoe.').length, 6);
  assert.equal(splitWords('a - b').length, 2, 'dấu gạch đứng riêng không tính là từ');
});

test('điểm: từ đúng = từ con trỏ đã gõ qua hết', () => {
  assert.deepEqual(completedWords(POEM, 0), { done: 0, total: 14 });
  assert.deepEqual(completedWords(POEM, 3), { done: 1, total: 14 }, 'gõ xong "Hôm"');
  assert.deepEqual(completedWords(POEM, 2), { done: 0, total: 14 }, '"Hô" chưa xong');
  assert.deepEqual(completedWords(POEM, POEM.length), { done: 14, total: 14 });
});

test('điểm: tốc độ từ/phút', () => {
  assert.equal(wordsPerMinute(10, 60), 10);
  assert.equal(wordsPerMinute(13, 30), 26);
  assert.equal(wordsPerMinute(5, 2), 0, 'dưới 10 giây chưa tính');
  assert.equal(wordsPerMinute(2, 9), 0, 'dưới 10 giây chưa tính');
});

test('điểm: thang 10 = 7 x chính xác + 3 x tốc độ/mục tiêu', () => {
  assert.equal(score10(100, 18, 18), 10);
  assert.equal(score10(100, 36, 18), 10, 'nhanh hơn mục tiêu không quá 10');
  assert.equal(score10(98, 16, 18), 9.5);
  assert.equal(score10(80, 9, 18), 7.1);
  assert.equal(score10(0, 0, 18), 0);
  assert.equal(formatScore(9.5), '9,5');
  assert.equal(formatScore(10), '10');
});

test('điểm: đồng hồ mm:ss và câu đọc thời gian', () => {
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(85), '01:25');
  assert.equal(formatClock(3725), '62:05');
  assert.equal(describeDuration(45), '45 giây');
  assert.equal(describeDuration(155), '2 phút 35 giây');
  assert.equal(describeDuration(120), '2 phút');
});
