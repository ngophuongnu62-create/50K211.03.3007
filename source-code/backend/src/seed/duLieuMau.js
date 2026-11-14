/**
 * Dữ liệu mẫu – tên người, lớp, phòng lấy theo màn hình Figma và bảng lịch AS-IS
 * (lớp GS Milky, GS Rabbit; giáo viên Mandy, Haley, John; trợ giảng Ty Na, Tuyết Nhi, Như Ý).
 * Ngày giờ tính tương đối theo tuần hiện tại để luôn có dữ liệu thử các luồng.
 */
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const clock = require('../utils/clock');
const { sinhNhieuMa, sinhMaPhieu, sinhMa } = require('../utils/sinhMa');
const models = require('../models');

const {
  NguoiDung, QuanLy, NhanSuGiangDay, MonHoc, KhoaHoc, LopHoc, PhuHuynhHocVien, PhongHoc, CaHoc,
  DangKyPhong, LichRanh, LichDay, PhanHoiGopY, ThongBao, BoDem,
} = models;

const MAT_KHAU_MAU = 'Broadway@2026';

const { CA, PHONG, MON } = require('./duLieuGoc');

const LOP = [
  ['IEF-K15', 'IELTS Foundation – K15', 'MH-IELTS', 'IELTS', 16, 48, 'DangHoc', 'KH-IEF-15', 'IELTS Foundation · Khóa 15', -2, 16],
  ['GT-A2-08', 'Giao tiếp A2 – K08', 'MH-GT', 'Giao tiếp', 16, 48, 'DangHoc', 'KH-GTA2-08', 'Giao tiếp A2 · Khóa 8', -2, 16],
  ['GT-B1-09', 'Giao tiếp B1 – K09', 'MH-GT', 'Giao tiếp', 14, 36, 'ChuaMo', 'KH-GTB1-09', 'Giao tiếp B1 · Khóa 9', 1, 12],
  ['TOEIC-K05', 'TOEIC 650 – K05', 'MH-TOEIC', 'TOEIC', 20, 40, 'ChuaMo', 'KH-TOEIC-05', 'TOEIC 650 · Khóa 5', 1, 14],
  ['TOEIC-K06', 'TOEIC 650 – K06', 'MH-TOEIC', 'TOEIC', 18, 40, 'ChuaMo', 'KH-TOEIC-06', 'TOEIC 650 · Khóa 6', 1, 14],
  ['Kids-K03', 'Kids Starters – K03', 'MH-KIDS', 'Thiếu nhi', 12, 60, 'DangHoc', 'KH-KIDS-03', 'Kids Starters · Khóa 3', -2, 20],
  ['Kids-K04', 'Kids Movers – K04', 'MH-KIDS', 'Thiếu nhi', 12, 60, 'ChuaMo', 'KH-KIDS-04', 'Kids Movers · Khóa 4', 1, 20],
  ['IE65-K12', 'IELTS 6.5 – K12', 'MH-IELTS', 'IELTS', 18, 48, 'ChuaMo', 'KH-IE65-12', 'IELTS 6.5 · Khóa 12', 1, 16],
  ['IE65-K13', 'IELTS 6.5 – K13', 'MH-IELTS', 'IELTS', 18, 48, 'ChuaMo', 'KH-IE65-13', 'IELTS 6.5 · Khóa 13', 1, 20],
  ['GS-MILKY', 'GS Milky – U15', 'MH-KIDS', 'GS', 12, 60, 'DangHoc', 'KH-GS-2026', 'GS · 2026', -4, 30],
  ['GS-RABBIT', 'GS Rabbit – U29', 'MH-KIDS', 'GS', 10, 60, 'DangHoc', 'KH-GS-2026', 'GS · 2026', -4, 30],
];

