/**
 * Collection kỹ thuật `boDem` – bộ đếm để sinh mã nghiệp vụ tuần tự (không phải thực thể nghiệp vụ;
 * tài liệu MongoDB mục 7, điểm "Định dạng mã").
 */
const { Schema, model } = require('mongoose');

const boDemSchema = new Schema(
  {
    _id: { type: String, required: true }, // tiền tố mã, ví dụ "LD", "PH-2611"
    giaTri: { type: Number, required: true, default: 0 },
  },
  { versionKey: false, collection: 'boDem' },
);

module.exports = { BoDem: model('BoDem', boDemSchema) };
