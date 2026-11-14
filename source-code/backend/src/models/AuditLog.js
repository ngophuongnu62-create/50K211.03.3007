/**
 * Collection kỹ thuật `audit_logs` – nhật ký thao tác quan trọng (production).
 * Mỗi bản ghi: người thực hiện, thời điểm, hành động, đối tượng, dữ liệu cũ, dữ liệu mới, IP, trình duyệt.
 * Được ghi TRONG CÙNG giao dịch với thay đổi dữ liệu → thao tác thất bại thì không có nhật ký "ma".
 * Chỉ được THÊM: mọi lệnh sửa / xóa qua Mongoose đều bị chặn.
 */
const { Schema, model } = require('mongoose');

const auditLogSchema = new Schema(
  {
    thoiDiem: { type: Date, required: true, default: Date.now },
    nguoiThucHien: {
      ma: { type: String, required: true },
      vaiTro: { type: String, required: true },
      hoTen: { type: String },
    },
    hanhDong: { type: String, required: true, maxlength: 60 },
    doiTuong: {
      loai: { type: String, required: true, maxlength: 40 },
      ma: { type: String, required: true, maxlength: 60 },
    },
    moTa: { type: String, maxlength: 500 },
    duLieuCu: { type: Schema.Types.Mixed, default: null },
    duLieuMoi: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 300 },
    maYeuCau: { type: String, maxlength: 64 },
  },
  { versionKey: false, collection: 'audit_logs', minimize: false },
);

auditLogSchema.index({ thoiDiem: -1 });
auditLogSchema.index({ 'doiTuong.loai': 1, 'doiTuong.ma': 1, thoiDiem: -1 });
auditLogSchema.index({ 'nguoiThucHien.ma': 1, thoiDiem: -1 });
auditLogSchema.index({ hanhDong: 1, thoiDiem: -1 });

const CHAN = ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace',
  'deleteOne', 'deleteMany', 'findOneAndDelete'];
for (const lenh of CHAN) {
  auditLogSchema.pre(lenh, () => { throw new Error('Nhật ký hệ thống (audit_logs) chỉ được thêm mới, không được sửa hoặc xóa.'); });
}

module.exports = { AuditLog: model('AuditLog', auditLogSchema) };
