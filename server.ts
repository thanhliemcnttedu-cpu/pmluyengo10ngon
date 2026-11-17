import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Cho phép đổi cổng qua biến môi trường PORT (khi cổng 3000 đang bận hoặc khi triển khai)
const PORT = Number(process.env.PORT) || 3000;

// Increase JSON body limit to support base64 image uploads
app.use(express.json({ limit: '30mb' }));

// Initialize Google GenAI client on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Thư mục duy nhất được phép đọc ảnh nội bộ: chặn đọc file tuỳ ý (vd. '/../.env')
const ALLOWED_IMAGE_DIRS = [path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist')];

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// Chặn SSRF: không cho máy chủ tải ảnh từ địa chỉ nội bộ/loopback
function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::1' || h === '::') return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172 && Number(m172[1]) >= 16 && Number(m172[1]) <= 31) return true;
  if (/^(fc|fd|fe80)/.test(h) && h.includes(':')) return true;
  return false;
}

// Đọc ảnh '/images/...' chỉ trong public/ hoặc dist/
function readAllowedLocalImage(relPath: string): { data: string; mime: string } | null {
  const clean = relPath.replace(/^\.?\/+/, '');
  for (const dir of ALLOWED_IMAGE_DIRS) {
    const resolved = path.resolve(dir, clean);
    if (!resolved.startsWith(dir + path.sep)) continue;
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const mime = MIME_BY_EXT[path.extname(resolved).toLowerCase()];
      if (!mime) return null;
      return { data: fs.readFileSync(resolved).toString('base64'), mime };
    }
  }
  return null;
}

// Chỉ nhận mảng bài học có id/text là chuỗi, tránh ghi rác vào file lưu trữ
function isValidLessonArray(value: unknown): value is Array<Record<string, unknown>> {
  return (
    Array.isArray(value) &&
    value.every(
      (l) =>
        !!l &&
        typeof l === 'object' &&
        !Array.isArray(l) &&
        typeof (l as any).id === 'string' &&
        (l as any).id.length > 0 &&
        typeof (l as any).text === 'string'
    )
  );
}

// Giao bài: object { [khối]: { lessonIds: string[] ... } }
function isValidAssignments(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((g) => {
    if (!g || typeof g !== 'object') return false;
    const a = g as any;
    const idsOk = a.lessonIds === undefined || (Array.isArray(a.lessonIds) && a.lessonIds.every((x: unknown) => typeof x === 'string'));
    const idOk = a.lessonId === undefined || typeof a.lessonId === 'string';
    return idsOk && idOk;
  });
}

// Storage path for persistent teacher lessons
const DATA_DIR = path.join(__dirname, 'src', 'data');
const SAVED_LESSONS_FILE = path.join(DATA_DIR, 'saved_lessons_store.json');
const SAVED_ASSIGNMENTS_FILE = path.join(DATA_DIR, 'saved_assignments_store.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// API: Lấy danh sách các bài học đã được giáo viên chỉnh sửa / lưu trữ
app.get('/api/lessons', (_req, res) => {
  try {
    if (fs.existsSync(SAVED_LESSONS_FILE)) {
      const raw = fs.readFileSync(SAVED_LESSONS_FILE, 'utf-8');
      return res.json({ success: true, lessons: JSON.parse(raw) });
    }
    return res.json({ success: true, lessons: null });
  } catch (error: any) {
    console.error('Error reading saved lessons:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to read lessons' });
  }
});

// API: Lưu trữ trực tuyến các bài học khi giáo viên chỉnh sửa hoặc thêm mới
app.post('/api/lessons', (req, res) => {
  try {
    const { lessons } = req.body;
    if (!isValidLessonArray(lessons)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu bài học không hợp lệ' });
    }
    fs.writeFileSync(SAVED_LESSONS_FILE, JSON.stringify(lessons, null, 2), 'utf-8');
    return res.json({ success: true, message: 'Đã lưu trữ dữ liệu trực tuyến thành công!' });
  } catch (error: any) {
    console.error('Error saving lessons:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save lessons' });
  }
});

