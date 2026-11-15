/** UC_2 – Quản lý thông tin phòng học: 2.1 Xem lịch phòng trống, 2.2 Đăng ký sử dụng phòng, 2.3 Hủy phòng */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { sinhMa } = require('../utils/sinhMa');
const { PhongHoc, DangKyPhong, LichDay } = require('../models');
const { layBanDo, layTenNguoiDung, nhanCa } = require('./danhMuc.service');
const { taiChiemDung, khoa } = require('./khaDung.service');
const { trongGiaoDich, trongGiaoDichCoKhoa, khoa: khoaTN } = require('../utils/giaoDich');
const { ghiNhatKy } = require('../utils/nhatKy');

/** Tình trạng từng phòng theo Ca 1–3 của một ngày */
async function tinhTrangTheoNgay(ngay, banDo) {
  const cd = await taiChiemDung({ tuNgay: ngay, denNgay: ngay });
  return banDo.dsPhong.map((p) => {
    const theoCa = banDo.dsCa.map((ca) => {
      const chiem = cd.phong.get(khoa(p._id, ngay, ca.maCa || ca._id));
      return {
        maCa: ca._id,
        tenCa: ca.tenCa,
        gio: `${ca.gioBatDau} – ${ca.gioKetThuc}`,
        trong: !chiem,
        // Figma QL-2.2-a: ô bận hiển thị mã lớp
        maLop: chiem?.maLop,
        loaiChiemDung: chiem?.loai,
      };
    });
    const soCaTrong = theoCa.filter((c) => c.trong).length;
    return {
      maPhong: p._id,
      tenPhong: p.tenPhong,
      sucChua: p.sucChua,
      moTa: p.moTa,
      theoCa,
      caConTrong: theoCa.filter((c) => c.trong).map((c) => c.tenCa),
      // Trạng thái phòng trong ngày: có ca được sử dụng → Đang sử dụng
      trangThai: soCaTrong === theoCa.length ? 'ChuaSuDung' : 'DangSuDung',
    };
  });
}

/** UC_2.1 bước 2, 4–7: danh sách phòng trống theo tiêu chí tên phòng, ngày, trạng thái */
async function danhSachPhongTrong({ ngay, tuNgay, denNgay, tenPhong, trangThai }) {
  // Thời gian sử dụng: một ngày (ngay) hoặc khoảng tuNgay → denNgay (Figma QL-2.1-c)
  const ngayXem = (tuNgay || ngay) ? clock.parseNgay(tuNgay || ngay) : clock.homNay();
  const ngayCuoi = denNgay ? clock.parseNgay(denNgay) : ngayXem;
  if (!ngayXem || !ngayCuoi || (trangThai && !E.TRANG_THAI_PHONG.includes(trangThai))) {
    throw new AppError(400, M.PHONG_TIM_KIEM_KHONG_HOP_LE); // luồng 6.a
  }
  if (ngayCuoi < ngayXem) {
    throw new AppError(400, M.PHONG_TIM_KIEM_KHONG_HOP_LE, { data: { lyDo: M.PHONG_NGAY_KET_THUC_TRUOC } }); // luồng 6.a
  }
  if (clock.congNgay(ngayXem, 92) < ngayCuoi) throw new AppError(400, M.PHONG_TIM_KIEM_KHONG_HOP_LE); // [BO SUNG] tối đa ~3 tháng
  let banDo;
  try {
    banDo = await layBanDo();
  } catch {
    throw new AppError(500, M.PHONG_KHONG_TAI_DUOC); // ngoại lệ 2.a
  }
  let ds = await tinhTrangTheoNgay(ngayXem, banDo);
  // Khoảng nhiều ngày: một ca chỉ "còn trống" khi trống ở mọi ngày; có ca bận ở bất kỳ ngày nào → Đang sử dụng
  for (let d = clock.congNgay(ngayXem, 1); d <= ngayCuoi; d = clock.congNgay(d, 1)) {
    const theoNgay = new Map((await tinhTrangTheoNgay(d, banDo)).map((p) => [p.maPhong, p]));
    ds = ds.map((p) => {
      const q = theoNgay.get(p.maPhong);
      const theoCa = p.theoCa.map((c, i) => ({ ...c, trong: c.trong && q.theoCa[i].trong }));
      const conTrong = theoCa.filter((c) => c.trong);
      return { ...p, theoCa, caConTrong: conTrong.map((c) => c.tenCa), trangThai: conTrong.length === theoCa.length ? 'ChuaSuDung' : 'DangSuDung' };
    });
  }
  if (tenPhong) {
    const tu = String(tenPhong).trim().toLowerCase();
    ds = ds.filter((p) => p.tenPhong.toLowerCase().includes(tu) || p.maPhong.toLowerCase() === tu);
  }
  if (trangThai) ds = ds.filter((p) => p.trangThai === trangThai);
  return { ngay: clock.dinhDangNgay(ngayXem), denNgay: clock.dinhDangNgay(ngayCuoi), nhanNgay: clock.nhanNgayDayDu(ngayXem), dsPhong: ds };
}

