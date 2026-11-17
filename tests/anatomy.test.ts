// Test tên hàng phím và khu vực bàn phím (tab "Làm quen bàn phím")
import assert from 'node:assert/strict';
import { test } from './harness';
import { KEYBOARD_ROW_INFO, KEYBOARD_ZONES, rowOf, zoneOf } from '../src/data/keyboardAnatomy';
import {
  FUNCTION_ROW,
  KEYBOARD_ROWS,
  NAV_CLUSTER_ROWS,
  NUMPAD_ROWS,
  NUMPAD_TOP_EXTRA_KEYS,
  SYSTEM_TOP_KEYS,
} from '../src/data/keyboardLayout';

test('bàn phím: đủ 5 hàng phím, đúng tên và đúng thứ tự từ trên xuống', () => {
  assert.deepEqual(
    KEYBOARD_ROW_INFO.map((r) => r.name),
    ['Hàng phím số', 'Hàng phím trên', 'Hàng phím cơ sở', 'Hàng phím dưới', 'Hàng phím chứa phím cách']
  );
  assert.deepEqual(KEYBOARD_ROW_INFO.map((r) => r.rowIndex), [0, 1, 2, 3, 4]);
});

test('bàn phím: phím tiêu biểu nằm đúng hàng', () => {
  assert.equal(rowOf('Digit5')?.id, 'number');
  assert.equal(rowOf('KeyQ')?.id, 'top');
  assert.equal(rowOf('KeyF')?.id, 'home');
  assert.equal(rowOf('KeyJ')?.id, 'home');
  assert.equal(rowOf('KeyM')?.id, 'bottom');
  assert.equal(rowOf('Space')?.id, 'space');
  assert.equal(rowOf('Numpad5'), undefined, 'phím số bàn phím phụ không thuộc 5 hàng chính');
});

test('bàn phím: mỗi phím thuộc đúng MỘT khu vực, không phím nào bị bỏ sót', () => {
  const all = [
    ...FUNCTION_ROW, ...SYSTEM_TOP_KEYS, ...NUMPAD_TOP_EXTRA_KEYS,
    ...KEYBOARD_ROWS.flat(), ...NAV_CLUSTER_ROWS.flat(), ...NUMPAD_ROWS.flat(),
  ];
  for (const k of all) {
    const count = KEYBOARD_ZONES.filter((z) => z.keys.some((x) => x.code === k.code)).length;
    assert.equal(count, 1, `${k.code} thuộc ${count} khu vực`);
  }
  assert.equal(zoneOf('F5')?.id, 'function');
  assert.equal(zoneOf('KeyA')?.id, 'main');
  assert.equal(zoneOf('ArrowUp')?.id, 'nav');
  assert.equal(zoneOf('Numpad5')?.id, 'numpad');
});
