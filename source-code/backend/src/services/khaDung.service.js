/**
 * Kiểm tra khả dụng và xung đột – dùng chung cho UC_2 (phòng), UC_6.1–6.4 (đề xuất, phân công, phê duyệt)
 * và cảnh báo xung đột ở Trang chủ Quản lý.
 *
 * Ba loại xung đột (Bảng 2.2, MH04, MH24): trùng giáo viên, trùng phòng, sai lịch rảnh.
 */
const { LichDay, DangKyPhong, LichRanh, NhanSuGiangDay } = require('../models');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { layTenNguoiDung, nhanCa } = require('./danhMuc.service');

/**
 * Phòng bị coi là bận khi có đăng ký phòng còn hiệu lực HOẶC có buổi dạy chưa hủy ở cùng ngày, ca.
 * (Tài liệu MongoDB mục 7, điểm "Phòng bận" – chờ nhóm xác nhận; đổi thành false nếu chỉ tính đăng ký phòng.)
 */
const TINH_LICH_DAY_VAO_PHONG_BAN = true;

const khoa = (a, ngay, ca) => `${a}|${clock.dinhDangNgay(ngay)}|${ca}`;

/**
 * Tải toàn bộ chiếm dụng (phòng, lớp, nhân sự) trong khoảng ngày.
 * boQuaLichDay: các buổi không tính (ví dụ chính các buổi đang được sửa).
 */
async function taiChiemDung({ tuNgay, denNgay, boQuaLichDay = [] }, session) {
  const [dsLich, dsDangKy] = await Promise.all([
    LichDay.find(
      { ngayDay: { $gte: tuNgay, $lte: denNgay }, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC }, _id: { $nin: boQuaLichDay } },
      { maLop: 1, maPhong: 1, maCa: 1, ngayDay: 1, 'phanCong.maNhanSu': 1, 'phanCong.vaiTro': 1 },
    ).session(session || null).lean(),
    DangKyPhong.find({ ngaySuDung: { $gte: tuNgay, $lte: denNgay }, trangThaiDangKy: 'DaDangKy' }).session(session || null).lean(),
  ]);
  const phong = new Map();
  const lop = new Map();
  const nhanSu = new Map();
  for (const dk of dsDangKy) phong.set(khoa(dk.maPhong, dk.ngaySuDung, dk.maCa), { loai: 'DangKyPhong', ma: dk._id });
  for (const ld of dsLich) {
    if (TINH_LICH_DAY_VAO_PHONG_BAN && !phong.has(khoa(ld.maPhong, ld.ngayDay, ld.maCa))) {
      phong.set(khoa(ld.maPhong, ld.ngayDay, ld.maCa), { loai: 'LichDay', ma: ld._id, maLop: ld.maLop });
    }
    lop.set(khoa(ld.maLop, ld.ngayDay, ld.maCa), ld._id);
    for (const pc of ld.phanCong || []) {
      nhanSu.set(khoa(pc.maNhanSu, ld.ngayDay, ld.maCa), { maLichDay: ld._id, maLop: ld.maLop });
    }
  }
  return { phong, lop, nhanSu, khoa };
}

/** Phòng có bận ở ngày, ca? */
async function phongDangBan({ maPhong, ngay, maCa, boQuaLichDay = [] }, session) {
  const cd = await taiChiemDung({ tuNgay: ngay, denNgay: ngay, boQuaLichDay }, session);
  return cd.phong.get(khoa(maPhong, ngay, maCa)) || null;
}

/**
 * Mẫu lịch rảnh của nhân sự (UC_9): theo từng tuần đã đăng ký + mẫu tuần gần nhất
 * (dùng cho các tuần tương lai chưa mở cổng đăng ký).
 */
async function taiMauRanh(dsMaNhanSu, session) {
  const docs = await LichRanh.find({ maNhanSu: { $in: dsMaNhanSu } }).sort({ tuanBatDau: -1 }).session(session || null).lean();
  const mau = new Map();
  for (const d of docs) {
    if (!mau.has(d.maNhanSu)) {
      mau.set(d.maNhanSu, {
        theoTuan: new Map(),
        ganNhat: new Set(d.cacRanh.map((c) => `${clock.thuTrongTuan(c.ngayRanh)}|${c.maCa}`)),
      });
    }
    mau.get(d.maNhanSu).theoTuan.set(
      clock.dinhDangNgay(d.tuanBatDau),
      new Set(d.cacRanh.map((c) => `${clock.dinhDangNgay(c.ngayRanh)}|${c.maCa}`)),
    );
  }
  return mau;
}

