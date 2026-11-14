/**
 * Tác vụ định kỳ: khóa phản hồi của giáo viên quá hạn 24 giờ (UC_8 BR03).
 * Các quy tắc thời gian khác (UC_11 hạn 24 giờ, UC_13 trước 2 tiếng, UC_9 cổng lịch rảnh)
 * được kiểm tra tại thời điểm thao tác nên không cần tác vụ nền.
 */
const { capNhatPhanCongHetHan } = require('../services/giaoVien.service');

const CHU_KY_MS = 10 * 60 * 1000;

function batDauTacVuDinhKy() {
  const chay = () => capNhatPhanCongHetHan().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Lỗi tác vụ hết hạn phân công:', err.message);
  });
  chay();
  return setInterval(chay, CHU_KY_MS).unref();
}

module.exports = { batDauTacVuDinhKy };