// API: Lấy danh sách bài tập được giáo viên giao cho các khối lớp
app.get('/api/assignments', (_req, res) => {
  try {
    if (fs.existsSync(SAVED_ASSIGNMENTS_FILE)) {
      const raw = fs.readFileSync(SAVED_ASSIGNMENTS_FILE, 'utf-8');
      return res.json({ success: true, assignments: JSON.parse(raw) });
    }
    return res.json({ success: true, assignments: null });
  } catch (error: any) {
    console.error('Error reading saved assignments:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to read assignments' });
  }
});

// API: Lưu trữ bài tập giáo viên giao cho khối lớp (hỗ trợ 1 bài hoặc nhiều bài cùng lúc)
app.post('/api/assignments', (req, res) => {
  try {
    const { assignments } = req.body;
    if (!isValidAssignments(assignments)) {
      return res.status(400).json({ success: false, error: 'Dữ liệu giao bài không hợp lệ' });
    }
    fs.writeFileSync(SAVED_ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2), 'utf-8');
    return res.json({ success: true, message: 'Đã lưu bài tập giao cho khối lớp thành công!' });
  } catch (error: any) {
    console.error('Error saving assignments:', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save assignments' });
  }
});

// API: cho trang biết máy chủ đã có khoá Gemini chưa (không trả về khoá, chỉ trả đúng/sai)
app.get('/api/ai-status', (_req, res) => {
  res.json({ ocrReady: !!process.env.GEMINI_API_KEY });
});

