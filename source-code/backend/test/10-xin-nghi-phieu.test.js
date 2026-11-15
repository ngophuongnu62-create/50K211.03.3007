/**
 * UC_13 bước 5–6: học viên báo vắng → ca học "Báo vắng" và Quản lý nhận phiếu "Chờ xử lý" trong "Phản hồi & yêu cầu".
 * Mốc đồng hồ: 09:00 Thứ Tư 11/11/2026; ca 2 hôm nay của GT-A2-08 bắt đầu 13:30 (đủ trước 2 tiếng).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { khoiDong, TK, PH } = require('./helpers/moiTruong');

let t;
let models;
before(async () => {
  t = await khoiDong();
  models = require('../src/models');
  await t.napLai();
});
after(async () => { await t.dong(); });

const caHomNay = async () => (await models.LichDay.findOne({ maLop: 'GT-A2-08', ngayDay: new Date('2026-11-11T00:00:00Z'), maCa: 'CA2' }).lean())._id;

describe('Xin nghỉ học tạo phiếu cho Quản lý (UC_13)', () => {
  it('TC-XN-01 · Báo vắng thành công → phiếu "Chờ xử lý" loại Nghỉ phép, gắn với ca học, Quản lý thấy trong danh sách', async () => {
    const ma = await caHomNay();
    const ph = await t.phuHuynh(...PH.AN);
    const r = await t.goi('POST', `/phu-huynh/ca-hoc/${ma}/xin-nghi`, { token: ph, body: { lyDoXinNghi: 'NghiOm', ghiChu: 'Bé bị sốt' } });
    assert.equal(r.status, 201);
    const phieu = await models.PhanHoiGopY.findOne({ maLichDay: ma, loaiPhanHoi: 'NghiPhep' }).lean();
    assert.ok(phieu, 'phải tạo phiếu');
    assert.match(phieu._id, /^PH-\d{4}-\d{4}$/);
    assert.equal(phieu.trangThaiXuLy, 'ChoXuLy');
    assert.ok(phieu.maPHHV);
    assert.match(phieu.tieuDe, /^Xin nghỉ học Thứ Tư 11\/11 · Ca 2 – /);
    assert.equal(phieu.noiDung, 'Lý do: Nghỉ ốm. Ghi chú: Bé bị sốt');
    const ds = await t.goi('GET', '/quan-ly/phan-hoi', { token: await t.nhanSu(TK.QL) });
    assert.ok(ds.body.data.ds.some((p) => p.maPhanHoi === phieu._id && p.trangThaiXuLy === 'ChoXuLy'));
  });

  it('TC-XN-02 · Gửi lại cho cùng ca → 409, không tạo thêm phiếu', async () => {
    const ma = await caHomNay();
    const truoc = await models.PhanHoiGopY.countDocuments({ maLichDay: ma });
    const r = await t.goi('POST', `/phu-huynh/ca-hoc/${ma}/xin-nghi`, { token: await t.phuHuynh(...PH.AN), body: { lyDoXinNghi: 'NghiOm' } });
    assert.equal(r.status, 409);
    assert.equal(await models.PhanHoiGopY.countDocuments({ maLichDay: ma }), truoc);
  });
});
