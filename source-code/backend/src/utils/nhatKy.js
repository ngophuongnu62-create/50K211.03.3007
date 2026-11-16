/**
 * Ghi nhật ký hệ thống (audit_logs). Gọi bên trong giao dịch, truyền cùng session để nhật ký
 * và thay đổi dữ liệu cùng được ghi hoặc cùng bị hủy.
 */
const { AuditLog } = require('../models');
const { layNguCanh } = require('./nguCanh');
const clock = require('./clock');

const TRUONG_NHAY_CAM = new Set(['matKhau', 'phienBanToken', 'matKhauTam', 'token', 'tokenThuHoi']);

/** Chuyển document Mongoose / Date về dữ liệu thuần, bỏ trường nhạy cảm */
function lamSach(v, sau = 0) {
  if (v === null || v === undefined) return null;
  if (sau > 8) return '[…]';
  if (v instanceof Date) return v.toISOString();
  if (typeof v.toObject === 'function') return lamSach(v.toObject({ depopulate: true }), sau);
  if (Array.isArray(v)) return v.map((x) => lamSach(x, sau + 1));
  if (typeof v === 'object') {
    const kq = {};
    for (const [k, x] of Object.entries(v)) if (!TRUONG_NHAY_CAM.has(k) && x !== undefined) kq[k] = lamSach(x, sau + 1);
    return kq;
  }
  return v;
}

/** Ảnh chụp gọn của một buổi dạy để lưu vào nhật ký */
function anhBuoi(b) {
  if (!b) return null;
  return {
    maLichDay: b._id,
    maLop: b.maLop,
    maPhong: b.maPhong,
    maCa: b.maCa,
    ngayDay: b.ngayDay instanceof Date ? clock.dinhDangNgay(b.ngayDay) : b.ngayDay,
    trangThaiLich: b.trangThaiLich,
    phanCong: (b.phanCong || []).map((p) => ({ maNhanSu: p.maNhanSu, vaiTro: p.vaiTro, trangThaiPhanCong: p.trangThaiPhanCong })),
  };
}

/**
 * @param {object} p
 * @param {string} p.hanhDong   VD: "LICH_DAY.TAO", "PHAN_CONG.GAN", "PHAN_HOI.CAP_NHAT_TRANG_THAI"
 * @param {{loai:string, ma:string}} p.doiTuong
 * @param {*} p.truoc  dữ liệu cũ (null nếu tạo mới)
 * @param {*} p.sau    dữ liệu mới (null nếu xóa)
 * @param {object} [p.nguoiThucHien] mặc định lấy từ ngữ cảnh yêu cầu
 */
async function ghiNhatKy({ hanhDong, doiTuong, moTa, truoc = null, sau = null, nguoiThucHien }, session) {
  const nc = layNguCanh() || {};
  const nguoi = nguoiThucHien || nc.nguoiThucHien || { ma: 'HE_THONG', vaiTro: 'HeThong', hoTen: 'Hệ thống' };
  await AuditLog.create([{
    thoiDiem: clock.now(),
    nguoiThucHien: { ma: String(nguoi.ma), vaiTro: String(nguoi.vaiTro), ...(nguoi.hoTen ? { hoTen: String(nguoi.hoTen).slice(0, 100) } : {}) },
    hanhDong,
    doiTuong: { loai: doiTuong.loai, ma: String(doiTuong.ma).slice(0, 60) },
    ...(moTa ? { moTa: String(moTa).slice(0, 500) } : {}),
    duLieuCu: lamSach(truoc),
    duLieuMoi: lamSach(sau),
    ...(nc.ip ? { ip: String(nc.ip).slice(0, 64) } : {}),
    ...(nc.userAgent ? { userAgent: nc.userAgent } : {}),
    ...(nc.maYeuCau ? { maYeuCau: nc.maYeuCau } : {}),
  }], { session });
}

module.exports = { ghiNhatKy, anhBuoi, lamSach };
