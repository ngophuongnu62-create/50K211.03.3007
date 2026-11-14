/** Hàm kiểm tra dữ liệu đầu vào dùng chung. */

const laChuoiRong = (v) => v === undefined || v === null || String(v).trim() === '';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Số điện thoại Việt Nam 10 chữ số, bắt đầu bằng 0 (Figma: "Số điện thoại phải gồm 10 chữ số") */
const SDT_REGEX = /^0\d{9}$/;

const laEmail = (v) => EMAIL_REGEX.test(String(v).trim());
const laSoDienThoai = (v) => SDT_REGEX.test(String(v).replace(/\s+/g, ''));
const chuanHoaSdt = (v) => String(v || '').replace(/[\s.-]+/g, '');

/** Chuẩn hóa họ tên để so khớp đăng nhập phụ huynh: bỏ khoảng trắng thừa, không phân biệt hoa thường. */
const chuanHoaTen = (v) => String(v || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

const catChuoi = (v) => (laChuoiRong(v) ? undefined : String(v).trim());

module.exports = { laChuoiRong, laEmail, laSoDienThoai, chuanHoaSdt, chuanHoaTen, catChuoi };
