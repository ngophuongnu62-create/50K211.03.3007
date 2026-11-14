/**
 * Collection kỹ thuật `khoaTaiNguyen` – khóa tài nguyên dùng trong giao dịch để tuần tự hóa các thao tác
 * cùng chiếm một phòng / một nhân sự / một lớp (chống xếp trùng khi nhiều Quản lý thao tác đồng thời).
 * _id: "PHONG:P101", "NHANSU:GV-001", "LOP:IE65-K12". Không chứa dữ liệu nghiệp vụ.
 */
const { Schema, model } = require('mongoose');

const khoaTaiNguyenSchema = new Schema(
  {
    _id: { type: String, required: true, maxlength: 80 },
    phienBan: { type: Number, required: true, default: 0 },
    capNhatLuc: { type: Date },
  },
  { versionKey: false, collection: 'khoaTaiNguyen' },
);

module.exports = { KhoaTaiNguyen: model('KhoaTaiNguyen', khoaTaiNguyenSchema) };
