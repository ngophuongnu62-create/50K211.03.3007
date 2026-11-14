const asyncHandler = require('../utils/asyncHandler');
const { traVe } = require('../utils/phanHoi');
const authService = require('../services/auth.service');

module.exports = {
  /** POST /api/auth/dang-nhap – UC_1 (Quản lý, Giáo viên, Trợ giảng) */
  dangNhap: asyncHandler(async (req, res) => traVe(res, await authService.dangNhapNhanSu(req.body))),
  /** POST /api/auth/phu-huynh/dang-nhap – UC_1 luồng 1.a */
  dangNhapPhuHuynh: asyncHandler(async (req, res) => traVe(res, await authService.dangNhapPhuHuynh(req.body))),
  /** GET /api/auth/toi */
  toi: asyncHandler(async (req, res) => traVe(res, await authService.thongTinToi(req.user))),
  /** POST /api/auth/doi-mat-khau – đổi mật khẩu (bắt buộc khi mustChangePassword = true) */
  doiMatKhau: asyncHandler(async (req, res) => traVe(res, await authService.doiMatKhau(req.user, req.body))),
  /** POST /api/auth/dang-xuat – kết thúc phiên (client xóa token) */
  dangXuat: (req, res) => traVe(res, null),
};