/** UC_2.1 bước 3, 7: chi tiết phòng (tên, sức chứa, thời gian sử dụng, giảng viên phụ trách, trạng thái) */
async function chiTietPhong(maPhong, { ngay }) {
  const ngayXem = ngay ? clock.parseNgay(ngay) : clock.homNay();
  if (!ngayXem) throw new AppError(400, M.PHONG_TIM_KIEM_KHONG_HOP_LE);
  const phong = await PhongHoc.findById(maPhong).lean();
  if (!phong) throw new AppError(404, M.PHONG_KHONG_TON_TAI);
  const banDo = await layBanDo();
  const [tinhTrang] = (await tinhTrangTheoNgay(ngayXem, banDo)).filter((p) => p.maPhong === maPhong);
  const [dsLich, dsDangKy] = await Promise.all([
    LichDay.find({ maPhong, ngayDay: ngayXem, trangThaiLich: { $in: E.LICH_CON_HIEU_LUC } }).lean(),
    DangKyPhong.find({ maPhong, ngaySuDung: ngayXem, trangThaiDangKy: 'DaDangKy' }).lean(),
  ]);
  const ten = await layTenNguoiDung([
    ...dsLich.flatMap((l) => l.phanCong.map((p) => p.maNhanSu)),
    ...dsDangKy.map((d) => d.maQuanLy),
  ]);
  const suDung = [
    ...dsLich.map((l) => ({
      loai: 'LichDay',
      maCa: l.maCa,
      thoiGian: nhanCa(banDo.ca.get(l.maCa)),
      tenLop: banDo.lop.get(l.maLop)?.tenLop,
      giangVienPhuTrach: l.phanCong.filter((p) => p.vaiTro === 'GiaoVien').map((p) => ten.get(p.maNhanSu)?.hoTen),
    })),
    ...dsDangKy.map((d) => ({
      loai: 'DangKyPhong',
      maDangKy: d._id,
      maCa: d.maCa,
      thoiGian: nhanCa(banDo.ca.get(d.maCa)),
      nguoiDangKy: ten.get(d.maQuanLy)?.hoTen,
    })),
  ].sort((a, b) => a.maCa.localeCompare(b.maCa));
  return {
    maPhong: phong._id,
    tenPhong: phong.tenPhong,
    sucChua: phong.sucChua,
    moTa: phong.moTa,
    ngay: clock.dinhDangNgay(ngayXem),
    trangThai: tinhTrang.trangThai,
    theoCa: tinhTrang.theoCa,
    suDung,
  };
}

function docThongTinDangKy({ maPhong, ngaySuDung, maCa }) {
  const ngay = clock.parseNgay(ngaySuDung);
  if (!maPhong || !maCa || !ngay) throw new AppError(400, M.PHONG_THIEU_THONG_TIN); // BR3
  return { maPhong, maCa, ngay };
}

/** UC_2.2 bước 4–6: kiểm tra trạng thái phòng học trong thời gian đã chọn */
async function kiemTraPhong(input) {
  const { maPhong, maCa, ngay } = docThongTinDangKy(input);
  const banDo = await layBanDo();
  const phong = banDo.phong.get(maPhong);
  const ca = banDo.ca.get(maCa);
  if (!phong || !ca) throw new AppError(400, M.PHONG_THIEU_THONG_TIN);
  if (clock.thoiDiem(ngay, ca.gioKetThuc) <= clock.now()) throw new AppError(400, M.PHONG_THIEU_THONG_TIN);
  const cd = await taiChiemDung({ tuNgay: ngay, denNgay: ngay });
  if (cd.phong.has(khoa(maPhong, ngay, maCa))) throw new AppError(409, M.PHONG_KHONG_CON_TRONG); // luồng 5.a
  return {
    trong: true,
    phong: { maPhong, tenPhong: phong.tenPhong, sucChua: phong.sucChua, moTa: phong.moTa },
    ngaySuDung: clock.dinhDangNgay(ngay),
    nhanNgay: clock.nhanNgayDayDu(ngay),
    ca: { maCa, nhan: nhanCa(ca) },
  };
}

