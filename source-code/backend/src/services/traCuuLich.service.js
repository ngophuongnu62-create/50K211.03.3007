/** UC_5 – Tra cứu tất cả lịch dạy (Quản lý). Chỉ đọc (BR06). */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { LichDay } = require('../models');
const { layBanDo, layTenNguoiDung, tomTatBuoi, nhanCa } = require('./danhMuc.service');


/** Trạng thái xác nhận (Đang thực hiện, Chưa hoàn thành, Đã xong) – suy ra từ thời gian buổi dạy */
const TRANG_THAI_THUC_HIEN = ['DangThucHien', 'ChuaHoanThanh', 'DaXong'];

function trangThaiThucHien(ld, ca, bayGio) {
  const batDau = clock.thoiDiem(ld.ngayDay, ca.gioBatDau);
  const ketThuc = clock.thoiDiem(ld.ngayDay, ca.gioKetThuc);
  if (bayGio >= ketThuc) return 'DaXong';
  if (bayGio >= batDau) return 'DangThucHien';
  return 'ChuaHoanThanh';
}

function chiTietBuoi(ld, banDo, ten, bayGio) {
  const lop = banDo.lop.get(ld.maLop);
  const ca = banDo.ca.get(ld.maCa);
  const theoVaiTro = (vt) => ld.phanCong.filter((p) => p.vaiTro === vt).map((p) => ({
    maNhanSu: p.maNhanSu, hoTen: ten.get(p.maNhanSu)?.hoTen, trangThaiPhanCong: p.trangThaiPhanCong,
  }));
  return {
    ...tomTatBuoi(ld, banDo),
    loaiLop: lop?.loaiLop,
    thoiGianDay: `${clock.nhanNgayDayDu(ld.ngayDay)} · ${nhanCa(ca)}`,
    giaoVien: theoVaiTro('GiaoVien'),
    troGiang: theoVaiTro('TroGiang'),
    soLuongHocVien: lop?.soLuongHocVien,
    trangThaiXacNhan: trangThaiThucHien(ld, ca, bayGio),
  };
}

/** UC_5 bước 2–6, luồng 4a, 4b; ngoại lệ 5a, 5b */
async function traCuu(q) {
  const loc = { trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } };
  const tuNgay = q.tuNgay ? clock.parseNgay(q.tuNgay) : null;
  const denNgay = q.denNgay ? clock.parseNgay(q.denNgay) : null;
  if ((q.tuNgay && !tuNgay) || (q.denNgay && !denNgay)) {
    throw new AppError(400, M.TC_NGAY_KHONG_HOP_LE, { fieldErrors: { thoiGianDay: M.TC_NGAY_KHONG_HOP_LE } });
  }
  if (tuNgay && denNgay && tuNgay > denNgay) {
    throw new AppError(400, M.TC_NGAY_KHONG_HOP_LE, { fieldErrors: { thoiGianDay: M.TC_NGAY_KHONG_HOP_LE } }); // BR05
  }
  if (tuNgay || denNgay) loc.ngayDay = { ...(tuNgay ? { $gte: tuNgay } : {}), ...(denNgay ? { $lte: denNgay } : {}) };
  if (q.trangThaiLich && E.TRANG_THAI_LICH.includes(q.trangThaiLich)) loc.trangThaiLich = q.trangThaiLich;
  const banDo = await layBanDo();
  if (q.maLop) loc.maLop = q.maLop;
  if (q.loaiLop) {
    const dsLop = [...banDo.lop.values()].filter((l) => l.loaiLop === q.loaiLop).map((l) => l._id);
    loc.maLop = q.maLop ? (dsLop.includes(q.maLop) ? q.maLop : '__khong__') : { $in: dsLop };
  }
  if (q.maPhong) loc.maPhong = q.maPhong;
  const phanCongLoc = [];
  if (q.maGiaoVien) phanCongLoc.push({ phanCong: { $elemMatch: { maNhanSu: q.maGiaoVien, vaiTro: 'GiaoVien' } } });
  if (q.maTroGiang) phanCongLoc.push({ phanCong: { $elemMatch: { maNhanSu: q.maTroGiang, vaiTro: 'TroGiang' } } });
  if (phanCongLoc.length) loc.$and = phanCongLoc;

  const ds = await LichDay.find(loc, { xacNhanCaHoc: 0, yeuCauNghiHoc: 0, lichSu: 0 }).sort({ ngayDay: 1, maCa: 1 }).lean();
  const ten = await layTenNguoiDung(ds.flatMap((l) => l.phanCong.map((p) => p.maNhanSu)));
  const bayGio = clock.now();
  const buoi = ds.map((ld) => ({ ld, ct: chiTietBuoi(ld, banDo, ten, bayGio) }));

  // MH17: mỗi dòng là lịch dạy của một lớp trong khoảng tra cứu ("Thứ 3, 5 · Ca 3")
  const theoLop = new Map();
  for (const b of buoi) {
    if (!theoLop.has(b.ld.maLop)) theoLop.set(b.ld.maLop, []);
    theoLop.get(b.ld.maLop).push(b);
  }
  let ketQua = [...theoLop.values()].map((nhom) => tongHopLich(nhom, banDo));
  if (q.trangThaiXacNhan && TRANG_THAI_THUC_HIEN.includes(q.trangThaiXacNhan)) {
    ketQua = ketQua.filter((k) => k.trangThaiXacNhan === q.trangThaiXacNhan);
  }
  const trang = Math.max(1, Number(q.trang) || 1);
  const soDong = Math.min(200, Math.max(1, Number(q.soDong) || 50));
  return {
    tong: ketQua.length,
    trang,
    soDong,
    // Ngoại lệ 5a: không tìm thấy → client hiển thị thông báo
    thongBao: ketQua.length ? undefined : M.TC_KHONG_TIM_THAY,
    ds: ketQua.slice((trang - 1) * soDong, trang * soDong),
  };
}

