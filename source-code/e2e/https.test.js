/**
 * Kiểm thử HTTPS (Caddy) trên bản triển khai bằng tên miền thật:
 *   BASE_URL=https://lichday.ten-mien.vn npm run test:https
 * Chạy thử khi chưa có tên miền: TEN_MIEN=lichday.localhost (Caddy tự cấp chứng chỉ từ CA nội bộ), thêm
 *   CA_GOC=<tệp root.crt của Caddy> (kiểm tra chuỗi chứng chỉ bằng CA đó) và BO_QUA_LOI_CHUNG_CHI=1 (cho trình duyệt).
 * Ca TC-SX-E13 cần một tài khoản Quản lý: E2E_TEN_DANG_NHAP / E2E_MAT_KHAU (mặc định tài khoản demo).
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const http = require('http');
const https = require('https');
const tls = require('tls');
const path = require('path');
const { chromium } = require('playwright');

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
const URL_GOC = new URL(BASE || 'https://khong-co');
const TEN_MIEN = URL_GOC.hostname;
const CONG = Number(URL_GOC.port || 443);
const CA = process.env.CA_GOC ? [fs.readFileSync(process.env.CA_GOC)] : undefined; // không đặt → kho chứng chỉ gốc của hệ điều hành
const TEN_DN = process.env.E2E_TEN_DANG_NHAP || 'quanly';
const MK = process.env.E2E_MAT_KHAU || 'Broadway@2026';
const ANH = path.resolve(__dirname, '../tai-lieu/golive/anh');

/** Gọi HTTPS bằng Node (kiểm tra chứng chỉ nghiêm ngặt, không bỏ qua lỗi) */
function goiHttps(duongDan, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((ok, loi) => {
    const req = https.request({ host: TEN_MIEN, port: CONG, path: duongDan, method, headers, ca: CA, servername: TEN_MIEN }, (res) => {
      const phan = [];
      res.on('data', (d) => phan.push(d));
      res.on('end', () => ok({ status: res.statusCode, headers: res.headers, body: Buffer.concat(phan) }));
    });
    req.on('error', loi);
    if (body) req.write(body);
    req.end();
  });
}

before(() => {
  assert.ok(BASE.startsWith('https://'), 'BASE_URL phải là địa chỉ https:// của bản triển khai');
});

