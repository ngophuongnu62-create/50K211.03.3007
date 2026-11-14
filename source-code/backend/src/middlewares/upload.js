/**
 * Tải tệp lên: ảnh bằng cấp (JPG, PNG – UC_3.2) và tệp minh chứng (JPG, PNG, PDF – UC_14).
 * Multer giữ tệp trong bộ nhớ (tối đa 5 tệp × 5 MB); sau khi kiểm tra chữ ký nội dung, tệp được ghi vào MongoDB
 * (GridFS – xem src/utils/luuTep.js). CSDL nghiệp vụ chỉ giữ đường dẫn /uploads/<thư mục>/<tên tệp>.
 */
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');
const M = require('../constants/messages');
const { luuTep, xoaTep } = require('../utils/luuTep');

const MIME = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'application/pdf': 'PDF',
};
const DUOI = { JPG: '.jpg', PNG: '.png', PDF: '.pdf' };

function taoUpload(thuMucCon, loaiChoPhep) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
    fileFilter: (req, file, cb) => {
      if (!loaiChoPhep.includes(MIME[file.mimetype])) return cb(new AppError(400, M.TEP_KHONG_HOP_LE));
      // Ghi nhớ thư mục đích trên chính đối tượng tệp (multer giữ nguyên đối tượng này trong req.files)
      file.thuMucCon = thuMucCon;
      return cb(null, true);
    },
  });
}

/** Chữ ký đầu tệp (magic bytes) theo loại khai báo – chặn tệp đổi đuôi / khai sai loại */
const CHU_KY = {
  PNG: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  JPG: [Buffer.from([0xff, 0xd8, 0xff])],
  PDF: [Buffer.from('%PDF-')],
};

function dungChuKy(file) {
  const ds = CHU_KY[MIME[file.mimetype]];
  if (!ds || !Buffer.isBuffer(file.buffer)) return false;
  return ds.some((b) => file.buffer.length >= b.length && file.buffer.subarray(0, b.length).equals(b));
}

const dsTepCuaYeuCau = (req) => {
  const ds = Array.isArray(req.files) ? [...req.files] : Object.values(req.files || {}).flat();
  if (req.file) ds.push(req.file);
  return ds;
};

/** Xóa khỏi kho các tệp đã lưu trong danh sách (mỗi tệp chỉ xóa một lần) */
function xoaTepDaLuu(files = []) {
  for (const f of files) {
    if (f && f.maTepLuu && !f.daXoa) {
      f.daXoa = true;
      // eslint-disable-next-line no-console
      xoaTep(f.maTepLuu).catch((err) => console.error(`Không xóa được tệp ${f.filename}:`, err.message));
    }
  }
}

/** Xóa các tệp vừa nhận của một yêu cầu (khi yêu cầu bị từ chối) */
function xoaTepCuaYeuCau(req) {
  xoaTepDaLuu(dsTepCuaYeuCau(req));
}

/** Chạy sau multer: kiểm tra nội dung thật của từng tệp khớp với loại khai báo, rồi lưu vào kho tệp */
async function kiemTraNoiDungTep(req, res, next) {
  const ds = dsTepCuaYeuCau(req);
  if (!ds.every(dungChuKy)) return next(new AppError(400, M.TEP_KHONG_HOP_LE));
  try {
    for (const f of ds) {
      // Tên ngẫu nhiên 128 bit (không đoán được)
      f.filename = `${f.thuMucCon}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}${DUOI[MIME[f.mimetype]]}`;
      f.maTepLuu = await luuTep(f.buffer, f.filename, { loaiNoiDung: f.mimetype, tenGoc: f.originalname.slice(0, 150) });
      f.buffer = undefined; // giải phóng bộ nhớ
    }
  } catch (err) {
    xoaTepDaLuu(ds);
    return next(err);
  }
  return next();
}

/** Thông tin tệp đã lưu: { tenTep, loaiTep, duongDan } */
function thongTinTep(file) {
  return {
    tenTep: file.originalname.slice(0, 150),
    loaiTep: MIME[file.mimetype],
    duongDan: `/uploads/${file.filename}`,
  };
}

module.exports = {
  uploadBangCap: taoUpload('bangcap', ['JPG', 'PNG']),
  uploadMinhChung: taoUpload('phanhoi', ['JPG', 'PNG', 'PDF']),
  thongTinTep,
  kiemTraNoiDungTep,
  xoaTepCuaYeuCau,
  xoaTepDaLuu,
};
