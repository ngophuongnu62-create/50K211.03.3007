/**
 * npm run init-master-data
 * Khởi tạo dữ liệu gốc (ca học, phòng học, môn học) và tài khoản Quản lý khởi tạo.
 * Không chứa bất kỳ lệnh xóa dữ liệu nào – chạy lại nhiều lần an toàn (xem khoiTaoDuLieuGoc.js).
 */
const env = require('../config/env');
const { ketNoiCSDL, ngatKetNoiCSDL } = require('../config/db');
const { khoiTaoDuLieuGoc } = require('./khoiTaoDuLieuGoc');

// eslint-disable-next-line no-console
const log = (s) => console.log(`[init-master-data] ${s}`);

(async () => {
  env.kiemTraCauHinh();
  await ketNoiCSDL();
  log(`Môi trường: ${env.NODE_ENV}`);
  await khoiTaoDuLieuGoc({ log });
  await ngatKetNoiCSDL();
})().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('[init-master-data] Lỗi:', err.message);
  await ngatKetNoiCSDL().catch(() => {});
  process.exit(1);
});
