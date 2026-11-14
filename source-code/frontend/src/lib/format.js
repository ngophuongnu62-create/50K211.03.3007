/** Định dạng ngày giờ và chuỗi hiển thị (giờ Việt Nam). */
const TEN_THU = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const TZ = 'Asia/Ho_Chi_Minh';

/** 'YYYY-MM-DD' → Date (UTC 00:00) */
export const docNgay = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);
export const thuCua = (s) => TEN_THU[docNgay(s).getUTCDay()];

/** '2026-11-10' → '10/11/2026' */
export const ddmmyyyy = (s) => (s ? s.split('-').reverse().join('/') : '');
/** '2026-11-10' → '10/11' */
export const ddmm = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '');
/** '2026-11-10' → 'Thứ Ba, 10/11/2026' */
export const nhanNgay = (s) => (s ? `${thuCua(s)}, ${ddmmyyyy(s)}` : '');

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD */
export function homNay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function congNgay(s, n) {
  const d = docNgay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa ngày s */
export function dauTuan(s) {
  const d = docNgay(s);
  return congNgay(s, -((d.getUTCDay() + 6) % 7));
}

/** Thời điểm ISO → '05/11 08:12' theo giờ VN */
export function gioNgay(iso) {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('vi-VN', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t) => p.find((x) => x.type === t)?.value;
  return `${g('day')}/${g('month')} ${g('hour')}:${g('minute')}`;
}

/** Thời điểm ISO → '05/11/2026 · 08:12' */
export function gioNgayDayDu(iso) {
  if (!iso) return '';
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return `${ddmmyyyy(d)} · ${gioNgay(iso).split(' ')[1]}`;
}

/** Thời điểm ISO → '09:00 Thứ Sáu 06/11/2026' */
export function hanChot(iso) {
  if (!iso) return '';
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  return `${gioNgay(iso).split(' ')[1]} ${thuCua(d)} ${ddmmyyyy(d)}`;
}

/** Chữ viết tắt cho ảnh đại diện: "Trần Thu Trang" → "TT" */
export function vietTat(ten = '') {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (!tu.length) return '';
  if (tu.length === 1) return tu[0].slice(0, 2).toUpperCase();
  return (tu[0][0] + tu[tu.length - 1][0]).toUpperCase();
}

export const NHAN_TRANG_THAI_LICH = {
  Nhap: 'Nháp',
  ChoGVXacNhan: 'Chờ GV xác nhận',
  DaDuyet: 'Đã duyệt',
  DaPhatHanh: 'Đã phát hành',
  DaHuy: 'Đã hủy',
};
export const MAU_TRANG_THAI_LICH = {
  Nhap: 'gray',
  ChoGVXacNhan: 'blue',
  DaDuyet: 'blue',
  DaPhatHanh: 'green',
  DaHuy: 'red',
};

export const NHAN_XU_LY = { ChoXuLy: 'Chờ xử lý', DangXuLy: 'Đang xử lý', DaXuLy: 'Đã xử lý', TuChoi: 'Từ chối' };
export const MAU_XU_LY = { ChoXuLy: 'gray', DangXuLy: 'blue', DaXuLy: 'green', TuChoi: 'red' };

export const NHAN_LOAI_PHAN_HOI = {
  DoiLich: 'Đổi lịch',
  NghiPhep: 'Nghỉ phép',
  GopY: 'Góp ý',
  ChatLuongGiangDay: 'Chất lượng giảng dạy',
  CoSoVatChat: 'Cơ sở vật chất',
  DichVu: 'Dịch vụ',
  YKienKhac: 'Ý kiến khác',
};

export const NHAN_LOAI_NHAN_SU = { GiaoVien: 'Giáo viên', TroGiang: 'Trợ giảng' };
export const NHAN_HINH_THUC = { ToanThoiGian: 'Toàn thời gian', BanThoiGian: 'Bán thời gian' };
export const NHAN_LY_DO_NGHI = {
  NghiOm: 'Nghỉ ốm',
  BanViecGiaDinh: 'Bận việc gia đình',
  BanLichTruong: 'Bận lịch trường',
  LyDoKhac: 'Lý do khác',
};

/** Thời điểm ISO → 'YYYY-MM-DD' theo giờ Việt Nam */
export const ngayCua = (iso) => (iso ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso)) : '');
const THU_NGAN = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
/** '2026-11-09' → 'Thứ 2' */
export const thuNgan = (s) => (s ? THU_NGAN[docNgay(s).getUTCDay()] : '');
/** Buổi học → 'Thứ 2 09/11 · Ca 2' */
export const nhanBuoiNgan = (b) => `${thuNgan(b.ngayDay)} ${ddmm(b.ngayDay)} · ${b.tenCa}`;
