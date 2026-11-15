/**
 * Cảnh báo "Sai lịch rảnh" (Trang chủ Quản lý, Phê duyệt, Lập lịch tuần):
 * UC_9 chỉ mở cổng đăng ký lịch rảnh cho TUẦN KẾ TIẾP → chỉ kết luận sai lịch rảnh ở tuần giáo viên đã đăng ký;
 * các tuần sau chưa có dữ liệu thì không cảnh báo (không suy ra từ mẫu tuần gần nhất).
 * Khi đề xuất / chọn giáo viên (nghiêm ngặt) vẫn dùng mẫu tuần gần nhất để xếp lịch nhiều tuần.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { coRanh } = require('../src/services/khaDung.service');

const d = (s) => new Date(`${s}T00:00:00Z`);
// GV đăng ký lịch rảnh tuần 16/11 – 22/11/2026: chỉ rảnh Thứ Hai 16/11 Ca 2
const mau = {
  theoTuan: new Map([['2026-11-16', new Set(['2026-11-16|CA2'])]]),
  ganNhat: new Set(['1|CA2']),
};

describe('Cảnh báo sai lịch rảnh chỉ xét tuần đã đăng ký', () => {
  it('TC-LR-01 · Tuần đã đăng ký: ca không đăng ký → sai lịch rảnh; ca đã đăng ký → hợp lệ', () => {
    assert.equal(coRanh(mau, d('2026-11-18'), 'CA2', { nghiemNgat: false }), false);
    assert.equal(coRanh(mau, d('2026-11-16'), 'CA2', { nghiemNgat: false }), true);
  });

  it('TC-LR-02 · Các tuần sau (25/11, 02/12, 09/12) chưa đăng ký → không kết luận, không cảnh báo', () => {
    for (const ngay of ['2026-11-25', '2026-12-02', '2026-12-09']) {
      assert.equal(coRanh(mau, d(ngay), 'CA2', { nghiemNgat: false }), null, ngay);
    }
  });

  it('TC-LR-03 · Đề xuất / chọn giáo viên vẫn dùng mẫu tuần gần nhất cho tuần chưa đăng ký', () => {
    assert.equal(coRanh(mau, d('2026-11-23'), 'CA2'), true); // Thứ Hai như mẫu
    assert.equal(coRanh(mau, d('2026-11-25'), 'CA2'), false); // Thứ Tư không có trong mẫu
  });
});
