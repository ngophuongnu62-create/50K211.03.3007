/**
 * Ngữ cảnh của từng yêu cầu HTTP (AsyncLocalStorage): mã yêu cầu, IP, trình duyệt và người thực hiện.
 * Cho phép tầng service ghi nhật ký hệ thống mà không phải truyền tham số qua mọi hàm.
 */
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const kho = new AsyncLocalStorage();

/** Middleware: mở ngữ cảnh cho yêu cầu, gắn mã yêu cầu vào header phản hồi để tra cứu nhật ký */
function moNguCanh(req, res, next) {
  const maYeuCau = String(req.headers['x-request-id'] || '').slice(0, 64) || crypto.randomUUID();
  res.setHeader('X-Request-Id', maYeuCau);
  kho.run({ maYeuCau, ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 300), nguoiThucHien: null }, next);
}

const layNguCanh = () => kho.getStore() || null;

/** Gắn người thực hiện sau khi xác thực thành công */
function datNguoiThucHien(user) {
  const nc = kho.getStore();
  if (nc && user) nc.nguoiThucHien = { ma: user.ma, vaiTro: user.vaiTro, hoTen: user.hoTen };
}

module.exports = { moNguCanh, layNguCanh, datNguoiThucHien, kho };
