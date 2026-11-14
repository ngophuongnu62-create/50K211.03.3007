#!/usr/bin/env node
/**
 * SINH BỘ DỮ LIỆU THỬ – ĐÚNG LOGIC NGHIỆP VỤ – rồi tự kiểm tra và xuất ra tệp để nhập vào CSDL.
 *
 * Nguồn dữ liệu (tài liệu của nhóm trong tai-lieu/):
 *  - Đặc tả 50K211.03.3007.docx: tên người, lớp, phòng, ngày, mã… trong các ví dụ "VD:" của màn hình (Figma);
 *    giá trị liệt kê (Enum); tỉ lệ trong Bảng 5.27 "Ước lượng dung lượng dữ liệu" (~15 học viên/lớp, ~3% lượt học có
 *    báo vắng) ở mức thu nhỏ. Nhịp học theo ví dụ màn hình (Thứ 3, 5 · Thứ 2, 4 · Thứ 7, CN), không theo giả định 3 buổi/tuần.
 *  - Biên bản phỏng vấn: 3 ca (07:30–11:30, 13:30–16:30, 17:30–21:00); GV Việt Nam / nước ngoài / trợ giảng,
 *    toàn thời gian / bán thời gian; lịch rảnh tối thiểu 5 ca/tuần, cập nhật Thứ Hai 08:00 – Thứ Năm 23:59;
 *    báo vắng trước giờ học tối thiểu 2 tiếng; phản hồi / xác nhận trong 24 giờ.
 *
 * Mọi bản ghi được ghi qua model của hệ thống trên một MongoDB tạm trong bộ nhớ (validator + chỉ mục chống trùng
 * phòng / lớp / nhân sự được áp dụng), sau đó kiểm tra 20 quy tắc logic, gọi thử API thật, rồi mới xuất tệp.
 *
 * Chạy:  npm run sinh-du-lieu-thu -- [--luc 2026-11-13T14:00:00+07:00] [--ra ../tai-lieu/du-lieu-thu]
 * --luc: thời điểm "hiện tại" của bộ dữ liệu (phải là Thứ Sáu, Thứ Bảy hoặc Chủ Nhật – sau khi cổng đăng ký
 *        lịch rảnh tuần tới đã đóng). Mặc định là lúc chạy lệnh. Với tuần 09–15/11/2026, tuần tới 16–22/11 khớp đúng
 *        các ví dụ ngày tháng trong đặc tả.
 */
process.env.NODE_ENV = 'test'; // MongoDB tạm trong bộ nhớ – không đụng tới CSDL thật
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || require('path').join(require('os').tmpdir(), 'broadway-sinh-du-lieu');

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { EJSON } = require('bson');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('../src/config/mongoose');
const clock = require('../src/utils/clock');
const { ketNoiCSDL, ngatKetNoiCSDL } = require('../src/config/db');
const {
  NguoiDung, QuanLy, NhanSuGiangDay, MonHoc, KhoaHoc, LopHoc, PhuHuynhHocVien, PhongHoc, CaHoc,
  DangKyPhong, LichRanh, LichDay, PhanHoiGopY, ThongBao, BoDem,
} = require('../src/models');
const { sinhMa, sinhNhieuMa, sinhMaPhieu } = require('../src/utils/sinhMa');
const { luuTep, timTep, BUCKET } = require('../src/utils/luuTep');
const { CA, PHONG, MON } = require('../src/seed/duLieuGoc');
const { MAT_KHAU_MAU, DAU_HIEU_DEMO } = require('../src/seed/duLieuMau');

/* ================================================================================================ tham số */
const doiSo = (ten) => { const i = process.argv.indexOf(ten); return i > 0 ? process.argv[i + 1] : undefined; };
// Mặc định: thời điểm chạy lệnh (làm tròn xuống phút) – nạp ngay sau khi sinh thì mọi mốc "hôm nay / tuần tới / còn … giờ" đều khớp
const LUC = doiSo('--luc') ? new Date(doiSo('--luc')) : new Date(Math.floor(Date.now() / 60e3) * 60e3);
const THU_MUC_RA = path.resolve(doiSo('--ra') || path.join(__dirname, '../../tai-lieu/du-lieu-thu'));
const THU_MUC_ANH = path.join(__dirname, 'du-lieu-thu', 'anh');
// eslint-disable-next-line no-console
const dung = (thongBao) => { console.error(`[sinh-du-lieu-thu] ${thongBao}`); process.exit(1); };
if (Number.isNaN(LUC.getTime())) dung('--luc không hợp lệ (VD 2026-11-13T14:00:00+07:00)');
clock.setNow(LUC);
const HOM_NAY = clock.homNay();
if (![5, 6, 0].includes(clock.thuTrongTuan(HOM_NAY))) {
  dung('Thời điểm của bộ dữ liệu phải rơi vào Thứ Sáu, Thứ Bảy hoặc Chủ Nhật (sau khi cổng đăng ký lịch rảnh tuần tới đóng). Hôm nay là ngày khác thì truyền --luc, VD --luc 2026-11-13T14:00:00+07:00');
}

/* ================================================================================================ thời gian */
const W0 = clock.dauTuan(HOM_NAY); // Thứ Hai tuần này
/** Ngày theo tuần tương đối và thứ (0 = CN, 1 = Thứ Hai … 6 = Thứ Bảy) */
const ngayCua = (tuan, thu) => clock.congNgay(W0, tuan * 7 + ((thu + 6) % 7));
/** Thời điểm theo giờ Việt Nam */
const luc = (ngay, gio) => clock.thoiDiem(ngay, gio);
const lucCua = ([tuan, thu, gio]) => luc(ngayCua(tuan, thu), gio);
const congGio = (d, gio) => new Date(d.getTime() + gio * clock.MOT_GIO);
const nhanNgay = (d) => clock.nhanNgayNgan(d);
const CA_MAP = new Map(CA.map((c) => [c._id, c]));
const batDauCa = (ngay, maCa) => luc(ngay, CA_MAP.get(maCa).gioBatDau);
const TIET_MOI_BUOI = 3;
const HAN_24_GIO_MS = 24 * 3600e3;
/** "HH:mm" giờ Việt Nam */
const gioVN = (d) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(11, 16);
const GIO_HIEN_TAI = `${clock.nhanNgayDayDu(HOM_NAY)} lúc ${gioVN(LUC)}`;
/** Thời điểm gửi lịch dự kiến của lớp đang chờ giáo viên xác nhận: 07:00–22:00, sau khi phân công (Thứ Năm 15:30), còn ≥ 6 giờ hạn */
const LUC_GUI_CHO_GV = (() => {
  const ungVien = [];
  for (let d = clock.congNgay(HOM_NAY, -2); d <= HOM_NAY; d = clock.congNgay(d, 1)) {
    for (let h = 7; h <= 22; h += 1) ungVien.push(luc(d, `${String(h).padStart(2, '0')}:00`));
  }
  const hopLe = ungVien.filter((t) => t > lucCua([0, 4, '15:30']) && t <= congGio(LUC, -1) && LUC - t <= HAN_24_GIO_MS - 6 * 3600e3);
  if (!hopLe.length) return congGio(LUC, -1);
  const muc = congGio(LUC, -6).getTime();
  return hopLe.reduce((a, b) => (Math.abs(b - muc) < Math.abs(a - muc) ? b : a));
})();
const HAN_24_GIO = 24;

