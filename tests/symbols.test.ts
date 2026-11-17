// Test hướng dẫn phím ký hiệu: quy tắc gõ 10 ngón dùng phím Shift của bàn tay đối diện.
import assert from 'node:assert/strict';
import { test } from './harness';
import { SYMBOL_KEY_GUIDE_MAP, getSymbolKeyGuideInfo } from '../src/utils/symbolKeyGuide';
import { NUMBER_ROW_SYMBOLS_MAP } from '../src/utils/vietnameseKeystrokes';

const RIGHT_HAND = ['*', '(', ')', '_', '+', '{', '}', '|', ':', '"', '<', '>', '?'];
// '^' không nằm ở đây: bàn phím của app (keyboardLayout.ts) gán phím 6 cho ngón trỏ PHẢI.
const LEFT_HAND = ['!', '@', '#', '$', '%', '~'];

test('Ký hiệu tay phải dùng Shift trái', () => {
  for (const ch of RIGHT_HAND) {
    assert.deepEqual(getSymbolKeyGuideInfo(ch)?.targetShiftCodes, ['ShiftLeft'], ch);
  }
});

test('Ký hiệu tay trái dùng Shift phải', () => {
  for (const ch of LEFT_HAND) {
    assert.deepEqual(getSymbolKeyGuideInfo(ch)?.targetShiftCodes, ['ShiftRight'], ch);
  }
});

test('Mọi ký hiệu: Shift luôn khác tay với phím chính, đúng 1 phím Shift', () => {
  for (const info of Object.values(SYMBOL_KEY_GUIDE_MAP)) {
    const expected = info.hand === 'right' ? 'ShiftLeft' : 'ShiftRight';
    assert.deepEqual(info.targetShiftCodes, [expected], info.symbol);
  }
});

test("NUMBER_ROW_SYMBOLS_MAP: nhãn phím đúng dạng 'số (ký hiệu)'", () => {
  for (const [sym, info] of Object.entries(NUMBER_ROW_SYMBOLS_MAP)) {
    assert.equal(info.keyLabel, `${info.digit} (${sym})`, sym);
  }
});
