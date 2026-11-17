// ============================================================================
// HÌNH MINH HỌA CHO TỪ CẦN GÕ TRONG TRÒ CHƠI (fish -> 🐟, ghế -> 🪑, cười -> 😄...)
// Dùng hình biểu tượng màu (emoji) có sẵn của hệ điều hành: chạy offline, nhẹ, không cần tải ảnh.
// CHỈ dùng emoji đến bộ Emoji 12 để hiện được trên Windows 10 (máy trường học);
// tránh 🪷 hoa sen, 🪴 chậu cây, 🧑‍🏫 (Emoji 12.1+) vì Windows 10 hiện ô vuông.
// Thứ tự tìm hình: 1) từ đơn có hình riêng  2) từ khóa trong cụm/câu  3) từng tiếng có hình
// 4) hình chung của chủ đề.
// ============================================================================
import type { GameWordCategory, GameWordItem } from './gameWords';

/** Hình riêng cho từ đơn (Level 1 tiếng Việt & tiếng Anh) */
export const WORD_PICTURES: Record<string, string> = {
  // Đồ dùng học tập & sự vật
  bút: '✏️', thước: '📏', sách: '📖', vở: '📓', cặp: '🎒', bảng: '👩‍🏫', phấn: '🖍️', tẩy: '🧽',
  hộp: '📦', bàn: '👨‍💻', ghế: '🪑', đèn: '💡',
  // Máy tính
  phím: '⌨️', chuột: '🖱️', màn: '🖥️', loa: '🔊', mạng: '🌐', chíp: '💾',
  // Gia đình
  mẹ: '👩', bố: '👨', ba: '👨', ông: '👴', bà: '👵', anh: '👦', chị: '👧', em: '🧒', bé: '👶',
  // Lòng biết ơn
  ơn: '🙏', kính: '🙇', trọng: '🤝', nhớ: '💭', lễ: '🙇', hiếu: '👨‍👩‍👧',
  // Học tập
  học: '👨‍🎓', đọc: '📚', viết: '✍️', vẽ: '🎨', bài: '📝', lớp: '🏫', điểm: '💯',
  // Việc thường ngày
  quét: '🧹', rửa: '🧼', lau: '🧽', gấp: '🛏️', tưới: '🌱',
  // Hoạt động
  chạy: '🏃', nhảy: '🤸', bơi: '🏊', bay: '🕊️', hát: '🎤', múa: '💃', cười: '😄',
  // Hiện tượng thiên nhiên
  mưa: '🌧️', nắng: '☀️', gió: '🌬️', mây: '☁️', sấm: '🌩️', chớp: '⚡', sao: '⭐',
  // Con vật
  mèo: '🐱', chó: '🐶', gà: '🐔', vịt: '🦆', chim: '🐦', cá: '🐟', voi: '🐘', khỉ: '🐒', rùa: '🐢',
  thỏ: '🐰', ong: '🐝',
  // Giao thông
  xe: '🚗', tàu: '🚆', thuyền: '⛵', bè: '🛶',
  // Cây cối & hoa
  cây: '🌳', lá: '🍃', cỏ: '🌿', rừng: '🌲', núi: '⛰️', sông: '🏞️', biển: '🌊',
  hoa: '🌸', sen: '🌺', cúc: '🌻', hồng: '🌹', lan: '💮', đào: '🌸', mai: '🌼',

  // Tiếng Anh
  pen: '🖊️', book: '📖', bag: '🎒', desk: '👨‍💻', key: '⌨️', mouse: '🖱️', mom: '👩', dad: '👨',
  cat: '🐱', dog: '🐶', fish: '🐟', bird: '🐦', sun: '☀️', rain: '🌧️', tree: '🌳', rose: '🌹',
  car: '🚗', boat: '⛵', ship: '🚢', plane: '✈️', run: '🏃', jump: '🤸', swim: '🏊', read: '📖',
};

/**
 * Từ khóa trong cụm từ / câu. Cụm dài đặt TRƯỚC cụm ngắn ("máy bay" trước "bay",
 * "tàu hỏa" trước "tàu") để chọn đúng nghĩa.
 */
