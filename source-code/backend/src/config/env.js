/**
 * Cấu hình theo môi trường (NODE_ENV = development | test | production).
 *
 * Thứ tự nạp (tệp nạp trước được ưu tiên, biến môi trường thật của hệ điều hành luôn thắng):
 *   .env.<NODE_ENV>.local  →  .env.<NODE_ENV>  →  .env
 * - development / test: có giá trị mặc định an toàn để chạy ngay trên máy lập trình viên.
 * - production: KHÔNG có giá trị mặc định cho bí mật, CSDL, tên miền; thiếu là từ chối khởi động (kiemTraCauHinh).
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const MOI_TRUONG = ['development', 'test', 'production'];
const NODE_ENV = process.env.NODE_ENV || 'development';
if (!MOI_TRUONG.includes(NODE_ENV)) {
  throw new Error(`NODE_ENV="${NODE_ENV}" không hợp lệ. Chỉ chấp nhận: ${MOI_TRUONG.join(', ')}`);
}
const LA_PRODUCTION = NODE_ENV === 'production';

const GOC = path.resolve(__dirname, '../..');
for (const ten of [`.env.${NODE_ENV}.local`, `.env.${NODE_ENV}`, '.env']) {
  const tep = path.join(GOC, ten);
  if (fs.existsSync(tep)) dotenv.config({ path: tep, quiet: true });
}

const MAC_DINH_JWT_DEV = 'broadway-dev-secret-chi-dung-khi-lap-trinh';
/** Giá trị mặc định chỉ dùng cho development / test */
const md = (giaTri) => (LA_PRODUCTION ? undefined : giaTri);
const soNguyen = (v, macDinh) => (v === undefined || v === '' ? macDinh : Number.parseInt(v, 10));
const danhSach = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

const thuMucFrontend = process.env.FRONTEND_DIST || path.resolve(GOC, '../frontend/dist');

