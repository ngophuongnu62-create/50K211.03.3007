/** Điểm khởi động: kết nối MongoDB, chạy tác vụ định kỳ, mở cổng API. */
const env = require('./config/env');
const { ketNoiCSDL, ngatKetNoiCSDL, kiemTraQuyenNhatKy } = require('./config/db');
const { taoApp } = require('./app');
const { batDauTacVuDinhKy } = require('./jobs/dinhKy');

let dangChay = null;

/**
 * Lưới an toàn cấp tiến trình:
 * - Promise bị từ chối mà không ai bắt: ghi log, máy chủ vẫn tiếp tục phục vụ.
 * - Ngoại lệ không bắt được (trạng thái tiến trình không còn tin cậy): ghi log, ngừng nhận yêu cầu mới,
 *   chờ yêu cầu đang xử lý xong rồi thoát để Docker (restart: unless-stopped) khởi động lại sạch sẽ trong vài giây.
 */
process.on('unhandledRejection', (lyDo) => {
  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] Promise bị từ chối không được xử lý:`, lyDo);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] Ngoại lệ không được xử lý, khởi động lại an toàn:`, err);
  const thoat = () => process.exit(1);
  if (dangChay) dangChay.close(thoat); else thoat();
  setTimeout(thoat, 10000).unref();
});

async function khoiDong() {
  env.kiemTraCauHinh();
  await ketNoiCSDL();
  const quyen = await kiemTraQuyenNhatKy();
  // eslint-disable-next-line no-console
  console.log(`Đã kết nối MongoDB${quyen.batXacThuc ? ` bằng tài khoản ${quyen.nguoiDung.join(', ')}` : ' (không xác thực)'}`);
  if (env.LA_PRODUCTION && quyen.quyenNguyHiem.length) {
    // eslint-disable-next-line no-console
    console.warn(`CẢNH BÁO: tài khoản CSDL của ứng dụng có quyền ${quyen.quyenNguyHiem.join(', ')} trên audit_logs – nhật ký có thể bị sửa / xóa. `
      + 'Dùng tài khoản ứng dụng riêng do src/db/thiet-lap-csdl.js tạo.');
  }
  const tacVu = batDauTacVuDinhKy();
  const srv = taoApp().listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Broadway [${env.NODE_ENV}] đang chạy tại http://localhost:${env.PORT} (API: /api${env.FRONTEND_DIST ? ', giao diện: /' : ''})`);
  });
  // Chống giữ kết nối treo (slowloris) và đồng bộ với proxy ngược phía trước
  srv.requestTimeout = env.REQUEST_TIMEOUT_MS * 5;
  srv.headersTimeout = 20000;
  srv.keepAliveTimeout = 65000;
  dangChay = srv;
  // Dừng an toàn khi nền tảng triển khai gửi tín hiệu (cập nhật phiên bản, khởi động lại)
  const dung = (tinHieu) => {
    // eslint-disable-next-line no-console
    console.log(`Nhận ${tinHieu}, đang dừng máy chủ…`);
    clearInterval(tacVu);
    srv.close(async () => {
      await ngatKetNoiCSDL().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10000).unref();
  };
  process.on('SIGTERM', dung);
  process.on('SIGINT', dung);
}

khoiDong().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Không khởi động được máy chủ:', err);
  process.exit(1);
});
