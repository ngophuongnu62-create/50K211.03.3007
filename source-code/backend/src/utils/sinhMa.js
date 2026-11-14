/**
 * Sinh mã nghiệp vụ tuần tự bằng collection `boDem` (nguyên tử với $inc).
 * Định dạng: <TIỀN TỐ>-<số thứ tự đệm 0>, ví dụ LD-000123, GV-007.
 * Mã phiếu phản hồi (Ticket ID): PH-<YYMM>-<NNNN>, ví dụ PH-2611-0042 (theo màn hình Figma PH-14).
 */
const { BoDem } = require('../models');
const clock = require('./clock');

const DO_DAI = {
  QL: 3, GV: 3, TG: 3, HV: 4, LD: 6, PC: 6, PL: 6, LS: 6, XN: 6, NH: 6, DK: 5, LR: 6, TB: 7, BC: 5, TP: 6, XL: 6,
};

async function tangBoDem(khoa, soLuong = 1, session) {
  const doc = await BoDem.findOneAndUpdate(
    { _id: khoa },
    { $inc: { giaTri: soLuong } },
    { upsert: true, new: true, session },
  );
  return doc.giaTri;
}

/** Sinh một mã. */
async function sinhMa(tienTo, session) {
  const giaTri = await tangBoDem(tienTo, 1, session);
  return `${tienTo}-${String(giaTri).padStart(DO_DAI[tienTo] || 5, '0')}`;
}

/** Sinh nhiều mã liên tiếp trong một lần gọi. */
async function sinhNhieuMa(tienTo, soLuong, session) {
  if (soLuong <= 0) return [];
  const cuoi = await tangBoDem(tienTo, soLuong, session);
  const dau = cuoi - soLuong + 1;
  return Array.from({ length: soLuong }, (_, i) => `${tienTo}-${String(dau + i).padStart(DO_DAI[tienTo] || 5, '0')}`);
}

/** Mã phiếu phản hồi: PH-YYMM-NNNN */
async function sinhMaPhieu(session) {
  const ngay = clock.homNay();
  const yymm = clock.dinhDangNgay(ngay).slice(2, 7).replace('-', '');
  const khoa = `PH-${yymm}`;
  const giaTri = await tangBoDem(khoa, 1, session);
  return `${khoa}-${String(giaTri).padStart(4, '0')}`;
}

module.exports = { sinhMa, sinhNhieuMa, sinhMaPhieu };
