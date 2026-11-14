/** Ứng dụng Express: middleware chung, phục vụ tệp tải lên, định tuyến API, xử lý lỗi. */
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const api = require('./routes');
const { notFound, errorHandler, gioiHanThoiGian } = require('./middlewares/errorHandler');
const { chanToanTu } = require('./middlewares/chanToanTu');
const { moNguCanh } = require('./utils/nguCanh');
const { taoCors, taoGioiHan } = require('./middlewares/baoMat');
const { phucVuTep } = require('./middlewares/phucVuTep');

/**
 * @param {object} [tuyChon]
 * @param {{apiPhut?:number, dangNhap?:number}} [tuyChon.gioiHan] ghi đè giới hạn tần suất (kiểm thử)
 * @param {string[]} [tuyChon.corsOrigin] ghi đè danh sách tên miền giao diện (kiểm thử)
 */
function taoApp(tuyChon = {}) {
  const app = express();
  const gioiHan = taoGioiHan(tuyChon.gioiHan);
  const dsNguon = tuyChon.corsOrigin || env.CORS_ORIGIN;
  const chiHttps = dsNguon.length > 0 && dsNguon.every((o) => o.startsWith('https://'));
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);
  app.use(moNguCanh);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // Khi mọi địa chỉ giao diện đều là https:// (chạy sau Caddy) → trình duyệt tự nâng mọi yêu cầu lên HTTPS;
    // còn chạy nội bộ bằng http:// thì tắt chỉ thị này để giao diện vẫn tải được
    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests: chiHttps ? [] : null,
      },
    },
  }));
  // CORS nghiêm ngặt: chỉ tên miền giao diện thật (CORS_ORIGIN); Origin lạ → 403
  app.use(taoCors(tuyChon.corsOrigin));
  // Chặn spam API theo IP, trước cả khi đọc thân yêu cầu
  app.use('/api', gioiHan.gioiHanApi);
  app.use('/api', gioiHanThoiGian(env.REQUEST_TIMEOUT_MS));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 200 }));
  app.use(chanToanTu);
  // Chống dò mật khẩu: đếm số lần SAI theo IP + tài khoản
  app.post('/api/auth/dang-nhap', gioiHan.chanDoDangNhap);
  app.post('/api/auth/phu-huynh/dang-nhap', gioiHan.chanDoPhuHuynh);
  app.post('/api/auth/doi-mat-khau', gioiHan.chanDoDoiMatKhau);
  if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  // Tệp tải lên: tên ngẫu nhiên 128 bit (không đoán được), cũng chịu giới hạn tần suất như API.
  // Lấy từ MongoDB (GridFS); không có thì tìm trong thư mục UPLOAD_DIR (tệp của bản cũ lưu trên ổ đĩa)
  app.use('/uploads', gioiHan.gioiHanApi, phucVuTep, express.static(path.resolve(env.UPLOAD_DIR), { dotfiles: 'deny', index: false }));
  app.use('/api', api);
  if (env.FRONTEND_DIST) {
    // Phục vụ giao diện đã build: tệp có mã băm lưu đệm lâu, index.html luôn lấy bản mới
    app.use('/assets', express.static(path.join(env.FRONTEND_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(env.FRONTEND_DIST, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|api$|uploads\/).*/, (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(env.FRONTEND_DIST, 'index.html'));
    });
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { taoApp };
