/** MH04 – Trang chủ Quản lý: thẻ thống kê, cảnh báo xung đột lịch dạy, lịch dạy cần xử lý. */
const E = require('../constants/enums');
const clock = require('../utils/clock');
const { LichDay, PhanHoiGopY } = require('../models');
const { layBanDo } = require('./danhMuc.service');
const khaDung = require('./khaDung.service');
const { danhSachLich } = require('./quanLyLich.service');

const SO_NGAY_QUET_XUNG_DOT = 28;

/** Xung đột của các buổi sắp diễn ra (trùng giáo viên, trùng phòng, sai lịch rảnh) */
async function canhBaoXungDot(banDo) {
  const homNay = clock.homNay();
  const dsBuoi = await LichDay.find({
    ngayDay: { $gte: homNay, $lte: clock.congNgay(homNay, SO_NGAY_QUET_XUNG_DOT) },
    trangThaiLich: { $in: E.LICH_CON_HIEU_LUC },
  }, { maLop: 1, maPhong: 1, maCa: 1, ngayDay: 1, phanCong: 1, trangThaiLich: 1 }).lean();
  // Nút "Xử lý" mở đúng nhóm buổi (lớp có thể có nhiều nhóm ở trạng thái khác nhau)
  const ttCua = new Map(dsBuoi.map((b) => [String(b._id), b.trangThaiLich]));
  const kq = await khaDung.kiemTraXungDot(dsBuoi, banDo);
  // Mỗi xung đột trùng giữa hai buổi chỉ hiện một lần
  const motLan = (ds, khoa) => [...new Map(ds.map((x) => [khoa(x), x])).values()];
  return [
    ...motLan(kq.trungGiaoVien, (x) => `${x.maNhanSu}|${x.ngayDay}|${x.maCa}`).map((x) => ({ loai: 'TrungGiaoVien', tieuDe: 'Trùng giáo viên', moTa: x.moTa, maLichDay: x.maLichDay, maLop: x.maLop, trangThaiLich: ttCua.get(String(x.maLichDay)) })),
    ...motLan(kq.trungPhong, (x) => `${x.maPhong}|${x.ngayDay}|${x.maCa}`).map((x) => ({ loai: 'TrungPhong', tieuDe: 'Trùng phòng', moTa: x.moTa, maLichDay: x.maLichDay, maLop: x.maLop, trangThaiLich: ttCua.get(String(x.maLichDay)) })),
    ...kq.saiLichRanh.map((x) => ({ loai: 'SaiLichRanh', tieuDe: 'Sai lịch rảnh', moTa: x.moTa, maLichDay: x.maLichDay, maLop: x.maLop, trangThaiLich: ttCua.get(String(x.maLichDay)) })),
  ];
}

async function tongQuan() {
  const banDo = await layBanDo();
  const homNay = clock.homNay();
  const [nhomLich, phanHoiCho, canhBao, cd] = await Promise.all([
    danhSachLich({}),
    PhanHoiGopY.countDocuments({ trangThaiXuLy: 'ChoXuLy' }),
    canhBaoXungDot(banDo),
    khaDung.taiChiemDung({ tuNgay: homNay, denNgay: homNay }),
  ]);
  const phongTrong = banDo.dsPhong.filter((p) => banDo.dsCa.every((ca) => !cd.phong.has(khaDung.khoa(p._id, homNay, ca._id)))).length;
  return {
    homNay: clock.nhanNgayDayDu(homNay),
    thongKe: {
      lichChoPheDuyet: nhomLich.dem.ChoGVXacNhan,
      phanHoiChoXuLy: phanHoiCho,
      xungDotCanXuLy: canhBao.length,
      phongTrongHomNay: { trong: phongTrong, tong: banDo.dsPhong.length },
    },
    canhBaoXungDot: canhBao,
    lichDayCanXuLy: nhomLich.ds.filter((n) => n.trangThaiLich !== 'DaPhatHanh').slice(0, 5),
  };
}

module.exports = { tongQuan, canhBaoXungDot };
