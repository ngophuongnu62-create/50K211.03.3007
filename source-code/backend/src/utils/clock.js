/**
 * Xử lý thời gian theo giờ Việt Nam (UTC+7).
 * - "Ngày" (DATE trong SQL) lưu thành Date lúc 00:00 UTC đại diện cho ngày lịch Việt Nam.
 * - "Thời điểm" (DATETIME2) lưu Date UTC thật.
 * - Giờ của ca học là chuỗi "HH:mm" theo giờ Việt Nam.
 * Có thể giả lập thời điểm hiện tại (biến môi trường FAKE_NOW hoặc setNow) để kiểm thử
 * các quy tắc phụ thuộc thời gian (24 giờ, 2 tiếng, cổng lịch rảnh).
 */
const VN_OFFSET_PHUT = 7 * 60;
const MOT_NGAY = 24 * 60 * 60 * 1000;
const MOT_GIO = 60 * 60 * 1000;

let gioGiaLap = null;
// Giờ giả lập chỉ dùng khi lập trình / kiểm thử – production luôn dùng giờ thật (env.js còn từ chối khởi động nếu có FAKE_NOW)
const GIO_GIA_LAP_ENV = process.env.NODE_ENV !== 'production' && process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : null;

function now() {
  if (gioGiaLap) return new Date(gioGiaLap.getTime());
  if (GIO_GIA_LAP_ENV && !Number.isNaN(GIO_GIA_LAP_ENV.getTime())) return new Date(GIO_GIA_LAP_ENV.getTime());
  return new Date();
}

function setNow(value) {
  gioGiaLap = value ? new Date(value) : null;
}

/** Ngày lịch Việt Nam của một thời điểm (Date 00:00 UTC). */
function ngayCuaThoiDiem(thoiDiem) {
  const v = new Date(thoiDiem.getTime() + VN_OFFSET_PHUT * 60000);
  return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
}

function homNay() {
  return ngayCuaThoiDiem(now());
}

/** Đọc chuỗi "YYYY-MM-DD" thành ngày; trả null nếu không hợp lệ. */
function parseNgay(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function dinhDangNgay(ngay) {
  return ngay.toISOString().slice(0, 10);
}

function congNgay(ngay, soNgay) {
  return new Date(ngay.getTime() + soNgay * MOT_NGAY);
}

/** 0 = Chủ Nhật, 1 = Thứ Hai ... 6 = Thứ Bảy */
function thuTrongTuan(ngay) {
  return ngay.getUTCDay();
}

/** Ngày Thứ Hai của tuần chứa ngày đã cho. */
function dauTuan(ngay) {
  return congNgay(ngay, -((ngay.getUTCDay() + 6) % 7));
}

/** Thời điểm (UTC) ứng với ngày + giờ "HH:mm" theo giờ Việt Nam. */
function thoiDiem(ngay, gio) {
  const [h, m] = gio.split(':').map(Number);
  return new Date(ngay.getTime() + (h * 60 + m - VN_OFFSET_PHUT) * 60000);
}

/** Số tuần ISO-8601 của ngày. */
function tuanISO(ngay) {
  const d = new Date(ngay.getTime());
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const nam = d.getUTCFullYear();
  const thursdayDau = new Date(Date.UTC(nam, 0, 4));
  return 1 + Math.round((d - thursdayDau) / MOT_NGAY / 7 - ((thursdayDau.getUTCDay() + 6) % 7 - 3) / 7);
}

const TEN_THU = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
/** Ký hiệu ngắn dùng trong chuỗi lịch học, ví dụ "Thứ 3, 5" hoặc "CN" */
const SO_THU = ['CN', '2', '3', '4', '5', '6', '7'];

function tenThu(ngay) {
  return TEN_THU[thuTrongTuan(ngay)];
}

/** "Thứ Ba, 10/11/2026" */
function nhanNgayDayDu(ngay) {
  const [y, m, d] = dinhDangNgay(ngay).split('-');
  return `${tenThu(ngay)}, ${d}/${m}/${y}`;
}

/** "10/11" */
function nhanNgayNgan(ngay) {
  const [, m, d] = dinhDangNgay(ngay).split('-');
  return `${d}/${m}`;
}

/** Chuỗi "Thứ 3, 5" từ danh sách thứ trong tuần (0..6), sắp Thứ Hai → Chủ Nhật. */
function chuoiThu(dsThu) {
  const sapXep = [...new Set(dsThu)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const coCN = sapXep.includes(0);
  const thuThuong = sapXep.filter((t) => t !== 0).map((t) => SO_THU[t]);
  if (!thuThuong.length) return 'Chủ Nhật';
  return `Thứ ${thuThuong.join(', ')}${coCN ? ', CN' : ''}`;
}

module.exports = {
  MOT_NGAY,
  MOT_GIO,
  now,
  setNow,
  homNay,
  ngayCuaThoiDiem,
  parseNgay,
  dinhDangNgay,
  congNgay,
  thuTrongTuan,
  dauTuan,
  thoiDiem,
  tuanISO,
  tenThu,
  nhanNgayDayDu,
  nhanNgayNgan,
  chuoiThu,
};