// [ma, hoTen, tenDangNhap, sdt, loaiNhanSu, hinhThuc, kinhNghiem, chuyenMon]
const NHAN_SU = [
  ['GV-001', 'Nguyễn Thị Lan', 'gvnguyenlan', '0905100001', 'GiaoVien', 'ToanThoiGian', 6, ['MH-IELTS', 'MH-GT']],
  ['GV-002', 'Trần Minh Quân', 'gvtranquan', '0905100002', 'GiaoVien', 'BanThoiGian', 4, ['MH-GT']],
  ['GV-003', 'Phạm Thu Hà', 'gvphamha', '0905100003', 'GiaoVien', 'ToanThoiGian', 5, ['MH-IELTS', 'MH-TOEIC']],
  ['GV-004', 'Võ Ngọc Mai', 'gvvomai', '0905100004', 'GiaoVien', 'ToanThoiGian', 3, ['MH-KIDS', 'MH-GT']],
  ['GV-005', 'David Miller', 'gvdavid', '0905100005', 'GiaoVien', 'BanThoiGian', 3, ['MH-IELTS']],
  ['GV-006', 'Mandy', 'gvmandy', '0905100006', 'GiaoVien', 'BanThoiGian', 4, ['MH-KIDS']],
  ['GV-007', 'Haley', 'gvhaley', '0905100007', 'GiaoVien', 'BanThoiGian', 2, ['MH-KIDS']],
  ['GV-008', 'John', 'gvjohn', '0905100008', 'GiaoVien', 'BanThoiGian', 5, ['MH-KIDS', 'MH-GT']],
  ['TG-001', 'Lê Hoàng Anh', 'tgleanh', '0905200001', 'TroGiang', 'ToanThoiGian', 2, ['MH-GT']],
  ['TG-002', 'Ty Na', 'tgtyna', '0905200002', 'TroGiang', 'BanThoiGian', 1, []],
  ['TG-003', 'Tuyết Nhi', 'tgtuyetnhi', '0905200003', 'TroGiang', 'BanThoiGian', 1, []],
  ['TG-004', 'Như Ý', 'tgnhuy', '0905200004', 'TroGiang', 'BanThoiGian', 1, []],
];

// [ma, tenHocVien, soDienThoai, lopTheoHoc]
const HOC_VIEN = [
  ['HV-0001', 'Nguyễn Minh An', '0905000456', ['IEF-K15', 'GT-A2-08', 'GT-B1-09']],
  ['HV-0002', 'Lê Văn Bình', '0934556778', ['GT-A2-08', 'GT-B1-09']],
  ['HV-0003', 'Đỗ Thị Hằng', '0905667889', ['GT-A2-08']],
  ['HV-0004', 'Trần Gia Huy', '0912345001', ['Kids-K04', 'Kids-K03']],
  ['HV-0005', 'Phạm Bảo Ngọc', '0912345002', ['Kids-K04']],
  ['HV-0006', 'Hoàng Minh Khoa', '0912345003', ['IEF-K15']],
  ['HV-0007', 'Vũ Thanh Tâm', '0912345004', ['TOEIC-K05']],
  ['HV-0008', 'Bùi Anh Thư', '0912345005', ['GS-MILKY']],
  ['HV-0009', 'Ngô Gia Bảo', '0912345006', ['GS-RABBIT']],
  ['HV-0010', 'Đặng Khánh Linh', '0912345007', ['Kids-K03']],
];

