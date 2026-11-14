/** Kiểu trường dùng chung cho các schema. */

/** Mã định danh: VARCHAR(20) → String tối đa 20 ký tự */
const ma = (extra = {}) => ({ type: String, trim: true, maxlength: 20, ...extra });

/** Khóa ngoại tham chiếu tới _id của collection khác */
const thamChieu = (ref, extra = {}) => ({ type: String, ref, trim: true, maxlength: 20, ...extra });

/** Số nguyên có cận dưới (CHECK x >= min hoặc x > min) */
const soNguyen = ({ min, lonHon = false, ...extra } = {}) => ({
  type: Number,
  validate: {
    validator: (v) => v === undefined || v === null || (Number.isInteger(v) && (lonHon ? v > min : v >= min)),
    message: (p) => `${p.path} phải là số nguyên ${lonHon ? '>' : '>='} ${min}`,
  },
  ...extra,
});

/** Chuỗi giờ "HH:mm" (TIME(0)) */
const GIO_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Kiểm tra phần tử mảng không trùng theo khóa */
const khongTrung = (khoa, thongBao) => ({
  validator(arr) {
    if (!Array.isArray(arr)) return true;
    const seen = new Set();
    for (const item of arr) {
      const k = khoa(item);
      if (seen.has(k)) return false;
      seen.add(k);
    }
    return true;
  },
  message: thongBao,
});

const TUY_CHON_SCHEMA = { versionKey: false };
const TUY_CHON_CON = { _id: false, versionKey: false };

module.exports = { ma, thamChieu, soNguyen, GIO_REGEX, khongTrung, TUY_CHON_SCHEMA, TUY_CHON_CON };
