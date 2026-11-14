/**
 * Kiểm thử XÁC THỰC MONGODB và VAI TRÒ CHỈ GHI NHẬT KÝ – chạy trên MongoDB replica set BẬT xác thực (keyfile + tài khoản quản trị),
 * giống cấu hình docker-compose.yml:
 *  - Không đăng nhập → không đọc / ghi được gì.
 *  - Tài khoản quản trị chạy bước thiết lập (cấu trúc + vai trò broadwayApp + tài khoản ứng dụng).
 *  - Tài khoản ứng dụng vận hành đủ nghiệp vụ (giao dịch, ghi nhật ký) nhưng KHÔNG sửa / xóa được audit_logs,
 *    không xóa dữ liệu nghiệp vụ, không đổi cấu trúc, không tự nâng quyền.
 */
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'broadway-kiem-thu-uploads');

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('../src/config/mongoose');
const clock = require('../src/utils/clock');
const { ketNoiCSDL, ngatKetNoiCSDL, kiemTraQuyenNhatKy, dsCollection } = require('../src/config/db');
const { thietLapQuyen } = require('../src/db/quyenCSDL');

const MOC = new Date('2026-11-11T02:00:00Z'); // 09:00 Thứ Tư 11/11/2026 giờ Việt Nam
const QT = { user: 'quantri', pass: 'QuanTri-kiem-thu-0123456789', authSource: 'admin' };
const UD = { user: 'broadway_app', pass: 'UngDung-kiem-thu-0123456789', authSource: 'admin' };

let rs;
let uri;
const ketNoiQuanTri = (dongBoCauTruc = true) => ketNoiCSDL(uri, { taiKhoan: QT, dongBoCauTruc });
const ketNoiUngDung = () => ketNoiCSDL(uri, { taiKhoan: UD, dongBoCauTruc: false });
const khongDuQuyen = (e) => e?.code === 13 || /not authorized|requires authentication/i.test(e?.message || '');

before(async () => {
  rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger', auth: { enable: true, customRootName: QT.user, customRootPwd: QT.pass } },
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' },
  });
  uri = rs.getUri('BroadwayDB');
});
after(async () => {
  clock.setNow(null);
  await ngatKetNoiCSDL().catch(() => {});
  await rs.stop();
});

