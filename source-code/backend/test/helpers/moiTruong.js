/**
 * Môi trường kiểm thử nghiệp vụ:
 * - MongoDB replica set trong bộ nhớ (cần cho giao dịch và chỉ mục duy nhất như môi trường thật)
 * - Đồng hồ hệ thống cố định ở MOC (09:00 Thứ Tư 11/11/2026, giờ Việt Nam) để các quy tắc
 *   2 tiếng, 24 giờ, cổng lịch rảnh cho kết quả lặp lại được
 * - Dữ liệu mẫu (src/seed/duLieuMau.js) nạp lại trước mỗi nhóm kịch bản
 */
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'broadway-kiem-thu-uploads');

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const clock = require('../../src/utils/clock');
const { ketNoiCSDL, ngatKetNoiCSDL } = require('../../src/config/db');
const { napDuLieuMau, MAT_KHAU_MAU } = require('../../src/seed/duLieuMau');
const { taoApp } = require('../../src/app');

/** 09:00 Thứ Tư 11/11/2026 (UTC+7) */
const MOC = new Date('2026-11-11T02:00:00Z');

/** Thời điểm theo giờ Việt Nam: vn('2026-11-11', '11:30') */
const vn = (ngay, gio) => clock.thoiDiem(clock.parseNgay(ngay), gio);

async function khoiDong() {
  const rs = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    binary: { version: process.env.MONGOMS_VERSION || '7.0.14' },
  });
  await ketNoiCSDL(rs.getUri('BroadwayDB'));
  const srv = taoApp().listen(0);
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tokenCache = new Map();

  /** Gọi API, trả về { status, body } */
  async function goi(method, duongDan, { token, body, form, headers: them = {} } = {}) {
    const headers = { ...them };
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (method === 'GET' || method === 'HEAD') payload = undefined;
    else if (form) payload = form;
    else if (typeof body === 'string') { headers['Content-Type'] = 'application/json'; payload = body; }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const r = await fetch((duongDan.startsWith('http') ? '' : base) + duongDan, { method, headers, body: payload });
    const json = await r.json().catch(() => ({}));
    return { status: r.status, body: json, headers: r.headers };
  }

  /** Đăng nhập nhân sự bằng tài khoản mẫu, trả về token */
  async function nhanSu(tenDangNhap, matKhau = MAT_KHAU_MAU) {
    const k = `ns:${tenDangNhap}`;
    if (!tokenCache.has(k)) {
      const r = await goi('POST', '/auth/dang-nhap', { body: { tenDangNhap, matKhau } });
      if (r.status !== 200) throw new Error(`Không đăng nhập được ${tenDangNhap}: ${r.status} ${r.body.message}`);
      tokenCache.set(k, r.body.data.token);
    }
    return tokenCache.get(k);
  }

  /** Đăng nhập Phụ huynh / Học viên, trả về token */
  async function phuHuynh(hoTen, soDienThoai) {
    const k = `ph:${soDienThoai}:${hoTen}`;
    if (!tokenCache.has(k)) {
      const r = await goi('POST', '/auth/phu-huynh/dang-nhap', { body: { hoTen, soDienThoai } });
      if (r.status !== 200) throw new Error(`Không đăng nhập được ${hoTen}: ${r.status} ${r.body.message}`);
      tokenCache.set(k, r.body.data.token);
    }
    return tokenCache.get(k);
  }

  /** Đưa đồng hồ về MOC và nạp lại toàn bộ dữ liệu mẫu */
  async function napLai() {
    clock.setNow(MOC);
    await napDuLieuMau({ xoaCu: true });
    tokenCache.clear();
  }

  async function dong() {
    clock.setNow(null);
    await new Promise((ok) => srv.close(ok));
    await ngatKetNoiCSDL();
    await rs.stop();
  }

  await napLai();
  return { goi, nhanSu, phuHuynh, napLai, dong, datGio: clock.setNow, vn, MOC, clock, base };
}

/** Tài khoản mẫu hay dùng */
const TK = {
  QL: 'quanly', LAN: 'gvnguyenlan', QUAN: 'gvtranquan', HA: 'gvphamha', MAI: 'gvvomai', DAVID: 'gvdavid', JOHN: 'gvjohn', TG_ANH: 'tgleanh',
};
const PH = {
  AN: ['Nguyễn Minh An', '0905000456'], // IEF-K15, GT-A2-08, GT-B1-09
  BINH: ['Lê Văn Bình', '0934556778'], // GT-A2-08, GT-B1-09
  HANG: ['Đỗ Thị Hằng', '0905667889'], // GT-A2-08
  HUY: ['Trần Gia Huy', '0912345001'], // Kids-K04, Kids-K03
  TAM: ['Vũ Thanh Tâm', '0912345004'], // TOEIC-K05
};

module.exports = { khoiDong, MOC, vn, TK, PH };