// API: Phân tích hình ảnh sách giáo khoa (AI OCR) để trích xuất văn bản bài đọc
app.post('/api/extract-textbook', async (req, res) => {
  try {
    // Ưu tiên khoá trong .env của máy chủ; chưa có thì dùng khoá giáo viên gửi kèm (header X-Gemini-Key).
    // Khoá gửi kèm chỉ dùng cho đúng yêu cầu này: không lưu, không ghi log.
    const headerKey = String(req.get('x-gemini-key') || '').trim();
    const usingUserKey = !process.env.GEMINI_API_KEY && !!headerKey;
    if (!process.env.GEMINI_API_KEY && !headerKey) {
      return res.status(503).json({
        success: false,
        code: 'KEY_MISSING',
        error: 'Chưa có khoá Gemini. Cô bấm nút Phân tích để nhập khoá nhé.',
      });
    }
    if (usingUserKey && !/^[A-Za-z0-9._-]{30,200}$/.test(headerKey)) {
      return res.status(400).json({ success: false, code: 'KEY_INVALID', error: 'Khoá Gemini không đúng dạng.' });
    }
    const client = usingUserKey ? new GoogleGenAI({ apiKey: headerKey }) : ai;

    const { imageBase64 } = req.body ?? {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Không tìm thấy dữ liệu hình ảnh' });
    }

    let base64Data = '';
    let cleanMime = '';

    if (imageBase64.startsWith('data:')) {
      // Lấy mime từ chính data URL, không tin trường mimeType client gửi
      const m = imageBase64.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
      if (!m) {
        return res.status(400).json({ success: false, error: 'Định dạng ảnh không hợp lệ' });
      }
      cleanMime = m[1].toLowerCase();
      base64Data = imageBase64.slice(m[0].length);
    } else if (imageBase64.startsWith('http://') || imageBase64.startsWith('https://')) {
      let url: URL;
      try {
        url = new URL(imageBase64);
      } catch {
        return res.status(400).json({ success: false, error: 'Đường dẫn ảnh không hợp lệ' });
      }
      if (url.protocol !== 'https:' || isPrivateHost(url.hostname)) {
        return res.status(400).json({ success: false, error: 'Chỉ chấp nhận ảnh từ địa chỉ https công khai' });
      }
      const fetchRes = await fetch(url, { redirect: 'error' });
      const cType = (fetchRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!fetchRes.ok || !cType.startsWith('image/')) {
        return res.status(400).json({ success: false, error: 'Không tải được ảnh từ đường dẫn đã cho' });
      }
      const arrayBuf = await fetchRes.arrayBuffer();
      base64Data = Buffer.from(arrayBuf).toString('base64');
      cleanMime = cType;
    } else if (imageBase64.startsWith('/') || imageBase64.startsWith('./')) {
      const local = readAllowedLocalImage(imageBase64);
      if (!local) {
        return res.status(400).json({ success: false, error: 'Không tìm thấy ảnh trong thư mục ảnh của phần mềm' });
      }
      base64Data = local.data;
      cleanMime = local.mime;
    } else {
      return res.status(400).json({ success: false, error: 'Định dạng ảnh không hợp lệ' });
    }

    const prompt = `Bạn là trợ lý giáo viên tiểu học Tiếng Việt chuyên nghiệp. 
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

    const response = await client.models.generateContent({
      // Cho phép đổi mô hình qua biến GEMINI_MODEL khi Google đổi tên/ngừng mô hình cũ
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: cleanMime,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Fallback nếu có markdown wrapper
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    // Kiểm tra kết quả AI: chỉ nhận chuỗi, khối lớp ép về 3/4/5
    const raw = parsedData && typeof parsedData === 'object' ? parsedData : {};
    const gradeNum = Number(String(raw.gradeLevel ?? '').match(/[3-5]/)?.[0]);
    const safeData = {
      title: typeof raw.title === 'string' ? raw.title : '',
      content: typeof raw.content === 'string' ? raw.content : '',
      gradeLevel: gradeNum === 3 || gradeNum === 4 || gradeNum === 5 ? gradeNum : 3,
      teacherNote: typeof raw.teacherNote === 'string' ? raw.teacherNote : '',
    };
    if (!safeData.content.trim()) {
      return res.status(422).json({ success: false, error: 'AI không đọc được nội dung bài từ ảnh, cô thử ảnh rõ nét hơn nhé.' });
    }

    return res.json({
      success: true,
      data: safeData,
    });
  } catch (error: any) {
    // Không in cả đối tượng lỗi (có thể chứa khoá trong URL yêu cầu), chỉ in trạng thái và thông điệp
    console.error('Error in /api/extract-textbook:', error?.status, String(error?.message || '').slice(0, 300));
    // Đổi lỗi tiếng Anh của Google sang câu tiếng Việt giáo viên hiểu được, kèm cách khắc phục
    const raw = String(error?.message || '');
    const status = Number(error?.status) || 0;
    let friendly = 'Lỗi khi phân tích hình ảnh bằng AI, cô thử lại sau ít phút nhé.';
    if (/default credentials/i.test(raw)) {
      friendly = 'Máy chủ chưa có khoá GEMINI_API_KEY hợp lệ nên chưa phân tích ảnh được.';
    } else if (/API_KEY_INVALID|API key not valid/i.test(raw) || status === 401 || status === 403) {
      friendly = 'Khoá Gemini không đúng hoặc đã bị thu hồi. Hãy tạo khoá mới và nhập lại.';
      return res.status(401).json({ success: false, code: 'KEY_INVALID', error: friendly });
    } else if (status === 404 || /not found/i.test(raw)) {
      friendly = 'Mô hình AI đang cấu hình không còn dùng được. Hãy đặt biến GEMINI_MODEL sang mô hình Gemini hiện hành.';
    } else if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(raw)) {
      friendly = 'Khoá Gemini đã dùng hết lượt miễn phí trong lúc này. Cô đợi vài phút rồi thử lại.';
    } else if (/fetch failed|ENOTFOUND|ECONNRESET|ETIMEDOUT/i.test(raw)) {
      friendly = 'Máy chủ không kết nối được tới Google AI. Hãy kiểm tra mạng Internet.';
    }
    return res.status(500).json({ success: false, error: friendly });
  }
});

// Static endpoints cho SEO: robots.txt & sitemap.xml
app.get('/robots.txt', (_req, res) => {
  const robotsPath = path.join(__dirname, 'public', 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.type('text/plain').sendFile(robotsPath);
  } else {
    res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://luyengo10ngon.vercel.app/sitemap.xml');
  }
});

app.get('/sitemap.xml', (_req, res) => {
  const sitemapPath = path.join(__dirname, 'public', 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.type('application/xml').sendFile(sitemapPath);
  } else {
    res.status(404).send('Not found');
  }
});

// Khởi động server với Vite middlewares (development) hoặc static files (production)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
