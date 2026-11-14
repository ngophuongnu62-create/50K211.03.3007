/**
 * npm run seed:demo – CHỈ dùng cho development / test / môi trường nghiệm thu (UAT).
 * Nạp bộ dữ liệu trình diễn (lớp, lịch, nhân sự, học viên, phiếu) tính theo tuần hiện tại.
 * Bị chặn tuyệt đối trên production, và chỉ chạy trên CSDL demo (xem kiemTraDuocNapDemo trong duLieuMau.js).
 */
const env = require('../config/env');
const { ketNoiCSDL, ngatKetNoiCSDL } = require('../config/db');
const { napDuLieuMau } = require('./duLieuMau');

(async () => {
  if (env.LA_PRODUCTION) throw new Error('seed:demo bị chặn trên production. Dùng npm run init-master-data để khởi tạo dữ liệu gốc.');
  await ketNoiCSDL();
  const kq = await napDuLieuMau({ xoaCu: true });
  // eslint-disable-next-line no-console
  console.log(`[seed:demo] Đã nạp dữ liệu demo: ${kq.soBuoi} buổi dạy.`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(kq.taiKhoan, null, 2));
  await ngatKetNoiCSDL();
})().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('[seed:demo] Lỗi:', err.message);
  await ngatKetNoiCSDL().catch(() => {});
  process.exit(1);
});