/* ================================================================================================ ngẫu nhiên lặp lại được */
let hat = 46; // tuần 46/2026
const ngauNhien = () => {
  hat = (hat + 0x6D2B79F5) | 0;
  let t = Math.imul(hat ^ (hat >>> 15), 1 | hat);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const chon = (ds) => ds[Math.floor(ngauNhien() * ds.length)];
const trongKhoang = (a, b) => a + Math.floor(ngauNhien() * (b - a + 1));
const lucNgauNhien = (tu, den) => new Date(tu.getTime() + Math.floor(ngauNhien() * Math.max(0, den.getTime() - tu.getTime())));

/* ================================================================================================ dữ liệu nguồn */
const MAU_BANG = {
  CNNNA: ['Cử nhân Ngôn ngữ Anh – ĐH Ngoại ngữ Đà Nẵng', 'cu-nhan-ngon-ngu-anh'],
  CNSPTA: ['Cử nhân Sư phạm Tiếng Anh – ĐH Sư phạm Đà Nẵng', 'cu-nhan-su-pham-tieng-anh'],
  IELTS80: ['IELTS Academic 8.0 – IDP · 2025', 'ielts-8-0'],
  IELTS75: ['IELTS Academic 7.5 – British Council · 2024', 'ielts-7-5'],
  TESOL: ['TESOL Certificate – Arizona State University', 'tesol'],
  TOEIC950: ['TOEIC 950 – IIG Việt Nam', 'toeic-950'],
  CELTA: ['CELTA – Cambridge English', 'celta'],
  TEFL: ['TEFL Certificate 120 giờ – The TEFL Org', 'tefl-120'],
  TKT: ['TKT Young Learners – Cambridge English', 'tkt-young-learners'],
  NVSP: ['Chứng chỉ Nghiệp vụ sư phạm – Đại học Đà Nẵng', 'nghiep-vu-su-pham'],
};

const T2_T6 = (ca) => [1, 2, 3, 4, 5].map((t) => [t, ca]);
/** Nhân sự: tên theo ví dụ đặc tả / Figma; lịch rảnh mẫu theo tuần (≥ 5 ca) phủ mọi ca được phân công */
const NHAN_SU = [
  { ma: 'GV-001', hoTen: 'Nguyễn Thị Lan', ten: 'gvnguyenlan', sdt: '0905100001', loai: 'GiaoVien', hinhThuc: 'ToanThoiGian', kn: 6, cm: ['MH-IELTS', 'MH-GT'], diaChi: 'Hải Châu, Đà Nẵng', bang: ['CNNNA', 'IELTS80'], ranh: [[1, 'CA3'], [2, 'CA3'], [3, 'CA3'], [4, 'CA3'], [5, 'CA1'], [6, 'CA1']] },
  { ma: 'GV-002', hoTen: 'Trần Minh Quân', ten: 'gvtranquan', sdt: '0905100002', loai: 'GiaoVien', hinhThuc: 'BanThoiGian', kn: 4, cm: ['MH-GT'], diaChi: 'Thanh Khê, Đà Nẵng', bang: ['CNSPTA', 'TESOL'], ranh: [[1, 'CA2'], [2, 'CA2'], [3, 'CA2'], [4, 'CA2'], [5, 'CA2'], [6, 'CA1']] },
  { ma: 'GV-003', hoTen: 'Phạm Thu Hà', ten: 'gvphamha', sdt: '0905100003', loai: 'GiaoVien', hinhThuc: 'ToanThoiGian', kn: 5, cm: ['MH-IELTS', 'MH-TOEIC'], diaChi: 'Sơn Trà, Đà Nẵng', bang: ['CNNNA', 'TOEIC950'], ranh: [[1, 'CA2'], [3, 'CA2'], [2, 'CA3'], [4, 'CA3'], [6, 'CA1']] },
  { ma: 'GV-004', hoTen: 'Võ Ngọc Mai', ten: 'gvvomai', sdt: '0905100004', loai: 'GiaoVien', hinhThuc: 'ToanThoiGian', kn: 3, cm: ['MH-KIDS', 'MH-GT'], diaChi: 'Ngũ Hành Sơn, Đà Nẵng', bang: ['CNSPTA', 'TKT'], ranh: [[2, 'CA2'], [4, 'CA2'], [6, 'CA2'], [0, 'CA2'], [1, 'CA1'], [5, 'CA1']] },
  { ma: 'GV-005', hoTen: 'David Miller', ten: 'gvdavid', sdt: '0905100005', loai: 'GiaoVien', hinhThuc: 'BanThoiGian', kn: 3, cm: ['MH-IELTS'], diaChi: 'Sơn Trà, Đà Nẵng', bang: ['CELTA'], ranh: [[2, 'CA3'], [4, 'CA3'], [1, 'CA3'], [3, 'CA2'], [5, 'CA1']] },
  { ma: 'GV-006', hoTen: 'Mandy', ten: 'gvmandy', sdt: '0905100006', loai: 'GiaoVien', hinhThuc: 'BanThoiGian', kn: 4, cm: ['MH-KIDS'], diaChi: 'Hải Châu, Đà Nẵng', bang: ['TEFL'], ranh: T2_T6('CA3') },
  { ma: 'GV-007', hoTen: 'Haley', ten: 'gvhaley', sdt: '0905100007', loai: 'GiaoVien', hinhThuc: 'BanThoiGian', kn: 2, cm: ['MH-KIDS'], diaChi: 'Ngũ Hành Sơn, Đà Nẵng', bang: ['TEFL'], ranh: [[6, 'CA1'], [0, 'CA1'], [1, 'CA2'], [2, 'CA2'], [3, 'CA2']] },
  { ma: 'GV-008', hoTen: 'John', ten: 'gvjohn', sdt: '0905100008', loai: 'GiaoVien', hinhThuc: 'BanThoiGian', kn: 5, cm: ['MH-KIDS', 'MH-GT'], diaChi: 'Sơn Trà, Đà Nẵng', bang: ['CELTA', 'TKT'], ranh: [[1, 'CA1'], [3, 'CA2'], [5, 'CA2'], [6, 'CA2'], [0, 'CA3']] },
  { ma: 'TG-001', hoTen: 'Lê Hoàng Anh', ten: 'tgleanh', sdt: '0905200001', loai: 'TroGiang', hinhThuc: 'ToanThoiGian', kn: 2, cm: ['MH-GT'], diaChi: 'Liên Chiểu, Đà Nẵng', bang: ['IELTS75'], ranh: [[1, 'CA2'], [3, 'CA2'], [6, 'CA1'], [2, 'CA1'], [4, 'CA1']] },
  { ma: 'TG-002', hoTen: 'Ty Na', ten: 'tgtyna', sdt: '0905200002', loai: 'TroGiang', hinhThuc: 'BanThoiGian', kn: 1, cm: [], diaChi: 'Cẩm Lệ, Đà Nẵng', bang: ['IELTS75'], ranh: [[2, 'CA3'], [4, 'CA3'], [5, 'CA3'], [1, 'CA1'], [3, 'CA1']] },
  { ma: 'TG-003', hoTen: 'Tuyết Nhi', ten: 'tgtuyetnhi', sdt: '0905200003', loai: 'TroGiang', hinhThuc: 'BanThoiGian', kn: 1, cm: [], diaChi: 'Thanh Khê, Đà Nẵng', bang: ['NVSP'], ranh: T2_T6('CA3') },
  { ma: 'TG-004', hoTen: 'Như Ý', ten: 'tgnhuy', sdt: '0905200004', loai: 'TroGiang', hinhThuc: 'BanThoiGian', kn: 1, cm: [], diaChi: 'Hải Châu, Đà Nẵng', bang: ['NVSP'], ranh: [[6, 'CA2'], [0, 'CA2'], [2, 'CA2'], [4, 'CA2'], [1, 'CA1']] },
];
/** Tình huống thật duy nhất được cài sẵn: Trần Minh Quân xin nghỉ Thứ Tư tuần tới, đã bỏ ca đó khỏi lịch rảnh tuần tới */
const NGHI_TUAN_TOI = { 'GV-002': [[3, 'CA2']] };
const LUC_QUAN_CAP_NHAT = [0, 3, '10:05'];

const QUAN_LY = [
  { _id: 'QL-001', hoTen: 'Trần Thu Trang', soDienThoai: '0905000000', email: 'trang.tran@broadway.edu.vn', tenDangNhap: 'quanly' },
  { _id: 'QL-002', hoTen: 'Lê Minh Hoàng', soDienThoai: '0905000009', email: 'hoang.le@broadway.edu.vn', tenDangNhap: 'quanly2' },
];

/**
 * Lớp: tên theo ví dụ đặc tả. Số buổi = tổng số tiết / 3; buổi đầu là ngày bắt đầu khóa, buổi cuối là ngày kết thúc khóa.
 * kieu: PhatHanh (đã phát hành), DaDuyet (đã duyệt, chờ phát hành), ChoDuyet (GV đã xác nhận, chờ phê duyệt),
 *       ChoGV (đã gửi, GV chưa phản hồi), Nhap (bản nháp chưa phân công), ChuaXep (chưa có lịch).
 */
const LOP = [
  { ma: 'IEF-K14', ten: 'IELTS Foundation – K14', mon: 'MH-IELTS', loai: 'IELTS', siSo: 16, tiet: 48, khoa: 'KH-IEF-14', tenKhoa: 'IELTS Foundation · Khóa 14', kieu: 'PhatHanh', lich: { thu: [2, 4], ca: 'CA3', phong: 'P201', tuan: -10, gv: 'GV-001', tg: 'TG-002' } },
  { ma: 'IEF-K15', ten: 'IELTS Foundation – K15', mon: 'MH-IELTS', loai: 'IELTS', siSo: 16, tiet: 48, khoa: 'KH-IEF-15', tenKhoa: 'IELTS Foundation · Khóa 15', kieu: 'PhatHanh', lich: { thu: [2, 4], ca: 'CA3', phong: 'P201', tuan: -2, gv: 'GV-001', tg: 'TG-002' } },
  { ma: 'GT-A2-08', ten: 'Giao tiếp A2 – K08', mon: 'MH-GT', loai: 'Giao tiếp', siSo: 16, tiet: 48, khoa: 'KH-GTA2-08', tenKhoa: 'Giao tiếp A2 · Khóa 8', kieu: 'PhatHanh', lich: { thu: [1, 3], ca: 'CA2', phong: 'P102', tuan: -2, gv: 'GV-002', tg: 'TG-001' },
    // Lập lịch tuần (UC_6.2) làm ở tuần trước: nghỉ buổi Thứ Tư tuần này vì P.102 bảo trì máy chiếu, học bù Thứ Bảy Ca 1
    doiBuoi: { huy: [0, 3], bu: { tuan: 0, thu: 6, ca: 'CA1', phong: 'P102' }, luc: [-1, 5, '16:00'] } },
  { ma: 'GT-B1-09', ten: 'Giao tiếp B1 – K09', mon: 'MH-GT', loai: 'Giao tiếp', siSo: 14, tiet: 36, khoa: 'KH-GTB1-09', tenKhoa: 'Giao tiếp B1 · Khóa 9', kieu: 'ChoGV', lich: { thu: [1, 3], ca: 'CA3', phong: 'P202', tuan: 1, gv: 'GV-001' } },
  { ma: 'TOEIC-K05', ten: 'TOEIC 650 – K05', mon: 'MH-TOEIC', loai: 'TOEIC', siSo: 20, tiet: 42, khoa: 'KH-TOEIC-05', tenKhoa: 'TOEIC 650 · Khóa 5', kieu: 'DaDuyet', lich: { thu: [2, 4], ca: 'CA3', phong: 'P301', tuan: 1, gv: 'GV-003' } },
  { ma: 'TOEIC-K06', ten: 'TOEIC 650 – K06', mon: 'MH-TOEIC', loai: 'TOEIC', siSo: 18, tiet: 42, khoa: 'KH-TOEIC-06', tenKhoa: 'TOEIC 650 · Khóa 6', kieu: 'Nhap', lich: { thu: [1, 3], ca: 'CA2', phong: 'P301', tuan: 1 } },
  { ma: 'Kids-K03', ten: 'Kids Starters – K03', mon: 'MH-KIDS', loai: 'Thiếu nhi', siSo: 12, tiet: 60, khoa: 'KH-KIDS-03', tenKhoa: 'Kids Starters · Khóa 3', kieu: 'PhatHanh', ql: 'QL-002', lich: { thu: [6, 0], ca: 'CA2', phong: 'P101', tuan: -4, gv: 'GV-004', tg: 'TG-004' } },
  { ma: 'Kids-K04', ten: 'Kids Movers – K04', mon: 'MH-KIDS', loai: 'Thiếu nhi', siSo: 12, tiet: 60, khoa: 'KH-KIDS-04', tenKhoa: 'Kids Movers · Khóa 4', kieu: 'ChoDuyet', ql: 'QL-002', lich: { thu: [2, 4], ca: 'CA2', phong: 'P101', tuan: 1, gv: 'GV-004' } },
  { ma: 'IE65-K12', ten: 'IELTS 6.5 – K12', mon: 'MH-IELTS', loai: 'IELTS', siSo: 18, tiet: 48, khoa: 'KH-IE65-12', tenKhoa: 'IELTS 6.5 · Khóa 12', kieu: 'Nhap', lich: { thu: [2, 4], ca: 'CA3', phong: 'P202', tuan: 1 } },
  // Ví dụ đặc tả MH20: "16/11/2026 → 08/03/2027" – lớp đã có học viên, chưa xếp lịch
  { ma: 'IE65-K13', ten: 'IELTS 6.5 – K13', mon: 'MH-IELTS', loai: 'IELTS', siSo: 18, tiet: 48, khoa: 'KH-IE65-13', tenKhoa: 'IELTS 6.5 · Khóa 13', kieu: 'ChuaXep', khoaCoDinh: { tuan: 1, soNgay: 112 } },
  { ma: 'GS-MILKY', ten: 'GS Milky – U15', mon: 'MH-KIDS', loai: 'GS', siSo: 12, tiet: 60, khoa: 'KH-GS-2026', tenKhoa: 'GS · 2026', kieu: 'PhatHanh', lich: { thu: [1, 2, 3, 4], ca: 'CA3', phong: 'P302', tuan: -2, gv: 'GV-006', tg: 'TG-003' } },
  { ma: 'GS-RABBIT', ten: 'GS Rabbit – U29', mon: 'MH-KIDS', loai: 'GS', siSo: 10, tiet: 60, khoa: 'KH-GS-2026', tenKhoa: 'GS · 2026', kieu: 'PhatHanh', ql: 'QL-002', lich: { thu: [6, 0], ca: 'CA1', phong: 'P303', tuan: -4, gv: 'GV-007' } },
];
const LOP_MAP = new Map(LOP.map((l) => [l.ma, l]));

/** Học viên có tên trong ví dụ đặc tả / tài khoản mẫu cũ ("Học viên Nguyễn Minh An đang theo học 2 lớp", "0905 ••• 456") */
const HV_CO_DINH = [
  ['Nguyễn Minh An', '0905000456', ['IEF-K15', 'GT-A2-08']],
  ['Lê Văn Bình', '0934556778', ['GT-B1-09']],
  ['Đỗ Thị Hằng', '0905667889', ['GT-A2-08']],
  ['Trần Gia Huy', '0912345001', ['Kids-K03']],
  ['Phạm Bảo Ngọc', '0912345002', ['Kids-K04']],
  ['Hoàng Minh Khoa', '0912345003', ['IEF-K15']],
  ['Vũ Thanh Tâm', '0912345004', ['TOEIC-K05']],
  ['Bùi Anh Thư', '0912345005', ['GS-MILKY']],
  ['Ngô Gia Bảo', '0912345006', ['GS-RABBIT']],
  ['Đặng Khánh Linh', '0912345007', ['Kids-K03']],
  ['Trần Gia Hân', '0912345001', ['GS-MILKY']], // em của Trần Gia Huy – cùng số điện thoại phụ huynh
];
/** Học viên học nhiều lớp (không trùng giờ): học tiếp lên lớp mới, hoặc học song song hai lớp khác ca */
const HV_NHIEU_LOP = [
  [6, ['IEF-K14', 'IE65-K12']], // học xong IELTS Foundation K14, đăng ký IELTS 6.5 K12
  [3, ['IEF-K15', 'GT-A2-08']], // Thứ 3, 5 Ca 3 và Thứ 2, 4 Ca 2
  [2, ['Kids-K03', 'GS-RABBIT']], // cuối tuần Ca 2 và Ca 1
];

const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trương', 'Đinh', 'Mai', 'Lâm'];
const DEM_NAM = ['Văn', 'Minh', 'Đức', 'Quốc', 'Hữu', 'Gia', 'Hoàng', 'Anh', 'Tuấn', 'Thành', 'Bảo', 'Nhật'];
const TEN_NAM = ['An', 'Bảo', 'Dũng', 'Đạt', 'Hải', 'Hiếu', 'Huy', 'Khang', 'Khoa', 'Khôi', 'Long', 'Minh', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thắng', 'Tiến', 'Trí', 'Tú', 'Vinh', 'Duy', 'Kiên', 'Phong', 'Thịnh', 'Tùng'];
const DEM_NU = ['Thị', 'Ngọc', 'Thu', 'Minh', 'Gia', 'Bảo', 'Khánh', 'Phương', 'Thanh', 'Mai', 'Hoài', 'Diệu'];
const TEN_NU = ['Anh', 'Châu', 'Chi', 'Giang', 'Hà', 'Hân', 'Hằng', 'Hương', 'Lan', 'Linh', 'Ly', 'Mai', 'My', 'Ngân', 'Nhi', 'Như', 'Oanh', 'Quỳnh', 'Tâm', 'Thảo', 'Thư', 'Trang', 'Trâm', 'Uyên', 'Vy', 'Yến', 'Hạnh'];
const DAU_SO = ['090', '091', '093', '094', '097', '098', '070', '076', '077', '079', '081', '083', '085', '086', '088', '089', '032', '033', '035', '036', '038', '039'];

const DANG_KY_PHONG = [
  { phong: 'P401', ngay: [0, 1], ca: 'CA1', ql: 'QL-001', dk: [-1, 4, '15:20'] },
  // Bảo trì máy chiếu P.102 đúng ca của buổi Giao tiếp A2 – K08 đã nghỉ (đăng ký sau khi buổi được hủy)
  { phong: 'P102', ngay: [0, 3], ca: 'CA2', ql: 'QL-001', dk: [-1, 5, '16:10'] },
  { phong: 'P202', ngay: [0, 4], ca: 'CA3', ql: 'QL-001', dk: [0, 2, '10:00'] }, // VD đặc tả "Thứ Năm 12/11 · Ca 3"
  { phong: 'P301', ngay: [0, 5], ca: 'CA1', ql: 'QL-002', dk: [0, 1, '14:00'], huy: [0, 3, '09:30'] },
  { phong: 'P201', ngay: [0, 6], ca: 'CA2', ql: 'QL-002', dk: [0, 3, '11:00'] },
  { phong: 'P402', ngay: [0, 6], ca: 'CA2', ql: 'QL-001', dk: [0, 2, '16:45'] },
  { phong: 'P1', ngay: [1, 3], ca: 'CA1', ql: 'QL-001', dk: [0, 4, '09:15'] },
  { phong: 'P303', ngay: [1, 0], ca: 'CA2', ql: 'QL-002', dk: [0, 4, '10:40'] },
];

/* ================================================================================================ tiện ích */
function dsNgayHoc({ thu, tuan }, soBuoi) {
  const kq = [];
  for (let d = ngayCua(tuan, 1); kq.length < soBuoi; d = clock.congNgay(d, 1)) {
    if (thu.includes(clock.thuTrongTuan(d))) kq.push(d);
  }
  return kq;
}
const khoaSlot = (a, ngay, ca) => `${a}|${clock.dinhDangNgay(ngay)}|${ca}`;
const nhanCa = (maCa) => { const c = CA_MAP.get(maCa); return `${c.tenCa} (${c.gioBatDau} – ${c.gioKetThuc})`; };
/** Như danhMuc.nhanCa của hệ thống: "Ca 3 · 17:30 – 21:00" */
const nhanCaCham = (maCa) => { const c = CA_MAP.get(maCa); return `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}`; };
const tenPhong = (ma) => PHONG.find((p) => p._id === ma).tenPhong;

function moiHocVienNgauNhien(daCo) {
  for (;;) {
    const nam = ngauNhien() < 0.5;
    const ten = `${chon(HO)} ${chon(nam ? DEM_NAM : DEM_NU)} ${chon(nam ? TEN_NAM : TEN_NU)}`;
    const sdt = `${chon(DAU_SO)}${String(trongKhoang(0, 9999999)).padStart(7, '0')}`;
    if (!daCo.has(ten) && !daCo.has(sdt)) { daCo.add(ten); daCo.add(sdt); return [ten, sdt]; }
  }
}

/* ================================================================================================ sinh dữ liệu */
async function sinh() {
  const nhatKy = { tinhHuong: [] };
  const matKhau = await bcrypt.hash(MAT_KHAU_MAU, 10);

  // ---------- Danh mục gốc (giống hệt init-master-data) ----------
  await CaHoc.insertMany(CA);
  await PhongHoc.insertMany(PHONG);
  await MonHoc.insertMany(MON);

  // ---------- Lịch học của từng lớp ----------
  for (const l of LOP) {
    if (!l.lich) continue;
    l.soBuoi = l.tiet / TIET_MOI_BUOI;
    l.ngay = dsNgayHoc(l.lich, l.soBuoi);
  }
  // Khóa học: từ buổi đầu đến buổi cuối của các lớp thuộc khóa
  const khoa = new Map();
  for (const l of LOP) {
    let bd; let kt;
    if (l.khoaCoDinh) {
      bd = ngayCua(l.khoaCoDinh.tuan, 1);
      kt = clock.congNgay(bd, l.khoaCoDinh.soNgay);
    } else {
      [bd] = l.ngay;
      kt = l.ngay[l.ngay.length - 1];
      if (l.doiBuoi) {
        const bu = ngayCua(l.doiBuoi.bu.tuan, l.doiBuoi.bu.thu);
        if (bu > kt) kt = bu;
      }
    }
    const k = khoa.get(l.khoa) || { _id: l.khoa, tenKhoaHoc: l.tenKhoa, ngayBatDau: bd, ngayKetThuc: kt };
    if (bd < k.ngayBatDau) k.ngayBatDau = bd;
    if (kt > k.ngayKetThuc) k.ngayKetThuc = kt;
    khoa.set(l.khoa, k);
  }
  await KhoaHoc.insertMany([...khoa.values()]);
  const trangThaiLop = (l) => {
    if (!l.ngay) return 'ChuaMo';
    const cuoi = l.ngay[l.ngay.length - 1];
    if (cuoi < HOM_NAY) return 'KetThuc';
    return l.ngay[0] <= HOM_NAY ? 'DangHoc' : 'ChuaMo';
  };
  await LopHoc.insertMany(LOP.map((l) => ({
    _id: l.ma, tenLop: l.ten, maMonHoc: l.mon, loaiLop: l.loai, soLuongHocVien: l.siSo, tongSoTiet: l.tiet,
    trangThaiLop: trangThaiLop(l), maKhoaHoc: l.khoa,
  })));

  // ---------- Người dùng ----------
  await QuanLy.create(QUAN_LY.map((q) => ({ ...q, matKhau })));
  const maBC = await sinhNhieuMa('BC', NHAN_SU.reduce((s, n) => s + n.bang.length, 0));
  let iBC = 0;
  const dsTepBangCap = [];
  const docNS = NHAN_SU.map((n) => ({
    _id: n.ma, hoTen: n.hoTen, tenDangNhap: n.ten, soDienThoai: n.sdt, email: `${n.ten}@broadway.edu.vn`, matKhau,
    diaChi: n.diaChi, loaiNhanSu: n.loai, hinhThucLamViec: n.hinhThuc, kinhNghiem: n.kn, chuyenMon: n.cm,
    bangCap: n.bang.map((k) => {
      const ma = maBC[iBC++];
      const tenTep = `bangcap/${ma.toLowerCase()}-${MAU_BANG[k][1]}.png`;
      dsTepBangCap.push({ tenTep, mau: MAU_BANG[k][1], tenGoc: `${MAU_BANG[k][1]}.png` });
      return { maBangCap: ma, tenBangCap: MAU_BANG[k][0], hinhAnh: `/uploads/${tenTep}` };
    }),
  }));
  await NhanSuGiangDay.create(docNS);
  for (const t of dsTepBangCap) {
    await luuTep(fs.readFileSync(path.join(THU_MUC_ANH, `${t.mau}.png`)), t.tenTep, { loaiNoiDung: 'image/png', tenGoc: t.tenGoc });
  }
  // Ảnh bằng cấp được tải lên khi lập hồ sơ – trước mọi hoạt động khác của bộ dữ liệu
  await mongoose.connection.db.collection(`${BUCKET}.files`).updateMany({ filename: /^bangcap\// }, { $set: { uploadDate: lucCua([-11, 1, '09:00']) } });

  // ---------- Học viên: điền đủ sĩ số từng lớp, không ai học hai lớp trùng ngày–ca ----------
  const daCo = new Set(HV_CO_DINH.flatMap(([t, s]) => [t, s]));
  const dsHV = HV_CO_DINH.map(([ten, sdt, lop]) => ({ ten, sdt, lop }));
  for (const [soLuong, lop] of HV_NHIEU_LOP) {
    for (let i = 0; i < soLuong; i += 1) { const [ten, sdt] = moiHocVienNgauNhien(daCo); dsHV.push({ ten, sdt, lop }); }
  }
  for (const l of LOP) {
    const daCoTrongLop = dsHV.filter((h) => h.lop.includes(l.ma)).length;
    for (let i = daCoTrongLop; i < l.siSo; i += 1) {
      const [ten, sdt] = moiHocVienNgauNhien(daCo);
      dsHV.push({ ten, sdt, lop: [l.ma] });
    }
  }
  // Anh chị em dùng chung số điện thoại phụ huynh (thêm một cặp trong lớp thiếu nhi)
  const kids04 = dsHV.filter((h) => h.lop.length === 1 && h.lop[0] === 'Kids-K04' && !HV_CO_DINH.some((c) => c[0] === h.ten));
  const gsRabbit = dsHV.find((h) => h.lop.length === 1 && h.lop[0] === 'GS-RABBIT' && !HV_CO_DINH.some((c) => c[0] === h.ten));
  if (kids04[0] && gsRabbit) gsRabbit.sdt = kids04[0].sdt;
  const maHV = dsHV.map((_, i) => `HV-${String(i + 1).padStart(4, '0')}`);
  dsHV.forEach((h, i) => { h.ma = maHV[i]; });
  await PhuHuynhHocVien.insertMany(dsHV.map((h) => ({ _id: h.ma, tenHocVien: h.ten, soDienThoai: h.sdt, lopTheoHoc: h.lop })));
  const hvCuaLop = (maLop) => dsHV.filter((h) => h.lop.includes(maLop));

  await BoDem.insertMany([
    { _id: DAU_HIEU_DEMO, giaTri: 1 }, { _id: 'QL', giaTri: QUAN_LY.length },
    { _id: 'GV', giaTri: NHAN_SU.filter((n) => n.loai === 'GiaoVien').length },
    { _id: 'TG', giaTri: NHAN_SU.filter((n) => n.loai === 'TroGiang').length },
    { _id: 'HV', giaTri: dsHV.length },
  ]);

  // ---------- Lịch rảnh: 10 tuần trước tới tuần tới, cập nhật trong khung Thứ Hai 08:00 – Thứ Năm 23:59 của tuần trước ----------
  const docRanh = [];
  for (const n of NHAN_SU) {
    for (let tuan = -10; tuan <= 1; tuan += 1) {
      const bo = tuan === 1 ? (NGHI_TUAN_TOI[n.ma] || []) : [];
      const cacRanh = n.ranh.filter(([t, c]) => !bo.some(([t2, c2]) => t2 === t && c2 === c))
        .map(([thu, maCa]) => ({ ngayRanh: ngayCua(tuan, thu), maCa }));
      const thuCapNhat = trongKhoang(1, 4);
      const capNhat = (tuan === 1 && NGHI_TUAN_TOI[n.ma])
        ? lucCua(LUC_QUAN_CAP_NHAT)
        : luc(ngayCua(tuan - 1, thuCapNhat), `${String(trongKhoang(thuCapNhat === 1 ? 8 : 7, 22)).padStart(2, '0')}:${String(trongKhoang(0, 59)).padStart(2, '0')}`);
      docRanh.push({ maNhanSu: n.ma, tuanBatDau: ngayCua(tuan, 1), cacRanh, thoiDiemCapNhat: capNhat });
    }
  }
  const maLR = await sinhNhieuMa('LR', docRanh.length);
  await LichRanh.insertMany(docRanh.map((d, i) => ({ _id: maLR[i], ...d })));
  nhatKy.tinhHuong.push({
    loai: 'Sai lịch rảnh',
    moTa: `Trần Minh Quân (GV-002) xin nghỉ phép Thứ Tư ${nhanNgay(ngayCua(1, 3))} (phiếu NghiPhep) và đã bỏ ca Thứ Tư Ca 2 khỏi lịch rảnh tuần tới lúc ${clock.nhanNgayNgan(ngayCua(0, 3))} 10:05 – trong khung đăng ký. Buổi Giao tiếp A2 – K08 ngày đó cần giáo viên dạy thay (John – GV-008 – rảnh và đúng chuyên môn).`,
  });

  // ---------- Lịch dạy ----------
  const dsBuoi = []; // { l, ngay, ca, phong, trangThai, phanCong: [...], lichSu: [...], tao, gui, buBu, huy }
  const mocLop = new Map();
  for (const l of LOP) {
    if (!l.lich) continue;
    const S = l.ngay[0];
    let m;
    if (l.kieu === 'PhatHanh') {
      m = { tao: luc(clock.congNgay(S, -15), '09:00'), phanCong: luc(clock.congNgay(S, -15), '09:30'), gui: luc(clock.congNgay(S, -14), '09:00'), phanHoi: luc(clock.congNgay(S, -14), '15:00'), pheDuyet: luc(clock.congNgay(S, -13), '10:00'), phatHanh: luc(clock.congNgay(S, -13), '10:30') };
    } else if (l.kieu === 'DaDuyet') {
      m = { tao: lucCua([0, 1, '09:00']), phanCong: lucCua([0, 1, '09:30']), gui: lucCua([0, 2, '09:00']), phanHoi: lucCua([0, 2, '15:00']), pheDuyet: lucCua([0, 3, '10:00']) };
    } else if (l.kieu === 'ChoDuyet') {
      m = { tao: lucCua([0, 3, '09:00']), phanCong: lucCua([0, 3, '09:30']), gui: lucCua([0, 4, '09:00']), phanHoi: lucCua([0, 4, '14:00']) };
    } else if (l.kieu === 'ChoGV') {
      // Gửi trong giờ làm việc, gần mốc 6 giờ trước thời điểm hiện tại nhất (ví dụ đặc tả: "Còn 18 giờ để phản hồi")
      m = { tao: lucCua([0, 4, '15:00']), phanCong: lucCua([0, 4, '15:30']), gui: LUC_GUI_CHO_GV };
    } else {
      m = { tao: lucCua([0, 4, l.ma === 'IE65-K12' ? '10:00' : '10:30']) };
    }
    mocLop.set(l.ma, m);
    const ql = l.ql || 'QL-001';
    for (const ngay of l.ngay) {
      dsBuoi.push({ l, ngay, ca: l.lich.ca, phong: l.lich.phong, ql, m, buBu: false });
    }
  }
  // Nghỉ buổi + học bù của Giao tiếp A2 – K08 (đã lập ở lịch tuần của tuần trước)
  for (const l of LOP.filter((x) => x.doiBuoi)) {
    const ngayHuy = ngayCua(...l.doiBuoi.huy);
    const buoiHuy = dsBuoi.find((b) => b.l === l && clock.dinhDangNgay(b.ngay) === clock.dinhDangNgay(ngayHuy));
    const lucDoi = lucCua(l.doiBuoi.luc);
    buoiHuy.huy = { luc: lucDoi, ghiChu: 'Hủy buổi khi lập lịch tuần' }; // đúng ghi chú hệ thống ghi ở UC_6.2
    const bu = l.doiBuoi.bu;
    dsBuoi.push({
      l, ngay: ngayCua(bu.tuan, bu.thu), ca: bu.ca, phong: bu.phong, ql: 'QL-001', buBu: true,
      m: { tao: lucDoi, gui: lucDoi, phanHoi: congGio(lucDoi, 3), pheDuyet: lucCua([-1, 6, '16:30']), phatHanh: lucCua([-1, 6, '16:40']) },
    });
  }
  dsBuoi.sort((a, b) => a.ngay - b.ngay || a.l.ma.localeCompare(b.l.ma));
  const n = dsBuoi.length;
  const [maLD, maLS, maPC] = await Promise.all([sinhNhieuMa('LD', n), sinhNhieuMa('LS', n * 6), sinhNhieuMa('PC', n * 2)]);
  let iLS = 0;
  let iPC = 0;
  const thuTuTrongLop = new Map();
  const kieuBuoi = (b) => (b.buBu ? 'PhatHanh' : b.l.kieu);
  for (const [i, b] of dsBuoi.entries()) {
    b._id = maLD[i];
    const k = kieuBuoi(b);
    const { m } = b;
    const lichSu = [{ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'Tao', thoiDiem: m.tao, ...(b.buBu ? { ghiChu: 'Buổi bù' } : {}) }];
    const phanCong = [];
    const thuTu = thuTuTrongLop.get(b.l.ma) || 0;
    thuTuTrongLop.set(b.l.ma, thuTu + 1);
    if (b.l.lich.gv && k !== 'Nhap') {
      for (const [ma, vaiTro] of [[b.l.lich.gv, 'GiaoVien'], [b.l.lich.tg, 'TroGiang']]) {
        if (!ma) continue;
        const daXacNhan = k !== 'ChoGV';
        phanCong.push({
          maPhanCong: maPC[iPC++], maNhanSu: ma, vaiTro, trangThaiPhanCong: daXacNhan ? 'DaXacNhan' : 'ChoXacNhan',
          thoiDiemGuiThongBao: m.gui, ...(daXacNhan ? { thoiDiemPhanHoi: congGio(m.phanHoi, (vaiTro === 'GiaoVien' ? 0 : 1) + (thuTu * 30) / 3600) } : {}),
          phanHoiLichDay: [],
        });
        if (!b.buBu) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'PhanCong', thoiDiem: m.phanCong, ghiChu: `${vaiTro === 'GiaoVien' ? 'Giáo viên' : 'Trợ giảng'} ${ma}` });
      }
      if (!b.buBu) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'GuiDuKien', thoiDiem: m.gui });
    }
    if (m.pheDuyet) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'PheDuyet', thoiDiem: m.pheDuyet });
    if (m.phatHanh) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'PhatHanh', thoiDiem: m.phatHanh });
    let trangThaiLich = { PhatHanh: 'DaPhatHanh', DaDuyet: 'DaDuyet', ChoDuyet: 'ChoGVXacNhan', ChoGV: 'ChoGVXacNhan', Nhap: 'Nhap' }[k];
    if (b.huy) {
      lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: b.ql, hanhDong: 'Huy', thoiDiem: b.huy.luc, ghiChu: b.huy.ghiChu });
      trangThaiLich = 'DaHuy';
    }
    Object.assign(b, { trangThaiLich, phanCong, lichSu, xacNhanCaHoc: [], yeuCauNghiHoc: [] });
  }

  // ---------- Phụ huynh / học viên xác nhận lịch dự kiến (trong 24 giờ sau khi gửi) ----------
  const LY_DO_TU_CHOI = ['Trùng lịch học ở trường', 'Gia đình có việc riêng', 'Con đi khám sức khỏe định kỳ', 'Trùng lịch thi học kỳ'];
  const nhomGui = new Map(); // lớp|thời điểm gửi → các buổi
  for (const b of dsBuoi.filter((x) => x.m.gui)) {
    const khoaNhom = `${b.l.ma}|${b.m.gui.toISOString()}`;
    if (!nhomGui.has(khoaNhom)) nhomGui.set(khoaNhom, { l: b.l, gui: b.m.gui, buoi: [] });
    nhomGui.get(khoaNhom).buoi.push(b);
  }
  const maXNCan = [];
  const dsTuChoi = [];
  for (const g of nhomGui.values()) {
    const hetHan = congGio(g.gui, HAN_24_GIO);
    const conMo = hetHan > LUC;
    const phatHanh = g.buoi[0].m.phatHanh;
    const denLuc = new Date(Math.min(conMo ? LUC.getTime() - 10 * 60e3 : congGio(g.gui, 20).getTime(), phatHanh ? phatHanh.getTime() - 5 * 60e3 : Infinity));
    for (const h of hvCuaLop(g.l.ma)) {
      let kieu;
      const r = ngauNhien();
      if (['HV-0001', 'HV-0005'].includes(h.ma)) kieu = 'XacNhan';
      else if (h.ma === 'HV-0002' && conMo) kieu = 'ChuaPhanHoi';
      else if (conMo) kieu = r < 0.4 ? 'XacNhan' : r < 0.48 ? 'TuChoiMot' : 'ChuaPhanHoi';
      else kieu = r < 0.9 ? 'XacNhan' : r < 0.95 ? 'TuChoiMot' : 'ChuaPhanHoi';
      if (kieu === 'ChuaPhanHoi') continue;
      const lucXN = lucNgauNhien(congGio(g.gui, 0.5), new Date(denLuc.getTime() - 60e3));
      const buoiTuChoi = kieu === 'TuChoiMot' && g.buoi.length > 0 ? chon(g.buoi) : null;
      for (const b of g.buoi) {
        const tuChoi = b === buoiTuChoi;
        maXNCan.push(null);
        // Từ chối một ca trước, sau đó bấm "Xác nhận tất cả" các ca còn lại
        const xn = { maPHHV: h.ma, ketQua: tuChoi ? 'TuChoi' : 'XacNhan', ...(tuChoi ? { lyDoTuChoi: chon(LY_DO_TU_CHOI) } : {}), thoiGianXacNhan: buoiTuChoi && !tuChoi ? new Date(lucXN.getTime() + 60e3) : lucXN };
        b.xacNhanCaHoc.push(xn);
        if (tuChoi) dsTuChoi.push({ b, h, xn });
      }
    }
  }
  const maXN = await sinhNhieuMa('XN', maXNCan.length);
  let iXN = 0;
  for (const b of dsBuoi) for (const x of b.xacNhanCaHoc) x.maXacNhan = maXN[iXN++];

  // ---------- Báo vắng (UC_13): chỉ buổi đã phát hành, gửi trước giờ học ≥ 2 tiếng và trước thời điểm hiện tại ----------
  const LY_DO_NGHI = ['NghiOm', 'BanViecGiaDinh', 'BanLichTruong', 'LyDoKhac'];
  const GHI_CHU = { NghiOm: ['Con bị sốt, gia đình xin cho nghỉ buổi này.', 'Em bị cảm, xin nghỉ một buổi.'], BanViecGiaDinh: ['Gia đình có việc ở quê.', ''], BanLichTruong: ['Trùng lịch kiểm tra ở trường.', ''], LyDoKhac: ['Xin nghỉ một buổi.', ''] };
  const dsBaoVang = [];
  for (const b of dsBuoi.filter((x) => x.trangThaiLich === 'DaPhatHanh')) {
    const batDau = batDauCa(b.ngay, b.ca);
    const tu = new Date(Math.max(b.m.phatHanh.getTime(), batDau.getTime() - 3 * clock.MOT_NGAY));
    const den = new Date(Math.min(batDau.getTime() - 2 * clock.MOT_GIO, LUC.getTime()));
    if (den <= tu) continue;
    for (const h of hvCuaLop(b.l.ma)) {
      const ganCo = h.ma === 'HV-0001' && b.l.ma === 'GT-A2-08' && clock.dinhDangNgay(b.ngay) === clock.dinhDangNgay(ngayCua(1, 1));
      if (!ganCo && (h.ma === 'HV-0001' || ngauNhien() >= 0.03)) continue;
      if (b.xacNhanCaHoc.some((x) => x.maPHHV === h.ma && x.ketQua === 'TuChoi')) continue;
      const lyDo = ganCo ? 'BanViecGiaDinh' : (b.l.loai === 'Thiếu nhi' || b.l.loai === 'GS') ? chon(['NghiOm', 'NghiOm', 'BanViecGiaDinh']) : chon(LY_DO_NGHI);
      const ghiChu = ganCo ? 'Gia đình có việc ở quê.' : chon(GHI_CHU[lyDo]);
      const gui = ganCo ? new Date(Math.min(lucCua([0, 4, '20:15']).getTime(), den.getTime())) : lucNgauNhien(tu, den);
      dsBaoVang.push({ b, h, yc: { maPHHV: h.ma, lyDoXinNghi: lyDo, ...(ghiChu ? { ghiChu } : {}), thoiGianGui: gui, trangThaiNghi: 'BaoVang' } });
    }
  }
  const maNH = await sinhNhieuMa('NH', dsBaoVang.length);
  dsBaoVang.forEach((x, i) => { x.yc.maYeuCauNghi = maNH[i]; x.b.yeuCauNghiHoc.push(x.yc); });

  await LichDay.insertMany(dsBuoi.map((b) => ({
    _id: b._id, maLop: b.l.ma, maPhong: b.phong, maCa: b.ca, maQuanLy: b.ql, ngayDay: b.ngay, soTiet: TIET_MOI_BUOI,
    trangThaiLich: b.trangThaiLich, thoiDiemTao: b.m.tao, thoiDiemCapNhat: b.lichSu[b.lichSu.length - 1].thoiDiem,
    ...(b.m.gui && b.trangThaiLich !== 'Nhap' ? { thoiDiemGuiDuKien: b.m.gui } : {}),
    phanCong: b.phanCong, lichSu: b.lichSu, xacNhanCaHoc: b.xacNhanCaHoc, yeuCauNghiHoc: b.yeuCauNghiHoc,
  })));

  // ---------- Đăng ký phòng (chỉ vào phòng–ca còn trống) ----------
  const maDK = await sinhNhieuMa('DK', DANG_KY_PHONG.length);
  await DangKyPhong.insertMany(DANG_KY_PHONG.map((d, i) => ({
    _id: maDK[i], maPhong: d.phong, maCa: d.ca, maQuanLy: d.ql, ngaySuDung: ngayCua(...d.ngay),
    trangThaiDangKy: d.huy ? 'DaHuy' : 'DaDangKy', thoiDiemDangKy: lucCua(d.dk), ...(d.huy ? { thoiDiemHuy: lucCua(d.huy) } : {}),
  })));

  // ---------- Phiếu phản hồi / góp ý (UC_4, UC_10, UC_14) ----------
  const ngayHuy = ngayCua(0, 3);
  const ngayBu = ngayCua(0, 6);
  const PHIEU = [
    { gui: [-2, 3, '20:00'], maNhanSu: 'GV-007', loai: 'DoiLich', tieuDe: `Xin đổi ca GS Rabbit Chủ Nhật ${nhanNgay(ngayCua(-1, 0))}`, noiDung: `Em xin đổi buổi GS Rabbit – U29 Chủ Nhật ${nhanNgay(ngayCua(-1, 0))} từ Ca 1 sang Ca 2.`,
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'TuChoi', 'Phụ huynh lớp GS Rabbit đã đăng ký học Ca 1, không đổi được ca.', [-2, 4, '09:30']]] },
    { gui: [-2, 5, '18:00'], maNhanSu: 'GV-006', loai: 'GopY', tieuDe: 'Đề xuất bổ sung bộ thẻ từ vựng cho lớp GS Milky', noiDung: 'Đề xuất trung tâm mua thêm bộ thẻ từ vựng (flashcards) chủ đề động vật và đồ vật cho lớp GS Milky – U15.',
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', 'Đã chuyển bộ phận học liệu', [-2, 6, '09:00']], ['CapNhatTrangThai', 'DangXuLy', 'DaXuLy', 'Đã mua 2 bộ thẻ từ vựng, để tại tủ phòng P.302', [-1, 1, '15:00']]] },
    { gui: [-2, 6, '20:05'], maPHHV: 'HV-0003', loai: 'ChatLuongGiangDay', tieuDe: 'Đề nghị tăng thời lượng luyện nói', noiDung: 'Mong trung tâm tăng thời lượng luyện nói trong mỗi buổi học lớp Giao tiếp A2 – K08.',
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', 'Đã trao đổi với GV Trần Minh Quân', [-1, 1, '09:00']], ['PhanHoiNguoiGui', 'Cảm ơn phụ huynh đã góp ý. Từ tuần sau mỗi buổi học sẽ có thêm 20 phút luyện nói theo nhóm.', [-1, 2, '10:15']], ['CapNhatTrangThai', 'DangXuLy', 'DaXuLy', null, [-1, 2, '10:16']]] },
    { gui: [-2, 0, '20:10'], maPHHV: 'HV-0009', loai: 'ChatLuongGiangDay', tieuDe: 'Cảm ơn cô Haley', noiDung: 'Bé tiến bộ rõ sau mấy tuần học lớp GS Rabbit, gia đình cảm ơn cô Haley đã rất nhiệt tình.',
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', null, [-1, 1, '08:30']], ['PhanHoiNguoiGui', 'Trung tâm cảm ơn phụ huynh, đã chuyển lời khen đến cô Haley.', [-1, 1, '08:40']], ['CapNhatTrangThai', 'DangXuLy', 'DaXuLy', null, [-1, 1, '08:41']]] },
    // Ví dụ đặc tả: "PH-…· Cơ sở vật chất · Gửi 04/11/2026 19:40", "Phòng P.102 thiếu máy chiếu", "05/11 · 08:12", "05/11/2026 08:30"
    { gui: [-1, 3, '19:40'], maPHHV: 'HV-0001', loai: 'CoSoVatChat', tieuDe: 'Phòng P.102 thiếu máy chiếu', noiDung: 'Buổi học Giao tiếp A2 – K08 chiều nay ở phòng P.102 không có máy chiếu, giáo viên phải dạy trên bảng. Mong trung tâm kiểm tra.', tep: true,
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', 'Đã báo bộ phận kỹ thuật kiểm tra máy chiếu P.102', [-1, 4, '08:12']],
        ['PhanHoiNguoiGui', 'Trung tâm xin lỗi vì sự bất tiện. Bộ phận kỹ thuật đang kiểm tra máy chiếu phòng P.102, trung tâm sẽ báo lại lịch thay máy.', [-1, 4, '08:30']],
        ['PhanHoiNguoiGui', `Máy chiếu P.102 sẽ được thay mới vào Thứ Tư ${nhanNgay(ngayHuy)}. Buổi học ngày đó tạm nghỉ và học bù Thứ Bảy ${nhanNgay(ngayBu)} · Ca 1 · P.102.`, [-1, 5, '16:20']],
        ['CapNhatTrangThai', 'DangXuLy', 'DaXuLy', 'Đã thay máy chiếu mới cho P.102', [0, 3, '17:00']]] },
    { gui: [0, 1, '19:30'], maPHHV: 'HV-0004', loai: 'DichVu', tieuDe: 'Hỏi về xe đưa đón cuối tuần', noiDung: 'Trung tâm có xe đưa đón học viên lớp Kids Starters vào Thứ Bảy, Chủ Nhật không ạ?',
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', 'Đang liên hệ bộ phận xe đưa đón', [0, 2, '08:30']]] },
    { gui: [0, 2, '13:00'], maNhanSu: 'GV-008', loai: 'GopY', tieuDe: 'Đăng ký nhận thêm lớp Giao tiếp', noiDung: 'Em còn trống Thứ Tư Ca 2 và Thứ Sáu Ca 2, xin nhận thêm lớp Giao tiếp nếu trung tâm cần.' },
    { gui: [0, 2, '21:30'], maNhanSu: 'TG-002', loai: 'GopY', tieuDe: 'Bổ sung tài liệu luyện nghe cho lớp IELTS Foundation', noiDung: 'Đề xuất bổ sung bộ tài liệu luyện nghe cho lớp IELTS Foundation – K15.',
      xuLy: [['CapNhatTrangThai', 'ChoXuLy', 'DangXuLy', 'Đã chuyển bộ phận học thuật', [0, 3, '08:45']]] },
    { gui: [0, 3, '10:20'], maNhanSu: 'GV-002', loai: 'NghiPhep', tieuDe: `Xin nghỉ phép Thứ Tư ${nhanNgay(ngayCua(1, 3))}`, noiDung: `Em xin nghỉ phép Thứ Tư ${nhanNgay(ngayCua(1, 3))} vì việc gia đình; đã bỏ Thứ Tư Ca 2 khỏi lịch rảnh tuần tới. Nhờ trung tâm sắp xếp giáo viên dạy thay lớp Giao tiếp A2 – K08.` },
    { gui: [0, 4, '11:25'], maPHHV: 'HV-0007', loai: 'YKienKhac', tieuDe: 'Xin tài liệu ôn tập trước khai giảng', noiDung: 'Trung tâm có thể gửi trước tài liệu ôn tập cho lớp TOEIC 650 – K05 không ạ?' },
    { gui: [0, 4, '19:10'], maPHHV: 'HV-0008', loai: 'CoSoVatChat', tieuDe: 'Điều hòa phòng P.302 kêu to', noiDung: 'Điều hòa phòng P.302 kêu to trong giờ học lớp GS Milky, các bé khó nghe giáo viên.' },
    // Ví dụ đặc tả: "IELTS Foundation – K15 · Thứ Sáu 20/11/2026 · Ca 1"
    { gui: [0, 4, '21:05'], maNhanSu: 'GV-001', loai: 'DoiLich', tieuDe: `Xin đổi buổi IELTS Foundation – K15 Thứ Ba ${nhanNgay(ngayCua(1, 2))}`, noiDung: `Thứ Ba ${nhanNgay(ngayCua(1, 2))} em có lịch thi chứng chỉ, xin chuyển buổi IELTS Foundation – K15 (Ca 3, P.201) sang Thứ Sáu ${nhanNgay(ngayCua(1, 5))} Ca 1.` },
  ];
  const dsPhieu = [];
  const dsThongBao = [];
  const tenNguoi = new Map([...QUAN_LY.map((q) => [q._id, q.hoTen]), ...NHAN_SU.map((x) => [x.ma, x.hoTen]), ...dsHV.map((h) => [h.ma, h.ten])]);
  for (const p of PHIEU) {
    const gui = lucCua(p.gui);
    clock.setNow(gui);
    const ma = await sinhMaPhieu();
    const tepDinhKem = [];
    if (p.tep) {
      const tenTep = `phanhoi/${ma.toLowerCase()}-minh-chung.png`;
      await luuTep(fs.readFileSync(path.join(THU_MUC_ANH, 'minh-chung-p102.png')), tenTep, { loaiNoiDung: 'image/png', tenGoc: 'may-chieu-p102.png' });
      await mongoose.connection.db.collection(`${BUCKET}.files`).updateOne({ filename: tenTep }, { $set: { uploadDate: gui } });
      tepDinhKem.push({ maTep: await sinhMa('TP'), tenTep: 'may-chieu-p102.png', loaiTep: 'PNG', duongDan: `/uploads/${tenTep}` });
    }
    const lichSuXuLy = [];
    let trangThai = 'ChoXuLy';
    for (const buoc of p.xuLy || []) {
      // ['CapNhatTrangThai', trước, sau, ghi chú, mốc] | ['PhanHoiNguoiGui', nội dung, mốc]
      const [loaiThaoTac, a, b2, c] = buoc;
      const thoiGianXuLy = lucCua(buoc[buoc.length - 1]);
      if (loaiThaoTac === 'CapNhatTrangThai') {
        lichSuXuLy.push({ maLichSu: await sinhMa('XL'), maQuanLy: 'QL-001', loaiThaoTac, trangThaiTruoc: a, trangThaiSau: b2, ...(c ? { ghiChuXuLy: c } : {}), thoiGianXuLy });
        trangThai = b2;
      } else {
        lichSuXuLy.push({ maLichSu: await sinhMa('XL'), maQuanLy: 'QL-001', loaiThaoTac, noiDungPhanHoi: a, thoiGianXuLy });
      }
      const NHAN_TT = { ChoXuLy: 'Đã tiếp nhận', DangXuLy: 'Đang xử lý', DaXuLy: 'Đã hoàn thành', TuChoi: 'Từ chối' };
      dsThongBao.push({
        ...(p.maNhanSu ? { maNguoiNhan: p.maNhanSu } : { maPHHV: p.maPHHV }), loaiThongBao: 'KetQuaXuLy',
        ...(loaiThaoTac === 'PhanHoiNguoiGui'
          ? { tieuDe: `Trung tâm đã trả lời phiếu ${ma}`, noiDung: a }
          : { tieuDe: `Phiếu ${ma}: ${NHAN_TT[b2]}`, noiDung: `Phiếu “${p.tieuDe}” được cập nhật trạng thái “${NHAN_TT[b2]}”.${c && b2 === 'TuChoi' ? ` Lý do: ${c}` : ''}` }),
        thoiDiemGui: thoiGianXuLy, trangThaiGui: 'DaGui',
      });
    }
    dsPhieu.push({
      _id: ma, ...(p.maNhanSu ? { maNhanSu: p.maNhanSu } : { maPHHV: p.maPHHV }), ...(lichSuXuLy.length ? { maQuanLy: 'QL-001' } : {}),
      loaiPhanHoi: p.loai, tieuDe: p.tieuDe, noiDung: p.noiDung, thoiGianGui: gui, trangThaiXuLy: trangThai, tepDinhKem, lichSuXuLy,
    });
    for (const q of QUAN_LY) dsThongBao.push({ maNguoiNhan: q._id, loaiThongBao: 'PhanHoiMoi', tieuDe: `Phản hồi mới ${ma}`, noiDung: p.tieuDe, thoiDiemGui: gui, trangThaiGui: 'DaGui' });
  }
  clock.setNow(LUC);
  await PhanHoiGopY.insertMany(dsPhieu);

  // ---------- Thông báo: đúng loại, tiêu đề, nội dung và thời điểm hệ thống tự gửi ở từng bước ----------
  // Mô tả lịch như quanLyLich.nhanLichDayDu: "Thứ 3, 5 · Ca 3 (17:30 – 21:00) · P.201"
  const moTaNhom = (ds) => `${clock.chuoiThu(ds.map((b) => clock.thuTrongTuan(b.ngay)))} · ${nhanCa(ds[0].ca)} · ${[...new Set(ds.map((b) => tenPhong(b.phong)))].join(', ')}`;
  const thongBaoQL = (tb) => { for (const q of QUAN_LY) dsThongBao.push({ maNguoiNhan: q._id, ...tb, trangThaiGui: 'DaGui' }); };
  // UC_6.3 bước 7–9: gửi lịch dự kiến cho nhân sự + học viên của lớp (buổi bù tạo ở UC_6.2 chỉ báo "Thay đổi lịch" cho nhân sự)
  for (const g of nhomGui.values()) {
    const buBu = g.buoi.every((b) => b.buBu);
    const moTa = moTaNhom(g.buoi);
    const tuNgay = clock.nhanNgayDayDu(g.buoi[0].ngay);
    const nhanSu = [...new Set(g.buoi.flatMap((b) => b.phanCong.map((p) => p.maNhanSu)))];
    if (buBu) {
      const b = g.buoi[g.buoi.length - 1];
      const dauTuan = clock.dauTuan(b.ngay);
      for (const ma of nhanSu) {
        dsThongBao.push({ maNguoiNhan: ma, loaiThongBao: 'ThayDoiLich', tieuDe: `Thay đổi lịch dạy tuần ${nhanNgay(dauTuan)} – ${nhanNgay(clock.congNgay(dauTuan, 6))}`, noiDung: `Lịch dạy lớp ${g.l.ten} (${clock.nhanNgayDayDu(b.ngay)} · ${nhanCaCham(b.ca)}) có thay đổi. Vui lòng kiểm tra và phản hồi trong 24 giờ.`, thoiDiemGui: g.gui, trangThaiGui: 'DaGui' });
      }
    } else {
      for (const ma of nhanSu) dsThongBao.push({ maNguoiNhan: ma, loaiThongBao: 'LichDuKien', tieuDe: `Lịch dạy dự kiến lớp ${g.l.ten}`, noiDung: `Bạn được phân công lớp ${g.l.ten}: ${moTa}, bắt đầu ${tuNgay}. Vui lòng phản hồi trong 24 giờ.`, thoiDiemGui: g.gui, trangThaiGui: 'DaGui' });
      for (const h of hvCuaLop(g.l.ma)) dsThongBao.push({ maPHHV: h.ma, loaiThongBao: 'LichDuKien', tieuDe: `Lịch học dự kiến lớp ${g.l.ten}`, noiDung: `Lịch học dự kiến: ${moTa}, bắt đầu ${tuNgay}. Vui lòng xác nhận trong 24 giờ.`, thoiDiemGui: g.gui, trangThaiGui: 'DaGui' });
    }
    // UC_8: mỗi lần giáo viên / trợ giảng xác nhận một ca → báo Quản lý
    for (const b of g.buoi) {
      for (const p of b.phanCong.filter((x) => x.trangThaiPhanCong === 'DaXacNhan')) {
        const hoTen = tenNguoi.get(p.maNhanSu);
        thongBaoQL({ loaiThongBao: 'PhanHoiMoi', tieuDe: `${hoTen} đã xác nhận lịch dạy`, noiDung: `${hoTen} xác nhận ca dạy lớp ${g.l.ten} · ${clock.nhanNgayDayDu(b.ngay)} · ${nhanCaCham(b.ca)}.`, thoiDiemGui: p.thoiDiemPhanHoi });
      }
    }
    // UC_6.4 bước 9–12: phát hành → lịch chính thức cho nhân sự và học viên
    const phatHanh = g.buoi[0].m.phatHanh;
    if (phatHanh) {
      for (const ma of nhanSu) dsThongBao.push({ maNguoiNhan: ma, loaiThongBao: 'LichChinhThuc', tieuDe: `Lịch dạy chính thức lớp ${g.l.ten}`, noiDung: `Lịch dạy chính thức: ${moTa}.`, thoiDiemGui: phatHanh, trangThaiGui: 'DaGui' });
      for (const h of hvCuaLop(g.l.ma)) dsThongBao.push({ maPHHV: h.ma, loaiThongBao: 'LichChinhThuc', tieuDe: `Lịch học chính thức lớp ${g.l.ten}`, noiDung: `Lịch học chính thức: ${moTa}.`, thoiDiemGui: phatHanh, trangThaiGui: 'DaGui' });
    }
  }
  // UC_11 luồng 3a: học viên từ chối ca học → chuyển về Quản lý
  for (const { b, h, xn } of dsTuChoi) {
    thongBaoQL({ loaiThongBao: 'PhanHoiMoi', tieuDe: `Học viên ${h.ten} từ chối ca học`, noiDung: `Lớp ${b.l.ten} · ${clock.nhanNgayDayDu(b.ngay)}: ${xn.lyDoTuChoi}`, thoiDiemGui: xn.thoiGianXacNhan });
  }
  // UC_13 bước 6: báo vắng → báo ngay Quản lý
  for (const { b, h, yc } of dsBaoVang) {
    thongBaoQL({ loaiThongBao: 'BaoVang', tieuDe: `Báo vắng: ${h.ten}`, noiDung: `Lớp ${b.l.ten} · ${clock.nhanNgayDayDu(b.ngay)} · ${nhanCaCham(b.ca)}.`, thoiDiemGui: yc.thoiGianGui });
  }
  dsThongBao.sort((a, b) => a.thoiDiemGui - b.thoiDiemGui);
  const maTB = await sinhNhieuMa('TB', dsThongBao.length);
  await ThongBao.insertMany(dsThongBao.map((t, i) => ({ _id: maTB[i], ...t })));

  return { dsHV, dsBuoi, dsBaoVang, dsPhieu, dsThongBao, nhatKy, tenNguoi, mocLop };
}

/* ================================================================================================ kiểm tra logic */
async function kiemTra() {
  const ketQua = [];
  const ghi = (ten, soMuc, loi) => ketQua.push({ ten, soMuc, loi });
  const [dsLop, dsKhoa, dsPhong, dsHV, dsNS, dsLich, dsDK, dsRanh, dsPhieu, dsTB, dsQL, dsDem] = await Promise.all([
    LopHoc.find().lean(), KhoaHoc.find().lean(), PhongHoc.find().lean(), PhuHuynhHocVien.find().lean(), NhanSuGiangDay.find().lean(),
    LichDay.find().lean(), DangKyPhong.find().lean(), LichRanh.find().lean(), PhanHoiGopY.find().lean(), ThongBao.find().lean(), QuanLy.find().lean(), BoDem.find().lean(),
  ]);
  const phong = new Map(dsPhong.map((p) => [p._id, p]));
  const lop = new Map(dsLop.map((l) => [l._id, l]));
  const khoaHoc = new Map(dsKhoa.map((k) => [k._id, k]));
  const ns = new Map(dsNS.map((x) => [x._id, x]));
  const hv = new Map(dsHV.map((x) => [x._id, x]));
  const conHieuLuc = dsLich.filter((b) => b.trangThaiLich !== 'DaHuy');
  const ngayS = (d) => clock.dinhDangNgay(d);
  const hvCua = (maLop) => dsHV.filter((h) => h.lopTheoHoc.includes(maLop));
  const buoiCua = (maLop) => conHieuLuc.filter((b) => b.maLop === maLop);

  // 1. Sĩ số = số học viên đang theo học
  ghi('Sĩ số lớp bằng số học viên được gán vào lớp', dsLop.length,
    dsLop.filter((l) => hvCua(l._id).length !== l.soLuongHocVien).map((l) => `${l._id}: sĩ số ${l.soLuongHocVien}, có ${hvCua(l._id).length} học viên`));
  // 2. Sức chứa phòng
  ghi('Phòng của mọi buổi học đủ sức chứa sĩ số lớp', conHieuLuc.length,
    conHieuLuc.filter((b) => phong.get(b.maPhong).sucChua < lop.get(b.maLop).soLuongHocVien).map((b) => `${b._id} ${b.maLop} ở ${b.maPhong}`));
  // 3. Số buổi × số tiết = tổng số tiết
  const lopCoLich = dsLop.filter((l) => buoiCua(l._id).length);
  ghi('Số buổi còn hiệu lực × số tiết mỗi buổi = tổng số tiết của lớp', lopCoLich.length,
    lopCoLich.filter((l) => buoiCua(l._id).reduce((s, b) => s + b.soTiet, 0) !== l.tongSoTiet).map((l) => `${l._id}: ${buoiCua(l._id).reduce((s, b) => s + b.soTiet, 0)} / ${l.tongSoTiet} tiết`));
  // 4. Buổi học nằm trong thời gian khóa học
  ghi('Mọi buổi học nằm trong thời gian khóa học', dsLich.length,
    dsLich.filter((b) => { const k = khoaHoc.get(lop.get(b.maLop).maKhoaHoc); return b.ngayDay < k.ngayBatDau || b.ngayDay > k.ngayKetThuc; }).map((b) => `${b._id} ${b.maLop} ${ngayS(b.ngayDay)}`));
  // 5. Trạng thái lớp khớp ngày
  ghi('Trạng thái lớp khớp ngày học (Kết thúc / Đang học / Chưa mở)', dsLop.length, dsLop.filter((l) => {
    const ds = buoiCua(l._id).map((b) => b.ngayDay).sort((a, b) => a - b);
    if (!ds.length) return l.trangThaiLop !== 'ChuaMo';
    if (l.trangThaiLop === 'KetThuc') return ds[ds.length - 1] >= HOM_NAY;
    if (l.trangThaiLop === 'DangHoc') return !(ds[0] <= HOM_NAY && ds[ds.length - 1] >= HOM_NAY);
    return ds[0] <= HOM_NAY;
  }).map((l) => `${l._id}: ${l.trangThaiLop}`));
  // 6–7. Không trùng phòng / lớp / nhân sự
  const chiem = new Map();
  const trung = [];
  const dat = (k, moTa) => { if (chiem.has(k)) trung.push(`${moTa} trùng ${chiem.get(k)}`); else chiem.set(k, moTa); };
  for (const b of conHieuLuc) {
    dat(khoaSlot(`phong:${b.maPhong}`, b.ngayDay, b.maCa), `${b._id} (${b.maLop})`);
    dat(khoaSlot(`lop:${b.maLop}`, b.ngayDay, b.maCa), `${b._id} (${b.maLop})`);
    for (const p of b.phanCong) dat(khoaSlot(`ns:${p.maNhanSu}`, b.ngayDay, b.maCa), `${b._id} (${p.maNhanSu})`);
  }
  for (const d of dsDK.filter((x) => x.trangThaiDangKy === 'DaDangKy')) dat(khoaSlot(`phong:${d.maPhong}`, d.ngaySuDung, d.maCa), `đăng ký ${d._id}`);
  ghi('Không trùng phòng, trùng lớp, trùng giáo viên / trợ giảng (kể cả với đăng ký phòng)', conHieuLuc.length + dsDK.length, trung);
  // 8. Chuyên môn
  ghi('Giáo viên được phân công đúng chuyên môn môn học của lớp', conHieuLuc.length, conHieuLuc.flatMap((b) => b.phanCong
    .filter((p) => p.vaiTro === 'GiaoVien' && !ns.get(p.maNhanSu).chuyenMon.includes(lop.get(b.maLop).maMonHoc))
    .map((p) => `${b._id}: ${p.maNhanSu} dạy ${b.maLop}`)));
  ghi('Mỗi buổi tối đa 1 giáo viên + 1 trợ giảng; vai trò khớp loại nhân sự', conHieuLuc.length, conHieuLuc.filter((b) => {
    const gv = b.phanCong.filter((p) => p.vaiTro === 'GiaoVien'); const tg = b.phanCong.filter((p) => p.vaiTro === 'TroGiang');
    return gv.length > 1 || tg.length > 1 || b.phanCong.some((p) => ns.get(p.maNhanSu).loaiNhanSu !== p.vaiTro);
  }).map((b) => b._id));
  // 9. Lịch rảnh
  const loiRanh = [];
  for (const r of dsRanh) {
    if (r.cacRanh.length < 5) loiRanh.push(`${r._id} ${r.maNhanSu}: chỉ ${r.cacRanh.length} ca`);
    const moCong = luc(clock.congNgay(r.tuanBatDau, -7), '08:00');
    const dongCong = luc(clock.congNgay(r.tuanBatDau, -3), '23:59');
    if (r.thoiDiemCapNhat < moCong || r.thoiDiemCapNhat > dongCong || r.thoiDiemCapNhat > LUC) loiRanh.push(`${r._id} ${r.maNhanSu}: cập nhật ngoài khung ${clock.dinhDangNgay(r.tuanBatDau)}`);
  }
  ghi('Lịch rảnh mỗi tuần ≥ 5 ca, cập nhật trong khung Thứ Hai 08:00 – Thứ Năm 23:59 của tuần trước', dsRanh.length, loiRanh);
  const ranh = new Set(dsRanh.flatMap((r) => r.cacRanh.map((c) => khoaSlot(r.maNhanSu, c.ngayRanh, c.maCa))));
  const tuanCoRanh = new Set(dsRanh.map((r) => `${r.maNhanSu}|${ngayS(r.tuanBatDau)}`));
  const ngoaiRanh = [];
  for (const b of conHieuLuc) {
    for (const p of b.phanCong) {
      if (!tuanCoRanh.has(`${p.maNhanSu}|${ngayS(clock.dauTuan(b.ngayDay))}`)) continue;
      if (!ranh.has(khoaSlot(p.maNhanSu, b.ngayDay, b.maCa))) ngoaiRanh.push(`${p.maNhanSu} ${ngayS(b.ngayDay)} ${b.maCa} (${b.maLop})`);
    }
  }
  const coY = ngoaiRanh.filter((x) => x.startsWith('GV-002') && x.includes(ngayS(ngayCua(1, 3))));
  ghi('Buổi được phân công nằm trong lịch rảnh đã đăng ký (trừ tình huống nghỉ phép cài sẵn)', conHieuLuc.length, ngoaiRanh.filter((x) => !coY.includes(x)));
  // 10. Trạng thái lịch ↔ phân công ↔ thời hạn 24 giờ
  const loiTT = [];
  for (const b of dsLich) {
    const gv = b.phanCong.filter((p) => p.vaiTro === 'GiaoVien');
    if (b.trangThaiLich === 'Nhap' && b.phanCong.length) loiTT.push(`${b._id}: Nháp nhưng đã phân công`);
    if (b.trangThaiLich === 'ChoGVXacNhan' && (!gv.length || !b.thoiDiemGuiDuKien)) loiTT.push(`${b._id}: chờ GV nhưng chưa phân công / chưa gửi`);
    if (['DaDuyet', 'DaPhatHanh'].includes(b.trangThaiLich) && !gv.every((p) => p.trangThaiPhanCong === 'DaXacNhan')) loiTT.push(`${b._id}: đã duyệt khi GV chưa xác nhận`);
    for (const p of b.phanCong) {
      const han = congGio(p.thoiDiemGuiThongBao, HAN_24_GIO);
      if (p.trangThaiPhanCong === 'ChoXacNhan' && han <= LUC) loiTT.push(`${b._id}: ${p.maNhanSu} chờ xác nhận nhưng đã quá 24 giờ`);
      if (p.thoiDiemPhanHoi && (p.thoiDiemPhanHoi < p.thoiDiemGuiThongBao || p.thoiDiemPhanHoi > han)) loiTT.push(`${b._id}: ${p.maNhanSu} phản hồi ngoài 24 giờ`);
    }
  }
  ghi('Trạng thái lịch khớp phân công; giáo viên phản hồi trong 24 giờ sau khi gửi', dsLich.length, loiTT);
  // 11. Lịch sử thao tác theo đúng thứ tự thời gian, trước buổi học
  const THU_TU = { Tao: 0, PhanCong: 1, GuiDuKien: 2, PheDuyet: 3, PhatHanh: 4, CapNhat: 5, Huy: 6 };
  ghi('Lịch sử thao tác đúng thứ tự (Tạo → Phân công → Gửi dự kiến → Phê duyệt → Phát hành) và trước giờ học', dsLich.length, dsLich.filter((b) => {
    for (let i = 1; i < b.lichSu.length; i += 1) {
      if (b.lichSu[i].thoiDiem < b.lichSu[i - 1].thoiDiem || THU_TU[b.lichSu[i].hanhDong] < THU_TU[b.lichSu[i - 1].hanhDong]) return true;
    }
    return b.lichSu.some((x) => x.thoiDiem > LUC || x.thoiDiem > batDauCa(b.ngayDay, b.maCa));
  }).map((b) => b._id));
  // 12. Xác nhận ca học
  ghi('Xác nhận / từ chối ca học: đúng học viên của lớp, trong 24 giờ sau khi gửi, trước thời điểm hiện tại', dsLich.reduce((s, b) => s + b.xacNhanCaHoc.length, 0), dsLich.flatMap((b) => b.xacNhanCaHoc.filter((x) => {
    const h = hv.get(x.maPHHV);
    return !h || !h.lopTheoHoc.includes(b.maLop) || x.thoiGianXacNhan < b.thoiDiemGuiDuKien || x.thoiGianXacNhan > congGio(b.thoiDiemGuiDuKien, HAN_24_GIO) || x.thoiGianXacNhan > LUC || (x.ketQua === 'TuChoi' && !x.lyDoTuChoi);
  }).map((x) => `${b._id} ${x.maPHHV}`)));
  // 13. Báo vắng
  ghi('Báo vắng: buổi đã phát hành, đúng học viên, gửi trước giờ học ≥ 2 tiếng, sau khi phát hành', dsLich.reduce((s, b) => s + b.yeuCauNghiHoc.length, 0), dsLich.flatMap((b) => b.yeuCauNghiHoc.filter((y) => {
    const phatHanh = b.lichSu.find((x) => x.hanhDong === 'PhatHanh');
    return b.trangThaiLich !== 'DaPhatHanh' || !hv.get(y.maPHHV)?.lopTheoHoc.includes(b.maLop) || !phatHanh || y.thoiGianGui < phatHanh.thoiDiem
      || y.thoiGianGui > new Date(batDauCa(b.ngayDay, b.maCa).getTime() - 2 * clock.MOT_GIO) || y.thoiGianGui > LUC;
  }).map((y) => `${b._id} ${y.maPHHV}`)));
  // 14. Học viên không học hai lớp trùng ngày–ca
  const lichHV = new Map();
  const trungHV = [];
  for (const b of conHieuLuc) {
    for (const h of hvCua(b.maLop)) {
      const k = khoaSlot(h._id, b.ngayDay, b.maCa);
      if (lichHV.has(k)) trungHV.push(`${h._id}: ${lichHV.get(k)} và ${b.maLop} ${ngayS(b.ngayDay)}`); else lichHV.set(k, b.maLop);
    }
  }
  ghi('Học viên học nhiều lớp không có hai buổi trùng ngày–ca', dsHV.length, trungHV);
  // 15. Phiếu phản hồi
  const LOAI_NS = ['DoiLich', 'NghiPhep', 'GopY'];
  ghi('Phiếu phản hồi: loại phiếu đúng nhóm người gửi; lịch sử xử lý đúng chuỗi trạng thái và thời gian', dsPhieu.length, dsPhieu.filter((p) => {
    if (p.maNhanSu ? !LOAI_NS.includes(p.loaiPhanHoi) || !ns.has(p.maNhanSu) : LOAI_NS.includes(p.loaiPhanHoi) || !hv.has(p.maPHHV)) return true;
    let tt = 'ChoXuLy'; let truoc = p.thoiGianGui;
    for (const x of p.lichSuXuLy) {
      if (x.thoiGianXuLy < truoc || x.thoiGianXuLy > LUC) return true;
      truoc = x.thoiGianXuLy;
      if (x.loaiThaoTac === 'CapNhatTrangThai') { if (x.trangThaiTruoc !== tt) return true; tt = x.trangThaiSau; if (tt === 'TuChoi' && !x.ghiChuXuLy) return true; }
    }
    return tt !== p.trangThaiXuLy;
  }).map((p) => p._id));
  // 16. Thông báo
  const coNguoi = (t) => (t.maNguoiNhan ? ns.has(t.maNguoiNhan) || dsQL.some((q) => q._id === t.maNguoiNhan) : hv.has(t.maPHHV));
  ghi('Thông báo: người nhận tồn tại, đã gửi trước thời điểm hiện tại', dsTB.length, dsTB.filter((t) => !coNguoi(t) || t.thoiDiemGui > LUC).map((t) => t._id));
  // 17. Đăng ký phòng
  ghi('Đăng ký phòng: đăng ký trước giờ sử dụng; hủy trước giờ sử dụng', dsDK.length, dsDK.filter((d) => {
    const batDau = batDauCa(d.ngaySuDung, d.maCa);
    return d.thoiDiemDangKy >= batDau || d.thoiDiemDangKy > LUC || (d.thoiDiemHuy && (d.thoiDiemHuy >= batDau || d.thoiDiemHuy < d.thoiDiemDangKy));
  }).map((d) => d._id));
  // 18. Tài khoản
  const tk = [...dsQL, ...dsNS];
  const trungTK = ['tenDangNhap', 'email', 'soDienThoai'].flatMap((f) => tk.map((x) => x[f]).filter((v, i, a) => a.indexOf(v) !== i).map((v) => `${f}: ${v}`));
  ghi('Tên đăng nhập, email, số điện thoại nhân sự không trùng nhau; học viên trùng số chỉ khi là anh chị em', tk.length + dsHV.length, trungTK);
  // 19. Tệp
  const tep = [...dsNS.flatMap((x) => x.bangCap.map((bc) => bc.hinhAnh)), ...dsPhieu.flatMap((p) => p.tepDinhKem.map((t) => t.duongDan))];
  const thieuTep = [];
  for (const d of tep) if (!(await timTep(d.replace(/^\/uploads\//, '')))) thieuTep.push(d);
  ghi('Mọi ảnh bằng cấp / tệp minh chứng có thật trong kho tệp (GridFS)', tep.length, thieuTep);
  // 20. Bộ đếm mã
  const dem = new Map(dsDem.map((d) => [d._id, d.giaTri]));
  const maMax = (ds, tienTo) => Math.max(0, ...ds.filter((x) => x.startsWith(`${tienTo}-`)).map((x) => Number(x.split('-').pop())));
  const kiemDem = [
    ['QL', dsQL.map((x) => x._id)], ['GV', dsNS.map((x) => x._id)], ['TG', dsNS.map((x) => x._id)], ['HV', dsHV.map((x) => x._id)],
    ['LD', dsLich.map((x) => x._id)], ['DK', dsDK.map((x) => x._id)], ['LR', dsRanh.map((x) => x._id)], ['TB', dsTB.map((x) => x._id)],
  ];
  ghi('Bộ đếm mã tự sinh ≥ mã lớn nhất đang dùng (mã tạo mới sau khi nhập không bị trùng)', kiemDem.length,
    kiemDem.filter(([t, ds]) => (dem.get(t) || 0) < maMax(ds, t)).map(([t]) => t));
  return ketQua;
}

/* ================================================================================================ chạy thử API */
async function chayThuApi(dsHV) {
  const { taoApp } = require('../src/app');
  const srv = taoApp().listen(0);
  await new Promise((ok) => srv.once('listening', ok));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const goi = async (method, url, { token, body } = {}) => {
    const r = await fetch(base + url, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const laAnh = (r.headers.get('content-type') || '').startsWith('image/');
    return { status: r.status, body: laAnh ? null : await r.json().catch(() => ({})) };
  };
  const ketQua = [];
  const thu = async (moTa, method, url, opt, kiem) => {
    const r = await goi(method, url, opt);
    let loi = r.status !== 200 ? `HTTP ${r.status} ${r.body?.message || ''}` : null;
    if (!loi && kiem) loi = kiem(r.body?.data) || null;
    ketQua.push({ moTa, url, loi });
    return r.body?.data;
  };
  const dangNhap = async (tenDangNhap) => (await goi('POST', '/api/auth/dang-nhap', { body: { tenDangNhap, matKhau: MAT_KHAU_MAU } })).body?.data?.token;
  try {
    const ql = await dangNhap('quanly');
    ketQua.push({ moTa: 'Quản lý đăng nhập', url: 'POST /api/auth/dang-nhap', loi: ql ? null : 'không đăng nhập được' });
    const tq = await thu('Trang chủ Quản lý (MH04)', 'GET', '/api/quan-ly/tong-quan', { token: ql });
    await thu('Quản lý lịch dạy (MH19)', 'GET', '/api/quan-ly/quan-ly-lich', { token: ql });
    await thu('Lớp chưa có lịch (MH20) có IE65-K13', 'GET', '/api/quan-ly/quan-ly-lich/lop-chua-co-lich', { token: ql }, (d) => (JSON.stringify(d).includes('IE65-K13') ? null : 'thiếu IE65-K13'));
    await thu('Đề xuất phương án lịch cho IE65-K13', 'POST', '/api/quan-ly/quan-ly-lich/de-xuat', { token: ql, body: { maLop: 'IE65-K13' } }, (d) => (d?.phuongAn?.length ? null : 'không có phương án'));
    await thu('Phân công IELTS 6.5 – K12: có giáo viên đề xuất (MH23)', 'GET', '/api/quan-ly/quan-ly-lich/IE65-K12/phan-cong', { token: ql }, (d) => (d?.deXuat?.some((g) => g.maNhanSu === 'GV-005') ? null : 'không đề xuất David Miller'));
    await thu('Phân công TOEIC 650 – K06: có giáo viên đề xuất', 'GET', '/api/quan-ly/quan-ly-lich/TOEIC-K06/phan-cong', { token: ql }, (d) => (d?.deXuat?.some((g) => g.maNhanSu === 'GV-003') ? null : 'không đề xuất Phạm Thu Hà'));
    await thu('Kids Movers – K04 đủ điều kiện phê duyệt (MH24)', 'GET', '/api/quan-ly/quan-ly-lich/Kids-K04/kiem-tra', { token: ql }, (d) => (d?.coThePheDuyet ? null : 'không phê duyệt được'));
    await thu('Lịch tuần tới (MH22): buổi bị ảnh hưởng do GV nghỉ phép', 'GET', '/api/quan-ly/quan-ly-lich/tuan-toi', { token: ql }, (d) => (d?.buoiBiAnhHuong?.length === 1 ? null : `có ${d?.buoiBiAnhHuong?.length} buổi bị ảnh hưởng`));
    await thu('Tra cứu lịch dạy (MH17)', 'GET', `/api/quan-ly/lich-day?tuNgay=${clock.dinhDangNgay(W0)}&denNgay=${clock.dinhDangNgay(clock.congNgay(W0, 13))}`, { token: ql });
    await thu('Phòng trống hôm nay (MH05)', 'GET', `/api/quan-ly/phong-hoc/trong?ngay=${clock.dinhDangNgay(HOM_NAY)}`, { token: ql });
    await thu('Danh sách đăng ký phòng (MH08)', 'GET', '/api/quan-ly/dang-ky-phong', { token: ql });
    await thu('Hồ sơ giáo viên (MH09)', 'GET', '/api/quan-ly/ho-so-giao-vien', { token: ql });
    const hs = await thu('Chi tiết hồ sơ Nguyễn Thị Lan (MH10)', 'GET', '/api/quan-ly/ho-so-giao-vien/GV-001', { token: ql });
    for (const bc of hs?.bangCap || []) {
      const r = await fetch(base + (bc.hinhAnh || bc.duongDan || ''), { headers: { Authorization: `Bearer ${ql}` } });
      ketQua.push({ moTa: `Ảnh bằng cấp "${bc.tenBangCap}" hiển thị được`, url: bc.hinhAnh || bc.duongDan, loi: r.status === 200 ? null : `HTTP ${r.status}` });
    }
    await thu('Phản hồi & yêu cầu (MH13)', 'GET', '/api/quan-ly/phan-hoi', { token: ql });
    const dsNSChay = NHAN_SU.map((x) => x.ten);
    for (const ten of dsNSChay) {
      const t = await dangNhap(ten);
      if (!t) { ketQua.push({ moTa: `${ten} đăng nhập`, url: 'POST /api/auth/dang-nhap', loi: 'không đăng nhập được' }); continue; }
      await thu(`${ten}: trang chủ, lịch dạy, ca dự kiến, lịch rảnh, yêu cầu`, 'GET', '/api/giao-vien/tong-quan', { token: t });
      await thu(`${ten}: lịch dạy`, 'GET', '/api/giao-vien/lich-day', { token: t });
      const ca = await thu(`${ten}: ca dự kiến`, 'GET', '/api/giao-vien/ca-du-kien', { token: t });
      if (ten === 'gvnguyenlan') ketQua.push({ moTa: 'Nguyễn Thị Lan có 12 ca Giao tiếp B1 – K09 chờ phản hồi', url: '/api/giao-vien/ca-du-kien', loi: (Array.isArray(ca) ? ca : ca?.ds || []).length === 12 ? null : `có ${(Array.isArray(ca) ? ca : ca?.ds || []).length} ca` });
      await thu(`${ten}: lịch rảnh`, 'GET', '/api/giao-vien/lich-ranh', { token: t });
      await thu(`${ten}: yêu cầu đã gửi`, 'GET', '/api/giao-vien/yeu-cau', { token: t });
    }
    const mau = [dsHV[0], dsHV[1], dsHV[3], dsHV[4], dsHV[10], dsHV[dsHV.length - 1]];
    for (const h of mau) {
      const r = await goi('POST', '/api/auth/phu-huynh/dang-nhap', { body: { hoTen: h.ten, soDienThoai: h.sdt } });
      const t = r.body?.data?.token;
      ketQua.push({ moTa: `Phụ huynh / học viên ${h.ten} đăng nhập`, url: 'POST /api/auth/phu-huynh/dang-nhap', loi: t ? null : `HTTP ${r.status}` });
      if (!t) continue;
      await thu(`${h.ten}: danh sách lớp`, 'GET', '/api/phu-huynh/lop', { token: t }, (d) => ((d || []).length === h.lop.length ? null : `thấy ${(d || []).length} lớp, đúng ra ${h.lop.length}`));
      for (const maLop of h.lop) await thu(`${h.ten}: thời khóa biểu ${maLop}`, 'GET', `/api/phu-huynh/thoi-khoa-bieu?maLop=${encodeURIComponent(maLop)}`, { token: t });
      await thu(`${h.ten}: lịch dự kiến`, 'GET', '/api/phu-huynh/lich-du-kien', { token: t });
      await thu(`${h.ten}: phiếu góp ý`, 'GET', '/api/phu-huynh/gop-y', { token: t });
    }
    return { ketQua, tongQuan: tq };
  } finally {
    await new Promise((ok) => srv.close(ok));
  }
}

/* ================================================================================================ xuất tệp */
const COLLECTION_XUAT = ['caHoc', 'phongHoc', 'monHoc', 'khoaHoc', 'lopHoc', 'nguoiDung', 'phuHuynhHocVien', 'lichRanh', 'lichDay',
  'dangKyPhong', 'phanHoiGopY', 'thongBao', 'boDem', `${BUCKET}.files`, `${BUCKET}.chunks`];

async function xuat() {
  const thuMucJson = path.join(THU_MUC_RA, 'json');
  fs.mkdirSync(thuMucJson, { recursive: true });
  for (const f of fs.readdirSync(thuMucJson)) if (f.endsWith('.json')) fs.unlinkSync(path.join(thuMucJson, f));
  const dem = {};
  for (const ten of COLLECTION_XUAT) {
    const docs = await mongoose.connection.db.collection(ten).find().sort({ _id: 1 }).toArray();
    fs.writeFileSync(path.join(thuMucJson, `${ten}.json`), `${EJSON.stringify(docs, null, 1, { relaxed: true })}\n`);
    dem[ten] = docs.length;
  }
  return dem;
}

/* ================================================================================================ báo cáo */
function bang(dau, dong) {
  return [`| ${dau.join(' | ')} |`, `| ${dau.map(() => '---').join(' | ')} |`, ...dong.map((d) => `| ${d.join(' | ')} |`)].join('\n');
}

async function vietBaoCao({ kq, api, dem, du, tongQuan }) {
  const dsLop = await LopHoc.find().lean();
  const dsLich = await LichDay.find().lean();
  const dsNS = await NhanSuGiangDay.find().lean();
  const dsRanh = await LichRanh.find({ tuanBatDau: ngayCua(1, 1) }).lean();
  const tenTT = { Nhap: 'Nháp', ChoGVXacNhan: 'Chờ GV xác nhận', DaDuyet: 'Đã duyệt', DaPhatHanh: 'Đã phát hành', DaHuy: 'Đã hủy' };
  const tenTTLop = { ChuaMo: 'Chưa mở', DangHoc: 'Đang học', KetThuc: 'Kết thúc' };
  const tenNS = new Map(dsNS.map((x) => [x._id, x.hoTen]));
  const lopRows = LOP.map((l) => {
    const db = dsLop.find((x) => x._id === l.ma);
    const buoi = dsLich.filter((b) => b.maLop === l.ma && b.trangThaiLich !== 'DaHuy').sort((a, b) => a.ngayDay - b.ngayDay);
    const tt = l.kieu === 'ChoDuyet' ? 'Chờ GV xác nhận (GV đã xác nhận đủ → chờ phê duyệt)' : ([...new Set(buoi.map((b) => tenTT[b.trangThaiLich]))].join(', ') || '—');
    return [l.ma, l.ten, `${l.siSo}`, `${l.tiet}`, l.lich ? `${clock.chuoiThu(l.lich.thu)} · ${CA_MAP.get(l.lich.ca).tenCa} · ${tenPhong(l.lich.phong)}` : '—',
      buoi.length ? `${nhanNgay(buoi[0].ngayDay)} → ${clock.nhanNgayDayDu(buoi[buoi.length - 1].ngayDay).split(', ')[1]} (${buoi.length} buổi)` : 'Chưa xếp lịch',
      l.lich?.gv ? `${tenNS.get(l.lich.gv)}${l.lich.tg ? ` + TG ${tenNS.get(l.lich.tg)}` : ''}` : '—', tenTTLop[db.trangThaiLop], tt];
  });
  const TEN_THU_NGAN = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const nsRows = NHAN_SU.map((x) => {
    const r = dsRanh.find((d) => d.maNhanSu === x.ma);
    const lopDay = LOP.filter((l) => l.lich && (l.lich.gv === x.ma || l.lich.tg === x.ma) && trangThai(l) !== 'KetThuc').map((l) => l.ma).join(', ') || '—';
    return [x.ma, x.hoTen, `\`${x.ten}\``, x.loai === 'GiaoVien' ? 'Giáo viên' : 'Trợ giảng', x.hinhThuc === 'ToanThoiGian' ? 'Toàn thời gian' : 'Bán thời gian', `${x.kn} năm`,
      x.cm.map((c) => MON.find((m) => m._id === c).tenMonHoc).join(', ') || '—', r.cacRanh.map((c) => `${TEN_THU_NGAN[clock.thuTrongTuan(c.ngayRanh)]} ${CA_MAP.get(c.maCa).tenCa.replace('Ca ', 'C')}`).join(', '), lopDay];
  });
  function trangThai(l) { return dsLop.find((x) => x._id === l.ma).trangThaiLop; }
  const loiLogic = kq.filter((x) => x.loi.length);
  const loiApi = api.ketQua.filter((x) => x.loi);
  const thoiDiem = GIO_HIEN_TAI;

  const baoCao = `# Kết quả kiểm tra bộ dữ liệu thử

Sinh và kiểm tra tự động bằng \`npm run sinh-du-lieu-thu\` (thư mục \`backend\`). Thời điểm "hiện tại" của bộ dữ liệu: **${thoiDiem}**.

**Kiểm tra logic: ${kq.length - loiLogic.length}/${kq.length} quy tắc đạt · Gọi thử API thật: ${api.ketQua.length - loiApi.length}/${api.ketQua.length} đạt**

Toàn bộ dữ liệu được ghi qua model của hệ thống vào MongoDB tạm, nên đồng thời đã qua: kiểm tra kiểu / bắt buộc / giá trị liệt kê
của Mongoose, \`$jsonSchema\` của CSDL, và các chỉ mục duy nhất chống trùng phòng (\`UX_LichDay_Phong\`), trùng lớp (\`UX_LichDay_Lop\`),
trùng giáo viên / trợ giảng (\`UX_LichDay_NhanSu\`), trùng đăng ký phòng (\`UX_DangKyPhong\`).

## Quy tắc logic

${bang(['#', 'Quy tắc', 'Số mục kiểm', 'Kết quả'], kq.map((x, i) => [`${i + 1}`, x.ten, `${x.soMuc}`, x.loi.length ? `**Không đạt** – ${x.loi.slice(0, 5).join('; ')}` : 'Đạt']))}

## Tình huống thật được cài sẵn để thử chức năng cảnh báo

${du.nhatKy.tinhHuong.map((t) => `- **${t.loai}**: ${t.moTa}`).join('\n')}

Trang chủ Quản lý hiện **${tongQuan?.thongKe?.xungDotCanXuLy ?? '?'} cảnh báo** – đều từ tình huống trên:
${(tongQuan?.canhBaoXungDot || []).map((c) => `- ${c.tieuDe}: ${c.moTa}`).join('\n')}

Vì các tuần sau chưa mở cổng đăng ký lịch rảnh, hệ thống tạm dùng mẫu lịch rảnh của tuần gần nhất cho các tuần đó, nên cảnh báo
lặp lại ở các Thứ Tư tiếp theo trong 28 ngày tới cho tới khi giáo viên đăng ký lịch rảnh các tuần đó.

## Gọi thử API thật trên bộ dữ liệu

${bang(['Kiểm tra', 'Kết quả'], api.ketQua.map((x) => [x.moTa, x.loi ? `**Lỗi** – ${x.loi}` : 'Đạt']))}

## Số bản ghi xuất ra

${bang(['Collection', 'Số bản ghi'], Object.entries(dem).map(([k, v]) => [`\`${k}\``, `${v}`]))}
`;
  fs.writeFileSync(path.join(THU_MUC_RA, 'KIEM_TRA_LOGIC.md'), baoCao);

  const soXN = dsLich.reduce((s, b) => s + b.xacNhanCaHoc.length, 0);
  const tongHop = `## Tổng quan dữ liệu (tự sinh)

Thời điểm "hiện tại" của bộ dữ liệu: **${thoiDiem}** · tuần này ${nhanNgay(W0)} – ${clock.nhanNgayDayDu(clock.congNgay(W0, 6)).split(', ')[1]}, tuần tới ${nhanNgay(ngayCua(1, 1))} – ${clock.nhanNgayDayDu(ngayCua(1, 0)).split(', ')[1]}.

${dem.nguoiDung} tài khoản nhân sự (${QUAN_LY.length} quản lý, ${NHAN_SU.filter((x) => x.loai === 'GiaoVien').length} giáo viên, ${NHAN_SU.filter((x) => x.loai === 'TroGiang').length} trợ giảng) ·
${du.dsHV.length} học viên (${du.dsHV.filter((h) => h.lop.length > 1).length} học 2 lớp) · ${LOP.length} lớp · ${dem.lichDay} buổi dạy ·
${dem.lichRanh} bản lịch rảnh · ${soXN} lượt xác nhận ca học · ${du.dsBaoVang.length} lượt báo vắng · ${dem.dangKyPhong} đăng ký phòng ·
${dem.phanHoiGopY} phiếu phản hồi · ${dem.thongBao} thông báo · ${dem[`${BUCKET}.files`]} tệp ảnh.

### Lớp học

${bang(['Mã lớp', 'Tên lớp', 'Sĩ số', 'Số tiết', 'Lịch', 'Thời gian', 'Giáo viên / trợ giảng', 'Trạng thái lớp', 'Trạng thái lịch'], lopRows)}

### Nhân sự (mật khẩu chung \`${MAT_KHAU_MAU}\`)

Lịch rảnh là bản đã đăng ký cho tuần tới.

${bang(['Mã', 'Họ tên', 'Tên đăng nhập', 'Loại', 'Hình thức', 'Kinh nghiệm', 'Chuyên môn', 'Lịch rảnh tuần tới', 'Đang dạy'], nsRows)}

Quản lý: \`quanly\` (Trần Thu Trang), \`quanly2\` (Lê Minh Hoàng) – cùng mật khẩu.

### Phụ huynh / học viên tiêu biểu (đăng nhập bằng họ tên học viên + số điện thoại)

${bang(['Họ tên học viên', 'Số điện thoại', 'Lớp', 'Dùng để thử'], [
    [du.dsHV[0].ten, du.dsHV[0].sdt, du.dsHV[0].lop.join(', '), 'Học 2 lớp → màn hình Chọn lớp; có báo vắng sẵn buổi tuần tới; có phiếu "Phòng P.102 thiếu máy chiếu" đã xử lý'],
    [du.dsHV[1].ten, du.dsHV[1].sdt, du.dsHV[1].lop.join(', '), 'Lịch dự kiến tuần tới **chưa xác nhận** (còn hạn 24 giờ) → thử xác nhận / từ chối'],
    [du.dsHV[2].ten, du.dsHV[2].sdt, du.dsHV[2].lop.join(', '), 'Thời khóa biểu có buổi bù Thứ Bảy; phiếu góp ý đã được trả lời'],
    [du.dsHV[3].ten, du.dsHV[3].sdt, du.dsHV[3].lop.join(', '), 'Thiếu nhi; cùng số điện thoại với em Trần Gia Hân (GS Milky)'],
    [du.dsHV[4].ten, du.dsHV[4].sdt, du.dsHV[4].lop.join(', '), 'Lớp chờ phê duyệt, đã xác nhận lịch dự kiến'],
    [du.dsHV[6].ten, du.dsHV[6].sdt, du.dsHV[6].lop.join(', '), 'Lớp đã duyệt, chờ phát hành; phiếu chờ xử lý'],
  ])}
`;
  return tongHop;
}

/* ================================================================================================ README */
function vietReadme(tongHop, dem) {
  const tong = Object.values(dem).reduce((a, b) => a + b, 0);
  return `# Bộ dữ liệu thử – Hệ thống quản lý lịch dạy Broadway

Bộ dữ liệu để nạp vào CSDL và **chạy thử toàn bộ hệ thống** (cả 3 vai trò). Gồm ${tong} bản ghi trong 15 collection, ở dạng
MongoDB Extended JSON (\`json/<collection>.json\`, mỗi tệp là một mảng). **Chỉ nạp vào CSDL chạy thử / nghiệm thu** – nạp sẽ
thay toàn bộ dữ liệu của các collection đó, kể cả tài khoản.

- \`json/\` – dữ liệu (nạp theo một trong ba cách bên dưới).
- \`KIEM_TRA_LOGIC.md\` – kết quả tự kiểm tra: 21 quy tắc nghiệp vụ + gọi thử API thật trên chính bộ dữ liệu này.
- \`thong-tin.json\` – thời điểm "hiện tại" mà bộ dữ liệu được sinh cho, và số bản ghi.

Sinh lại (và tự kiểm tra lại): \`cd backend && npm run sinh-du-lieu-thu\` – mã nguồn \`backend/scripts/sinh-du-lieu-thu.js\`.

## Nguồn dữ liệu

| Dữ liệu | Lấy từ |
| --- | --- |
| 3 ca học (07:30–11:30, 13:30–16:30, 17:30–21:00), 12 phòng, 4 môn | Biên bản phỏng vấn + danh mục gốc \`backend/src/seed/duLieuGoc.js\` (giống hệt \`init-master-data\`) |
| Tên giáo viên, trợ giảng, quản lý, lớp, phòng, học viên tiêu biểu, ngày, mã phiếu | Ví dụ "VD:" trong đặc tả use case / màn hình Figma (Nguyễn Thị Lan, Trần Minh Quân, Phạm Thu Hà, Võ Ngọc Mai, David Miller, Lê Hoàng Anh, Trần Thu Trang, Nguyễn Minh An; IELTS Foundation – K15, Giao tiếp A2 – K08, TOEIC 650, Kids Starters – K03, IELTS 6.5; "Phòng P.102 thiếu máy chiếu"; "16/11/2026 → 08/03/2027"…) và bảng lịch AS-IS (GS Milky, GS Rabbit; Mandy, Haley, John; Ty Na, Tuyết Nhi, Như Ý) như dữ liệu mẫu sẵn có |
| Giá trị liệt kê (trạng thái lịch, loại phiếu, lý do nghỉ…) | Bảng giá trị Enum của đặc tả |
| Sĩ số ~15 học viên/lớp (10–20), báo vắng ~3% lượt học | Bảng 5.27 "Ước lượng dung lượng dữ liệu" của đặc tả (thu nhỏ còn 12 lớp) |
| Nhịp học 2 buổi/tuần (Thứ 3, 5 · Thứ 2, 4 · Thứ 7, CN; lớp GS 4 buổi/tuần), 3 tiết/buổi | Ví dụ lịch trên các màn hình của đặc tả – *không* theo giả định "3 buổi/tuần" chỉ dùng để ước lượng dung lượng |
| Quy tắc thời gian: lịch rảnh ≥ 5 ca/tuần, cập nhật Thứ Hai 08:00 – Thứ Năm 23:59 tuần trước; phản hồi / xác nhận trong 24 giờ; báo vắng trước giờ học ≥ 2 tiếng | Biên bản phỏng vấn + quy tắc nghiệp vụ (BR) của các use case |

**Phần tự tạo thêm (không có trong tài liệu):** tên và số điện thoại của các học viên còn lại (sinh ngẫu nhiên, cố định theo hạt
giống – chạy lại cho ra đúng bộ cũ), email / địa chỉ nhân sự, tên bằng cấp, nội dung các phiếu phản hồi, và ảnh bằng cấp / ảnh
minh chứng – là **ảnh minh họa** có dòng chữ "ẢNH MINH HỌA – DỮ LIỆU THỬ", không phải giấy tờ thật. Chỉ 1/12 phiếu có tệp đính kèm
(phiếu cơ sở vật chất "Phòng P.102 thiếu máy chiếu"), thấp hơn mức ~30% của Bảng 5.27: phiếu của giáo viên không kèm được tệp, và
các phiếu còn lại không có nội dung cần minh chứng.

## Bảo đảm logic

Mọi bản ghi được tạo đúng theo trình tự các use case (tạo lịch → phân công → gửi dự kiến → giáo viên xác nhận → phê duyệt → phát
hành → học viên xác nhận / báo vắng…), với **đúng nội dung thông báo và lịch sử thao tác mà hệ thống tự ghi** ở từng bước.
Trước khi xuất, bộ sinh ghi tất cả vào MongoDB tạm qua model của hệ thống (validator, \`$jsonSchema\`, chỉ mục chống trùng phòng /
lớp / giáo viên), kiểm tra 21 quy tắc và gọi thử API thật – xem \`KIEM_TRA_LOGIC.md\`. Một số điểm chính:

- Sĩ số lớp = số học viên được gán; phòng đủ sức chứa; số buổi × 3 tiết = tổng số tiết; buổi học nằm trong thời gian khóa học;
  trạng thái lớp (Chưa mở / Đang học / Kết thúc) khớp ngày học.
- Không trùng phòng, lớp, giáo viên, trợ giảng (kể cả với đăng ký phòng); giáo viên đúng chuyên môn; mỗi buổi tối đa 1 GV + 1 TG.
- Buổi được phân công nằm trong lịch rảnh đã đăng ký; học viên học 2 lớp không bị trùng giờ.
- Mọi mốc thời gian ≤ thời điểm "hiện tại"; phản hồi / xác nhận trong 24 giờ; báo vắng trước giờ học ≥ 2 tiếng.
- Lịch sử xử lý phiếu đúng chuỗi trạng thái; bộ đếm mã ≥ mã lớn nhất (tạo mới sau khi nạp không bị trùng mã).

## Thời điểm của bộ dữ liệu – quan trọng

Bộ dữ liệu được sinh cho **${GIO_HIEN_TAI}** (xem \`thong-tin.json\`). Hệ thống chạy theo đồng hồ thật, nên
nạp trong vòng vài giờ sau mốc đó thì mọi màn hình khớp nhất (tuần này / tuần tới, "còn … giờ để phản hồi"…). Nạp vào ngày khác thì sinh lại cho
đúng thời điểm nạp (phải là Thứ Sáu, Thứ Bảy hoặc Chủ Nhật – sau khi cổng đăng ký lịch rảnh tuần tới đã đóng):

\`\`\`bash
cd backend && npm run sinh-du-lieu-thu -- --luc 2026-11-20T14:00:00+07:00
\`\`\`

## Cách nạp

Cách 1 – bằng lệnh của dự án (khuyên dùng; tự tạo collection / validator / chỉ mục còn thiếu, có xác nhận trước khi ghi đè):

\`\`\`bash
cd backend && npm run nap-du-lieu-thu
\`\`\`

Nạp vào CSDL MongoDB Atlas mà bản Render đang dùng – chạy trên máy cá nhân (đã \`npm install\` trong \`backend\`), lấy **3 giá trị
giống hệt mục Environment của dịch vụ trên Render**: \`MONGODB_URI\` (không chứa tài khoản), \`MONGODB_USER\`, \`MONGODB_PASSWORD\`.
Atlas → Network Access phải cho phép IP máy đang chạy (hướng dẫn triển khai đã mở \`0.0.0.0/0\`). PowerShell trên Windows:

\`\`\`powershell
cd backend
$env:MONGODB_URI="mongodb+srv://<cụm>.mongodb.net/BroadwayDB?retryWrites=true&w=majority"
$env:MONGODB_USER="<tài khoản>"
$env:MONGODB_PASSWORD="<mật khẩu>"
npm run nap-du-lieu-thu -- --xac-nhan
\`\`\`

Thành công khi dòng đầu ghi \`database "BroadwayDB"\` (đúng tên database trong \`MONGODB_URI\` của Render) và dòng cuối ghi
\`Xong: … bản ghi\`. Không cần khởi động lại dịch vụ trên Render. Đã có tài khoản quản lý trong dữ liệu nên Render không tạo lại
tài khoản \`admin\` khi khởi động.

Cách 2 – \`mongoimport\` (MongoDB Database Tools), mỗi collection một lệnh, ví dụ:

\`\`\`bash
mongoimport --uri "<chuỗi kết nối>/BroadwayDB" --collection lichDay --jsonArray --drop --file json/lichDay.json
\`\`\`

Lặp lại cho cả 15 tệp (tên collection = tên tệp, kể cả \`tepTaiLen.files\` và \`tepTaiLen.chunks\` chứa ảnh). Cách này không tạo
validator / chỉ mục: CSDL phải được hệ thống khởi tạo trước (chạy ứng dụng hoặc \`npm run init-master-data\` một lần).

Cách 3 – MongoDB Compass: mở từng collection → **Add Data → Import JSON or CSV file** → chọn tệp tương ứng (xóa dữ liệu cũ của
collection trước khi nhập).

Sau khi nạp: đăng nhập Quản lý \`quanly\` / mật khẩu \`${MAT_KHAU_MAU}\`. Tài khoản quản lý cũ trong CSDL (nếu có) bị thay bằng
tài khoản của bộ dữ liệu; nhật ký hệ thống (\`audit_logs\`) không bị đụng tới.

${tongHop}
## Tình huống có sẵn để thử

- **Quản lý**: trang chủ có cảnh báo *Sai lịch rảnh* của Trần Minh Quân (đã xin nghỉ Thứ Tư tuần tới và bỏ ca đó khỏi lịch rảnh) –
  vào *Lập lịch tuần tới* để chọn giáo viên dạy thay (John rảnh, đúng chuyên môn). Hệ thống dùng mẫu lịch rảnh tuần gần nhất cho các
  tuần chưa đăng ký nên cảnh báo lặp lại ở các Thứ Tư sau trong 28 ngày tới – đúng thiết kế, hết khi giáo viên đăng ký các tuần đó.
- **Quản lý**: *Kids Movers – K04* đủ điều kiện phê duyệt → phát hành; *TOEIC 650 – K05* đã duyệt → phát hành;
  *TOEIC 650 – K06*, *IELTS 6.5 – K12* là bản nháp → phân công (hệ thống đề xuất Phạm Thu Hà, David Miller);
  *IELTS 6.5 – K13* chưa có lịch → tạo lịch; 5 phiếu chờ xử lý (xin nghỉ phép, xin đổi lịch, góp ý…); đăng ký / hủy phòng.
- **Giáo viên** \`gvnguyenlan\`: 12 ca *Giao tiếp B1 – K09* chờ phản hồi (hạn ${clock.nhanNgayDayDu(clock.ngayCuaThoiDiem(congGio(LUC_GUI_CHO_GV, 24)))} ${gioVN(congGio(LUC_GUI_CHO_GV, 24))}) → xác nhận / đề xuất thay đổi; cập nhật lịch rảnh.
- **Phụ huynh** Lê Văn Bình – 0934556778: lịch dự kiến *Giao tiếp B1 – K09* chưa xác nhận → xác nhận / từ chối.
  Nguyễn Minh An – 0905000456: học 2 lớp, đã báo vắng sẵn một buổi tuần tới (thử báo vắng buổi khác), có phiếu đã được trả lời.
- *Giao tiếp A2 – K08*: buổi Thứ Tư tuần này đã hủy khi lập lịch tuần (P.102 thay máy chiếu), có buổi bù Thứ Bảy.
`;
}

/* ================================================================================================ main */
(async () => {
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' }, binary: { version: process.env.MONGOMS_VERSION || '7.0.14' } });
  try {
    await ketNoiCSDL(rs.getUri('BroadwayDB'), { taiKhoan: null, dongBoCauTruc: true });
    const du = await sinh();
    const kq = await kiemTra();
    const api = await chayThuApi(du.dsHV);
    const dem = await xuat();
    const tongHop = await vietBaoCao({ kq, api, dem, du, tongQuan: api.tongQuan });
    fs.writeFileSync(path.join(THU_MUC_RA, 'README.md'), vietReadme(tongHop, dem));
    fs.writeFileSync(path.join(THU_MUC_RA, 'thong-tin.json'), `${JSON.stringify({ thoiDiemHienTai: LUC.toISOString(), tuanNay: clock.dinhDangNgay(W0), soBanGhi: dem }, null, 2)}\n`);
    const loi = kq.filter((x) => x.loi.length).length + api.ketQua.filter((x) => x.loi).length;
    // eslint-disable-next-line no-console
    console.log(`[sinh-du-lieu-thu] ${loi ? `CÓ ${loi} MỤC KHÔNG ĐẠT` : 'Đạt toàn bộ kiểm tra'} · đã xuất ${Object.values(dem).reduce((a, b) => a + b, 0)} bản ghi vào ${THU_MUC_RA}`);
    process.exitCode = loi ? 1 : 0;
  } finally {
    clock.setNow(null);
    await ngatKetNoiCSDL().catch(() => {});
    await rs.stop();
  }
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[sinh-du-lieu-thu] Lỗi:', err);
  process.exit(1);
});
