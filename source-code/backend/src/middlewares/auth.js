/**
 * Xác thực JWT và phân quyền theo vai trò (UC_1 BR03, BR04).
 * - Nhân sự (Quản lý / Giáo viên / Trợ giảng): token sau khi đăng nhập bằng tên đăng nhập + mật khẩu.
 * - Phụ huynh / Học viên: token phiên sau khi xác thực Họ tên học viên + Số điện thoại.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const { VAI_TRO } = require('../constants/enums');
const { NguoiDung, PhuHuynhHocVien } = require('../models');
const { datNguoiThucHien } = require('../utils/nguCanh');

const DUOC_PHEP_KHI_PHAI_DOI_MK = new Set([
  'GET /api/auth/toi',
  'POST /api/auth/doi-mat-khau',
  'POST /api/auth/dang-xuat',
]);

function kyToken(payload, hetHan) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: hetHan });
}

function docToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Bắt buộc đăng nhập; gắn req.user = { ma, vaiTro, hoTen } */
async function xacThuc(req, res, next) {
  try {
    const token = docToken(req);
    if (!token) throw new AppError(401, M.CHUA_DANG_NHAP);
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new AppError(401, M.CHUA_DANG_NHAP);
    }
    if (payload.vaiTro === VAI_TRO.PHU_HUYNH) {
      const hv = await PhuHuynhHocVien.findById(payload.sub).lean();
      if (!hv) throw new AppError(401, M.CHUA_DANG_NHAP);
      req.user = { ma: hv._id, vaiTro: VAI_TRO.PHU_HUYNH, hoTen: hv.tenHocVien, lopTheoHoc: hv.lopTheoHoc || [] };
    } else {
      const nd = await NguoiDung.findById(payload.sub).lean();
      if (!nd) throw new AppError(401, M.CHUA_DANG_NHAP);
      // Token cấp trước lần đổi mật khẩu gần nhất bị vô hiệu ngay (phiên bản token lệch)
      if ((payload.pv ?? 0) !== (nd.phienBanToken ?? 0)) throw new AppError(401, M.PHIEN_HET_HIEU_LUC, { code: 'PHIEN_HET_HIEU_LUC' });
      if (nd.trangThaiTaiKhoan !== 'HoatDong') throw new AppError(403, M.DN_TAI_KHOAN_KHOA);
      const vaiTro = nd.loaiNguoiDung === 'QuanLy' ? VAI_TRO.QUAN_LY : nd.loaiNhanSu;
      req.user = { ma: nd._id, vaiTro, hoTen: nd.hoTen, mustChangePassword: !!nd.mustChangePassword };
    }
    datNguoiThucHien(req.user);
    // Mật khẩu tạm (tài khoản mới cấp): chỉ được xem thông tin của mình, đổi mật khẩu hoặc đăng xuất
    if (req.user.mustChangePassword && !DUOC_PHEP_KHI_PHAI_DOI_MK.has(`${req.method} ${req.originalUrl.split('?')[0].replace(/\/+$/, '')}`)) {
      throw new AppError(403, M.PHAI_DOI_MAT_KHAU, { code: 'PHAI_DOI_MAT_KHAU' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/** Chỉ cho phép các vai trò liệt kê. */
function choPhep(...dsVaiTro) {
  return (req, res, next) => {
    if (!req.user || !dsVaiTro.includes(req.user.vaiTro)) return next(new AppError(403, M.KHONG_CO_QUYEN));
    return next();
  };
}

module.exports = { kyToken, xacThuc, choPhep };
