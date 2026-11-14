/**
 * Giá trị Enum – theo Bảng 4.1 (Chương IV) và tài liệu thiết kế MongoDB.
 */
module.exports = Object.freeze({
  TRANG_THAI_TAI_KHOAN: ['HoatDong', 'TamKhoa'],
  LOAI_NGUOI_DUNG: ['QuanLy', 'NhanSuGiangDay'],
  LOAI_NHAN_SU: ['GiaoVien', 'TroGiang'],
  HINH_THUC_LAM_VIEC: ['ToanThoiGian', 'BanThoiGian'],
  TRANG_THAI_LOP: ['ChuaMo', 'DangHoc', 'KetThuc'],
  TRANG_THAI_PHONG: ['ChuaSuDung', 'DangSuDung'],
  TRANG_THAI_DANG_KY: ['DaDangKy', 'DaHuy'],
  TRANG_THAI_LICH: ['Nhap', 'ChoGVXacNhan', 'DaDuyet', 'DaPhatHanh', 'DaHuy'],
  /** Lịch chưa hủy – dùng cho chỉ mục duy nhất có lọc (UX_LichDay_Phong, UX_LichDay_Lop) */
  LICH_CON_HIEU_LUC: ['Nhap', 'ChoGVXacNhan', 'DaDuyet', 'DaPhatHanh'],
  VAI_TRO_PHAN_CONG: ['GiaoVien', 'TroGiang'],
  TRANG_THAI_PHAN_CONG: ['ChoXacNhan', 'DaXacNhan', 'DeXuatThayDoi', 'HetHan'],
  TRANG_THAI_XU_LY_PHAN_HOI_LICH: ['ChoXuLy', 'DaChapNhan', 'TuChoi'],
  HANH_DONG_LICH: ['Tao', 'CapNhat', 'PhanCong', 'GuiDuKien', 'PheDuyet', 'PhatHanh', 'Huy'],
  KET_QUA_XAC_NHAN: ['XacNhan', 'TuChoi'],
  LY_DO_XIN_NGHI: ['NghiOm', 'BanViecGiaDinh', 'BanLichTruong', 'LyDoKhac'],
  TRANG_THAI_NGHI: ['BaoVang', 'DaGhiNhanDiemDanh'],
  LOAI_PHAN_HOI: ['DoiLich', 'NghiPhep', 'GopY', 'ChatLuongGiangDay', 'CoSoVatChat', 'DichVu', 'YKienKhac'],
  /** 3 loại đầu cho Giáo viên/Trợ giảng (UC_10) */
  LOAI_PHAN_HOI_NHAN_SU: ['DoiLich', 'NghiPhep', 'GopY'],
  /** 4 loại sau cho Phụ huynh/Học viên (UC_14) */
  LOAI_PHAN_HOI_PHU_HUYNH: ['ChatLuongGiangDay', 'CoSoVatChat', 'DichVu', 'YKienKhac'],
  TRANG_THAI_XU_LY: ['ChoXuLy', 'DangXuLy', 'DaXuLy', 'TuChoi'],
  LOAI_THAO_TAC: ['CapNhatTrangThai', 'PhanHoiNguoiGui'],
  LOAI_TEP: ['JPG', 'PNG', 'PDF'],
  LOAI_THONG_BAO: ['LichDuKien', 'LichChinhThuc', 'ThayDoiLich', 'BaoVang', 'PhanHoiMoi', 'KetQuaXuLy'],
  TRANG_THAI_GUI: ['ChoGui', 'DaGui', 'GuiLoi'],
  /** Vai trò dùng cho phân quyền API */
  VAI_TRO: Object.freeze({
    QUAN_LY: 'QuanLy',
    GIAO_VIEN: 'GiaoVien',
    TRO_GIANG: 'TroGiang',
    PHU_HUYNH: 'PhuHuynhHocVien',
  }),
});
