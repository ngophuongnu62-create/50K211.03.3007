/**
 * Bảng định tuyến API – phân quyền theo vai trò (đặc tả Use Case, Hình 2.2):
 *   /api/auth        – UC_1 (công khai)
 *   /api/quan-ly     – Quản lý: UC_2 → UC_6
 *   /api/giao-vien   – Giáo viên / Trợ giảng: UC_7 → UC_10
 *   /api/phu-huynh   – Phụ huynh / Học viên: UC_11 → UC_14
 */
const { Router } = require('express');
const { xacThuc, choPhep } = require('../middlewares/auth');
const { uploadBangCap, uploadMinhChung, kiemTraNoiDungTep } = require('../middlewares/upload');
const { VAI_TRO } = require('../constants/enums');
const auth = require('../controllers/auth.controller');
const ql = require('../controllers/quanLy.controller');
const gv = require('../controllers/giaoVien.controller');
const ph = require('../controllers/phuHuynh.controller');
const chung = require('../controllers/chung.controller');

const api = Router();

api.get('/suc-khoe', chung.suKhoe);

/* ---------------- UC_1 – Đăng nhập ---------------- */
const authRouter = Router();
authRouter.post('/dang-nhap', auth.dangNhap);
authRouter.post('/phu-huynh/dang-nhap', auth.dangNhapPhuHuynh);
authRouter.get('/toi', xacThuc, auth.toi);
authRouter.post('/doi-mat-khau', xacThuc, auth.doiMatKhau);
authRouter.post('/dang-xuat', xacThuc, auth.dangXuat);
api.use('/auth', authRouter);

/* ---------------- Dùng chung (đã đăng nhập) ---------------- */
api.get('/thong-bao', xacThuc, chung.thongBaoCuaToi);
const danhMuc = Router();
danhMuc.use(xacThuc, choPhep(VAI_TRO.QUAN_LY, VAI_TRO.GIAO_VIEN, VAI_TRO.TRO_GIANG));
danhMuc.get('/ca-hoc', chung.caHoc);
danhMuc.get('/phong-hoc', chung.phongHoc);
danhMuc.get('/mon-hoc', chung.monHoc);
danhMuc.get('/lop-hoc', chung.lopHoc);
danhMuc.get('/khoa-hoc', chung.khoaHoc);
api.use('/danh-muc', danhMuc);

/* ---------------- Quản lý: UC_2 → UC_6 ---------------- */
const quanLy = Router();
quanLy.use(xacThuc, choPhep(VAI_TRO.QUAN_LY));
quanLy.get('/tong-quan', ql.tongQuan);
// UC_2 – Quản lý thông tin phòng học
quanLy.get('/phong-hoc/trong', ql.phongTrong); //                 2.1
quanLy.post('/phong-hoc/kiem-tra', ql.kiemTraPhong); //           2.2 bước 4–6
quanLy.get('/phong-hoc/:maPhong', ql.chiTietPhong); //            2.1 chi tiết
quanLy.post('/dang-ky-phong', ql.dangKyPhong); //                 2.2 bước 7–9
quanLy.get('/dang-ky-phong', ql.dsDangKyPhong); //                2.3 bước 2
quanLy.patch('/dang-ky-phong/:maDangKy/huy', ql.huyDangKyPhong); // 2.3 bước 7–10
// UC_3 – Quản lý hồ sơ giáo viên
quanLy.get('/ho-so-giao-vien', ql.dsHoSo); //                     3.1
quanLy.get('/ho-so-giao-vien/:maNhanSu', ql.chiTietHoSo); //      3.1
quanLy.post('/ho-so-giao-vien', uploadBangCap.array('bangCap', 5), kiemTraNoiDungTep, ql.themHoSo); //      3.2
quanLy.put('/ho-so-giao-vien/:maNhanSu', uploadBangCap.array('bangCap', 5), kiemTraNoiDungTep, ql.suaHoSo); // 3.3
// UC_4 – Tiếp nhận và xử lý phản hồi
quanLy.get('/phan-hoi', ql.dsPhanHoi); //                         4.1
quanLy.get('/phan-hoi/:maPhanHoi', ql.chiTietPhanHoi); //         4.1
quanLy.patch('/phan-hoi/:maPhanHoi/trang-thai', ql.capNhatTrangThaiPhanHoi); // 4.2
quanLy.post('/phan-hoi/:maPhanHoi/tra-loi', ql.traLoiPhanHoi); // 4.3
// UC_5 – Tra cứu tất cả lịch dạy
quanLy.get('/lich-day', ql.traCuuLich);
quanLy.get('/lich-day/:maLichDay', ql.chiTietLich);
// UC_6 – Quản lý lịch dạy
quanLy.get('/quan-ly-lich', ql.dsLich); //                        MH19
quanLy.get('/quan-ly-lich/lop-chua-co-lich', ql.lopChuaCoLich); // 6.1 MH20
quanLy.post('/quan-ly-lich/de-xuat', ql.deXuatLich); //            6.1 bước 4–6
quanLy.post('/quan-ly-lich/kiem-tra-phuong-an', ql.kiemTraPhuongAn); // 6.1 luồng 7.a
quanLy.post('/quan-ly-lich', ql.luuLich); //                       6.1 bước 7–9
quanLy.get('/quan-ly-lich/tuan-toi', ql.lichTuanToi); //           6.2 bước 1–6
quanLy.post('/quan-ly-lich/tuan-toi/xac-nhan', ql.xacNhanLichTuan); // 6.2 bước 7–12
quanLy.patch('/quan-ly-lich/de-xuat-thay-doi/:maLichDay/:maPhanHoiLichDay', ql.xuLyDeXuatThayDoi);
quanLy.get('/quan-ly-lich/:maLop/phan-cong', ql.thongTinPhanCong); //   6.3 bước 3
quanLy.post('/quan-ly-lich/:maLop/kiem-tra-giao-vien', ql.kiemTraGiaoVien); // 6.3 luồng 4.a
quanLy.post('/quan-ly-lich/:maLop/phan-cong', ql.phanCong); //          6.3 bước 4–6
quanLy.post('/quan-ly-lich/:maLop/gui-thong-bao', ql.guiThongBaoPhanCong); // 6.3 bước 7–9
quanLy.get('/quan-ly-lich/:maLop/kiem-tra', ql.kiemTraPheDuyet); //      6.4 bước 3–4
quanLy.post('/quan-ly-lich/:maLop/phe-duyet', ql.pheDuyet); //          6.4 bước 5–7
quanLy.post('/quan-ly-lich/:maLop/phat-hanh', ql.phatHanh); //          6.4 bước 9–12
quanLy.post('/quan-ly-lich/:maLop/gui-lai-thong-bao', ql.guiLaiThongBaoPhatHanh); // 6.4 luồng 11.a
quanLy.post('/quan-ly-lich/:maLop/phan-cong-lai', ql.phanCongLai); //   6.4 luồng 5.a
quanLy.get('/nhan-su', ql.dsNhanSu); //                                 6.3 luồng 4.a.2
quanLy.post('/thong-bao/gui-lai', ql.guiLaiThongBao);
quanLy.get('/nhat-ky', ql.nhatKy); //                                   Nhật ký hệ thống (chỉ đọc)
api.use('/quan-ly', quanLy);