// Lịch rảnh mẫu (thứ: 0 = CN … 6 = Thứ Bảy); "khongRanhTuanToi" tạo buổi bị ảnh hưởng cho UC_6.2
const LICH_RANH = {
  'GV-001': [[1, 'CA3'], [2, 'CA3'], [3, 'CA3'], [4, 'CA3'], [5, 'CA2'], [6, 'CA1']],
  'GV-002': [[1, 'CA2'], [3, 'CA2'], [2, 'CA2'], [4, 'CA2'], [5, 'CA2'], [6, 'CA1']],
  'GV-003': [[2, 'CA3'], [4, 'CA3'], [6, 'CA1'], [1, 'CA1'], [3, 'CA1'], [5, 'CA3']],
  'GV-004': [[2, 'CA2'], [4, 'CA2'], [6, 'CA2'], [0, 'CA2'], [1, 'CA1'], [5, 'CA1']],
  'GV-005': [[2, 'CA3'], [4, 'CA3'], [1, 'CA3'], [3, 'CA2'], [5, 'CA1']],
  'GV-006': [[1, 'CA3'], [2, 'CA3'], [3, 'CA3'], [4, 'CA3'], [5, 'CA3']],
  'GV-007': [[6, 'CA1'], [0, 'CA1'], [1, 'CA2'], [2, 'CA2'], [3, 'CA2']],
  'GV-008': [[1, 'CA1'], [3, 'CA2'], [5, 'CA2'], [6, 'CA2'], [0, 'CA3']],
  'TG-001': [[1, 'CA2'], [3, 'CA2'], [6, 'CA1'], [2, 'CA1'], [4, 'CA1']],
  'TG-002': [[2, 'CA3'], [4, 'CA3'], [1, 'CA2'], [3, 'CA2'], [5, 'CA3']],
  'TG-003': [[1, 'CA3'], [2, 'CA3'], [3, 'CA3'], [4, 'CA3'], [5, 'CA3']],
  'TG-004': [[1, 'CA1'], [2, 'CA1'], [3, 'CA1'], [4, 'CA1'], [5, 'CA1']],
};
const KHONG_RANH_TUAN_TOI = { 'GV-002': [[3, 'CA2']] }; // Trần Minh Quân bận Thứ Tư Ca 2 tuần tới

/** Dấu hiệu nhận biết CSDL demo (bộ đếm đặc biệt do chính script demo tạo) */
const DAU_HIEU_DEMO = 'DU_LIEU_DEMO';

/**
 * Chốt an toàn trước khi xóa: dữ liệu demo CHỈ được nạp lại khi
 * (1) không phải production và (2) CSDL là CSDL demo (có dấu hiệu demo) hoặc chưa có dữ liệu nghiệp vụ nào.
 * Nhờ vậy không thể vô tình xóa dữ liệu thật của trung tâm.
 */
async function kiemTraDuocNapDemo() {
  if (env.LA_PRODUCTION) throw new Error('Không được nạp dữ liệu demo trên môi trường production.');
  if (await BoDem.exists({ _id: DAU_HIEU_DEMO })) return;
  const coDuLieu = await Promise.all([LichDay, LopHoc, PhuHuynhHocVien, NhanSuGiangDay, PhanHoiGopY, DangKyPhong, LichRanh].map((m) => m.exists({})));
  if (coDuLieu.some(Boolean)) {
    throw new Error('CSDL đang có dữ liệu nghiệp vụ không phải dữ liệu demo – từ chối xóa. Hãy dùng một CSDL riêng cho demo.');
  }
}

async function xoaHet() {
  await kiemTraDuocNapDemo();
  for (const m of [NguoiDung, MonHoc, KhoaHoc, LopHoc, PhuHuynhHocVien, PhongHoc, CaHoc, DangKyPhong, LichRanh, LichDay, PhanHoiGopY, ThongBao, BoDem]) {
    await m.deleteMany({});
  }
}

function ngayTheoThu(dauTuan, thu) {
  return clock.congNgay(dauTuan, (thu + 6) % 7);
}

