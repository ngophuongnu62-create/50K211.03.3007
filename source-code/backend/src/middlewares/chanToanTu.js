/**
 * Chặn chèn toán tử truy vấn NoSQL (VD: ?maLop[$ne]=x hoặc {"maNhanSu": {"$ne": null}}).
 * Mọi khóa bắt đầu bằng "$" trong query, body, params đều bị từ chối với lỗi 400.
 */
const AppError = require('../utils/AppError');
const M = require('../constants/messages');

function coToanTu(v, sau = 0) {
  if (sau > 10 || v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some((x) => coToanTu(x, sau + 1));
  return Object.keys(v).some((k) => k.startsWith('$') || coToanTu(v[k], sau + 1));
}

function chanToanTu(req, res, next) {
  if (coToanTu(req.query) || coToanTu(req.body) || coToanTu(req.params)) return next(new AppError(400, M.HS_KHONG_HOP_LE));
  return next();
}

module.exports = { chanToanTu, coToanTu };
