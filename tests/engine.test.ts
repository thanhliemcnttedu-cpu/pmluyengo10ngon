// Test bộ gõ Telex/VNI: khóa lại các lỗi đã được người rà soát xác nhận và các hành vi đang đúng.
import assert from 'node:assert/strict';
import { test } from './harness';
import { telexCompose, vniCompose, findToneTargetIndex } from '../src/utils/vietnameseTelexEngine';
import {
  generateValidTelexSequencesForWord,
  checkKeyInSmartTelexWord,
  matchUnikeyInputInWord,
} from '../src/utils/vietnameseSmartTelex';
import {
  evaluateCaseMistake,
  charToKeyCode,
  buildKeystrokeSteps,
  convertWordToTelexSteps,
} from '../src/utils/vietnameseKeystrokes';

// [đầu vào, kết quả mong đợi]
const TELEX_CASES: [string, string][] = [
  ['Quee', 'Quê'],
  ['huowng', 'hương'],
  ['huwowng', 'hương'],
  ['Nguowif', 'Người'],
  ['Nguwowif', 'Người'],
  ['khuya', 'khuya'],
  ['giuwax', 'giữa'],
  ['DDuwowngf', 'Đường'],
  ['DDUWOWNGF', 'ĐƯỜNG'],
  ['DDUOWNGF', 'ĐƯỜNG'],
  ['gieengs', 'giếng'],
  ['quoocs', 'quốc'],
  ['gif', 'gì'],
  ['dduwowcj', 'được'],
  ['dduowcj', 'được'],
  ['ddooij', 'đội'],
  ['ddowif', 'đời'],
  ['thuowr', 'thuở'],
  ['huow', 'huơ'],
  ['quow', 'quơ'],
  // Hồi quy: các cách gõ đang đúng
  ['troiwf', 'trời'],
  ['trowif', 'trời'],
  ['cuoiwf', 'cười'],
  ['ruwowuj', 'rượu'],
  ['huowu', 'hươu'],
  ['nawngs', 'nắng'],
  ['hocj', 'học'],
];

const VNI_CASES: [string, string][] = [
  ['Que6', 'Quê'],
  ['hu7o7ng', 'hương'],
  ['huo7ng', 'hương'],
  ['Ngu7o72i', 'Người'],
  ['khuya', 'khuya'],
  ['giu7a4', 'giữa'],
  ['D9u7o7ng2', 'Đường'],
  ['D9u7o72ng', 'Đường'],
  ['D9U7O7NG2', 'ĐƯỜNG'],
  ['gie6ng1', 'giếng'],
  ['quo6c1', 'quốc'],
  ['gi2', 'gì'],
  ['d9u7o7c5', 'được'],
  ['d9u7o75c', 'được'],
  ['d9o6i5', 'đội'],
  ['d9o7i2', 'đời'],
  ['thuo73', 'thuở'],
  ['huo7', 'huơ'],
  ['quo7', 'quơ'],
];

for (const [keys, expected] of TELEX_CASES) {
  test(`telexCompose('${keys}') === '${expected}'`, () => {
    assert.equal(telexCompose(keys), expected);
  });
}

for (const [keys, expected] of VNI_CASES) {
  test(`vniCompose('${keys}') === '${expected}'`, () => {
    assert.equal(vniCompose(keys), expected);
  });
}

test('findToneTargetIndex: ươ/uô/iê/yê/uơ mở (không phụ âm cuối) -> nguyên âm thứ 2', () => {
  assert.equal(findToneTargetIndex(['N', 'g', 'ư', 'ơ']), 3);
  assert.equal(findToneTargetIndex(['đ', 'ư', 'ơ']), 2);
  assert.equal(findToneTargetIndex(['c', 'u', 'ô']), 2);
  assert.equal(findToneTargetIndex(['t', 'i', 'ê']), 2);
  assert.equal(findToneTargetIndex(['y', 'ê']), 1);
  assert.equal(findToneTargetIndex(['t', 'h', 'u', 'ơ']), 3);
  // Không đổi các vần đang đúng: ia, ua, ưa, ai, oi
  assert.equal(findToneTargetIndex(['m', 'i', 'a']), 1);
  assert.equal(findToneTargetIndex(['m', 'ư', 'a']), 1);
  assert.equal(findToneTargetIndex(['b', 'a', 'i']), 1);
});

test('generateValidTelexSequencesForWord không nhận dãy làm mất phím mũ/gạch', () => {
  const bad: [string, string][] = [
    ['được', 'duocwj'],
    ['đội', 'doioj'],
    ['đời', 'doiwf'],
  ];
  for (const [word, seq] of bad) {
    const all = generateValidTelexSequencesForWord(word).map((s) => s.join(''));
    assert.ok(!all.includes(seq), `${word} không được chứa dãy ${seq}`);
    const res = checkKeyInSmartTelexWord(word, seq.slice(0, -1).split(''), seq.slice(-1));
    assert.equal(res.isWordCompleted, false, `${seq} không được hoàn thành từ ${word}`);
  }
});

test('generateValidTelexSequencesForWord: mọi biến thể "ơi/ôi" đều ghép lại đúng từ', () => {
  for (const word of ['đời', 'trời', 'đội', 'chổi', 'mới', 'được', 'Người']) {
    const seqs = generateValidTelexSequencesForWord(word).map((s) => s.join(''));
    assert.ok(seqs.length > 0);
    // Dãy chuẩn (dấu cuối từ) phải luôn có mặt và đúng
    assert.equal(telexCompose(seqs[0]), word, `dãy chuẩn ${seqs[0]} của ${word}`);
  }
  const doi = generateValidTelexSequencesForWord('đời').map((s) => s.join(''));
  assert.ok(doi.includes('ddoiwf'), 'đời nên nhận cả cách gõ ddoiwf');
});