async function napDuLieuMau({ xoaCu = true } = {}) {
  if (xoaCu) await xoaHet();
  else await kiemTraDuocNapDemo();
  const bayGio = clock.now();
  const W0 = clock.dauTuan(clock.homNay());
  const gioTruoc = (h) => new Date(bayGio.getTime() - h * clock.MOT_GIO);
  const matKhau = await bcrypt.hash(MAT_KHAU_MAU, 10);

  // Danh mục
  await CaHoc.insertMany(CA);
  await PhongHoc.insertMany(PHONG);
  await MonHoc.insertMany(MON);
  const khoa = new Map();
  for (const l of LOP) {
    if (!khoa.has(l[7])) {
      const bd = clock.congNgay(W0, l[9] * 7);
      khoa.set(l[7], { _id: l[7], tenKhoaHoc: l[8], ngayBatDau: bd, ngayKetThuc: clock.congNgay(bd, l[10] * 7 - 1) });
    }
  }
  await KhoaHoc.insertMany([...khoa.values()]);
  await LopHoc.insertMany(LOP.map((l) => ({
    _id: l[0], tenLop: l[1], maMonHoc: l[2], loaiLop: l[3], soLuongHocVien: l[4], tongSoTiet: l[5], trangThaiLop: l[6], maKhoaHoc: l[7],
  })));

  // Người dùng
  await QuanLy.create([
    { _id: 'QL-001', hoTen: 'Trần Thu Trang', soDienThoai: '0905000000', email: 'trang.tran@broadway.edu.vn', tenDangNhap: 'quanly', matKhau },
    { _id: 'QL-002', hoTen: 'Lê Minh Hoàng', soDienThoai: '0905000009', email: 'hoang.le@broadway.edu.vn', tenDangNhap: 'quanly2', matKhau },
  ]);
  await NhanSuGiangDay.create(NHAN_SU.map(([ma, hoTen, tenDangNhap, sdt, loaiNhanSu, hinhThucLamViec, kinhNghiem, chuyenMon], i) => ({
    _id: ma,
    hoTen,
    tenDangNhap,
    soDienThoai: sdt,
    email: `${tenDangNhap}@broadway.edu.vn`,
    matKhau,
    diaChi: 'Đà Nẵng',
    loaiNhanSu,
    hinhThucLamViec,
    kinhNghiem,
    chuyenMon,
    bangCap: [{ maBangCap: `BC-${String(i + 1).padStart(5, '0')}`, tenBangCap: loaiNhanSu === 'GiaoVien' ? 'Cử nhân Ngôn ngữ Anh' : 'Chứng chỉ TESOL', hinhAnh: '/uploads/bangcap/mau.png' }],
  })));
  await BoDem.insertMany([
    { _id: DAU_HIEU_DEMO, giaTri: 1 }, { _id: 'QL', giaTri: 2 }, { _id: 'GV', giaTri: 8 }, { _id: 'TG', giaTri: 4 }, { _id: 'HV', giaTri: HOC_VIEN.length }, { _id: 'BC', giaTri: NHAN_SU.length },
  ]);
  await PhuHuynhHocVien.insertMany(HOC_VIEN.map(([_id, tenHocVien, soDienThoai, lopTheoHoc]) => ({ _id, tenHocVien, soDienThoai, lopTheoHoc })));

  // Lịch rảnh tuần này và tuần tới
  const docRanh = [];
  for (const [maNhanSu, ds] of Object.entries(LICH_RANH)) {
    for (const tuan of [0, 1]) {
      const dau = clock.congNgay(W0, tuan * 7);
      const loaiTru = tuan === 1 ? (KHONG_RANH_TUAN_TOI[maNhanSu] || []) : [];
      const cacRanh = ds
        .filter(([thu, ca]) => !loaiTru.some(([t, c]) => t === thu && c === ca))
        .map(([thu, maCa]) => ({ ngayRanh: ngayTheoThu(dau, thu), maCa }));
      docRanh.push({ maNhanSu, tuanBatDau: dau, cacRanh, thoiDiemCapNhat: gioTruoc(30) });
    }
  }
  const maLR = await sinhNhieuMa('LR', docRanh.length);
  await LichRanh.insertMany(docRanh.map((d, i) => ({ _id: maLR[i], ...d })));

  // Lịch dạy
  const dsBuoi = [];
  const themNhom = ({ maLop, maPhong, maCa, thu, tuan, trangThaiLich, giaoVien, troGiang, guiLuc, phanHoiLuc, trangThaiPhanCong, ghiChu }) => {
    for (const t of tuan) {
      for (const th of thu) {
        dsBuoi.push({
          maLop, maPhong, maCa, ngayDay: ngayTheoThu(clock.congNgay(W0, t * 7), th), trangThaiLich,
          giaoVien, troGiang, guiLuc, phanHoiLuc, trangThaiPhanCong, ghiChu,
        });
      }
    }
  };
  const tuan = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const daGui = { guiLuc: gioTruoc(24 * 21), phanHoiLuc: gioTruoc(24 * 20), trangThaiPhanCong: 'DaXacNhan' };
  themNhom({ maLop: 'IEF-K15', maPhong: 'P201', maCa: 'CA3', thu: [2, 4], tuan: tuan(-2, 5), trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-001', troGiang: 'TG-002', ...daGui });
  themNhom({ maLop: 'GT-A2-08', maPhong: 'P102', maCa: 'CA2', thu: [1, 3], tuan: tuan(-2, 5), trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-002', troGiang: 'TG-001', ...daGui });
  themNhom({ maLop: 'GT-A2-08', maPhong: 'P102', maCa: 'CA1', thu: [6], tuan: [0], trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-002', troGiang: 'TG-001', ghiChu: 'Buổi bù', ...daGui }); // buổi bù
  themNhom({ maLop: 'Kids-K03', maPhong: 'P101', maCa: 'CA2', thu: [6, 0], tuan: tuan(-2, 5), trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-004', ...daGui });
  themNhom({ maLop: 'GS-MILKY', maPhong: 'P302', maCa: 'CA3', thu: [1, 2, 3, 4], tuan: tuan(-1, 3), trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-006', troGiang: 'TG-003', ...daGui });
  themNhom({ maLop: 'GS-RABBIT', maPhong: 'P303', maCa: 'CA1', thu: [6, 0], tuan: tuan(-1, 3), trangThaiLich: 'DaPhatHanh', giaoVien: 'GV-007', ...daGui });
  themNhom({ maLop: 'TOEIC-K05', maPhong: 'P301', maCa: 'CA1', thu: [6], tuan: tuan(1, 8), trangThaiLich: 'DaDuyet', giaoVien: 'GV-003', guiLuc: gioTruoc(30), phanHoiLuc: gioTruoc(28), trangThaiPhanCong: 'DaXacNhan' });
  themNhom({ maLop: 'Kids-K04', maPhong: 'P101', maCa: 'CA2', thu: [2, 4], tuan: tuan(1, 6), trangThaiLich: 'ChoGVXacNhan', giaoVien: 'GV-004', guiLuc: gioTruoc(5), phanHoiLuc: gioTruoc(4), trangThaiPhanCong: 'DaXacNhan' });
  themNhom({ maLop: 'GT-B1-09', maPhong: 'P202', maCa: 'CA3', thu: [1, 3], tuan: tuan(1, 6), trangThaiLich: 'ChoGVXacNhan', giaoVien: 'GV-001', guiLuc: gioTruoc(6), trangThaiPhanCong: 'ChoXacNhan' });
  themNhom({ maLop: 'IE65-K12', maPhong: 'P202', maCa: 'CA3', thu: [2, 4], tuan: tuan(1, 8), trangThaiLich: 'Nhap' });
  themNhom({ maLop: 'TOEIC-K06', maPhong: 'P301', maCa: 'CA2', thu: [1, 3], tuan: tuan(1, 8), trangThaiLich: 'Nhap' });

  const n = dsBuoi.length;
  const [maLD, maLS, maPC, maXN] = await Promise.all([
    sinhNhieuMa('LD', n), sinhNhieuMa('LS', n * 4), sinhNhieuMa('PC', n * 2), sinhNhieuMa('XN', n),
  ]);
  let iLS = 0;
  let iPC = 0;
  let iXN = 0;
  const docLich = dsBuoi.map((b, i) => {
    const lichSu = [{ maLichSuLich: maLS[iLS++], maQuanLy: 'QL-001', hanhDong: 'Tao', thoiDiem: gioTruoc(24 * 30), ...(b.ghiChu ? { ghiChu: b.ghiChu } : {}) }];
    const phanCong = [];
    for (const [ma, vaiTro] of [[b.giaoVien, 'GiaoVien'], [b.troGiang, 'TroGiang']]) {
      if (!ma) continue;
      phanCong.push({
        maPhanCong: maPC[iPC++], maNhanSu: ma, vaiTro, trangThaiPhanCong: b.trangThaiPhanCong,
        thoiDiemGuiThongBao: b.guiLuc, ...(b.phanHoiLuc ? { thoiDiemPhanHoi: b.phanHoiLuc } : {}),
      });
    }
    if (phanCong.length) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: 'QL-001', hanhDong: 'GuiDuKien', thoiDiem: b.guiLuc });
    if (['DaDuyet', 'DaPhatHanh'].includes(b.trangThaiLich)) lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: 'QL-001', hanhDong: 'PheDuyet', thoiDiem: b.phanHoiLuc });
    if (b.trangThaiLich === 'DaPhatHanh') lichSu.push({ maLichSuLich: maLS[iLS++], maQuanLy: 'QL-001', hanhDong: 'PhatHanh', thoiDiem: b.phanHoiLuc });
    // Phụ huynh Phạm Bảo Ngọc đã xác nhận các ca dự kiến của Kids Movers – K04
    const xacNhanCaHoc = b.maLop === 'Kids-K04'
      ? [{ maXacNhan: maXN[iXN++], maPHHV: 'HV-0005', ketQua: 'XacNhan', thoiGianXacNhan: gioTruoc(3) }]
      : [];
    return {
      _id: maLD[i],
      maLop: b.maLop,
      maPhong: b.maPhong,
      maCa: b.maCa,
      maQuanLy: 'QL-001',
      ngayDay: b.ngayDay,
      soTiet: 3,
      trangThaiLich: b.trangThaiLich,
      thoiDiemTao: gioTruoc(24 * 30),
      ...(b.guiLuc ? { thoiDiemGuiDuKien: b.guiLuc } : {}),
      phanCong,
      lichSu,
      xacNhanCaHoc,
      yeuCauNghiHoc: [],
    };
  });
  await LichDay.insertMany(docLich);

  // Đăng ký phòng: P.101 Chủ Nhật tuần tới Ca 2 (trùng buổi Kids Starters – K03 → buổi bị ảnh hưởng UC_6.2),
  // P.202 Thứ Năm tuần này Ca 3, và một đăng ký đã hủy
  const maDK = await sinhNhieuMa('DK', 3);
  await DangKyPhong.insertMany([
    { _id: maDK[0], maPhong: 'P101', maCa: 'CA2', maQuanLy: 'QL-001', ngaySuDung: ngayTheoThu(clock.congNgay(W0, 7), 0), trangThaiDangKy: 'DaDangKy', thoiDiemDangKy: gioTruoc(20) },
    { _id: maDK[1], maPhong: 'P202', maCa: 'CA3', maQuanLy: 'QL-001', ngaySuDung: ngayTheoThu(W0, 4), trangThaiDangKy: 'DaDangKy', thoiDiemDangKy: gioTruoc(50) },
    { _id: maDK[2], maPhong: 'P301', maCa: 'CA1', maQuanLy: 'QL-002', ngaySuDung: ngayTheoThu(W0, 5), trangThaiDangKy: 'DaHuy', thoiDiemDangKy: gioTruoc(72), thoiDiemHuy: gioTruoc(48) },
  ]);

  // Phiếu phản hồi
  const phieu = [
    { maPHHV: 'HV-0001', loaiPhanHoi: 'CoSoVatChat', tieuDe: 'Phòng P.102 thiếu máy chiếu', noiDung: 'Phòng P.102 không có máy chiếu trong buổi học Giao tiếp A2 – K08, giáo viên phải dạy trên bảng.', thoiGianGui: gioTruoc(24 * 6), trangThaiXuLy: 'DangXuLy', maQuanLy: 'QL-001', lichSu: [{ loaiThaoTac: 'CapNhatTrangThai', trangThaiTruoc: 'ChoXuLy', trangThaiSau: 'DangXuLy', ghiChuXuLy: 'Đã báo bộ phận kỹ thuật', thoiGianXuLy: gioTruoc(24 * 5) }] },
    { maNhanSu: 'GV-001', loaiPhanHoi: 'DoiLich', tieuDe: 'Xin đổi ca dạy Thứ Ba tuần sau', noiDung: 'Thứ Ba tuần sau em có lịch thi chứng chỉ, xin đổi ca dạy IELTS Foundation – K15 sang Thứ Tư cùng giờ.', thoiGianGui: gioTruoc(10), trangThaiXuLy: 'ChoXuLy' },
    { maNhanSu: 'GV-002', loaiPhanHoi: 'NghiPhep', tieuDe: 'Xin nghỉ phép Thứ Tư tuần sau', noiDung: 'Em xin nghỉ phép Thứ Tư tuần sau vì việc gia đình.', thoiGianGui: gioTruoc(26), trangThaiXuLy: 'ChoXuLy' },
    { maPHHV: 'HV-0002', loaiPhanHoi: 'ChatLuongGiangDay', tieuDe: 'Đề nghị tăng thời lượng luyện nói', noiDung: 'Mong trung tâm tăng thời lượng luyện nói trong mỗi buổi học.', thoiGianGui: gioTruoc(24 * 9), trangThaiXuLy: 'DaXuLy', maQuanLy: 'QL-001', lichSu: [
      { loaiThaoTac: 'CapNhatTrangThai', trangThaiTruoc: 'ChoXuLy', trangThaiSau: 'DangXuLy', thoiGianXuLy: gioTruoc(24 * 8) },
      { loaiThaoTac: 'PhanHoiNguoiGui', noiDungPhanHoi: 'Cảm ơn phụ huynh đã góp ý. Từ tuần sau mỗi buổi học sẽ có thêm 20 phút luyện nói theo nhóm.', thoiGianXuLy: gioTruoc(24 * 7) },
      { loaiThaoTac: 'CapNhatTrangThai', trangThaiTruoc: 'DangXuLy', trangThaiSau: 'DaXuLy', thoiGianXuLy: gioTruoc(24 * 7) },
    ] },
    { maNhanSu: 'TG-002', loaiPhanHoi: 'GopY', tieuDe: 'Bổ sung tài liệu luyện nghe', noiDung: 'Đề xuất bổ sung bộ tài liệu luyện nghe cho lớp IELTS Foundation.', thoiGianGui: gioTruoc(30), trangThaiXuLy: 'ChoXuLy' },
  ];
  for (const p of phieu) {
    const { lichSu = [], ...goc } = p;
    const lichSuXuLy = [];
    for (const l of lichSu) lichSuXuLy.push({ maLichSu: await sinhMa('XL'), maQuanLy: 'QL-001', ...l });
    await PhanHoiGopY.create({ _id: await sinhMaPhieu(), ...goc, tepDinhKem: [], lichSuXuLy });
  }

  // Thông báo mẫu
  const maTB = await sinhNhieuMa('TB', 3);
  await ThongBao.insertMany([
    { _id: maTB[0], maNguoiNhan: 'GV-001', loaiThongBao: 'LichDuKien', tieuDe: 'Lịch dạy dự kiến lớp Giao tiếp B1 – K09', noiDung: 'Bạn được phân công lớp Giao tiếp B1 – K09. Vui lòng phản hồi trong 24 giờ.', thoiDiemGui: gioTruoc(6), trangThaiGui: 'DaGui' },
    { _id: maTB[1], maPHHV: 'HV-0001', loaiThongBao: 'LichDuKien', tieuDe: 'Lịch học dự kiến lớp Giao tiếp B1 – K09', noiDung: 'Vui lòng xác nhận lịch học dự kiến trong 24 giờ.', thoiDiemGui: gioTruoc(6), trangThaiGui: 'DaGui' },
    { _id: maTB[2], maNguoiNhan: 'QL-001', loaiThongBao: 'PhanHoiMoi', tieuDe: 'Phản hồi mới', noiDung: 'Nguyễn Thị Lan gửi yêu cầu đổi lịch.', thoiDiemGui: gioTruoc(10), trangThaiGui: 'DaGui' },
  ]);

  return {
    taiKhoan: {
      matKhau: MAT_KHAU_MAU,
      quanLy: ['quanly', 'quanly2'],
      giaoVien: NHAN_SU.filter((x) => x[4] === 'GiaoVien').map((x) => x[2]),
      troGiang: NHAN_SU.filter((x) => x[4] === 'TroGiang').map((x) => x[2]),
      phuHuynh: HOC_VIEN.map(([, ten, sdt, lop]) => ({ ten, sdt, soLop: lop.length })),
    },
    soBuoi: n,
  };
}

module.exports = { napDuLieuMau, MAT_KHAU_MAU, DAU_HIEU_DEMO };
