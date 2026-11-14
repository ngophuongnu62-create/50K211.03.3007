/**
 * Lỗi nghiệp vụ trả về cho client.
 * status: mã HTTP; code: mã lỗi máy đọc; message: câu thông báo hiển thị (theo đặc tả);
 * fieldErrors: lỗi theo từng trường của biểu mẫu; data: dữ liệu kèm theo (ví dụ chi tiết xung đột).
 */
class AppError extends Error {
  constructor(status, message, { code, fieldErrors, data } = {}) {
    super(message);
    this.status = status;
    this.code = code || AppError.codeTheoStatus(status);
    this.fieldErrors = fieldErrors;
    this.data = data;
  }

  static codeTheoStatus(status) {
    return {
      400: 'DU_LIEU_KHONG_HOP_LE',
      401: 'CHUA_XAC_THUC',
      403: 'KHONG_DUOC_PHEP',
      404: 'KHONG_TIM_THAY',
      409: 'XUNG_DOT',
      422: 'KHONG_THUC_HIEN_DUOC',
    }[status] || 'LOI_HE_THONG';
  }
}

module.exports = AppError;
