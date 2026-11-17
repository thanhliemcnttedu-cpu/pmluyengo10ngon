// Test hướng dẫn Caps Lock và đánh số lần bấm phím liên tiếp (Telex dd, oo, aa, ee)
import assert from 'node:assert/strict';
import { test } from './harness';
import { capsGuidance, repeatPressInfo } from '../src/utils/keyGuidance';
import { buildKeystrokeSteps } from '../src/utils/vietnameseKeystrokes';

test('caps: Caps Lock TẮT -> không thay đổi gì', () => {
  assert.deepEqual(capsGuidance({ keyChar: 'H' }, false), { capsCoversUpper: false, capsOffNeeded: false });
});

test('caps: Caps Lock BẬT + chữ HOA -> không cần Shift', () => {
  assert.equal(capsGuidance({ keyChar: 'H' }, true).capsCoversUpper, true);
  assert.equal(capsGuidance({ keyChar: 'H' }, true).capsOffNeeded, false);
});

test('caps: Caps Lock BẬT + chữ thường -> phải bấm Caps Lock để tắt', () => {
  assert.equal(capsGuidance({ keyChar: 'o' }, true).capsOffNeeded, true);
});

test('caps: phím dấu thanh/mũ Telex và ký hiệu không bắt tắt Caps Lock', () => {
  assert.equal(capsGuidance({ keyChar: 's', isToneMarkKey: true }, true).capsOffNeeded, false);
  assert.equal(capsGuidance({ keyChar: 'w', isHatHookKey: true }, true).capsOffNeeded, false);
  assert.equal(capsGuidance({ keyChar: '1' }, true).capsOffNeeded, false);
  assert.equal(capsGuidance({ keyChar: 'a' }, true, { isSymbol: true }).capsOffNeeded, false);
  assert.equal(capsGuidance({ keyChar: 'a' }, true, { hasMistake: true }).capsOffNeeded, false);
});

test('lần bấm: "đi" Telex -> d (lần 1/2), d (lần 2/2), i (1/1)', () => {
  const steps = buildKeystrokeSteps('đi', 'telex');
  const keys = steps.map((s) => s.keyChar).join('');
  assert.ok(keys.startsWith('dd'), `dãy phím ${keys}`);
  assert.deepEqual(repeatPressInfo(steps, 0), { n: 1, total: 2 });
  assert.deepEqual(repeatPressInfo(steps, 1), { n: 2, total: 2 });
  assert.deepEqual(repeatPressInfo(steps, 2), { n: 1, total: 1 });
});

test('lần bấm: "Hôm" Telex -> o lần 1, o lần 2 (Ô = oo)', () => {
  const steps = buildKeystrokeSteps('Hôm', 'telex');
  const oIdx = steps.findIndex((s) => s.keyChar.toLowerCase() === 'o');
  assert.deepEqual(repeatPressInfo(steps, oIdx), { n: 1, total: 2 });
  assert.deepEqual(repeatPressInfo(steps, oIdx + 1), { n: 2, total: 2 });
});

test('lần bấm: phím cách liên tiếp không đánh số', () => {
  const steps = [{ code: 'Space', keyChar: ' ' }, { code: 'Space', keyChar: ' ' }];
  assert.deepEqual(repeatPressInfo(steps, 1), { n: 1, total: 1 });
});