describe('HTTPS bằng Caddy', () => {
  it('TC-SX-E10 · Chứng chỉ TLS hợp lệ cho đúng tên miền: chuỗi tin cậy, còn hạn (≥ 7 ngày với chứng chỉ công khai), TLS 1.2+, HTTP/2', async () => {
    const kq = await new Promise((ok, loi) => {
      const s = tls.connect({ host: TEN_MIEN, port: CONG, servername: TEN_MIEN, ca: CA, ALPNProtocols: ['h2', 'http/1.1'] }, () => {
        const ct = s.getPeerCertificate();
        ok({ authorized: s.authorized, loi: s.authorizationError, giaoThuc: s.getProtocol(), alpn: s.alpnProtocol, het: new Date(ct.valid_to), san: ct.subjectaltname, cap: ct.issuer?.CN });
        s.end();
      });
      s.on('error', loi);
    });
    assert.equal(kq.authorized, true, `Chứng chỉ không hợp lệ: ${kq.loi}`);
    assert.ok(kq.san.split(', ').includes(`DNS:${TEN_MIEN}`), kq.san);
    // Chứng chỉ công khai (Let's Encrypt 90 ngày, Caddy gia hạn khi còn ~30 ngày) phải còn ≥ 7 ngày;
    // CA nội bộ của Caddy (chỉ dùng khi chạy thử) cố ý cấp chứng chỉ 12 giờ và tự gia hạn → yêu cầu ≥ 1 giờ
    const conToiThieu = CA ? 3600e3 : 7 * 864e5;
    assert.ok(kq.het.getTime() - Date.now() > conToiThieu, `Chứng chỉ sắp hết hạn: ${kq.het.toISOString()}`);
    assert.ok(['TLSv1.2', 'TLSv1.3'].includes(kq.giaoThuc), kq.giaoThuc);
    assert.equal(kq.alpn, 'h2');
    // eslint-disable-next-line no-console
    console.log(`    chứng chỉ do "${kq.cap}" cấp, hết hạn ${kq.het.toISOString().slice(0, 10)}, ${kq.giaoThuc}`);
  });

  it('TC-SX-E11 · Mở bằng http:// → tự chuyển vĩnh viễn (308) sang https:// giữ nguyên đường dẫn', async () => {
    const r = await new Promise((ok, loi) => {
      http.get({ host: TEN_MIEN, port: 80, path: '/quan-ly/quan-ly-lich?tuan=2026-11-16', headers: { Host: TEN_MIEN } }, (res) => {
        res.resume();
        ok({ status: res.statusCode, location: res.headers.location });
      }).on('error', loi);
    });
    assert.equal(r.status, 308);
    assert.equal(r.location, `https://${TEN_MIEN}/quan-ly/quan-ly-lich?tuan=2026-11-16`);
  });

  it('TC-SX-E12 · Phản hồi HTTPS có HSTS 1 năm, CSP tự nâng cấp HTTPS, không lộ phần mềm máy chủ, tệp giao diện được nén', async () => {
    const trang = await goiHttps('/');
    assert.equal(trang.status, 200);
    assert.match(trang.headers['strict-transport-security'] || '', /max-age=31536000/);
    assert.match(trang.headers['content-security-policy'] || '', /upgrade-insecure-requests/);
    assert.equal(trang.headers.server, undefined);
    assert.equal(trang.headers['x-powered-by'], undefined);
    assert.equal(trang.headers['x-content-type-options'], 'nosniff');
    const js = String(trang.body).match(/\/assets\/index-[\w-]+\.js/)[0];
    const tep = await goiHttps(js, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(tep.status, 200);
    assert.equal(tep.headers['content-encoding'], 'gzip');
  });

  it('TC-SX-E13 · Sau proxy, ứng dụng ghi đúng IP người dùng và không bị giả mạo bằng header X-Forwarded-For', async () => {
    const GIA = '203.0.113.9';
    const body = JSON.stringify({ tenDangNhap: TEN_DN, matKhau: MK });
    const dn = await goiHttps('/api/auth/dang-nhap', {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Forwarded-For': GIA, Origin: BASE },
    });
    assert.equal(dn.status, 200, String(dn.body));
    const { token } = JSON.parse(dn.body).data;
    const nk = await goiHttps('/api/quan-ly/nhat-ky?hanhDong=TAI_KHOAN.DANG_NHAP&soDong=1', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(nk.status, 200, String(nk.body));
    const { ip } = JSON.parse(nk.body).data.ds[0];
    assert.ok(ip, 'Nhật ký phải có IP');
    assert.notEqual(ip, GIA, 'IP bị giả mạo qua X-Forwarded-For');
    // eslint-disable-next-line no-console
    console.log(`    IP ghi nhận: ${ip}`);
  });

  it('TC-SX-E14 · Trình duyệt mở giao diện qua HTTPS, đăng nhập được; mọi yêu cầu đều là https://, không có nội dung hỗn hợp hay lỗi JavaScript', async () => {
    const browser = await chromium.launch();
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'vi-VN', ignoreHTTPSErrors: process.env.BO_QUA_LOI_CHUNG_CHI === '1' });
      const page = await context.newPage();
      const khongAnToan = [];
      const loiTrang = [];
      page.on('request', (r) => { if (!/^(https:|data:|blob:)/.test(r.url())) khongAnToan.push(r.url()); });
      page.on('console', (m) => { if (/mixed content/i.test(m.text())) khongAnToan.push(m.text()); });
      page.on('pageerror', (e) => loiTrang.push(e.message));
      await page.goto(`${BASE}/dang-nhap/quan-ly`);
      await page.getByPlaceholder('Nhập tên đăng nhập').fill(TEN_DN);
      await page.getByPlaceholder('Nhập mật khẩu').fill(MK);
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await page.waitForURL(/\/(quan-ly|doi-mat-khau)$/);
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(ANH, 'SX-06-https.png') });
      assert.equal(new URL(page.url()).protocol, 'https:');
      assert.deepEqual(khongAnToan, []);
      assert.deepEqual(loiTrang, []);
    } finally {
      await browser.close();
    }
  });
});

