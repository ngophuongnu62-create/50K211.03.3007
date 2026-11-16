/**
 * Phát hiện khi kiểm tra độc lập theo checklist (16/11/2026):
 * - A5-03: đăng xuất phải kết thúc phiên ở máy chủ – token cũ không dùng lại được; phiên khác của cùng tài khoản vẫn dùng được.
 * - A3-05: phê duyệt lại lịch đã phát hành bị chặn với thông báo đúng lý do.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/constants/messages');
const { khoiDong, TK, PH } = require('./helpers/moiTruong');

let t;
before(async () => { t = await khoiDong(); await t.napLai(); });
after(async () => { await t.dong(); });

const dangNhap = async (u) => (await t.goi('POST', '/auth/dang-nhap', { body: { tenDangNhap: u, matKhau: 'Broadway@2026' } })).body.data.token;

describe('Đăng xuất thu hồi token (A5-03)', () => {
  it('TC-DX-AUTH-01 · Nhân sự đăng xuất → token đó bị từ chối 401; phiên thứ hai của cùng tài khoản vẫn dùng được', async () => {
    const may1 = await dangNhap(TK.QL);
    const may2 = await dangNhap(TK.QL);
    assert.equal((await t.goi('GET', '/auth/toi', { token: may1 })).status, 200);
    assert.equal((await t.goi('POST', '/auth/dang-xuat', { token: may1 })).status, 200);
    assert.equal((await t.goi('GET', '/auth/toi', { token: may1 })).status, 401);
    assert.equal((await t.goi('GET', '/quan-ly/tong-quan', { token: may1 })).status, 401);
    assert.equal((await t.goi('GET', '/auth/toi', { token: may2 })).status, 200);
  });

  it('TC-DX-AUTH-02 · Phụ huynh / học viên đăng xuất → token đó bị từ chối 401', async () => {
    const r = await t.goi('POST', '/auth/phu-huynh/dang-nhap', { body: { hoTen: PH.AN[0], soDienThoai: PH.AN[1] } });
    const tk = r.body.data.token;
    assert.equal((await t.goi('GET', '/phu-huynh/lop', { token: tk })).status, 200);
    assert.equal((await t.goi('POST', '/auth/dang-xuat', { token: tk })).status, 200);
    assert.equal((await t.goi('GET', '/phu-huynh/lop', { token: tk })).status, 401);
  });
});

describe('Phê duyệt sai trạng thái (A3-05)', () => {
  it('TC-PD-01 · Phê duyệt lại lịch đã phát hành → 409 "Chỉ lịch ở trạng thái “Chờ GV xác nhận” mới được phê duyệt."', async () => {
    const r = await t.goi('POST', '/quan-ly/quan-ly-lich/IEF-K15/phe-duyet', { token: await t.nhanSu(TK.QL) });
    assert.equal(r.status, 409);
    assert.equal(r.body.message, M.PD_CHI_CHO_GV_XAC_NHAN);
  });
});
