// Phân tích ảnh SGK bằng AI: đọc kết quả và đổi lỗi Google sang tiếng Việt (không gọi mạng)
import assert from 'node:assert/strict';
import { test } from './harness';
import { parseOcrResponse, friendlyGeminiError, OcrError, TEXTBOOK_OCR_PROMPT } from '../src/lib/geminiOcr';

test('AI ảnh SGK: đọc JSON chuẩn, ép khối lớp về 3/4/5', () => {
  const r = parseOcrResponse('{"title":"Mèo con đi học","content":"Hôm nay trời nắng","gradeLevel":"Lớp 4","teacherNote":"Gõ chậm thôi"}');
  assert.deepEqual(r, { title: 'Mèo con đi học', content: 'Hôm nay trời nắng', gradeLevel: 4, teacherNote: 'Gõ chậm thôi' });
  assert.equal(parseOcrResponse('{"content":"abc","gradeLevel":2}').gradeLevel, 3);
});

test('AI ảnh SGK: đọc được JSON bọc trong ```json', () => {
  assert.equal(parseOcrResponse('```json\n{"content":"Quê hương"}\n```').content, 'Quê hương');
});

test('AI ảnh SGK: không có nội dung hoặc chữ hỏng -> lỗi EMPTY tiếng Việt', () => {
  for (const bad of ['{"title":"x","content":"  "}', 'không phải json', '']) {
    assert.throws(() => parseOcrResponse(bad), (e: unknown) => e instanceof OcrError && e.code === 'EMPTY');
  }
});

test('AI ảnh SGK: đổi lỗi Google sang mã + câu tiếng Việt', () => {
  assert.equal(friendlyGeminiError({ message: 'API key not valid. Please pass a valid API key.', status: 400 }).code, 'KEY_INVALID');
  assert.equal(friendlyGeminiError({ message: 'x', status: 403 }).code, 'KEY_INVALID');
  assert.equal(friendlyGeminiError({ message: 'models/abc is not found', status: 404 }).code, 'MODEL');
  assert.equal(friendlyGeminiError({ message: 'RESOURCE_EXHAUSTED', status: 429 }).code, 'QUOTA');
  assert.equal(friendlyGeminiError(new TypeError('Failed to fetch')).code, 'NETWORK');
  assert.match(friendlyGeminiError({ message: '???' }).message, /thử lại/);
});

test('AI ảnh SGK: máy chủ và trình duyệt dùng chung một câu lệnh', () => {
  assert.match(TEXTBOOK_OCR_PROMPT, /"teacherNote"/);
  assert.ok(TEXTBOOK_OCR_PROMPT.length > 500);
});
