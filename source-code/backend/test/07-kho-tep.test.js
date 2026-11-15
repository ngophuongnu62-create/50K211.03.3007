/**
 * Kiểm thử KHO TỆP TRONG MONGODB (GridFS) – ảnh bằng cấp (UC_3.2) và tệp minh chứng (UC_14) không phụ thuộc ổ đĩa máy chủ
 * (nền tảng như Render xóa ổ đĩa mỗi lần khởi động lại).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env');
const { khoiDong, TK, PH } = require('./helpers/moiTruong');

let t;
let goc;
let khoTep;
before(async () => {
  t = await khoiDong();
  goc = t.base.replace(/\/api$/, '');
  khoTep = require('../src/config/mongoose').connection.db.collection('tepTaiLen.files');
});
after(async () => { await t.dong(); });

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

async function themHoSo(email, soDienThoai) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ hoTen: 'Hoàng Bảo Ngọc', soDienThoai, email, diaChi: 'Đà Nẵng', loaiNhanSu: 'GiaoVien' })) f.append(k, v);
  f.append('bangCap', new Blob([PNG], { type: 'image/png' }), 'bang.png');
  return t.goi('POST', '/quan-ly/ho-so-giao-vien', { token: await t.nhanSu(TK.QL), form: f });
}

describe('Kho tệp GridFS', () => {
  it('TC-TEP-01 · Thêm hồ sơ kèm ảnh bằng cấp → ảnh lưu trong MongoDB (không ghi ổ đĩa), tải lại đúng nội dung và loại tệp', async () => {
    const r = await themHoSo('tep01@gmail.com', '0905111001');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const duongDan = r.body.data.hoSo.bangCap[0].hinhAnh;
    assert.match(duongDan, /^\/uploads\/bangcap\/\d+-[0-9a-f]{32}\.png$/);
    const tep = await khoTep.findOne({ filename: duongDan.replace('/uploads/', '') });
    assert.ok(tep, 'phải có bản ghi trong tepTaiLen.files');
    assert.equal(tep.metadata.loaiNoiDung, 'image/png');
    assert.equal(fs.existsSync(path.join(env.UPLOAD_DIR, duongDan.replace('/uploads/', ''))), false);

    const tai = await fetch(goc + duongDan);
    assert.equal(tai.status, 200);
    assert.equal(tai.headers.get('content-type'), 'image/png');
    assert.equal(tai.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(Buffer.from(await tai.arrayBuffer()).equals(PNG));
    // Trình duyệt đã có bản lưu đệm → 304, không gửi lại nội dung
    const lai = await fetch(goc + duongDan, { headers: { 'If-None-Match': tai.headers.get('etag') } });
    assert.equal(lai.status, 304);
  });

  it('TC-TEP-02 · Phụ huynh gửi ý kiến kèm tệp PDF → tải lại được tệp minh chứng', async () => {
    const f = new FormData();
    for (const [k, v] of Object.entries({ loaiPhanHoi: 'DichVu', tieuDe: 'Bãi xe', noiDung: 'Bãi xe chật' })) f.append(k, v);
    f.append('tepDinhKem', new Blob([PDF], { type: 'application/pdf' }), 'minh-chung.pdf');
    const r = await t.goi('POST', '/phu-huynh/gop-y', { token: await t.phuHuynh(...PH.AN), form: f });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const models = require('../src/models');
    const phieu = await models.PhanHoiGopY.findOne({ 'tepDinhKem.tenTep': 'minh-chung.pdf' }).lean();
    const duongDan = phieu.tepDinhKem[0].duongDan;
    assert.match(duongDan, /^\/uploads\/phanhoi\/.+\.pdf$/);
    const tai = await fetch(goc + duongDan);
    assert.equal(tai.status, 200);
    assert.equal(tai.headers.get('content-type'), 'application/pdf');
    assert.ok(Buffer.from(await tai.arrayBuffer()).equals(PDF));
  });

  it('TC-TEP-03 · SĐT trùng (409) → ảnh vừa lưu bị xóa khỏi kho, không để lại tệp mồ côi', async () => {
    const truoc = await khoTep.countDocuments();
    const r = await themHoSo('tep03@gmail.com', '0905111001'); // SĐT đã dùng ở TC-TEP-01
    assert.equal(r.status, 409);
    await new Promise((ok) => setTimeout(ok, 200));
    assert.equal(await khoTep.countDocuments(), truoc);
    assert.equal(await require('../src/config/mongoose').connection.db.collection('tepTaiLen.chunks').countDocuments({ files_id: { $nin: await khoTep.distinct('_id') } }), 0);
  });

  it('TC-TEP-04 · Đường dẫn không tồn tại / dò thư mục / tên lạ → 404', async () => {
    for (const p of ['/uploads/bangcap/1-khongco.png', '/uploads/../package.json', '/uploads/bangcap/..%2F..%2Fpackage.json', '/uploads/khac/a.png']) {
      // Gửi nguyên văn đường dẫn: fetch() tự rút gọn "/uploads/../x" thành "/x" (giao diện SPA → 200), không thử được dò thư mục
      const status = await new Promise((ok, loi) => {
        const u = new URL(goc);
        require('node:http').get({ host: u.hostname, port: u.port, path: p }, (res) => { res.resume(); ok(res.statusCode); }).on('error', loi);
      });
      assert.equal(status, 404, p);
    }
  });
});