/* ---------------- Giáo viên / Trợ giảng: UC_7 → UC_10 ---------------- */
const giaoVien = Router();
giaoVien.use(xacThuc, choPhep(VAI_TRO.GIAO_VIEN, VAI_TRO.TRO_GIANG));
giaoVien.get('/tong-quan', gv.tongQuan); //                        MH25
giaoVien.get('/lich-day', gv.lichDay); //                          UC_7
giaoVien.get('/lich-day/:maLichDay', gv.chiTietLichDay); //        UC_7
giaoVien.get('/ca-du-kien', gv.caDuKien); //                       UC_8 bước 2
giaoVien.get('/ca-du-kien/:maLichDay', gv.chiTietCaDuKien); //     UC_8 bước 4
giaoVien.post('/ca-du-kien/:maLichDay/xac-nhan', gv.xacNhanCaDay); // UC_8 bước 5–6
giaoVien.post('/ca-du-kien/:maLichDay/de-xuat-thay-doi', gv.deXuatThayDoi); // UC_8 luồng 5a
giaoVien.get('/lich-ranh', gv.lichRanh); //                        UC_9
giaoVien.put('/lich-ranh', gv.capNhatLichRanh); //                 UC_9
giaoVien.post('/yeu-cau', gv.guiYeuCau); //                        UC_10
giaoVien.get('/yeu-cau', gv.yeuCauCuaToi); //                      UC_10 bước 9
api.use('/giao-vien', giaoVien);

/* ---------------- Phụ huynh / Học viên: UC_11 → UC_14 ---------------- */
const phuHuynh = Router();
phuHuynh.use(xacThuc, choPhep(VAI_TRO.PHU_HUYNH));
phuHuynh.get('/lop', ph.dsLop); //                                 UC_12 luồng 2a (MH33)
phuHuynh.get('/thoi-khoa-bieu', ph.thoiKhoaBieu); //               UC_12 (MH32)
phuHuynh.get('/ca-hoc/:maLichDay', ph.chiTietCaHoc); //            UC_12 bước 4 (MH34)
phuHuynh.get('/ca-hoc/:maLichDay/xin-nghi', ph.thongTinXinNghi); // UC_13 bước 2
phuHuynh.post('/ca-hoc/:maLichDay/xin-nghi', ph.xinNghi); //       UC_13
phuHuynh.get('/lich-du-kien', ph.lichDuKien); //                   UC_11 (MH35)
phuHuynh.post('/lich-du-kien/xac-nhan-tat-ca', ph.xacNhanTatCa); // UC_11 luồng 3b
phuHuynh.post('/lich-du-kien/:maLichDay/xac-nhan', ph.xacNhanCaHoc); // UC_11
phuHuynh.post('/lich-du-kien/:maLichDay/tu-choi', ph.tuChoiCaHoc); //  UC_11 luồng 3a
phuHuynh.post('/gop-y', uploadMinhChung.array('tepDinhKem', 5), kiemTraNoiDungTep, ph.guiGopY); // UC_14
phuHuynh.get('/gop-y', ph.lichSuPhieu); //                         UC_14 (MH40)
phuHuynh.get('/gop-y/:maPhieu', ph.traCuuPhieu); //                UC_14 luồng 1a (MH39)
api.use('/phu-huynh', phuHuynh);

module.exports = api;