test("evaluateCaseMistake('R','r') báo sai hoa/thường khi R là chữ cái gốc", () => {
  assert.equal(evaluateCaseMistake('R', 'r').isCaseMismatch, true);
  assert.equal(evaluateCaseMistake('A', 'a').isCaseMismatch, true);
  assert.equal(evaluateCaseMistake('d', 'D').isCaseMismatch, true);
});

test('evaluateCaseMistake vẫn nới lỏng cho phím mũ/dấu thật', () => {
  assert.equal(evaluateCaseMistake('s', 'S', { isToneMarkKey: true }).isCaseMismatch, false);
  assert.equal(evaluateCaseMistake('d', 'D', { isHatHookKey: true, targetChar: 'Đ' }).isCaseMismatch, false);
  assert.equal(evaluateCaseMistake('w', 'W', { isAuxiliaryKey: true, isHatHookKey: true }).isCaseMismatch, false);
});

test("checkKeyInSmartTelexWord('Rùa',[],'r') không hợp lệ", () => {
  assert.equal(checkKeyInSmartTelexWord('Rùa', [], 'r').isValid, false);
  assert.equal(checkKeyInSmartTelexWord('Rùa', [], 'R').isValid, true);
  assert.equal(checkKeyInSmartTelexWord('Rùa', ['R', 'u', 'a'], 'f').isWordCompleted, true);
  assert.equal(checkKeyInSmartTelexWord('Rùa', ['R', 'u', 'a'], 'F').isWordCompleted, true);
  assert.equal(checkKeyInSmartTelexWord('rùa', [], 'R').isValid, false);
});

test('checkKeyInSmartTelexWord cho từ in hoa: phím mũ/dấu được gõ thường', () => {
  assert.equal(checkKeyInSmartTelexWord('ĐÀ', ['D'], 'd').isValid, true);
  assert.equal(checkKeyInSmartTelexWord('ĐÀ', ['D', 'd', 'A'], 'f').isWordCompleted, true);
  assert.equal(checkKeyInSmartTelexWord('ĐÀ', ['D', 'D', 'A'], 'F').isWordCompleted, true);
  assert.equal(checkKeyInSmartTelexWord('NẴNG', ['N', 'A'], 'w').isValid, true);
});

test('charToKeyCode: [ ] \\ ` và ký tự ngoài bàn phím', () => {
  assert.equal(charToKeyCode('['), 'BracketLeft');
  assert.equal(charToKeyCode(']'), 'BracketRight');
  assert.equal(charToKeyCode('\\'), 'Backslash');
  assert.equal(charToKeyCode('`'), 'Backquote');
  assert.equal(charToKeyCode('“'), '');
  assert.equal(charToKeyCode('…'), '');
  // Hồi quy
  assert.equal(charToKeyCode('a'), 'KeyA');
  assert.equal(charToKeyCode('Z'), 'KeyZ');
  assert.equal(charToKeyCode('5'), 'Digit5');
  assert.equal(charToKeyCode(','), 'Comma');
  assert.equal(charToKeyCode('!'), 'Digit1');
  assert.equal(charToKeyCode(' '), 'Space');
});

test('matchUnikeyInputInWord: "ng" ở bước 1 của "chang" không được hoàn thành từ', () => {
  const steps = buildKeystrokeSteps('chang', 'telex');
  const r = matchUnikeyInputInWord('chang', 1, 'ng', steps);
  assert.equal(r.isWordCompleted, false);
  assert.equal(r.advanceCount, 0);
  // Phần còn lại đúng thì vẫn hoàn thành
  const ok = matchUnikeyInputInWord('chang', 1, 'hang', steps);
  assert.equal(ok.isMatch, true);
  assert.equal(ok.isWordCompleted, true);
});

test('matchUnikeyInputInWord: ký tự có dấu không nhảy cóc qua chữ phía trước', () => {
  const steps = buildKeystrokeSteps('chàng', 'telex');
  const r = matchUnikeyInputInWord('chàng', 1, 'à', steps);
  assert.equal(r.isWordCompleted, false);
  // Đang ở đúng bước chữ 'a' thì Unikey gửi 'à' là hợp lệ
  const idxA = steps.findIndex((s) => s.keyChar === 'a');
  const ok = matchUnikeyInputInWord('chàng', idxA, 'à', steps);
  assert.equal(ok.isMatch, true);
});

test('Ký hiệu cần Shift nằm giữa từ (a@b, 100+200) phải bật isShiftRequired', () => {
  const at = buildKeystrokeSteps('a@b', 'telex').find((s) => s.keyChar === '@');
  assert.ok(at && at.isShiftRequired);
  const plus = buildKeystrokeSteps('100+200', 'telex').find((s) => s.keyChar === '+');
  assert.ok(plus && plus.isShiftRequired);
  const minus = buildKeystrokeSteps('8-5', 'telex').find((s) => s.keyChar === '-');
  assert.ok(minus && !minus.isShiftRequired);
});

test('convertWordToTelexSteps: dãy chuẩn ghép lại đúng các từ mẫu', () => {
  for (const w of ['Quê', 'hương', 'Người', 'giếng', 'quốc', 'được', 'đội', 'đời', 'Đường', 'ĐƯỜNG', 'thuở']) {
    const { script } = convertWordToTelexSteps(w, 0);
    assert.equal(telexCompose(script), w, `${w} -> ${script}`);
  }
});
