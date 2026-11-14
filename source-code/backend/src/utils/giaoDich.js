/**
 * Giao dịch nhiều document (MongoDB replica set / Atlas) và khóa tài nguyên.
 *
 * Chống xếp trùng khi nhiều người thao tác đồng thời:
 *  1. Ngoài giao dịch: bảo đảm tài liệu khóa tồn tại (upsert, idempotent).
 *  2. Thao tác ĐẦU TIÊN trong giao dịch: ghi vào tài liệu khóa của mọi tài nguyên liên quan
 *     (phòng, nhân sự, lớp). Hai giao dịch cùng chạm một tài nguyên → MongoDB báo xung đột ghi,
 *     giao dịch đến sau tự chạy lại và lúc đó thấy dữ liệu mới → kiểm tra trùng bên trong giao dịch sẽ chặn.
 *  3. Kiểm tra ràng buộc và ghi dữ liệu đều trong cùng giao dịch (đọc snapshot, ghi majority).
 * Lớp bảo vệ cuối cùng là các chỉ mục duy nhất trong CSDL (phòng–ngày–ca, lớp–ngày–ca, nhân sự–ngày–ca).
 */
const mongoose = require('mongoose');

const TUY_CHON_GIAO_DICH = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
  readPreference: 'primary',
};

async function trongGiaoDich(fn) {
  const session = await mongoose.startSession();
  try {
    let ketQua;
    await session.withTransaction(async () => {
      ketQua = await fn(session);
    }, TUY_CHON_GIAO_DICH);
    return ketQua;
  } finally {
    await session.endSession();
  }
}

/**
 * Khóa tài nguyên: "PHONG:P101", "NHANSU:GV-001", "LOP:IE65-K12".
 * Mã không phải chuỗi ngắn (dữ liệu lạ, toán tử $) không thể là mã có thật → từ chối 400 thay vì ghi khóa rác.
 */
const tenKhoa = (loai) => (ma) => {
  if (ma === undefined || ma === null || ma === '') return null;
  if (typeof ma !== 'string' || ma.length > 40 || ma.startsWith('$')) {
    const AppError = require('./AppError');
    const M = require('../constants/messages');
    throw new AppError(400, M.HS_KHONG_HOP_LE);
  }
  return `${loai}:${ma}`;
};
const khoa = { phong: tenKhoa('PHONG'), nhanSu: tenKhoa('NHANSU'), lop: tenKhoa('LOP') };

async function chuanBiKhoa(dsKhoa) {
  const { KhoaTaiNguyen } = require('../models');
  if (!dsKhoa.length) return;
  try {
    await KhoaTaiNguyen.bulkWrite(
      dsKhoa.map((k) => ({ updateOne: { filter: { _id: k }, update: { $setOnInsert: { phienBan: 0 } }, upsert: true } })),
      { ordered: false },
    );
  } catch (err) {
    if (err?.code !== 11000 && !err?.writeErrors?.every((e) => e.code === 11000)) throw err;
  }
}

/**
 * Chạy fn(session) trong giao dịch sau khi giữ khóa các tài nguyên.
 * @param {string[]} dsKhoa danh sách khóa (có thể trùng, sẽ được loại trùng và sắp xếp)
 */
async function trongGiaoDichCoKhoa(dsKhoa, fn) {
  const ds = [...new Set(dsKhoa.filter(Boolean))].sort();
  await chuanBiKhoa(ds);
  const { KhoaTaiNguyen } = require('../models');
  return trongGiaoDich(async (session) => {
    for (const k of ds) {
      await KhoaTaiNguyen.updateOne({ _id: k }, { $inc: { phienBan: 1 }, $set: { capNhatLuc: new Date() } }, { session });
    }
    return fn(session);
  });
}

module.exports = { trongGiaoDich, trongGiaoDichCoKhoa, khoa };