const env = {
  NODE_ENV,
  LA_PRODUCTION,
  PORT: soNguyen(process.env.PORT, 4000),
  MONGODB_URI: process.env.MONGODB_URI || md('mongodb://127.0.0.1:27017/BroadwayDB?replicaSet=rs0'),
  /**
   * Tài khoản đăng nhập MongoDB (tách khỏi chuỗi kết nối để mật khẩu không phải mã hóa URL).
   * Production bắt buộc có xác thực: đặt MONGODB_USER / MONGODB_PASSWORD hoặc ghi sẵn trong MONGODB_URI (Atlas).
   */
  MONGODB_USER: process.env.MONGODB_USER || undefined,
  MONGODB_PASSWORD: process.env.MONGODB_PASSWORD || undefined,
  MONGODB_AUTH_SOURCE: process.env.MONGODB_AUTH_SOURCE || (process.env.MONGODB_USER ? 'admin' : undefined),
  /**
   * Ứng dụng tự đồng bộ validator + chỉ mục khi khởi động (1 = có). Đặt 0 khi tài khoản ứng dụng chỉ có quyền đọc/ghi dữ liệu
   * và cấu trúc CSDL do bước thiết lập (src/db/thiet-lap-csdl.js, tài khoản quản trị) đảm nhiệm – như docker-compose.yml.
   */
  MONGODB_DONG_BO_CAU_TRUC: !['0', 'false', 'khong'].includes(String(process.env.MONGODB_DONG_BO_CAU_TRUC || '1').toLowerCase()),
  JWT_SECRET: process.env.JWT_SECRET || md(MAC_DINH_JWT_DEV),
  JWT_EXPIRES_NHAN_SU: process.env.JWT_EXPIRES_NHAN_SU || '8h',
  JWT_EXPIRES_PHU_HUYNH: process.env.JWT_EXPIRES_PHU_HUYNH || '4h',
  /** Số vòng băm bcrypt cho mật khẩu mới (production nên ≥ 12) */
  BCRYPT_ROUNDS: soNguyen(process.env.BCRYPT_ROUNDS, LA_PRODUCTION ? 12 : 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  /**
   * Danh sách tên miền giao diện được phép gọi API (CORS), phân tách bằng dấu phẩy.
   * development: mặc định cho phép Vite (localhost:5173). production: bắt buộc khai báo, không chấp nhận "*".
   */
  CORS_ORIGIN: danhSach(process.env.CORS_ORIGIN || md('http://localhost:5173,http://127.0.0.1:5173')),
  /** Giới hạn tần suất: số yêu cầu API / phút / IP; số lần đăng nhập SAI / 15 phút / IP + tài khoản */
  // test: tắt mặc định (bộ kiểm thử bảo mật tự bật với ngưỡng riêng); 0 = tắt
  RATE_LIMIT_API_PHUT: soNguyen(process.env.RATE_LIMIT_API_PHUT, NODE_ENV === 'test' ? 0 : 600),
  RATE_LIMIT_DANG_NHAP: soNguyen(process.env.RATE_LIMIT_DANG_NHAP, NODE_ENV === 'test' ? 0 : 10),
  /** Thời gian tối đa xử lý một yêu cầu HTTP (ms) – chống treo kết nối */
  REQUEST_TIMEOUT_MS: soNguyen(process.env.REQUEST_TIMEOUT_MS, 30000),
  /** Thư mục bản build giao diện; có thì backend phục vụ luôn giao diện (triển khai một dịch vụ) */
  FRONTEND_DIST: fs.existsSync(path.join(thuMucFrontend, 'index.html')) ? thuMucFrontend : null,
  /** Số lớp proxy ngược phía trước (Nginx, Caddy, Render…) để đọc đúng IP / giao thức */
  TRUST_PROXY: soNguyen(process.env.TRUST_PROXY, 0),
  /** Tài khoản Quản lý khởi tạo (init-master-data) */
  ADMIN_TEN_DANG_NHAP: process.env.ADMIN_TEN_DANG_NHAP || 'admin',
  ADMIN_HO_TEN: process.env.ADMIN_HO_TEN || 'Quản trị hệ thống',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || md('admin@broadway.local'),
  ADMIN_SO_DIEN_THOAI: process.env.ADMIN_SO_DIEN_THOAI || md('0900000000'),
  ADMIN_MAT_KHAU_TAM: process.env.ADMIN_MAT_KHAU_TAM || undefined,
};

/** Danh sách lỗi cấu hình (rỗng = hợp lệ). Production bắt buộc đủ bí mật, CSDL, tên miền giao diện. */
env.loiCauHinh = () => {
  const loi = [];
  if (!env.MONGODB_URI) loi.push('Chưa đặt MONGODB_URI');
  if (!env.JWT_SECRET) loi.push('Chưa đặt JWT_SECRET');
  if (LA_PRODUCTION) {
    if (env.MONGODB_URI && !env.MONGODB_USER && !/^mongodb(\+srv)?:\/\/[^/@]+@/.test(env.MONGODB_URI)) {
      loi.push('MongoDB production phải bật xác thực: đặt MONGODB_USER / MONGODB_PASSWORD hoặc tài khoản trong MONGODB_URI');
    }
    if (env.MONGODB_USER && !env.MONGODB_PASSWORD) loi.push('Chưa đặt MONGODB_PASSWORD cho tài khoản MONGODB_USER');
    if (env.JWT_SECRET && (env.JWT_SECRET === MAC_DINH_JWT_DEV || env.JWT_SECRET.length < 32)) {
      loi.push('JWT_SECRET phải khác giá trị dùng khi lập trình và dài tối thiểu 32 ký tự');
    }
    if (!env.CORS_ORIGIN.length) loi.push('Chưa đặt CORS_ORIGIN (địa chỉ giao diện thật, VD: https://lichday.broadway.edu.vn)');
    if (env.CORS_ORIGIN.includes('*')) loi.push('CORS_ORIGIN không được là "*" trên production');
    for (const o of env.CORS_ORIGIN.filter((x) => x !== '*')) {
      if (!/^https?:\/\/[^/\s]+$/.test(o)) loi.push(`CORS_ORIGIN "${o}" không hợp lệ (dạng https://ten-mien, không có dấu / ở cuối)`);
    }
    if (env.BCRYPT_ROUNDS < 10) loi.push('BCRYPT_ROUNDS tối thiểu 10 trên production');
    if (!(env.RATE_LIMIT_API_PHUT > 0) || !(env.RATE_LIMIT_DANG_NHAP > 0)) loi.push('Không được tắt giới hạn tần suất (RATE_LIMIT_*) trên production');
    if (process.env.FAKE_NOW) loi.push('Không được đặt FAKE_NOW (giờ giả lập) trên production');
  }
  return loi;
};

env.kiemTraCauHinh = () => {
  const loi = env.loiCauHinh();
  if (loi.length) throw new Error(`Cấu hình ${NODE_ENV} không hợp lệ:\n - ${loi.join('\n - ')}`);
};

module.exports = env;
