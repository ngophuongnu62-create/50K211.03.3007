/**
 * Kho tệp tải lên trong MongoDB (GridFS, bucket "tepTaiLen"): ảnh bằng cấp (UC_3.2) và tệp minh chứng (UC_14).
 *
 * Bổ sung ngoài tài liệu thiết kế CSDL mục 5.3.3 (tệp trên ổ đĩa, CSDL giữ đường dẫn): nền tảng triển khai miễn phí
 * (Render) xóa ổ đĩa mỗi lần khởi động lại, nên nội dung tệp chuyển vào MongoDB. CSDL vẫn giữ đường dẫn
 * dạng /uploads/<thư mục>/<tên tệp> như cũ; tên tệp trong GridFS chính là "<thư mục>/<tên tệp>".
 */
const mongoose = require('../config/mongoose');

const BUCKET = 'tepTaiLen';
const COLLECTION_TEP = [`${BUCKET}.files`, `${BUCKET}.chunks`];
/** Tên tệp hợp lệ: thư mục được phép + tên ngẫu nhiên do máy chủ sinh */
const TEN_HOP_LE = /^(bangcap|phanhoi)\/[A-Za-z0-9-]+\.(jpg|png|pdf)$/;

let bucket = null;
let dbCuaBucket = null;
function layBucket() {
  const { db } = mongoose.connection;
  if (!db) throw new Error('Chưa kết nối MongoDB');
  if (bucket === null || dbCuaBucket !== db) {
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
    dbCuaBucket = db;
  }
  return bucket;
}

/** Ghi tệp vào GridFS, trả về _id của tệp */
function luuTep(noiDung, tenTep, { loaiNoiDung, tenGoc }) {
  return new Promise((ok, loi) => {
    const luong = layBucket().openUploadStream(tenTep, { metadata: { loaiNoiDung, tenGoc } });
    luong.once('error', loi);
    luong.once('finish', () => ok(luong.id));
    luong.end(noiDung);
  });
}

/** Xóa tệp theo _id (bỏ qua nếu tệp không còn) */
async function xoaTep(id) {
  try {
    await layBucket().delete(id);
  } catch (err) {
    if (!/FileNotFound|File not found/i.test(err?.message || '')) throw err;
  }
}

/** Tìm tệp theo tên "<thư mục>/<tên tệp>"; null nếu tên không hợp lệ hoặc không có */
async function timTep(tenTep) {
  if (!TEN_HOP_LE.test(tenTep)) return null;
  return layBucket().find({ filename: tenTep }).limit(1).next();
}

const moLuongDoc = (id) => layBucket().openDownloadStream(id);

/** Chỉ mục chuẩn của GridFS – tạo ở bước thiết lập vì tài khoản ứng dụng không có quyền tạo chỉ mục */
async function taoChiMucTep(db) {
  await db.collection(`${BUCKET}.files`).createIndex({ filename: 1, uploadDate: 1 });
  await db.collection(`${BUCKET}.chunks`).createIndex({ files_id: 1, n: 1 }, { unique: true });
}

module.exports = { BUCKET, COLLECTION_TEP, luuTep, xoaTep, timTep, moLuongDoc, taoChiMucTep };
