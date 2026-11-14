/**
 * Kiểm tra sức khỏe MongoDB (mongosh, chạy trong container mỗi 10 giây):
 *  - Đăng nhập bằng tài khoản quản trị (đọc từ biến môi trường, không lộ mật khẩu trên dòng lệnh).
 *  - Nâng cấp từ bản cũ chưa bật xác thực: CSDL đã có dữ liệu nên image không tự tạo tài khoản quản trị
 *    → dùng ngoại lệ localhost của MongoDB (chỉ hiệu lực khi CHƯA có tài khoản nào) để tạo tài khoản quản trị đầu tiên.
 *  - Khởi tạo replica set rs0 ở lần chạy đầu.
 */
const ten = process.env.MONGO_INITDB_ROOT_USERNAME;
const mk = process.env.MONGO_INITDB_ROOT_PASSWORD;
const admin = db.getSiblingDB('admin');

function dangNhap() {
  try {
    return admin.auth(ten, mk).ok === 1;
  } catch (e) {
    return false;
  }
}

if (!dangNhap()) {
  admin.createUser({ user: ten, pwd: mk, roles: [{ role: 'root', db: 'admin' }] });
  print('Đã tạo tài khoản quản trị MongoDB cho CSDL nâng cấp từ bản chưa bật xác thực');
  if (!dangNhap()) quit(1);
}

let ok;
try {
  ok = rs.status().ok;
} catch (e) {
  if (e.codeName !== 'NotYetInitialized') throw e;
  ok = rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo:27017' }] }).ok;
}
quit(ok === 1 ? 0 : 1);
