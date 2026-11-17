// Test dữ liệu bài học: id/level không trùng, focusKeys sạch, và cả bài gõ được qua bộ phân rã phím.
import assert from 'node:assert/strict';
import { test } from './harness';
import { LESSONS } from '../src/data/lessons';
import { buildKeystrokeSteps, convertWordToTelexSteps } from '../src/utils/vietnameseKeystrokes';
import { telexCompose } from '../src/utils/vietnameseTelexEngine';
import { checkKeyInSmartTelexWord } from '../src/utils/vietnameseSmartTelex';

test('lessons: id duy nhất', () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('lessons: level duy nhất trong cùng gradeLevel', () => {
  const seen = new Map<string, string>();
  for (const l of LESSONS) {
    const key = `${l.gradeLevel}:${l.level}`;
    assert.ok(!seen.has(key), `${l.id} trùng level với ${seen.get(key)}`);
    seen.set(key, l.id);
  }
});

test('lessons: level duy nhất toàn cục (sắp xếp chéo khối không bị lẫn)', () => {
  const levels = LESSONS.map((l) => l.level);
  assert.equal(new Set(levels).size, levels.length);
});

test('lessons: text không rỗng', () => {
  for (const l of LESSONS) assert.ok(l.text.trim().length > 0, l.id);
});

test('lessons: focusKeys không trùng lặp', () => {
  for (const l of LESSONS) {
    assert.equal(new Set(l.focusKeys).size, l.focusKeys.length, l.id);
  }
});

test('lessons: focusKeys của bài Numpad 4 khớp nội dung', () => {
  const l = LESSONS.find((x) => x.id === 'lesson-numpad-4')!;
  for (const k of l.focusKeys) assert.ok(l.text.includes(k), `phím '${k}' không có trong text`);
});

test('lessons: ghi chú Nàng Tiên Ốc không gọi "nghèo" là dấu ngã', () => {
  const l = LESSONS.find((x) => x.id === 'poem-4-nang-tien-oc')!;
  assert.ok(!/dấu ngã như "nghèo"/.test(l.teacherNote || ''));
});

test('lessons: mọi bài telex/vni sinh được >0 bước, không ném lỗi', () => {
  for (const l of LESSONS) {
    for (const mode of ['telex', 'vni', 'no_accent'] as const) {
      const steps = buildKeystrokeSteps(l.text, mode);
      assert.ok(steps.length > 0, `${l.id} (${mode})`);
      for (const s of steps) assert.equal(typeof s.code, 'string');
    }
  }
});

test('lessons: gõ từng phím theo dãy chuẩn, checkKeyInSmartTelexWord luôn hợp lệ và hoàn thành từ', () => {
  const failures: string[] = [];
  for (const l of LESSONS) {
    for (const raw of l.text.split(/[\s\n]+/)) {
      if (!raw) continue;
      const keys = convertWordToTelexSteps(raw, 0).steps.map((s) => s.keyChar);
      const typed: string[] = [];
      let last = null as ReturnType<typeof checkKeyInSmartTelexWord> | null;
      for (const k of keys) {
        last = checkKeyInSmartTelexWord(raw, typed, k);
        if (!last.isValid) {
          failures.push(`${l.id}: "${raw}" phím ${typed.length + 1} '${k}'`);
          break;
        }
        typed.push(k);
      }
      if (last && last.isValid && !last.isWordCompleted) failures.push(`${l.id}: "${raw}" chưa hoàn thành`);
    }
  }
  assert.equal(failures.length, 0, failures.slice(0, 15).join('; '));
});

test('lessons: dãy telex chuẩn của từng từ ghép lại đúng từ (trừ kiểu bỏ dấu cũ oà/oè/uỳ)', () => {
  const mismatches: string[] = [];
  for (const l of LESSONS) {
    for (const raw of l.text.split(/[\s\n]+/)) {
      if (!raw) continue;
      const core = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      // Từ không dấu (asdf, box...) gõ bằng Telex vốn bị bộ gõ biến đổi; app khớp theo dãy phím nên bỏ qua.
      if (!core || /^[\x00-\x7F]+$/.test(core)) continue;
      const script = convertWordToTelexSteps(core, 0).script;
      const back = telexCompose(script);
      if (back !== core) mismatches.push(`${l.id}: ${core} -> ${script} -> ${back}`);
    }
  }
  // Kiểu bỏ dấu cũ/mới (xòe/xoè, lũy/luỹ) là quyết định của chủ dự án nên chỉ in ra, không đánh trượt.
  const STYLE_ONLY = new Set(['xòe', 'lũy']);
  const real = mismatches.filter((m) => !STYLE_ONLY.has(m.split(': ')[1].split(' -> ')[0]));
  if (mismatches.length) console.log(`  info: ${mismatches.length} từ lệch kiểu bỏ dấu:\n    ` + mismatches.join('\n    '));
  assert.equal(real.length, 0, real.join('; '));
});
