// Trò chơi: thời gian mỗi Level (+60 giây theo yêu cầu) và hình minh họa đúng từ cần gõ
import assert from 'node:assert/strict';
import { test } from './harness';
import { LEVEL_TIME_LIMITS, VIETNAMESE_ACCENTED_WORDS, ENGLISH_UNACCENTED_WORDS, GameWordItem } from '../src/data/gameWords';
import { findWordPicture, wordPicture } from '../src/data/wordPictures';

test('trò chơi: mỗi Level được thêm 60 giây (110/100/95/90/85)', () => {
  assert.deepEqual(LEVEL_TIME_LIMITS, { 1: 110, 2: 100, 3: 95, 4: 90, 5: 85 });
});

const all = (set: Record<number, GameWordItem[]>) => Object.values(set).flat();

test('hình minh họa: mọi từ đơn Level 1 (Việt & Anh) đều có hình riêng, không dùng hình chủ đề', () => {
  const lv1 = [...VIETNAMESE_ACCENTED_WORDS[1], ...ENGLISH_UNACCENTED_WORDS[1]];
  const missing = lv1.filter((w) => findWordPicture(w).source !== 'word').map((w) => w.word);
  assert.deepEqual(missing, []);
});

test('hình minh họa: mọi mục trong kho từ đều có hình', () => {
  for (const w of [...all(VIETNAMESE_ACCENTED_WORDS), ...all(ENGLISH_UNACCENTED_WORDS)]) {
    assert.ok(wordPicture(w).length > 0, w.word);
  }
});

test('hình minh họa: chọn đúng nghĩa theo cụm từ', () => {
  const p = (word: string, category: any = 'su_vat') => wordPicture({ word, category });
  assert.equal(p('fish'), '🐟');
  assert.equal(p('tree'), '🌳');
  assert.equal(p('ghế'), '🪑');
  assert.equal(p('cười'), '😄');
  assert.equal(p('máy bay khổng lồ'), '✈️'); // không nhầm sang "bay" 🕊️
  assert.equal(p('xe buýt học sinh'), '🚌'); // không nhầm sang "xe" 🚗
  assert.equal(p('đoàn tàu hỏa'), '🚂');
  assert.equal(p('airplanes fly high above the white clouds'), '✈️');
});

test('hình minh họa: tỉ lệ cụm/câu phải dùng hình chủ đề không quá 35%', () => {
  const items = [...all(VIETNAMESE_ACCENTED_WORDS), ...all(ENGLISH_UNACCENTED_WORDS)];
  const fallback = items.filter((w) => findWordPicture(w).source === 'category');
  console.log(`       (hình chủ đề: ${fallback.length}/${items.length})`);
  assert.ok(fallback.length / items.length <= 0.35);
});
