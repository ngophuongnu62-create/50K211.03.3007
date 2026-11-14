/**
 * Thông báo hiển thị cho người dùng – trích nguyên văn từ đặc tả Use Case (Chương III)
 * và màn hình Figma. Các thông báo đánh dấu [BO SUNG] không có trong đặc tả,
 * được thêm cho tình huống kỹ thuật mà đặc tả chưa nêu (đã liệt kê để nhóm duyệt).
 */
module.exports = Object.freeze({
  // UC_1 – Đăng nhập
  DN_THIEU_THONG_TIN: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
  DN_SAI_THONG_TIN: 'Tên đăng nhập hoặc mật khẩu không chính xác. Vui lòng thử lại.',
  DN_TAI_KHOAN_KHOA: 'Tài khoản đang bị tạm khóa. Vui lòng liên hệ Quản lý.', // [BO SUNG]
  DN_PH_THIEU_THONG_TIN: 'Vui lòng nhập đầy đủ Họ và tên và Số điện thoại trước khi tra cứu!',
  DN_PH_SAI_THONG_TIN: 'Thông tin Tên học viên hoặc Số điện thoại không chính xác. Vui lòng kiểm tra lại hoặc liên hệ Quản lý!',
  CHUA_DANG_NHAP: 'Vui lòng đăng nhập để sử dụng chức năng này.', // [BO SUNG]
  KHONG_CO_QUYEN: 'Bạn không có quyền thực hiện chức năng này.', // [BO SUNG]

  // UC_2 – Phòng học
  PHONG_TIM_KIEM_KHONG_HOP_LE: 'Thông tin tìm kiếm không hợp lệ',
  PHONG_KHONG_TAI_DUOC: 'Không thể tải danh sách phòng trống.',
  PHONG_KHONG_CON_TRONG: 'Phòng không còn trống trong thời gian đã chọn. Vui lòng chọn phòng hoặc thời gian khác.',
  PHONG_THIEU_THONG_TIN: 'Thông tin phòng học và thời gian đăng ký phải được cung cấp đầy đủ và hợp lệ.',
  PHONG_DANG_KY_THANH_CONG: 'Đăng ký phòng học thành công',
  PHONG_DANG_KY_THAT_BAI: 'Không thể đăng ký phòng học',
  PHONG_CON_TRONG: 'Phòng còn trống trong thời gian đã chọn.', // [BO SUNG] (bước 6: hiển thị thông tin phòng phù hợp)
  PHONG_KHONG_THE_HUY: 'Không thể hủy phòng',
  PHONG_HUY_THAT_BAI: 'Hủy phòng thất bại',
  PHONG_HUY_THANH_CONG: 'Đã hủy phòng thành công',
  PHONG_KHONG_TON_TAI: 'Không tìm thấy phòng học.', // [BO SUNG]

  // UC_3 – Hồ sơ giáo viên
  HS_KHONG_CO_THONG_TIN: 'Không có thông tin của giáo viên!',
  HS_THIEU_BAT_BUOC: 'Vui lòng nhập đầy đủ thông tin bắt buộc!',
  HS_KHONG_HOP_LE: 'Thông tin đã nhập chưa hợp lệ',
  HS_TRUNG_SDT_EMAIL: 'Số điện thoại hoặc email đã tồn tại!',
  HS_THEM_THANH_CONG: 'Thêm hồ sơ giáo viên thành công!',
  HS_SUA_KHONG_HOP_LE: 'Thông tin chỉnh sửa chưa hợp lệ!',
  HS_SUA_THAT_BAI: 'Cập nhật hồ sơ giáo viên thất bại, vui lòng thử lại sau!',
  HS_SUA_THANH_CONG: 'Cập nhật hồ sơ giáo viên thành công!',
  HS_EMAIL_SAI: 'Email không đúng định dạng', // Figma QL-3.2-b
  HS_SDT_SAI: 'Số điện thoại phải gồm 10 chữ số', // Figma QL-3.2-b

  // UC_4 – Tiếp nhận và xử lý phản hồi
  PH_KHONG_TIM_THAY: 'Không tìm thấy phản hồi!',
  PH_CHUA_CHON_TRANG_THAI: 'Vui lòng chọn trạng thái mới!',
  PH_TRONG_LY_DO_TU_CHOI: 'Không được để trống lý do từ chối!',
  PH_CHI_CAP_NHAT_KHI: 'Chỉ được cập nhật phản hồi/yêu cầu đang ở trạng thái “Chờ xử lý” hoặc “Đang xử lý”.',
  PH_CAP_NHAT_THANH_CONG: 'Cập nhật trạng thái thành công!',
  PH_KHONG_DUOC_DE_TRONG: 'Không được để trống!',
  PH_GUI_THANH_CONG: 'Gửi phản hồi thành công!',
  PH_GUI_THAT_BAI: 'Gửi phản hồi không thành công!',
  VUOT_500: 'Nội dung không được vượt quá 500 ký tự.', // [BO SUNG] (BR06/BR04: tối đa 500 ký tự)

  // UC_5 – Tra cứu lịch dạy
  TC_KHONG_TIM_THAY: 'Không tìm thấy lịch dạy phù hợp với điều kiện lọc!',
  TC_NGAY_KHONG_HOP_LE: 'Ngày bắt đầu không được lớn hơn ngày kết thúc',

  // UC_6.1 – Tạo lịch dạy mới
  TL_CHUA_CHON_LOP: 'Vui lòng chọn lớp học!',
  TL_KHONG_CO_PHUONG_AN: 'Không có thời gian và phòng học phù hợp với lớp đã chọn!',
  TL_TRUNG: 'Thời gian hoặc phòng học bị trùng',
  TL_LUU_THAT_BAI: 'Không lưu được lịch dạy. Vui lòng thử lại!',
  TL_THANH_CONG: 'Tạo lịch dạy thành công!',
  TL_LOP_DA_CO_LICH: 'Lớp học đã có lịch dạy.', // [BO SUNG]

  // UC_6.2 – Lập và cập nhật lịch dạy hằng tuần
  LT_KHONG_THAY_DOI: 'Tuần tới không có thay đổi!',
  LT_XUNG_DOT: 'Lịch tuần bị xung đột!',
  LT_THANH_CONG: 'Tạo lịch tuần thành công!',

  // UC_6.3 – Phân công lịch dạy
  PC_KHONG_CO_GV: 'Không có giáo viên phù hợp với lịch đã chọn!',
  PC_GV_PHU_HOP: 'Giáo viên phù hợp với thời gian của lịch dạy',
  PC_XUNG_DOT: 'Cảnh báo xung đột lịch dạy, vui lòng chọn giáo viên khác',
  PC_LUU_THAT_BAI: 'Không lưu được phân công. Vui lòng thử lại!',
  PC_CHUA_GUI_THONG_BAO: 'Đã lưu phân công nhưng chưa gửi được thông báo cho giáo viên!',
  PC_GUI_THANH_CONG: 'Gửi phân công lịch dạy thành công!',
  PC_LUU_THANH_CONG: 'Đã lưu phân công. Lịch chuyển sang “Chờ giáo viên xác nhận”.', // [BO SUNG] (bước 6)
  PC_PHAI_LA_NHAP: 'Lịch cần phân công phải ở trạng thái “Nháp”.', // tiền điều kiện UC_6.3
  PC_KHONG_CO_GI_DE_GUI: 'Không có phân công nào cần gửi thông báo.', // [BO SUNG]

  // UC_6.4 – Phê duyệt và phát hành
  PD_THANH_CONG: 'Phê duyệt lịch thành công!',
  PD_THAT_BAI: 'Không phê duyệt được lịch. Vui lòng thử lại!',
  PD_CHUA_XAC_NHAN: 'Lịch chưa có phản hồi xác nhận của giáo viên, chưa thể phê duyệt.', // tiền điều kiện UC_6.4
  PH_HANH_THANH_CONG: 'Phát hành lịch dạy thành công!',
  PH_HANH_THAT_BAI: 'Không phát hành được lịch. Vui lòng thử lại!',
  PH_HANH_CHI_DA_DUYET: 'Chỉ lịch ở trạng thái “Đã duyệt” mới được phát hành.', // BR02
  PH_HANH_CHUA_GUI_HET: 'Đã phát hành lịch nhưng chưa gửi được thông báo cho một số người nhận.', // [BO SUNG] (ngoại lệ 11.a)
  KHONG_TIM_THAY_LICH: 'Không tìm thấy lịch dạy.', // [BO SUNG]

  // UC_7 – Tra cứu lịch dạy cá nhân
  GV_CHUA_CO_LICH: 'Bạn chưa có lịch dạy được phân công!',
  GV_LICH_KHONG_KHA_DUNG: 'Lịch dạy không còn khả dụng!',

  // UC_8 – Phản hồi lịch dạy được phân công
  GV_DA_XAC_NHAN: 'Đã xác nhận thành công',
  GV_TRONG_LY_DO: 'Không được để trống',
  GV_TRUNG_CA_HIEN_TAI: 'Ca dạy đề xuất không được trùng với ca dạy hiện tại!',
  GV_LY_DO_VUOT_500: 'Lý do thay đổi không được vượt quá 500 ký tự',
  GV_QUA_HAN: 'Đã quá thời hạn gửi phản hồi',
  GV_GUI_PHAN_HOI_THANH_CONG: 'Gửi phản hồi lịch dạy thành công!',

  // UC_9 – Cập nhật lịch rảnh
  LR_THANH_CONG: 'Cập nhật lịch rảnh thành công!',
  LR_THAT_BAI: 'Lưu lịch rảnh thất bại',
  LR_THAT_BAI_CHI_TIET: 'Các ô đang chọn được giữ nguyên, lịch đã lưu trước đó không bị mất. Vui lòng thử lại.',
  LR_DONG_CONG: 'Hệ thống đã đóng cổng đăng ký lịch rảnh cho tuần tiếp theo',
  LR_CHUA_CHON: 'Bạn phải chọn ít nhất 1 ca rảnh trong tuần để tiến hành lưu dữ liệu!',
  LR_CHUA_DU: (n) => `Bạn mới chọn ${n} ca. Giáo viên / trợ giảng phải đăng ký tối thiểu 5 ca rảnh mỗi tuần.`,
  LR_NGOAI_TUAN: 'Ca rảnh phải thuộc tuần kế tiếp.', // [BO SUNG]

  // UC_10 – Gửi phản hồi, yêu cầu
  YC_THANH_CONG: 'Gửi phản hồi/yêu cầu thành công!',
  YC_THAT_BAI: 'Gửi phản hồi/yêu cầu không thành công!',

  // UC_11 – Xác nhận ca học
  XN_THANH_CONG: 'Xác nhận tham gia ca học thành công',
  XN_TRONG_LY_DO: 'Vui lòng nhập lý do từ chối xác nhận lịch học',
  XN_LY_DO_VUOT_500: 'Lý do từ chối không được vượt quá 500 ký tự',
  XN_TU_CHOI_THANH_CONG: 'Đã gửi phản hồi từ chối xác nhận ca học thành công',
  XN_TAT_CA_THANH_CONG: (n) => `Xác nhận tham gia ${n} ca học thành công`,
  XN_QUA_HAN: 'Đã quá thời hạn phản hồi lịch học',
  XN_QUA_HAN_CHI_TIET: 'Tính năng phản hồi đã bị khóa. Hãy liên hệ trung tâm để được giải quyết thắc mắc.',
  XN_DA_PHAN_HOI: 'Ca học này đã được phản hồi trước đó.', // [BO SUNG] (BR01: mỗi ca chỉ xử lý một lần)
  XN_KHONG_CON_CA: 'Không có ca học nào cần xác nhận.', // [BO SUNG]

  // UC_12 – Theo dõi lịch học
  TKB_DANG_CAP_NHAT: 'Lịch học của lớp đang được trung tâm cập nhật. Vui lòng quay lại sau!',
  TKB_KHONG_TAI_DUOC_CHI_TIET: 'Không tải được chi tiết ca học. Vui lòng thử lại!',
  TKB_KHONG_PHAI_LOP: 'Học viên không theo học lớp này.', // [BO SUNG]

  // UC_13 – Xin nghỉ học
  NGHI_DA_DIEN_RA: 'Không thể báo vắng cho ca học đã hoặc đang diễn ra. Vui lòng liên hệ trực tiếp Quản lý!',
  NGHI_CHUA_DU_2_TIENG: 'Đơn xin nghỉ phải được gửi trước giờ học tối thiểu 02 tiếng. Vui lòng liên hệ trực tiếp Quản lý hoặc Hotline để được hỗ trợ báo vắng khẩn cấp!',
  NGHI_THANH_CONG: 'Gửi yêu cầu xin nghỉ thành công',
  NGHI_DA_GUI: 'Ca học này đã được báo vắng trước đó.', // [BO SUNG]
  NGHI_CHUA_CHON_LY_DO: 'Vui lòng chọn lý do xin nghỉ.', // [BO SUNG]

  // UC_14 – Gửi phản hồi, ý kiến
  GY_THIEU: 'Vui lòng nhập đầy đủ Tiêu đề và Nội dung phản hồi trước khi gửi!',
  GY_THANH_CONG: 'Gửi thành công',
  GY_KHONG_TIM_THAY_PHIEU: 'Không tìm thấy phiếu phản hồi với mã đã nhập.', // [BO SUNG]

  // Chung
  LOI_HE_THONG: 'Đã có lỗi xảy ra. Vui lòng thử lại!', // [BO SUNG]
  KHONG_TIM_THAY_API: 'Không tìm thấy chức năng yêu cầu.', // [BO SUNG]
  TEP_KHONG_HOP_LE: 'Tệp đính kèm không đúng định dạng cho phép.', // [BO SUNG]

  // Bảo mật & vận hành production [BO SUNG]
  QUA_NHIEU_YEU_CAU: 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.',
  DN_QUA_NHIEU_LAN: 'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc liên hệ Quản lý.',
  NGUON_KHONG_DUOC_PHEP: 'Địa chỉ truy cập không được phép gọi hệ thống này.',
  PHIEN_HET_HIEU_LUC: 'Phiên đăng nhập đã hết hiệu lực do mật khẩu vừa được thay đổi. Vui lòng đăng nhập lại.',
  PHAI_DOI_MAT_KHAU: 'Bạn đang dùng mật khẩu tạm. Vui lòng đổi mật khẩu trước khi sử dụng hệ thống.',
  DMK_THIEU_THONG_TIN: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.',
  DMK_SAI_MAT_KHAU_HIEN_TAI: 'Mật khẩu hiện tại không chính xác.',
  DMK_XAC_NHAN_KHONG_KHOP: 'Xác nhận mật khẩu mới không khớp.',
  DMK_KHONG_DU_MANH: 'Mật khẩu mới phải dài 8–64 ký tự, gồm cả chữ cái và chữ số, và không trùng tên đăng nhập.',
  DMK_TRUNG_MAT_KHAU_CU: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  DMK_THANH_CONG: 'Đổi mật khẩu thành công.',
  DU_LIEU_DA_THAY_DOI: 'Dữ liệu vừa được người khác cập nhật hoặc đã tồn tại. Vui lòng tải lại trang và thử lại.',
  MAY_CHU_BAN: 'Hệ thống đang bận. Vui lòng thử lại sau ít phút.',
});