/**
 * Nhân sự có rảnh ở ngày, ca không.
 * nghiemNgat = true (đề xuất): không có dữ liệu lịch rảnh → không rảnh.
 * nghiemNgat = false (cảnh báo xung đột): chỉ xét tuần giáo viên ĐÃ đăng ký lịch rảnh (UC_9 chỉ mở cổng cho tuần kế tiếp);
 *   tuần chưa đăng ký → null (không kết luận), KHÔNG suy ra từ mẫu tuần gần nhất.
 */
function coRanh(mauNhanSu, ngay, maCa, { nghiemNgat = true } = {}) {
  if (!mauNhanSu) return nghiemNgat ? false : null;
  const tuan = clock.dinhDangNgay(clock.dauTuan(ngay));
  if (mauNhanSu.theoTuan.has(tuan)) return mauNhanSu.theoTuan.get(tuan).has(`${clock.dinhDangNgay(ngay)}|${maCa}`);
  if (!nghiemNgat) return null;
  if (mauNhanSu.ganNhat) return mauNhanSu.ganNhat.has(`${clock.thuTrongTuan(ngay)}|${maCa}`);
  return nghiemNgat ? false : null;
}

function khoangNgay(dsBuoi) {
  const ts = dsBuoi.map((b) => b.ngayDay.getTime());
  return { tuNgay: new Date(Math.min(...ts)), denNgay: new Date(Math.max(...ts)) };
}

/**
 * Kiểm tra xung đột cho một tập buổi dạy (đã có trong CSDL hoặc đang dự kiến).
 * dsBuoi: [{ _id?, maLop, maPhong, maCa, ngayDay, phanCong: [{maNhanSu, vaiTro}] }]
 */
async function kiemTraXungDot(dsBuoi, banDo, session) {
  const ketQua = { trungGiaoVien: [], trungPhong: [], saiLichRanh: [] };
  if (!dsBuoi.length) return ketQua;
  const { tuNgay, denNgay } = khoangNgay(dsBuoi);
  const dsId = dsBuoi.map((b) => b._id).filter(Boolean);
  const cd = await taiChiemDung({ tuNgay, denNgay, boQuaLichDay: dsId }, session);
  const dsNhanSu = [...new Set(dsBuoi.flatMap((b) => (b.phanCong || []).map((p) => p.maNhanSu)))];
  const [mau, ten] = await Promise.all([taiMauRanh(dsNhanSu, session), layTenNguoiDung(dsNhanSu)]);

  // Trùng trong chính tập đang xét
  const trongTap = { phong: new Map(), nhanSu: new Map() };
  const moTa = (b) => `${clock.tenThu(b.ngayDay)} ${clock.nhanNgayNgan(b.ngayDay)} · ${banDo.ca.get(b.maCa)?.tenCa || b.maCa}`;

  for (const b of dsBuoi) {
    const kp = khoa(b.maPhong, b.ngayDay, b.maCa);
    const chiemPhong = cd.phong.get(kp) || trongTap.phong.get(kp);
    const tenPhong = banDo.phong.get(b.maPhong)?.tenPhong || b.maPhong;
    if (chiemPhong) {
      ketQua.trungPhong.push({
        maLichDay: b._id, maLop: b.maLop, maPhong: b.maPhong, tenPhong, ngayDay: clock.dinhDangNgay(b.ngayDay), maCa: b.maCa,
        nguon: chiemPhong.loai || 'LichDay', moTa: `${tenPhong} · ${moTa(b)}`,
      });
    }
    trongTap.phong.set(kp, { loai: 'LichDay', ma: b._id });

    for (const pc of b.phanCong || []) {
      const kn = khoa(pc.maNhanSu, b.ngayDay, b.maCa);
      const hoTen = ten.get(pc.maNhanSu)?.hoTen || pc.maNhanSu;
      const chiemNS = cd.nhanSu.get(kn) || trongTap.nhanSu.get(kn);
      if (chiemNS) {
        ketQua.trungGiaoVien.push({
          maLichDay: b._id, maLop: b.maLop, maNhanSu: pc.maNhanSu, hoTen, ngayDay: clock.dinhDangNgay(b.ngayDay), maCa: b.maCa,
          voiLop: banDo.lop.get(chiemNS.maLop)?.tenLop, moTa: `${hoTen} · ${moTa(b)}`,
        });
      }
      trongTap.nhanSu.set(kn, { maLichDay: b._id, maLop: b.maLop });
      if (coRanh(mau.get(pc.maNhanSu), b.ngayDay, b.maCa, { nghiemNgat: false }) === false) {
        ketQua.saiLichRanh.push({
          maLichDay: b._id, maLop: b.maLop, maNhanSu: pc.maNhanSu, hoTen, ngayDay: clock.dinhDangNgay(b.ngayDay), maCa: b.maCa,
          moTa: `${hoTen} · ${moTa(b)}`,
        });
      }
    }
  }
  return ketQua;
}

