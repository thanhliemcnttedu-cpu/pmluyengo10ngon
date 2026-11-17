// ============================================================================
// ĐIỂM, THỜI GIAN, SỐ TỪ ĐÚNG, TỐC ĐỘ (dùng chung cho bảng điểm khi gõ và bảng kết quả cuối bài)
// Theo lựa chọn của tác giả:
//  - Điểm thang 10 = 7 phần cho độ chính xác + 3 phần cho tốc độ so với mục tiêu của bài
//  - Tốc độ = số từ tiếng Việt gõ đúng mỗi phút ("Hôm", "nay" = 2 từ)
// ============================================================================

export interface WordSpan {
  start: number; // vị trí ký tự đầu của từ trong văn bản
  end: number; // vị trí ngay sau ký tự cuối của từ
}

/** Tách văn bản thành các từ (cụm ký tự không phải khoảng trắng/xuống dòng). */
export function splitWords(text: string): WordSpan[] {
  const out: WordSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    // Chỉ tính cụm có chữ hoặc số (bỏ cụm toàn dấu câu như "-" đứng riêng)
    if (/[\p{L}\p{N}]/u.test(m[0])) out.push({ start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/**
 * Số từ đã gõ xong. Phần mềm bắt học sinh sửa lỗi (xóa lùi) trước khi đi tiếp,
 * nên từ nào con trỏ đã vượt qua hết là từ đã gõ đúng.
 */
export function completedWords(text: string, cursorIndex: number): { done: number; total: number } {
  const words = splitWords(text);
  const done = words.filter((w) => w.end <= cursorIndex).length;
  return { done, total: words.length };
}

/** Thời gian tối thiểu trước khi tính tốc độ: đo quá ngắn thì con số dao động mạnh, làm học sinh khó hiểu */
export const MIN_SPEED_SEC = 10;

/** Số từ đúng mỗi phút. Chưa đủ MIN_SPEED_SEC giây thì trả 0 (tránh con số ảo rất lớn lúc mới bắt đầu). */
export function wordsPerMinute(doneWords: number, elapsedSec: number): number {
  if (elapsedSec < MIN_SPEED_SEC || doneWords <= 0) return 0;
  return Math.round((doneWords * 60) / elapsedSec);
}

/** Điểm thang 10, làm tròn 1 chữ số thập phân. */
export function score10(accuracyPercent: number, wpm: number, targetWpm: number): number {
  const acc = Math.max(0, Math.min(100, accuracyPercent)) / 100;
  const speed = targetWpm > 0 ? Math.max(0, Math.min(1, wpm / targetWpm)) : 1;
  return Math.round((7 * acc + 3 * speed) * 10) / 10;
}

/** Hiển thị điểm kiểu Việt Nam: 9,5 */
export const formatScore = (s: number) => s.toFixed(1).replace('.', ',').replace(/,0$/, '');

/** Đồng hồ mm:ss (quá 60 phút vẫn hiện số phút lớn) */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Câu đọc thời gian cho học sinh: "2 phút 35 giây", "45 giây" */
export function describeDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} giây`;
  return r === 0 ? `${m} phút` : `${m} phút ${r} giây`;
}
