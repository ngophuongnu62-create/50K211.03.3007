#!/usr/bin/env node
/**
 * NẠP BỘ DỮ LIỆU THỬ (tai-lieu/du-lieu-thu/json) VÀO CSDL – chỉ dùng cho CSDL chạy thử / nghiệm thu.
 *
 *   npm run nap-du-lieu-thu                     # CSDL trong MONGODB_URI (mặc định MongoDB cục bộ của môi trường lập trình)
 *   MONGODB_URI="mongodb+srv://..." npm run nap-du-lieu-thu -- --xac-nhan
 *
 * - Thay toàn bộ dữ liệu của 15 collection có trong bộ dữ liệu (kể cả tài khoản, ảnh bằng cấp trong GridFS).
 *   CSDL đã có dữ liệu thì phải thêm --xac-nhan. Không đụng tới nhật ký hệ thống (audit_logs).
 * - Bị chặn khi NODE_ENV=production (giống seed:demo).
 * - Tạo collection, validator, chỉ mục còn thiếu nếu tài khoản MongoDB có quyền quản trị cấu trúc (Atlas admin / root);
 *   tài khoản chỉ đọc / ghi thì dùng cấu trúc đã có (CSDL phải được ứng dụng khởi tạo trước – VD đã chạy trên Render).
 *   Tài khoản ứng dụng Docker (broadwayApp) không có quyền xóa → dùng tài khoản root.
 * - Mọi bản ghi vẫn qua $jsonSchema validator và chỉ mục chống trùng của CSDL.
 */
const fs = require('fs');
const path = require('path');
const { EJSON } = require('bson');
const env = require('../src/config/env');
const mongoose = require('../src/config/mongoose');
const { ketNoiCSDL, ngatKetNoiCSDL } = require('../src/config/db');

const doiSo = (ten) => { const i = process.argv.indexOf(ten); return i > 0 ? process.argv[i + 1] : undefined; };
const THU_MUC = path.resolve(doiSo('--tu') || path.join(__dirname, '../../tai-lieu/du-lieu-thu'));
const XAC_NHAN = process.argv.includes('--xac-nhan');
// eslint-disable-next-line no-console
const log = (s) => console.log(`[nap-du-lieu-thu] ${s}`);

/** Thứ tự nạp: danh mục → người dùng → lớp → nghiệp vụ → tệp → bộ đếm */
const THU_TU = ['caHoc', 'phongHoc', 'monHoc', 'khoaHoc', 'lopHoc', 'nguoiDung', 'phuHuynhHocVien', 'lichRanh', 'lichDay',
  'dangKyPhong', 'phanHoiGopY', 'thongBao', 'tepTaiLen.files', 'tepTaiLen.chunks', 'boDem'];

/** Ẩn mật khẩu trong chuỗi kết nối khi in ra màn hình */
const anMatKhau = (uri) => uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');

(async () => {
  if (env.LA_PRODUCTION) throw new Error('Bị chặn khi NODE_ENV=production. Chạy từ máy cá nhân với NODE_ENV=development và MONGODB_URI của CSDL chạy thử.');
  const thuMucJson = path.join(THU_MUC, 'json');
  const thieu = THU_TU.filter((c) => !fs.existsSync(path.join(thuMucJson, `${c}.json`)));
  if (thieu.length) throw new Error(`Thiếu tệp dữ liệu trong ${thuMucJson}: ${thieu.join(', ')}. Chạy npm run sinh-du-lieu-thu trước.`);

  try {
    await ketNoiCSDL(env.MONGODB_URI, { dongBoCauTruc: true });
  } catch (err) {
    if (/requires authentication|Authentication failed|bad auth/i.test(err.message)) {
      throw new Error(`Chưa đăng nhập được MongoDB (${err.message}). Đặt MONGODB_USER và MONGODB_PASSWORD giống trên Render `
        + '(Environment), hoặc ghi tài khoản vào MONGODB_URI. Kiểm tra cả Atlas → Network Access cho phép IP máy này.');
    }
    if (!/not authorized|Unauthorized/i.test(err.message)) throw err;
    // Tài khoản chỉ đọc / ghi: dùng cấu trúc (collection, validator, chỉ mục) mà ứng dụng / bước thiết lập đã tạo sẵn
    log('Tài khoản MongoDB không có quyền quản trị cấu trúc → dùng cấu trúc CSDL đã có sẵn.');
    await ngatKetNoiCSDL();
    await ketNoiCSDL(env.MONGODB_URI, { dongBoCauTruc: false });
  }
  const { db } = mongoose.connection;
  log(`CSDL đích: ${anMatKhau(env.MONGODB_URI)} → database "${db.databaseName}"${env.MONGODB_USER ? ` · tài khoản ${env.MONGODB_USER}` : ''}`);

  const daCo = [];
  for (const c of THU_TU) {
    const n = await db.collection(c).estimatedDocumentCount();
    if (n) daCo.push(`${c}: ${n}`);
  }
  if (daCo.length && !XAC_NHAN) {
    log(`CSDL đang có dữ liệu (${daCo.join(', ')}).`);
    log('Nạp bộ dữ liệu thử sẽ XÓA và THAY toàn bộ các collection trên (kể cả tài khoản quản lý hiện có). Chạy lại với --xac-nhan nếu đúng là CSDL chạy thử.');
    process.exitCode = 2;
    return;
  }

  let tong = 0;
  for (const c of THU_TU) {
    const docs = EJSON.parse(fs.readFileSync(path.join(thuMucJson, `${c}.json`), 'utf8'), { relaxed: false });
    await db.collection(c).deleteMany({});
    for (let i = 0; i < docs.length; i += 500) {
      await db.collection(c).insertMany(docs.slice(i, i + 500), { ordered: true });
    }
    tong += docs.length;
    log(`${c.padEnd(18)} ${String(docs.length).padStart(5)} bản ghi`);
  }
  log(`Xong: ${tong} bản ghi. Tài khoản: quanly / gvnguyenlan … (mật khẩu Broadway@2026); phụ huynh: Nguyễn Minh An – 0905000456.`);

  const thongTin = path.join(THU_MUC, 'thong-tin.json');
  if (fs.existsSync(thongTin)) {
    const { thoiDiemHienTai } = JSON.parse(fs.readFileSync(thongTin, 'utf8'));
    const lech = Math.abs(Date.now() - new Date(thoiDiemHienTai).getTime()) / 3600e3;
    if (lech > 24) {
      log(`LƯU Ý: bộ dữ liệu được sinh cho thời điểm ${thoiDiemHienTai}, lệch ${Math.round(lech)} giờ so với đồng hồ hiện tại.`);
      log('Các mốc "tuần này / tuần tới", hạn phản hồi 24 giờ… sẽ không còn khớp. Sinh lại cho đúng thời điểm nạp:');
      log('  npm run sinh-du-lieu-thu -- --luc <thời điểm, VD 2026-11-20T14:00:00+07:00 – Thứ Sáu, Thứ Bảy hoặc Chủ Nhật>');
    }
  }
})().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[nap-du-lieu-thu] Lỗi:', err.message);
  process.exitCode = 1;
}).finally(() => ngatKetNoiCSDL().catch(() => {}));
