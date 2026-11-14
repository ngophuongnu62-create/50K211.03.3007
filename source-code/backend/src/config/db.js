const mongoose = require('./mongoose');
const env = require('./env');

/** Tài khoản đăng nhập MongoDB lấy từ biến môi trường (không có → kết nối không xác thực, chỉ dùng khi lập trình / kiểm thử) */
const taiKhoanMacDinh = () => (env.MONGODB_USER
  ? { user: env.MONGODB_USER, pass: env.MONGODB_PASSWORD, authSource: env.MONGODB_AUTH_SOURCE || 'admin' }
  : null);

/** Danh sách collection của hệ thống (lấy từ model, gồm cả audit_logs, khoaTaiNguyen; cộng 2 collection GridFS của kho tệp) */
function dsCollection() {
  const models = require('../models');
  const { COLLECTION_TEP } = require('../utils/luuTep');
  return [...new Set([...Object.values(models).map((m) => m.collection.collectionName), ...COLLECTION_TEP])].sort();
}

/**
 * Kết nối MongoDB.
 * - dongBoCauTruc = true: tạo collection, áp $jsonSchema validator, tạo chỉ mục (cần quyền quản trị cấu trúc).
 * - dongBoCauTruc = false: tài khoản ứng dụng bị giới hạn quyền → chỉ kiểm tra cấu trúc đã được bước thiết lập tạo sẵn.
 */
async function ketNoiCSDL(uri = env.MONGODB_URI, { taiKhoan = taiKhoanMacDinh(), dongBoCauTruc = env.MONGODB_DONG_BO_CAU_TRUC } = {}) {
  const tuyChon = { serverSelectionTimeoutMS: 15000 };
  if (taiKhoan?.user) {
    tuyChon.auth = { username: taiKhoan.user, password: taiKhoan.pass };
    tuyChon.authSource = taiKhoan.authSource || 'admin';
  }
  await mongoose.connect(uri, tuyChon);
  const models = require('../models');
  const db = mongoose.connection.db;
  if (dongBoCauTruc) {
    const { apDungValidator } = require('../db/validators');
    await apDungValidator(db);
    // Collection không có validator riêng (VD: boDem) cũng phải tồn tại sẵn: tài khoản ứng dụng không có quyền tạo collection
    const coSan = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    for (const ten of dsCollection().filter((c) => !coSan.has(c))) await db.createCollection(ten);
    // createIndexes: tạo chỉ mục còn thiếu, không xóa chỉ mục của discriminator dùng chung collection
    for (const model of [...Object.values(models), models.QuanLy, models.NhanSuGiangDay]) {
      await model.createIndexes();
    }
    await require('../utils/luuTep').taoChiMucTep(db);
  } else {
    const coSan = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
    const thieu = dsCollection().filter((c) => !coSan.has(c));
    if (thieu.length) {
      throw new Error(`CSDL chưa được thiết lập (thiếu collection: ${thieu.join(', ')}). Chạy bước thiết lập: node src/db/thiet-lap-csdl.js`);
    }
  }
  return mongoose.connection;
}

const HANH_DONG_NGUY_HIEM = ['remove', 'update', 'dropCollection', 'dropIndex', 'createIndex', 'collMod', 'renameCollectionSameDB', 'convertToCapped', 'dropDatabase'];

/**
 * Tài khoản CSDL đang dùng có thể sửa / xóa nhật ký hệ thống không?
 * @returns {{ batXacThuc: boolean, nguoiDung: string[], quyenNguyHiem: string[] }}
 */
async function kiemTraQuyenNhatKy(tenCollection = 'audit_logs') {
  const db = mongoose.connection.db;
  const kq = await db.command({ connectionStatus: 1, showPrivileges: true });
  const users = kq.authInfo?.authenticatedUsers || [];
  if (!users.length) return { batXacThuc: false, nguoiDung: [], quyenNguyHiem: [] };
  const quyen = new Set();
  for (const p of kq.authInfo.authenticatedUserPrivileges || []) {
    const r = p.resource || {};
    const khop = r.anyResource
      || ((r.db === db.databaseName || r.db === '') && (r.collection === tenCollection || r.collection === ''));
    if (khop) for (const a of p.actions) if (HANH_DONG_NGUY_HIEM.includes(a)) quyen.add(a);
  }
  return { batXacThuc: true, nguoiDung: users.map((u) => `${u.user}@${u.db}`), quyenNguyHiem: [...quyen].sort() };
}

async function ngatKetNoiCSDL() {
  await mongoose.disconnect();
}

module.exports = { ketNoiCSDL, ngatKetNoiCSDL, kiemTraQuyenNhatKy, dsCollection };
