/**
 * Bộ bắt lỗi toàn cục: mọi lỗi (nghiệp vụ, dữ liệu lạ, CSDL, tệp, JSON hỏng…) đều được chuẩn hóa thành
 * phản hồi { success: false, code, message, fieldErrors?, data?, maYeuCau? } bằng tiếng Việt.
 * Máy chủ không bao giờ trả chi tiết kỹ thuật (stack, câu lệnh CSDL) ra ngoài.
 */
const mongoose = require('mongoose');
const multer = require('multer');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const { xoaTepCuaYeuCau } = require('./upload');
const { layNguCanh } = require('../utils/nguCanh');

function notFound(req, res, next) {
  next(new AppError(404, M.KHONG_TIM_THAY_API));
}

const coNhan = (err, nhan) => typeof err?.hasErrorLabel === 'function' && err.hasErrorLabel(nhan);

/** Chuyển lỗi bất kỳ thành AppError có thông báo thân thiện */
function chuanHoaLoi(err) {
  if (err instanceof AppError) return err;
  if (err instanceof mongoose.Error.ValidationError) {
    const fieldErrors = {};
    for (const [k, v] of Object.entries(err.errors)) fieldErrors[k] = v.message;
    return new AppError(400, M.HS_KHONG_HOP_LE, { fieldErrors });
  }
  if (err instanceof mongoose.Error.CastError || err?.name === 'BSONError' || err?.name === 'StrictModeError') {
    return new AppError(400, M.HS_KHONG_HOP_LE);
  }
  if (err instanceof multer.MulterError) return new AppError(400, M.TEP_KHONG_HOP_LE);
  if (err?.type === 'entity.parse.failed' || err?.type === 'encoding.unsupported' || err?.type === 'charset.unsupported') {
    return new AppError(400, M.HS_KHONG_HOP_LE);
  }
  if (err?.type === 'entity.too.large' || err?.type === 'parameters.too.many') return new AppError(413, M.HS_KHONG_HOP_LE, { code: 'DU_LIEU_QUA_LON' });
  // Trùng khóa duy nhất (chốt chặn cuối cùng của CSDL chống trùng lịch / trùng dữ liệu)
  if (err?.code === 11000 || err?.code === 11001) return new AppError(409, M.DU_LIEU_DA_THAY_DOI, { code: 'XUNG_DOT' });
  // Xung đột ghi đồng thời vẫn còn sau khi đã thử lại giao dịch
  if (err?.code === 112 || coNhan(err, 'TransientTransactionError') || err instanceof mongoose.Error.VersionError) {
    return new AppError(409, M.DU_LIEU_DA_THAY_DOI, { code: 'XUNG_DOT' });
  }
  // Mất kết nối CSDL / CSDL quá tải
  if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError', 'MongoPoolClearedError'].includes(err?.name)
    || err?.code === 91 || err?.code === 189 || err?.code === 10107 || err?.code === 11600) {
    return new AppError(503, M.MAY_CHU_BAN, { code: 'MAY_CHU_BAN' });
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const nc = layNguCanh();
  let loi = chuanHoaLoi(err);
  if (!loi) {
    // Lỗi ngoài dự kiến: ghi đầy đủ ở máy chủ kèm mã yêu cầu, trả câu chung cho người dùng
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}] [${nc?.maYeuCau || '-'}] ${req.method} ${req.originalUrl}`, err);
    loi = new AppError(500, M.LOI_HE_THONG);
  } else if (loi.status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${new Date().toISOString()}] [${nc?.maYeuCau || '-'}] ${req.method} ${req.originalUrl} → ${loi.status}: ${err?.message}`);
  }
  // Yêu cầu bị từ chối thì không giữ lại tệp vừa tải lên (tránh tệp mồ côi trên máy chủ)
  xoaTepCuaYeuCau(req);
  // Đã gửi phản hồi (VD: quá thời gian xử lý đã trả 503) → không ghi thêm
  if (res.headersSent) return undefined;
  const body = { success: false, code: loi.code, message: loi.message };
  if (loi.fieldErrors) body.fieldErrors = loi.fieldErrors;
  if (loi.data !== undefined) body.data = loi.data;
  if (loi.status >= 500 && nc?.maYeuCau) body.maYeuCau = nc.maYeuCau;
  if (loi.status === 429 && loi.data?.thuLaiSauGiay) res.set('Retry-After', String(loi.data.thuLaiSauGiay));
  return res.status(loi.status).json(body);
}

/** Giới hạn thời gian xử lý mỗi yêu cầu API: quá hạn trả 503 thân thiện thay vì treo kết nối */
function gioiHanThoiGian(msMacDinh) {
  return (req, res, next) => {
    const ms = req.is('multipart/form-data') ? msMacDinh * 4 : msMacDinh;
    const hen = setTimeout(() => {
      if (!res.headersSent) {
        // eslint-disable-next-line no-console
        console.error(`[${new Date().toISOString()}] [${layNguCanh()?.maYeuCau || '-'}] ${req.method} ${req.originalUrl} quá ${ms}ms`);
        res.status(503).json({ success: false, code: 'QUA_THOI_GIAN', message: M.MAY_CHU_BAN });
      }
    }, ms);
    hen.unref();
    const xong = () => clearTimeout(hen);
    res.on('finish', xong);
    res.on('close', xong);
    next();
  };
}

module.exports = { notFound, errorHandler, gioiHanThoiGian, chuanHoaLoi };
