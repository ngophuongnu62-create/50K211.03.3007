/**
 * Phân quyền MongoDB theo nguyên tắc quyền tối thiểu.
 *
 * Vai trò "broadwayApp" (tài khoản ứng dụng):
 *  - Collection nghiệp vụ: find, insert, update – KHÔNG xóa (hệ thống chỉ đổi trạng thái, không xóa cứng dữ liệu),
 *    KHÔNG đổi cấu trúc (validator, chỉ mục, xóa collection).
 *  - audit_logs: CHỈ find + insert → ứng dụng (kể cả khi bị chiếm quyền) không thể sửa, xóa, tạo chỉ mục TTL
 *    hay đổi validator để làm mất nhật ký.
 *  - Kho tệp GridFS (tepTaiLen.files, tepTaiLen.chunks): find, insert, remove, listIndexes – không sửa tệp đã lưu;
 *    được xóa để dọn tệp của yêu cầu bị từ chối (dữ liệu sai, trùng…), listIndexes để driver GridFS kiểm tra chỉ mục.
 *  - Cơ sở dữ liệu: listCollections (kiểm tra cấu trúc khi khởi động).
 * Cấu trúc (collection, validator, chỉ mục) và tài khoản do tài khoản quản trị tạo ở bước thiết lập.
 */
const VAI_TRO_UNG_DUNG = 'broadwayApp';
const COLLECTION_NHAT_KY = 'audit_logs';
const QUYEN_NGHIEP_VU = ['find', 'insert', 'update'];
const QUYEN_NHAT_KY = ['find', 'insert'];
const QUYEN_KHO_TEP = ['find', 'insert', 'remove', 'listIndexes'];
const { COLLECTION_TEP } = require('../utils/luuTep');

function dsQuyen(tenDb, dsCollection) {
  const quyenCua = (c) => (COLLECTION_TEP.includes(c) ? QUYEN_KHO_TEP : QUYEN_NGHIEP_VU);
  return [
    ...dsCollection.filter((c) => c !== COLLECTION_NHAT_KY).map((c) => ({ resource: { db: tenDb, collection: c }, actions: quyenCua(c) })),
    { resource: { db: tenDb, collection: COLLECTION_NHAT_KY }, actions: QUYEN_NHAT_KY },
    { resource: { db: tenDb, collection: '' }, actions: ['listCollections'] },
  ];
}

/**
 * Tạo / cập nhật vai trò và tài khoản ứng dụng (chạy lại được nhiều lần).
 * @param {import('mongodb').Db} adminDb  db "admin" của kết nối bằng tài khoản quản trị
 */
async function thietLapQuyen(adminDb, { tenDb, dsCollection, tenTaiKhoan, matKhau }) {
  const privileges = dsQuyen(tenDb, dsCollection);
  const coVaiTro = (await adminDb.command({ rolesInfo: { role: VAI_TRO_UNG_DUNG, db: 'admin' } })).roles.length > 0;
  if (coVaiTro) await adminDb.command({ updateRole: VAI_TRO_UNG_DUNG, privileges, roles: [] });
  else await adminDb.command({ createRole: VAI_TRO_UNG_DUNG, privileges, roles: [] });

  const roles = [{ role: VAI_TRO_UNG_DUNG, db: 'admin' }];
  const coTaiKhoan = (await adminDb.command({ usersInfo: { user: tenTaiKhoan, db: 'admin' } })).users.length > 0;
  // Luôn đặt lại mật khẩu và vai trò theo cấu hình hiện tại (đổi mật khẩu trong .env rồi chạy lại là có hiệu lực)
  if (coTaiKhoan) await adminDb.command({ updateUser: tenTaiKhoan, pwd: matKhau, roles });
  else await adminDb.command({ createUser: tenTaiKhoan, pwd: matKhau, roles });
  return { vaiTro: VAI_TRO_UNG_DUNG, taiKhoan: tenTaiKhoan, taoMoi: { vaiTro: !coVaiTro, taiKhoan: !coTaiKhoan }, privileges };
}

module.exports = { thietLapQuyen, dsQuyen, VAI_TRO_UNG_DUNG, COLLECTION_NHAT_KY, QUYEN_NGHIEP_VU, QUYEN_NHAT_KY, QUYEN_KHO_TEP };
