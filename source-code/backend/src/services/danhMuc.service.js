/** Đọc danh mục (ca học, phòng, lớp, môn, khóa) và định dạng chuỗi hiển thị dùng chung. */
const { CaHoc, PhongHoc, LopHoc, MonHoc, KhoaHoc, NguoiDung } = require('../models');
const clock = require('../utils/clock');

async function layBanDo() {
  const [ca, phong, lop, mon, khoa] = await Promise.all([
    CaHoc.find().sort({ gioBatDau: 1 }).lean(),
    PhongHoc.find().sort({ tenPhong: 1 }).lean(),
    LopHoc.find().lean(),
    MonHoc.find().lean(),
    KhoaHoc.find().lean(),
  ]);
  const toMap = (arr) => new Map(arr.map((x) => [x._id, x]));
  return { dsCa: ca, dsPhong: phong, ca: toMap(ca), phong: toMap(phong), lop: toMap(lop), mon: toMap(mon), khoa: toMap(khoa) };
}

async function layTenNguoiDung(dsMa) {
  const ds = await NguoiDung.find({ _id: { $in: [...new Set(dsMa)] } }).lean();
  return new Map(ds.map((n) => [n._id, n]));
}

/** "Ca 3 · 17:30 – 21:00" */
function nhanCa(ca) {
  return ca ? `${ca.tenCa} · ${ca.gioBatDau} – ${ca.gioKetThuc}` : '';
}

/** "Thứ 3, 5 · Ca 3 · P.201" – tóm tắt lịch học của một nhóm buổi */
function moTaLichHoc(dsBuoi, banDo) {
  if (!dsBuoi.length) return '';
  const thu = clock.chuoiThu(dsBuoi.map((b) => clock.thuTrongTuan(b.ngayDay)));
  const ca = [...new Set(dsBuoi.map((b) => b.maCa))].map((m) => banDo.ca.get(m)?.tenCa || m).join(', ');
  const phong = [...new Set(dsBuoi.map((b) => b.maPhong))].map((m) => banDo.phong.get(m)?.tenPhong || m).join(', ');
  return `${thu} · ${ca} · ${phong}`;
}

/** Thông tin cơ bản của một buổi để trả về client */
function tomTatBuoi(ld, banDo) {
  const ca = banDo.ca.get(ld.maCa);
  const lop = banDo.lop.get(ld.maLop);
  return {
    maLichDay: ld._id,
    maLop: ld.maLop,
    tenLop: lop?.tenLop,
    ngayDay: clock.dinhDangNgay(ld.ngayDay),
    nhanNgay: clock.nhanNgayDayDu(ld.ngayDay),
    tuan: clock.tuanISO(ld.ngayDay),
    maCa: ld.maCa,
    tenCa: ca?.tenCa,
    gioBatDau: ca?.gioBatDau,
    gioKetThuc: ca?.gioKetThuc,
    maPhong: ld.maPhong,
    tenPhong: banDo.phong.get(ld.maPhong)?.tenPhong,
    soTiet: ld.soTiet,
    trangThaiLich: ld.trangThaiLich,
  };
}

module.exports = { layBanDo, layTenNguoiDung, nhanCa, moTaLichHoc, tomTatBuoi };