describe('Xác thực MongoDB và vai trò chỉ ghi nhật ký', () => {
  it('TC-CSDL-01 · Kết nối không đăng nhập → MongoDB từ chối mọi thao tác (đã bật xác thực)', async () => {
    await assert.rejects(ketNoiCSDL(uri, { taiKhoan: null, dongBoCauTruc: false }), khongDuQuyen);
    await ngatKetNoiCSDL();
    await assert.rejects(ketNoiCSDL(uri, { taiKhoan: { ...UD, pass: 'sai-mat-khau' }, dongBoCauTruc: false }), /Authentication failed/i);
    await ngatKetNoiCSDL();
  });

  it('TC-CSDL-02 · Ứng dụng khởi động khi CSDL chưa được thiết lập → báo rõ cần chạy bước thiết lập', async () => {
    await assert.rejects(
      ketNoiCSDL(rs.getUri('BroadwayChuaThietLap'), { taiKhoan: QT, dongBoCauTruc: false }),
      /CSDL chưa được thiết lập[\s\S]*thiet-lap-csdl/,
    );
    await ngatKetNoiCSDL();
  });

  it('TC-CSDL-03 · Tài khoản quản trị chạy bước thiết lập trên CSDL trống: tạo đủ collection, vai trò broadwayApp, tài khoản ứng dụng; chạy lại lần 2 vẫn thành công', async () => {
    await ketNoiQuanTri();
    const adminDb = mongoose.connection.getClient().db('admin');
    const lan1 = await thietLapQuyen(adminDb, { tenDb: 'BroadwayDB', dsCollection: dsCollection(), tenTaiKhoan: UD.user, matKhau: UD.pass });
    assert.deepEqual(lan1.taoMoi, { vaiTro: true, taiKhoan: true });
    const lan2 = await thietLapQuyen(adminDb, { tenDb: 'BroadwayDB', dsCollection: dsCollection(), tenTaiKhoan: UD.user, matKhau: UD.pass });
    assert.deepEqual(lan2.taoMoi, { vaiTro: false, taiKhoan: false });
    const quyenNhatKy = lan2.privileges.find((p) => p.resource.collection === 'audit_logs').actions;
    assert.deepEqual([...quyenNhatKy].sort(), ['find', 'insert']);
    // CSDL hoàn toàn trống: bước thiết lập phải tạo đủ mọi collection (kể cả collection không có validator như boDem)
    const coSan = (await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    assert.deepEqual(dsCollection().filter((c) => !coSan.includes(c)), []);
    // Tài khoản quản trị thì có toàn quyền trên nhật ký – vì vậy ứng dụng không được dùng tài khoản này
    assert.ok((await kiemTraQuyenNhatKy()).quyenNguyHiem.includes('remove'));
    // Nạp dữ liệu demo bằng tài khoản quản trị để các ca sau chạy nghiệp vụ thật
    clock.setNow(MOC);
    await require('../src/seed/duLieuMau').napDuLieuMau({ xoaCu: true });
    await ngatKetNoiCSDL();
  });

  it('TC-CSDL-04 · Tài khoản ứng dụng: đăng nhập được, trên audit_logs chỉ có quyền đọc và thêm', async () => {
    await ketNoiUngDung();
    const q = await kiemTraQuyenNhatKy();
    assert.equal(q.batXacThuc, true);
    assert.deepEqual(q.nguoiDung, ['broadway_app@admin']);
    assert.deepEqual(q.quyenNguyHiem, []);
  });

  it('TC-CSDL-05 · Ứng dụng chạy nghiệp vụ thật bằng tài khoản hạn chế: đăng nhập, phân công (giao dịch + khóa + nhật ký), init-master-data', async () => {
    const { taoApp } = require('../src/app');
    const { MAT_KHAU_MAU } = require('../src/seed/duLieuMau');
    const models = require('../src/models');
    const srv = taoApp().listen(0);
    const base = `http://127.0.0.1:${srv.address().port}/api`;
    try {
      const dn = await fetch(`${base}/auth/dang-nhap`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenDangNhap: 'quanly', matKhau: MAT_KHAU_MAU }),
      });
      assert.equal(dn.status, 200);
      const { token } = (await dn.json()).data;
      const pc = await fetch(`${base}/quan-ly/quan-ly-lich/IE65-K12/phan-cong`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ maNhanSu: 'GV-005' }),
      });
      assert.equal(pc.status, 200, JSON.stringify(await pc.clone().json()));
      const log = await models.AuditLog.findOne({ maYeuCau: pc.headers.get('x-request-id') }).lean();
      assert.equal(log.hanhDong, 'PHAN_CONG.GIAO_VIEN');
      // Kho tệp GridFS: lưu ảnh bằng cấp, tải lại được; yêu cầu bị từ chối thì ảnh vừa lưu được dọn khỏi kho
      const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
      const hoSo = (sdt, email) => {
        const f = new FormData();
        for (const [k, v] of Object.entries({ hoTen: 'Kiểm Thử Tệp', soDienThoai: sdt, email, diaChi: 'Đà Nẵng', loaiNhanSu: 'GiaoVien' })) f.append(k, v);
        f.append('bangCap', new Blob([PNG], { type: 'image/png' }), 'bang.png');
        return fetch(`${base}/quan-ly/ho-so-giao-vien`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: f });
      };
      const tao = await hoSo('0905222001', 'kiemthutep@gmail.com');
      assert.equal(tao.status, 201, JSON.stringify(await tao.clone().json()));
      const anh = await fetch(base.replace(/\/api$/, '') + (await tao.json()).data.hoSo.bangCap[0].hinhAnh);
      assert.equal(anh.status, 200);
      assert.ok(Buffer.from(await anh.arrayBuffer()).equals(PNG));
      const khoTep = mongoose.connection.db.collection('tepTaiLen.files');
      const soTep = await khoTep.countDocuments();
      assert.equal((await hoSo('0905222001', 'khac@gmail.com')).status, 409);
      await new Promise((ok) => setTimeout(ok, 200));
      assert.equal(await khoTep.countDocuments(), soTep);
      const { khoiTaoDuLieuGoc } = require('../src/seed/khoiTaoDuLieuGoc');
      await khoiTaoDuLieuGoc({ log: () => {} });
    } finally {
      await new Promise((ok) => srv.close(ok));
    }
  });

  it('TC-CSDL-06 · Tài khoản ứng dụng đi thẳng driver (bỏ qua Mongoose) cũng KHÔNG sửa / xóa / làm mất được nhật ký', async () => {
    const db = mongoose.connection.db;
    const nk = db.collection('audit_logs');
    const truoc = await nk.countDocuments();
    assert.ok(truoc > 0);
    const mot = await nk.findOne();
    // Đếm chỉ mục bằng kết nối quản trị riêng (tài khoản ứng dụng không được xem chỉ mục của audit_logs)
    const qt = await mongoose.createConnection(uri, { auth: { username: QT.user, password: QT.pass }, authSource: 'admin' }).asPromise();
    const chiMucQuanTri = () => qt.db.collection('audit_logs').indexes();
    const soChiMuc = (await chiMucQuanTri()).length;
    assert.ok(soChiMuc > 1);
    const thu = [
      ['deleteMany', () => nk.deleteMany({})],
      ['deleteOne', () => nk.deleteOne({ _id: mot._id })],
      ['findOneAndDelete', () => nk.findOneAndDelete({ _id: mot._id })],
      ['updateOne', () => nk.updateOne({ _id: mot._id }, { $set: { hanhDong: 'GIA_MAO' } })],
      ['updateMany', () => nk.updateMany({}, { $unset: { duLieuCu: 1 } })],
      ['replaceOne', () => nk.replaceOne({ _id: mot._id }, { hanhDong: 'GIA_MAO' })],
      ['drop', () => nk.drop()],
      ['createIndex TTL (tự xóa nhật ký cũ)', () => nk.createIndex({ thoiDiem: 1 }, { expireAfterSeconds: 1, name: 'XoaNhatKy' })],
      // Lệnh gốc: hàm dropIndexes() của driver tự nuốt lỗi và chỉ trả về false
      ['dropIndexes', () => db.command({ dropIndexes: 'audit_logs', index: '*' })],
      ['collMod tắt validator', () => db.command({ collMod: 'audit_logs', validator: {}, validationLevel: 'off' })],
      ['renameCollection', () => db.renameCollection('audit_logs', 'nhat_ky_cu')],
      ['convertToCapped', () => db.command({ convertToCapped: 'audit_logs', size: 4096 })],
    ];
    for (const [ten, fn] of thu) await assert.rejects(fn(), khongDuQuyen, `${ten} lẽ ra phải bị từ chối`);
    assert.equal(await nk.countDocuments(), truoc);
    assert.equal((await nk.findOne({ _id: mot._id })).hanhDong, mot.hanhDong);
    assert.equal((await chiMucQuanTri()).length, soChiMuc);
    await qt.close();
    // Thêm và đọc vẫn được (đúng vai trò "chỉ ghi nhật ký")
    await nk.insertOne({ thoiDiem: new Date(), nguoiThucHien: { ma: 'KIEM_THU', vaiTro: 'HeThong' }, hanhDong: 'KIEM_THU.QUYEN', doiTuong: { loai: 'CSDL', ma: 'audit_logs' } });
    assert.equal(await nk.countDocuments(), truoc + 1);
  });

  it('TC-CSDL-07 · Tài khoản ứng dụng không xóa được dữ liệu nghiệp vụ, không đổi cấu trúc, không tự nâng quyền', async () => {
    const db = mongoose.connection.db;
    const admin = mongoose.connection.getClient().db('admin');
    const soLich = await db.collection('lichDay').countDocuments();
    const thu = [
      ['xóa lịch dạy', () => db.collection('lichDay').deleteMany({})],
      ['xóa collection lịch dạy', () => db.collection('lichDay').drop()],
      ['xóa cả CSDL', () => db.dropDatabase()],
      ['tắt validator lịch dạy', () => db.command({ collMod: 'lichDay', validator: {}, validationLevel: 'off' })],
      ['tạo chỉ mục', () => db.collection('lichDay').createIndex({ ghiChu: 1 })],
      ['xóa chỉ mục chống trùng', () => db.collection('lichDay').dropIndex('UX_LichDay_NhanSu')],
      ['tạo tài khoản quản trị mới', () => admin.command({ createUser: 'hacker', pwd: 'x'.repeat(20), roles: ['root'] })],
      ['tự cấp quyền root', () => admin.command({ grantRolesToUser: UD.user, roles: ['root'] })],
      ['sửa vai trò broadwayApp', () => admin.command({ grantPrivilegesToRole: 'broadwayApp', privileges: [{ resource: { db: 'BroadwayDB', collection: 'audit_logs' }, actions: ['remove'] }] })],
      ['đọc bảng tài khoản MongoDB', () => admin.collection('system.users').findOne()],
    ];
    for (const [ten, fn] of thu) await assert.rejects(fn(), khongDuQuyen, `${ten} lẽ ra phải bị từ chối`);
    assert.equal(await db.collection('lichDay').countDocuments(), soLich);
    await ngatKetNoiCSDL();
  });
});
