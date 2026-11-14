/**
 * Bước thiết lập CSDL – chạy bằng TÀI KHOẢN QUẢN TRỊ MongoDB, trước khi ứng dụng khởi động (dịch vụ "thiet-lap-csdl"
 * trong docker-compose.yml chạy tự động mỗi lần `docker compose up`):
 *   1. Tạo collection còn thiếu, áp $jsonSchema validator, tạo chỉ mục cho TẤT CẢ collection (kể cả audit_logs).
 *   2. Tạo / cập nhật vai trò "broadwayApp" và tài khoản ứng dụng (xem src/db/quyenCSDL.js).
 *   3. Tự kiểm tra: tài khoản ứng dụng đăng nhập được và KHÔNG có quyền sửa / xóa audit_logs.
 * Không đọc, không sửa, không xóa dữ liệu nghiệp vụ. Chạy lại bao nhiêu lần cũng được.
 *
 * Biến môi trường: MONGODB_URI, MONGODB_USER / MONGODB_PASSWORD (quản trị), MONGO_APP_USER, MONGO_APP_PASSWORD.
 */
const mongoose = require('../config/mongoose');
const env = require('../config/env');
const { ketNoiCSDL, ngatKetNoiCSDL, kiemTraQuyenNhatKy, dsCollection } = require('../config/db');
const { thietLapQuyen } = require('./quyenCSDL');

// eslint-disable-next-line no-console
const log = (...a) => console.log('[thiet-lap-csdl]', ...a);

async function chay() {
  const tenTaiKhoan = process.env.MONGO_APP_USER || 'broadway_app';
  const matKhau = process.env.MONGO_APP_PASSWORD || '';
  if (!env.MONGODB_URI) throw new Error('Chưa đặt MONGODB_URI');
  if (!env.MONGODB_USER) throw new Error('Chưa đặt MONGODB_USER / MONGODB_PASSWORD của tài khoản quản trị MongoDB');
  if (matKhau.length < 16) throw new Error('MONGO_APP_PASSWORD phải dài tối thiểu 16 ký tự (tạo bằng: openssl rand -hex 24)');
  if (tenTaiKhoan === env.MONGODB_USER) throw new Error('Tài khoản ứng dụng phải khác tài khoản quản trị');

  await ketNoiCSDL(env.MONGODB_URI, { dongBoCauTruc: true });
  const tenDb = mongoose.connection.db.databaseName;
  log(`Đã đồng bộ cấu trúc ${dsCollection().length} collection của CSDL ${tenDb} (validator + chỉ mục).`);
  const kq = await thietLapQuyen(mongoose.connection.getClient().db('admin'), {
    tenDb, dsCollection: dsCollection(), tenTaiKhoan, matKhau,
  });
  log(`Vai trò ${kq.vaiTro}: ${kq.taoMoi.vaiTro ? 'tạo mới' : 'cập nhật'}. Tài khoản ứng dụng ${kq.taiKhoan}: ${kq.taoMoi.taiKhoan ? 'tạo mới' : 'cập nhật mật khẩu / vai trò'}.`);
  await ngatKetNoiCSDL();

  // Tự kiểm tra bằng chính tài khoản ứng dụng
  await ketNoiCSDL(env.MONGODB_URI, { taiKhoan: { user: tenTaiKhoan, pass: matKhau, authSource: 'admin' }, dongBoCauTruc: false });
  const q = await kiemTraQuyenNhatKy();
  await ngatKetNoiCSDL();
  if (!q.batXacThuc) throw new Error('MongoDB chưa bật xác thực (không có tài khoản nào được đăng nhập)');
  if (q.quyenNguyHiem.length) throw new Error(`Tài khoản ứng dụng vẫn có quyền ${q.quyenNguyHiem.join(', ')} trên audit_logs`);
  log(`Kiểm tra: ${tenTaiKhoan} đăng nhập được; trên audit_logs chỉ được đọc và thêm.`);
}

chay().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('[thiet-lap-csdl] Lỗi:', err.message);
  await ngatKetNoiCSDL().catch(() => {});
  process.exit(1);
});