export const KEYWORD_PICTURES: Array<[string, string]> = [
  // Cụm rất cụ thể: đặt đầu tiên để không bị cụm chung "máy tính", "lớp học", "mặt trời"... chiếm trước
  ['chuột máy tính', '🖱️'], ['bàn phím máy tính', '⌨️'], ['quả địa cầu', '🌍'], ['hướng dương', '🌻'],
  ['bảng đen', '👩‍🏫'], ['cây phượng', '🌺'], ['chuông trường', '🔔'], ['sách giáo khoa', '📚'],
  ['bút mực', '🖋️'], ['thuyền nan', '🛶'], ['tàu vũ trụ', '🚀'], ['tàu hỏa', '🚂'], ['đoàn tàu', '🚆'], ['cá heo', '🐬'],
  ['đàn ong', '🐝'], ['mật ngọt', '🍯'], ['đại bàng', '🦅'], ['chim én', '🐦'], ['lá cờ', '🚩'],
  ['đồng hồ', '⏰'], ['xe cộ', '🚦'], ['thể thao', '⚽'], ['vinh quang', '🏆'], ['nguyệt quế', '🏆'],
  ['việc nhà', '🧹'], ['dọn dẹp', '🧹'], ['nhớ ơn', '🙏'], ['anh em', '👫'], ['nét chữ', '✍️'],
  ['công nghệ', '💻'], ['tương lai', '🌟'], ['đoàn kết', '🤝'], ['luyện rèn', '💪'], ['thiên nhiên', '🌳'],
  ['father and mother', '👨‍👩‍👧'], ['clean house', '🧹'], ['clean my room', '🧹'],
  // Giao thông
  ['máy bay', '✈️'], ['phi cơ', '✈️'], ['trực thăng', '🚁'], ['khinh khí cầu', '🎈'], ['tên lửa', '🚀'],
  ['xe buýt', '🚌'], ['xe đạp', '🚲'], ['xe máy', '🛵'], ['ô tô', '🚗'], ['xe cứu thương', '🚑'],
  ['xe cứu hỏa', '🚒'], ['tàu hỏa', '🚂'], ['tàu thủy', '🚢'], ['tàu du lịch', '🚢'], ['thuyền buồm', '⛵'],
  ['ca nô', '🚤'], ['đèn giao thông', '🚦'],
  // Thiên nhiên
  ['cầu vồng', '🌈'], ['mặt trời', '🌞'], ['mặt trăng', '🌙'], ['ông trăng', '🌙'], ['cơn mưa', '🌧️'],
  ['ánh nắng', '☀️'], ['ngọn gió', '🌬️'], ['bầu trời', '🌤️'], ['ngọn núi', '⛰️'], ['dòng sông', '🏞️'],
  ['khu rừng', '🌲'], ['đại dương', '🌊'], ['trái đất', '🌍'], ['hành tinh', '🌍'], ['sao băng', '🌠'],
  ['tuyết', '❄️'], ['bão', '🌀'],
  // Hoa & cây
  ['hoa phượng', '🌺'], ['hoa sen', '🌺'], ['hoa cúc', '🌻'], ['hoa hồng', '🌹'], ['hoa mai', '🌼'],
  ['hoa đào', '🌸'], ['hoa lan', '💮'], ['hoa điểm mười', '💯'], ['hướng dương', '🌻'], ['cây bàng', '🌳'],
  ['tưới cây', '🌱'], ['trồng cây', '🌱'],
  // Con vật
  ['bồ câu', '🕊️'], ['chú mèo', '🐱'], ['mèo con', '🐱'], ['chú cún', '🐶'], ['cún con', '🐶'],
  ['chú thỏ', '🐰'], ['chú khỉ', '🐒'], ['con voi', '🐘'], ['đàn cá', '🐟'], ['chú gà', '🐔'],
  ['đàn chim', '🐦'], ['bươm bướm', '🦋'], ['con ong', '🐝'], ['rùa', '🐢'],
  // Máy tính
  ['máy tính', '💻'], ['bàn phím', '⌨️'], ['chuột máy tính', '🖱️'], ['màn hình', '🖥️'],
  ['mười ngón', '🖐️'], ['gõ phím', '⌨️'], ['internet', '🌐'], ['mạng', '🌐'],
  // Gia đình & biết ơn
  ['gia đình', '👨‍👩‍👧‍👦'], ['tổ ấm', '🏠'], ['ông bà', '👴'], ['cha mẹ', '👨‍👩‍👧'], ['bố mẹ', '👨‍👩‍👧'],
  ['anh chị em', '👫'], ['thầy cô', '👩‍🏫'], ['cô giáo', '👩‍🏫'], ['thầy giáo', '👨‍🏫'], ['tôn sư', '👩‍🏫'],
  ['uống nước nhớ nguồn', '💧'], ['người lớn', '🙇'], ['công ơn', '🙏'], ['biết ơn', '🙏'],
  // Học tập
  ['lớp học', '🏫'], ['trường', '🏫'], ['học hành', '📚'], ['học giỏi', '🏅'], ['bài tập', '📝'],
  ['chữ đẹp', '✍️'], ['thi đua', '🏆'], ['đọc sách', '📚'], ['vẽ tranh', '🎨'], ['bút chì', '✏️'],
  ['thước kẻ', '📏'], ['cặp sách', '🎒'], ['bảng đen', '👩‍🏫'], ['hộp bút', '✏️'],
  // Việc nhà & hoạt động
  ['quét dọn', '🧹'], ['quét nhà', '🧹'], ['rửa bát', '🍽️'], ['rửa tay', '🧼'], ['chăn màn', '🛏️'],
  ['thể dục', '🤸'], ['tiếp sức', '🏃'], ['nhảy dây', '🤸'], ['bơi lội', '🏊'], ['múa hát', '💃'],
  ['đá bóng', '⚽'], ['bóng đá', '⚽'], ['ca hát', '🎤'], ['âm nhạc', '🎵'],

  // Tiếng Anh (cụm & câu)
  ['airplanes', '✈️'], ['rocket', '🚀'], ['galaxy', '🌌'], ['rainbow', '🌈'], ['butterflies', '🦋'],
  ['lotus', '🌺'], ['flowers', '🌼'], ['rose', '🌹'], ['trains', '🚆'], ['ships', '🚢'], ['boat', '⛵'],
  ['plane', '✈️'], ['car', '🚗'], ['birds', '🐦'], ['puppy', '🐶'], ['sun', '☀️'], ['clouds', '☁️'],
  ['keyboard', '⌨️'], ['computers', '💻'], ['computer', '💻'], ['typing', '⌨️'], ['fingers', '🖐️'],
  ['family', '👨‍👩‍👧‍👦'], ['mother', '👩'], ['father', '👨'], ['parents', '👨‍👩‍👧'], ['children', '👧'],
  ['teachers', '👩‍🏫'], ['teacher', '👩‍🏫'], ['gratitude', '🙏'], ['classroom', '🏫'], ['school', '🏫'],
  ['books', '📚'], ['study', '📚'], ['wash your hands', '🧼'], ['clean', '🧹'], ['sports', '⚽'],
  ['champion', '🏆'], ['perfect', '💯'], ['dreams', '🌟'], ['never give up', '💪'], ['world', '🌍'],
  ['green', '🌳'], ['love', '❤️'], ['happy', '😊'],
];

