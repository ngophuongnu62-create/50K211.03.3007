/**
 * Thông báo trong hệ thống (collection `thongBao`).
 * Giai đoạn này gửi trong ứng dụng: bản ghi tạo ra là đã gửi (DaGui). Tích hợp Zalo API để sau (Phạm vi 1.3.4).
 */
const { ThongBao, NguoiDung } = require('../models');
const { sinhNhieuMa } = require('../utils/sinhMa');
const clock = require('../utils/clock');

const cat = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Tạo thông báo cho danh sách người nhận.
 * dsNhan: [{ maNguoiNhan | maPHHV, loaiThongBao, tieuDe, noiDung }]
 */
async function guiThongBao(dsNhan, session) {
  if (!dsNhan.length) return [];
  const dsMa = await sinhNhieuMa('TB', dsNhan.length, session);
  const luc = clock.now();
  const docs = dsNhan.map((tb, i) => {
    const doc = {
      _id: dsMa[i],
      loaiThongBao: tb.loaiThongBao,
      tieuDe: cat(tb.tieuDe, 200),
      noiDung: cat(tb.noiDung, 500),
      thoiDiemGui: luc,
      trangThaiGui: 'DaGui',
    };
    if (tb.maNguoiNhan) doc.maNguoiNhan = tb.maNguoiNhan;
    else doc.maPHHV = tb.maPHHV;
    return doc;
  });
  return ThongBao.insertMany(docs, { session });
}

/** Danh sách mã Quản lý đang hoạt động */
async function dsMaQuanLy(session) {
  const ds = await NguoiDung.find({ loaiNguoiDung: 'QuanLy', trangThaiTaiKhoan: 'HoatDong' }, { _id: 1 }).session(session || null).lean();
  return ds.map((q) => q._id);
}

/** Gửi một thông báo tới tất cả Quản lý */
async function thongBaoQuanLy({ loaiThongBao, tieuDe, noiDung }, session) {
  const dsQL = await dsMaQuanLy(session);
  return guiThongBao(dsQL.map((ma) => ({ maNguoiNhan: ma, loaiThongBao, tieuDe, noiDung })), session);
}

/** Thông báo của người dùng hiện tại (nhân sự hoặc phụ huynh / học viên) */
async function thongBaoCuaToi(user, { gioiHan = 50 } = {}) {
  const loc = user.vaiTro === 'PhuHuynhHocVien' ? { maPHHV: user.ma } : { maNguoiNhan: user.ma };
  const ds = await ThongBao.find(loc).sort({ thoiDiemGui: -1 }).limit(gioiHan).lean();
  return ds.map((t) => ({
    maThongBao: t._id,
    loaiThongBao: t.loaiThongBao,
    tieuDe: t.tieuDe,
    noiDung: t.noiDung,
    thoiDiemGui: t.thoiDiemGui,
    trangThaiGui: t.trangThaiGui,
  }));
}

/** Gửi lại các thông báo lỗi (UC_6.4 ngoại lệ 11.a) */
async function guiLai(dsMaThongBao) {
  const loc = { trangThaiGui: { $in: ['GuiLoi', 'ChoGui'] } };
  if (dsMaThongBao && dsMaThongBao.length) loc._id = { $in: dsMaThongBao };
  const kq = await ThongBao.updateMany(loc, { $set: { trangThaiGui: 'DaGui', thoiDiemGui: clock.now() } });
  return kq.modifiedCount;
}

module.exports = { guiThongBao, thongBaoQuanLy, dsMaQuanLy, thongBaoCuaToi, guiLai };
