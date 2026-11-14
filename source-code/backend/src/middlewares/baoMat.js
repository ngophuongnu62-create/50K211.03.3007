/**
 * Lớp bảo mật production:
 *  - CORS nghiêm ngặt: chỉ tên miền giao diện khai báo trong CORS_ORIGIN (và chính máy chủ khi phục vụ giao diện).
 *  - Giới hạn tần suất (express-rate-limit): chặn spam API theo IP; chặn dò mật khẩu theo IP + tài khoản.
 */
const cors = require('cors');
const { rateLimit } = require('express-rate-limit');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');

/** Origin của chính máy chủ (khi backend phục vụ luôn giao diện thì trình duyệt gửi Origin trùng host) */
const cungNguon = (req, origin) => origin === `${req.protocol}://${req.get('host')}`;

/**
 * CORS theo danh sách trắng. Yêu cầu không có header Origin (cùng nguồn khi GET, công cụ giám sát,
 * máy chủ gọi máy chủ) không phải yêu cầu CORS nên được đi tiếp; xác thực JWT vẫn áp dụng như thường.
 * Origin lạ bị từ chối ngay bằng 403, không chỉ thiếu header Access-Control-*.
 */
function taoCors(dsNguon = env.CORS_ORIGIN) {
  const choPhepTatCa = !env.LA_PRODUCTION && dsNguon.includes('*');
  const danhSach = new Set(dsNguon);
  const corsMw = cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    maxAge: 600,
  });
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || choPhepTatCa || danhSach.has(origin) || cungNguon(req, origin)) return corsMw(req, res, next);
    return next(new AppError(403, M.NGUON_KHONG_DUOC_PHEP, { code: 'NGUON_KHONG_DUOC_PHEP' }));
  };
}

const traLoi429 = (thongBao, ma) => (req, res, next, options) => {
  next(new AppError(429, thongBao, { code: ma, data: { thuLaiSauGiay: Math.ceil(options.windowMs / 1000) } }));
};

/** Khóa đếm theo IP + tài khoản (đã chuẩn hóa) – chặn dò mật khẩu một tài khoản từ một máy */
const khoaTaiKhoan = (laySoHieu) => (req) => `${req.ip}|${String(laySoHieu(req.body || {}) || '').trim().toLowerCase().replace(/\s+/g, '').slice(0, 100)}`;

/**
 * @param {object} [tuyChon] ghi đè giới hạn (dùng cho kiểm thử); 0 = tắt
 */
function taoGioiHan({ apiPhut = env.RATE_LIMIT_API_PHUT, dangNhap = env.RATE_LIMIT_DANG_NHAP } = {}) {
  const gioiHanApi = apiPhut > 0 ? rateLimit({
    windowMs: 60 * 1000,
    limit: apiPhut,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/suc-khoe',
    handler: traLoi429(M.QUA_NHIEU_YEU_CAU, 'QUA_NHIEU_YEU_CAU'),
  }) : null;

  const taoChanDo = (laySoHieu) => (dangNhap > 0 ? rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: dangNhap,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Chỉ đếm lần đăng nhập SAI: người dùng gõ đúng không bị ảnh hưởng
    skipSuccessfulRequests: true,
    keyGenerator: khoaTaiKhoan(laySoHieu),
    handler: traLoi429(M.DN_QUA_NHIEU_LAN, 'DANG_NHAP_QUA_NHIEU_LAN'),
  }) : null);

  // Chặn rải mật khẩu sang nhiều tài khoản từ cùng một IP (gấp 5 lần ngưỡng một tài khoản)
  const chanDoTheoIp = dangNhap > 0 ? rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: dangNhap * 5,
    standardHeaders: false,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: traLoi429(M.DN_QUA_NHIEU_LAN, 'DANG_NHAP_QUA_NHIEU_LAN'),
  }) : null;

  const diTiep = (req, res, next) => next();
  const chuoi = (...ds) => (ds.filter(Boolean).length ? ds.filter(Boolean) : [diTiep]);
  return {
    gioiHanApi: gioiHanApi || ((req, res, next) => next()),
    chanDoDangNhap: chuoi(chanDoTheoIp, taoChanDo((b) => b.tenDangNhap)),
    chanDoPhuHuynh: chuoi(chanDoTheoIp, taoChanDo((b) => `${b.soDienThoai}`)),
    // Đổi mật khẩu cũng phải nhập mật khẩu hiện tại → giới hạn số lần nhập sai như đăng nhập
    chanDoDoiMatKhau: chuoi(taoChanDo(() => 'doi-mat-khau')),
  };
}

module.exports = { taoCors, taoGioiHan };
