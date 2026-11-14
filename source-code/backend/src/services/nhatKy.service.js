/** Tra cứu nhật ký hệ thống (audit_logs) – chỉ đọc, dành cho Quản lý */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const clock = require('../utils/clock');
const { catChuoi } = require('../utils/kiemTra');
const { AuditLog } = require('../models');

const thoatRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function traCuu(q = {}) {
  const loc = {};
  const hanhDong = catChuoi(q.hanhDong);
  if (hanhDong) loc.hanhDong = { $regex: `^${thoatRegex(hanhDong.slice(0, 60))}` };
  const loai = catChuoi(q.loaiDoiTuong);
  if (loai) loc['doiTuong.loai'] = loai.slice(0, 40);
  const ma = catChuoi(q.maDoiTuong);
  if (ma) loc['doiTuong.ma'] = ma.slice(0, 60);
  const nguoi = catChuoi(q.nguoiThucHien);
  if (nguoi) loc['nguoiThucHien.ma'] = nguoi.slice(0, 60);
  const tu = q.tuNgay ? clock.parseNgay(String(q.tuNgay)) : null;
  const den = q.denNgay ? clock.parseNgay(String(q.denNgay)) : null;
  if ((q.tuNgay && !tu) || (q.denNgay && !den)) throw new AppError(400, M.HS_KHONG_HOP_LE);
  if (tu || den) {
    loc.thoiDiem = {};
    if (tu) loc.thoiDiem.$gte = clock.thoiDiem(tu, '00:00');
    if (den) loc.thoiDiem.$lt = clock.thoiDiem(clock.congNgay(den, 1), '00:00');
  }
  const trang = Math.max(1, Number.parseInt(q.trang, 10) || 1);
  const soDong = Math.min(100, Math.max(1, Number.parseInt(q.soDong, 10) || 20));
  const [tong, ds] = await Promise.all([
    AuditLog.countDocuments(loc),
    AuditLog.find(loc).sort({ thoiDiem: -1, _id: -1 }).skip((trang - 1) * soDong).limit(soDong).lean(),
  ]);
  return { tong, trang, soDong, ds };
}

module.exports = { traCuu };
