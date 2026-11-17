// ============================================================================
// PHÂN TÍCH ẢNH SÁCH GIÁO KHOA BẰNG GEMINI (dùng chung cho máy chủ và trình duyệt)
// - Máy chủ (localhost, server.ts): dùng khoá trong .env hoặc khoá cô nhập.
// - Trình duyệt (bản web Vercel, bản cài đặt .exe: KHÔNG có máy chủ đi kèm): gọi thẳng Google
//   bằng khoá cô đã nhập. Khoá chỉ đi từ trình duyệt tới Google, không qua máy chủ nào khác.
// ============================================================================

export const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';

export const TEXTBOOK_OCR_PROMPT = `Bạn là trợ lý giáo viên tiểu học Tiếng Việt chuyên nghiệp. 
Hãy quan sát hình ảnh trang sách giáo khoa (SGK) Tiếng Việt này và trích xuất CHÍNH XÁC toàn bộ nội dung bài tập đọc / bài thơ / đoạn văn để học sinh tiểu học luyện gõ bàn phím 10 ngón.

Yêu cầu quy chuẩn trích xuất:
1. "title": Tiêu đề chính xác của bài đọc hoặc bài thơ trong trang sách (ví dụ: "Mèo Con Đi Học", "Quê Hương", "Rùa và Thỏ", v.v.).
2. "content": Toàn bộ nội dung văn bản tiếng Việt có dấu đầy đủ, chuẩn xác chính tả từng từ, từng dấu thanh. Nếu là thơ thì giữ nguyên định dạng xuống dòng của từng câu thơ. Nếu là đoạn văn xuôi thì giữ nguyên cấu trúc đoạn văn bản. Không cắt bớt chữ.
3. "gradeLevel": Khối lớp tiểu học nhận diện được (3, 4, hoặc 5; nếu không ghi rõ hãy ước lượng độ khó để chọn 3, 4 hoặc 5).
4. "teacherNote": Một câu dặn dò hoặc gợi ý ngắn gọn, ấm áp của cô giáo dành cho học sinh khi luyện gõ bài này.

Chỉ trả về JSON theo cấu trúc sau, không kèm bất kỳ giải thích hay markdown code block thừa:
{
  "title": "Tên bài đọc",
  "content": "Nội dung bài đọc tiếng Việt...",
  "gradeLevel": 3,
  "teacherNote": "Lời dặn của cô giáo..."
}`;

export interface TextbookOcrResult {
  title: string;
  content: string;
  gradeLevel: 3 | 4 | 5;
  teacherNote: string;
}

/** Đọc chữ AI trả về (JSON, có thể bọc trong ```json) thành dữ liệu an toàn; không đọc được nội dung thì báo lỗi */
export function parseOcrResponse(responseText: string): TextbookOcrResult {
  const text = responseText || '{}';
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new OcrError('EMPTY', 'AI trả về dữ liệu không đọc được, cô thử lại hoặc chọn ảnh rõ nét hơn nhé.');
    }
  }
  const raw = (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
  const gradeNum = Number(String(raw.gradeLevel ?? '').match(/[3-5]/)?.[0]);
  const result: TextbookOcrResult = {
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    gradeLevel: gradeNum === 3 || gradeNum === 4 || gradeNum === 5 ? gradeNum : 3,
    teacherNote: typeof raw.teacherNote === 'string' ? raw.teacherNote : '',
  };
  if (!result.content.trim()) {
    throw new OcrError('EMPTY', 'AI không đọc được nội dung bài từ ảnh, cô thử ảnh rõ nét hơn nhé.');
  }
  return result;
}

export type OcrErrorCode = 'KEY_MISSING' | 'KEY_INVALID' | 'MODEL' | 'QUOTA' | 'NETWORK' | 'EMPTY' | 'IMAGE' | 'OTHER';

export class OcrError extends Error {
  code: OcrErrorCode;
  constructor(code: OcrErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/** Đổi lỗi tiếng Anh của Google thành câu tiếng Việt kèm cách khắc phục */
export function friendlyGeminiError(error: unknown): OcrError {
  if (error instanceof OcrError) return error;
  const e = error as { message?: unknown; status?: unknown };
  const raw = String(e?.message || '');
  const status = Number(e?.status) || 0;
  if (/default credentials/i.test(raw)) return new OcrError('KEY_MISSING', 'Chưa có khoá Gemini hợp lệ nên chưa phân tích ảnh được.');
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(raw) || status === 401 || status === 403)
    return new OcrError('KEY_INVALID', 'Khoá Gemini không đúng hoặc đã bị thu hồi. Hãy tạo khoá mới và nhập lại.');
  if (status === 404 || /not found/i.test(raw))
    return new OcrError('MODEL', 'Mô hình AI đang cấu hình không còn dùng được. Hãy báo người quản trị đổi tên mô hình Gemini.');
  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(raw))
    return new OcrError('QUOTA', 'Khoá Gemini đã dùng hết lượt miễn phí trong lúc này. Cô đợi vài phút rồi thử lại.');
  if (/fetch failed|Failed to fetch|NetworkError|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(raw))
    return new OcrError('NETWORK', 'Không kết nối được tới Google AI. Hãy kiểm tra mạng Internet.');
  return new OcrError('OTHER', 'Lỗi khi phân tích hình ảnh bằng AI, cô thử lại sau ít phút nhé.');
}

/** Ảnh (data URL, https, hoặc /images/... trong phần mềm) -> { mime, base64 } để gửi Gemini */
async function imageToInlineData(image: string): Promise<{ mimeType: string; data: string }> {
  const m = image.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  if (m) return { mimeType: m[1].toLowerCase(), data: image.slice(m[0].length) };
  let blob: Blob;
  try {
    const res = await fetch(image);
    if (!res.ok) throw new Error(String(res.status));
    blob = await res.blob();
  } catch {
    throw new OcrError('IMAGE', 'Không tải được ảnh này để phân tích. Cô tải ảnh từ máy lên rồi thử lại nhé.');
  }
  if (!blob.type.startsWith('image/')) throw new OcrError('IMAGE', 'Tệp đã chọn không phải hình ảnh.');
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new OcrError('IMAGE', 'Không đọc được ảnh.'));
    r.readAsDataURL(blob);
  });
  return { mimeType: blob.type, data: dataUrl.slice(dataUrl.indexOf(',') + 1) };
}

/** Gọi thẳng Gemini từ trình duyệt (bản web / .exe). Thư viện Google chỉ tải về khi cô bấm phân tích. */
export async function analyzeTextbookImageInBrowser(
  image: string,
  apiKey: string,
  model: string = GEMINI_DEFAULT_MODEL
): Promise<TextbookOcrResult> {
  if (!apiKey.trim()) throw new OcrError('KEY_MISSING', 'Chưa có khoá Gemini.');
  const inline = await imageToInlineData(image);
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    const response = await ai.models.generateContent({
      model,
      contents: { parts: [{ inlineData: inline }, { text: TEXTBOOK_OCR_PROMPT }] },
      config: { responseMimeType: 'application/json' },
    });
    return parseOcrResponse(response.text || '{}');
  } catch (err) {
    throw friendlyGeminiError(err);
  }
}