/** UC_2.2 bước 7–9: xác nhận đăng ký phòng */
async function dangKyPhong(input, maQuanLy) {
  const thongTin = await kiemTraPhong(input);
  const ngay = clock.parseNgay(thongTin.ngaySuDung);
  const { maPhong } = thongTin.phong;
  const { maCa } = thongTin.ca;
  try {
    // Khóa phòng + kiểm tra lại trong giao dịch: không thể đăng ký trùng với đăng ký khác hoặc buổi học vừa được xếp đồng thời
    return await trongGiaoDichCoKhoa([khoaTN.phong(maPhong)], async (session) => {
      const cd = await taiChiemDung({ tuNgay: ngay, denNgay: ngay }, session);
      if (cd.phong.has(khoa(maPhong, ngay, maCa))) throw new AppError(409, M.PHONG_KHONG_CON_TRONG);
      const [doc] = await DangKyPhong.create([{
        _id: await sinhMa('DK', session),
        maPhong,
        maCa,
        maQuanLy,
        ngaySuDung: ngay,
        trangThaiDangKy: 'DaDangKy',
        thoiDiemDangKy: clock.now(),
      }], { session });
      await ghiNhatKy({
        hanhDong: 'DANG_KY_PHONG.TAO',
        doiTuong: { loai: 'DangKyPhong', ma: doc._id },
        moTa: `Đăng ký ${thongTin.phong.tenPhong} · ${thongTin.nhanNgay} · ${thongTin.ca.nhan}`,
        sau: { maPhong, maCa, ngaySuDung: thongTin.ngaySuDung, trangThaiDangKy: 'DaDangKy' },
      }, session);
      return { maDangKy: doc._id, ...thongTin, trangThaiDangKy: doc.trangThaiDangKy };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    // Chỉ mục UX_DangKyPhong: lớp bảo vệ cuối khi hai quản lý đăng ký cùng lúc
    if (err && err.code === 11000) throw new AppError(409, M.PHONG_KHONG_CON_TRONG);
    throw new AppError(500, M.PHONG_DANG_KY_THAT_BAI); // ngoại lệ 8.a
  }
}

/** UC_2.3 bước 2–3: danh sách phòng đã đăng ký */
async function danhSachDaDangKy({ trangThai }) {
  const loc = {};
  if (trangThai) loc.trangThaiDangKy = trangThai;
  const [ds, banDo] = await Promise.all([DangKyPhong.find(loc).sort({ ngaySuDung: -1, maCa: 1 }).lean(), layBanDo()]);
  const ten = await layTenNguoiDung(ds.map((d) => d.maQuanLy));
  const bayGio = clock.now();
  return ds.map((d) => {
    const ca = banDo.ca.get(d.maCa);
    const batDau = clock.thoiDiem(d.ngaySuDung, ca.gioBatDau);
    const ketThuc = clock.thoiDiem(d.ngaySuDung, ca.gioKetThuc);
    return {
      maDangKy: d._id,
      maPhong: d.maPhong,
      tenPhong: banDo.phong.get(d.maPhong)?.tenPhong,
      ngaySuDung: clock.dinhDangNgay(d.ngaySuDung),
      thoiGian: `${clock.nhanNgayDayDu(d.ngaySuDung)} · ${nhanCa(ca)}`,
      trangThaiDangKy: d.trangThaiDangKy,
      // Trạng thái phòng (Chưa sử dụng, Đang sử dụng) theo thời điểm hiện tại
      trangThaiPhong: d.trangThaiDangKy === 'DaDangKy' && batDau <= bayGio && bayGio < ketThuc ? 'DangSuDung' : 'ChuaSuDung',
      nguoiDangKy: ten.get(d.maQuanLy)?.hoTen,
      thoiDiemDangKy: d.thoiDiemDangKy,
      thoiDiemHuy: d.thoiDiemHuy,
    };
  });
}

/** UC_2.3 bước 7–10: hủy đăng ký phòng (điều kiện: còn hiệu lực và chưa đến giờ sử dụng – BR03) */
async function huyDangKy(maDangKy) {
  const dk = await DangKyPhong.findById(String(maDangKy)).lean();
  if (!dk) throw new AppError(404, M.PHONG_KHONG_THE_HUY);
  const banDo = await layBanDo();
  const ca = banDo.ca.get(dk.maCa);
  if (dk.trangThaiDangKy !== 'DaDangKy' || clock.thoiDiem(dk.ngaySuDung, ca.gioBatDau) <= clock.now()) {
    throw new AppError(422, M.PHONG_KHONG_THE_HUY); // ngoại lệ 8.a
  }
  try {
    return await trongGiaoDich(async (session) => {
      // Cập nhật nguyên tử: chỉ hủy khi vẫn còn hiệu lực (hai người hủy cùng lúc → người sau nhận 422)
      const kq = await DangKyPhong.updateOne(
        { _id: dk._id, trangThaiDangKy: 'DaDangKy' },
        { $set: { trangThaiDangKy: 'DaHuy', thoiDiemHuy: clock.now() } },
        { session },
      );
      if (kq.modifiedCount !== 1) throw new AppError(422, M.PHONG_KHONG_THE_HUY);
      await ghiNhatKy({
        hanhDong: 'DANG_KY_PHONG.HUY',
        doiTuong: { loai: 'DangKyPhong', ma: dk._id },
        truoc: { maPhong: dk.maPhong, maCa: dk.maCa, ngaySuDung: dk.ngaySuDung, trangThaiDangKy: 'DaDangKy' },
        sau: { trangThaiDangKy: 'DaHuy' },
      }, session);
      return { maDangKy: dk._id, trangThaiDangKy: 'DaHuy' };
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(500, M.PHONG_HUY_THAT_BAI); // ngoại lệ 9.a
  }
}

module.exports = { danhSachPhongTrong, chiTietPhong, kiemTraPhong, dangKyPhong, danhSachDaDangKy, huyDangKy };