const coXungDot = (kq) => kq.trungGiaoVien.length + kq.trungPhong.length + kq.saiLichRanh.length > 0;

/**
 * Nhân sự phù hợp cho một tập buổi (UC_6.1 BR01, UC_6.2 BR03, UC_6.3 BR01):
 * đúng chuyên môn, có lịch rảnh ở mọi buổi, không trùng lịch dạy.
 * Ưu tiên (UC_6.3 BR02): đã từng dạy lớp đó, kinh nghiệm cao.
 */
async function timNhanSuPhuHop({ maMonHoc, vaiTro = 'GiaoVien', dsBuoi, maLop, boQuaLichDay = [] }, session) {
  if (!dsBuoi.length) return [];
  const loc = { trangThaiTaiKhoan: 'HoatDong', loaiNhanSu: vaiTro };
  if (vaiTro === 'GiaoVien' && maMonHoc) loc.chuyenMon = maMonHoc;
  const ungVien = await NhanSuGiangDay.find(loc).lean();
  if (!ungVien.length) return [];
  const { tuNgay, denNgay } = khoangNgay(dsBuoi);
  const [cd, mau] = await Promise.all([
    taiChiemDung({ tuNgay, denNgay, boQuaLichDay }, session),
    taiMauRanh(ungVien.map((u) => u._id)),
  ]);
  const daDay = maLop
    ? new Set((await LichDay.distinct('phanCong.maNhanSu', { maLop, _id: { $nin: boQuaLichDay } })))
    : new Set();
  return ungVien
    .filter((u) => dsBuoi.every((b) => coRanh(mau.get(u._id), b.ngayDay, b.maCa) && !cd.nhanSu.has(khoa(u._id, b.ngayDay, b.maCa))))
    .map((u) => ({
      maNhanSu: u._id,
      hoTen: u.hoTen,
      loaiNhanSu: u.loaiNhanSu,
      hinhThucLamViec: u.hinhThucLamViec,
      kinhNghiem: u.kinhNghiem,
      chuyenMon: u.chuyenMon,
      daDayLopNay: daDay.has(u._id),
    }))
    .sort((a, b) => Number(b.daDayLopNay) - Number(a.daDayLopNay) || b.kinhNghiem - a.kinhNghiem || a.hoTen.localeCompare(b.hoTen, 'vi'));
}

/** Lý do một nhân sự KHÔNG phù hợp với tập buổi (UC_6.3 luồng 4.a) */
async function lyDoKhongPhuHop({ nhanSu, maMonHoc, vaiTro, dsBuoi, boQuaLichDay = [] }, banDo, session) {
  const lyDo = [];
  if (!nhanSu || nhanSu.loaiNguoiDung !== 'NhanSuGiangDay' || nhanSu.trangThaiTaiKhoan !== 'HoatDong') {
    return ['Nhân sự không tồn tại hoặc đã bị khóa'];
  }
  if (nhanSu.loaiNhanSu !== vaiTro) lyDo.push(vaiTro === 'GiaoVien' ? 'Nhân sự không phải giáo viên' : 'Nhân sự không phải trợ giảng');
  if (vaiTro === 'GiaoVien' && maMonHoc && !(nhanSu.chuyenMon || []).includes(maMonHoc)) lyDo.push('Không đúng chuyên môn');
  const { tuNgay, denNgay } = khoangNgay(dsBuoi);
  const [cd, mau] = await Promise.all([taiChiemDung({ tuNgay, denNgay, boQuaLichDay }, session), taiMauRanh([nhanSu._id], session)]);
  for (const b of dsBuoi) {
    const nhan = `${clock.nhanNgayDayDu(b.ngayDay)} · ${nhanCa(banDo.ca.get(b.maCa))}`;
    if (!coRanh(mau.get(nhanSu._id), b.ngayDay, b.maCa)) lyDo.push(`Không có lịch rảnh: ${nhan}`);
    if (cd.nhanSu.has(khoa(nhanSu._id, b.ngayDay, b.maCa))) lyDo.push(`Trùng lịch dạy: ${nhan}`);
  }
  return lyDo;
}

module.exports = {
  TINH_LICH_DAY_VAO_PHONG_BAN,
  khoa,
  taiChiemDung,
  phongDangBan,
  taiMauRanh,
  coRanh,
  kiemTraXungDot,
  coXungDot,
  timNhanSuPhuHop,
  lyDoKhongPhuHop,
};