/** Tiếng có hình riêng nhưng dễ sai nghĩa khi đứng trong câu ("chúng em", "bay lượn"...) */
const WEAK_TOKENS = new Set(['em', 'anh', 'chị', 'ba', 'bé', 'bà', 'ơn', 'nhớ', 'kính', 'trọng', 'lễ', 'bài',
  'bay', 'sao', 'mai', 'lan', 'đào', 'hồng', 'bè', 'ong', 'xe', 'tàu', 'màn', 'lá', 'cá', 'gà', 'key']);

/** Hình chung theo chủ đề (dự phòng cuối cùng) */
export const CATEGORY_PICTURES: Record<GameWordCategory, string> = {
  may_tinh: '💻',
  gia_dinh: '👨‍👩‍👧‍👦',
  biet_on: '🙏',
  hoc_tap: '📚',
  viec_thuong_ngay: '🧹',
  hoat_dong: '⚽',
  su_vat: '🏠',
  hien_tuong: '🌦️',
  con_vat: '🐾',
  do_dung_hoc_tap: '✏️',
  giao_thong_bo: '🚗',
  giao_thong_thuy: '🚢',
  giao_thong_khong: '✈️',
  cay_coi: '🌳',
  loai_hoa: '🌸',
};

export type PictureSource = 'word' | 'keyword' | 'token' | 'category';

const norm = (s: string) => s.trim().toLowerCase().replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ');

/** Tìm hình minh họa cho từ/cụm/câu cần gõ, kèm nguồn tìm được (để kiểm thử) */
export function findWordPicture(item: Pick<GameWordItem, 'word' | 'category'>): { emoji: string; source: PictureSource } {
  const text = norm(item.word);
  if (WORD_PICTURES[text]) return { emoji: WORD_PICTURES[text], source: 'word' };
  const padded = ` ${text} `;
  for (const [kw, emoji] of KEYWORD_PICTURES) {
    if (padded.includes(` ${kw} `)) return { emoji, source: 'keyword' };
  }
  for (const tok of text.split(' ')) {
    if (!WEAK_TOKENS.has(tok) && WORD_PICTURES[tok]) return { emoji: WORD_PICTURES[tok], source: 'token' };
  }
  return { emoji: CATEGORY_PICTURES[item.category] ?? '⌨️', source: 'category' };
}

export const wordPicture = (item: Pick<GameWordItem, 'word' | 'category'>): string => findWordPicture(item).emoji;