const duyNhat = (ds) => [...new Set(ds.filter(Boolean))];

/** Gộp các buổi của một lớp thành một lịch dạy (MH17 cột "Thời gian dạy", MH18) */
function tongHopLich(nhom, banDo) {
  const dau = nhom[0];
  const lop = banDo.lop.get(dau.ld.maLop);
  const thu = clock.chuoiThu(nhom.map((b) => clock.thuTrongTuan(b.ld.ngayDay)));
  const dsCa = duyNhat(nhom.map((b) => b.ld.maCa)).map((m) => banDo.ca.get(m)).filter(Boolean);
  const trangThai = duyNhat(nhom.map((b) => b.ct.trangThaiXacNhan));
  // Tất cả buổi đã xong → Đã xong; chưa buổi nào bắt đầu → Chưa hoàn thành; còn lại → Đang thực hiện
  let trangThaiXacNhan = 'DangThucHien';
  if (trangThai.length === 1) [trangThaiXacNhan] = trangThai;
  return {
    maLop: dau.ld.maLop,
    tenLop: lop?.tenLop,
    loaiLop: lop?.loaiLop,
    giaoVienPhuTrach: duyNhat(nhom.flatMap((b) => b.ct.giaoVien.map((g) => g.hoTen))).join(', '),
    troGiang: duyNhat(nhom.flatMap((b) => b.ct.troGiang.map((g) => g.hoTen))).join(', '),
    phongHoc: duyNhat(nhom.map((b) => b.ct.tenPhong)).join(', '),
    soLuongHocVien: lop?.soLuongHocVien,
    thoiGianDay: `${thu} · ${dsCa.map((c) => c.tenCa).join(', ')}`,
    thoiGianDayDayDu: `${thu} · ${dsCa.map((c) => `${c.tenCa} (${c.gioBatDau} – ${c.gioKetThuc})`).join(', ')}`,
    tuNgay: dau.ct.ngayDay,
    denNgay: nhom[nhom.length - 1].ct.ngayDay,
    soBuoi: nhom.length,
    trangThaiLich: duyNhat(nhom.map((b) => b.ld.trangThaiLich)),
    trangThaiXacNhan,
    dsMaLichDay: nhom.map((b) => b.ld._id),
  };
}

/** UC_5 bước 7–8: chi tiết lịch dạy */
async function chiTiet(maLichDay) {
  const ld = await LichDay.findById(maLichDay).lean();
  if (!ld || ld.trangThaiLich === 'DaHuy') throw new AppError(404, M.KHONG_TIM_THAY_LICH);
  const [banDo, ten] = await Promise.all([layBanDo(), layTenNguoiDung(ld.phanCong.map((p) => p.maNhanSu))]);
  return chiTietBuoi(ld, banDo, ten, clock.now());
}

module.exports = { traCuu, chiTiet, trangThaiThucHien };
