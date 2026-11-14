/** Controller cho vai trò Quản lý: UC_2, UC_3, UC_4, UC_5, UC_6 và Trang chủ Quản lý. */
const asyncHandler = require('../utils/asyncHandler');
const { traVe } = require('../utils/phanHoi');
const M = require('../constants/messages');
const tongQuanService = require('../services/tongQuan.service');
const phongHoc = require('../services/phongHoc.service');
const hoSo = require('../services/hoSoGiaoVien.service');
const phanHoi = require('../services/phanHoi.service');
const traCuu = require('../services/traCuuLich.service');
const quanLyLich = require('../services/quanLyLich.service');
const lichTuan = require('../services/lichTuan.service');
const thongBao = require('../services/thongBao.service');
const nhatKy = require('../services/nhatKy.service');

const h = asyncHandler;

module.exports = {
  // Nhật ký hệ thống (audit_logs) – chỉ đọc
  nhatKy: h(async (req, res) => traVe(res, await nhatKy.traCuu(req.query))),

  // MH04
  tongQuan: h(async (req, res) => traVe(res, await tongQuanService.tongQuan())),

  // UC_2 – Phòng học
  phongTrong: h(async (req, res) => traVe(res, await phongHoc.danhSachPhongTrong(req.query))),
  chiTietPhong: h(async (req, res) => traVe(res, await phongHoc.chiTietPhong(req.params.maPhong, req.query))),
  kiemTraPhong: h(async (req, res) => traVe(res, await phongHoc.kiemTraPhong(req.body), M.PHONG_CON_TRONG)),
  dangKyPhong: h(async (req, res) => traVe(res, await phongHoc.dangKyPhong(req.body, req.user.ma), M.PHONG_DANG_KY_THANH_CONG, 201)),
  dsDangKyPhong: h(async (req, res) => traVe(res, await phongHoc.danhSachDaDangKy(req.query))),
  huyDangKyPhong: h(async (req, res) => traVe(res, await phongHoc.huyDangKy(req.params.maDangKy), M.PHONG_HUY_THANH_CONG)),

  // UC_3 – Hồ sơ giáo viên
  dsHoSo: h(async (req, res) => traVe(res, await hoSo.danhSach(req.query))),
  chiTietHoSo: h(async (req, res) => traVe(res, await hoSo.chiTiet(req.params.maNhanSu))),
  themHoSo: h(async (req, res) => traVe(res, await hoSo.them(req.body, req.files || []), M.HS_THEM_THANH_CONG, 201)),
  suaHoSo: h(async (req, res) => traVe(res, await hoSo.sua(req.params.maNhanSu, req.body, req.files || []), M.HS_SUA_THANH_CONG)),

  // UC_4 – Phản hồi & yêu cầu
  dsPhanHoi: h(async (req, res) => traVe(res, await phanHoi.danhSach(req.query))),
  chiTietPhanHoi: h(async (req, res) => traVe(res, await phanHoi.chiTiet(req.params.maPhanHoi))),
  capNhatTrangThaiPhanHoi: h(async (req, res) => traVe(res, await phanHoi.capNhatTrangThai(req.params.maPhanHoi, req.body, req.user.ma), M.PH_CAP_NHAT_THANH_CONG)),
  traLoiPhanHoi: h(async (req, res) => traVe(res, await phanHoi.traLoiNguoiGui(req.params.maPhanHoi, req.body, req.user.ma), M.PH_GUI_THANH_CONG)),

  // UC_5 – Tra cứu tất cả lịch dạy
  traCuuLich: h(async (req, res) => traVe(res, await traCuu.traCuu(req.query))),
  chiTietLich: h(async (req, res) => traVe(res, await traCuu.chiTiet(req.params.maLichDay))),

  // UC_6 – Quản lý lịch dạy (MH19)
  dsLich: h(async (req, res) => traVe(res, await quanLyLich.danhSachLich(req.query))),
  // 6.1
  lopChuaCoLich: h(async (req, res) => traVe(res, await quanLyLich.lopChuaCoLich())),
  deXuatLich: h(async (req, res) => traVe(res, await quanLyLich.deXuatLich(req.body))),
  kiemTraPhuongAn: h(async (req, res) => traVe(res, { phuongAn: (await quanLyLich.kiemTraPhuongAn(req.body)).hienThi })),
  luuLich: h(async (req, res) => traVe(res, await quanLyLich.luuLich(req.body, req.user.ma), M.TL_THANH_CONG, 201)),
  // 6.2
  lichTuanToi: h(async (req, res) => {
    const data = await lichTuan.layLichTuanToi();
    return traVe(res, data, data.thongBao);
  }),
  xacNhanLichTuan: h(async (req, res) => traVe(res, await lichTuan.xacNhanLichTuan(req.body, req.user.ma), M.LT_THANH_CONG)),
  // 6.3
  thongTinPhanCong: h(async (req, res) => traVe(res, await quanLyLich.thongTinPhanCong(req.params.maLop, req.query))),
  dsNhanSu: h(async (req, res) => traVe(res, await quanLyLich.danhSachNhanSu(req.query))),
  kiemTraGiaoVien: h(async (req, res) => traVe(res, await quanLyLich.kiemTraNhanSu(req.params.maLop, req.body), M.PC_GV_PHU_HOP)),
  phanCong: h(async (req, res) => traVe(res, await quanLyLich.phanCong(req.params.maLop, req.body, req.user.ma), M.PC_LUU_THANH_CONG)),
  guiThongBaoPhanCong: h(async (req, res) => traVe(res, await quanLyLich.guiThongBaoPhanCong(req.params.maLop, req.user.ma), M.PC_GUI_THANH_CONG)),
  // 6.4
  kiemTraPheDuyet: h(async (req, res) => traVe(res, await quanLyLich.kiemTraTruocPheDuyet(req.params.maLop, req.query))),
  pheDuyet: h(async (req, res) => traVe(res, await quanLyLich.pheDuyet(req.params.maLop, req.user.ma), M.PD_THANH_CONG)),
  phatHanh: h(async (req, res) => {
    const data = await quanLyLich.phatHanh(req.params.maLop, req.user.ma);
    return traVe(res, data, data.chuaGui.length ? M.PH_HANH_CHUA_GUI_HET : M.PH_HANH_THANH_CONG);
  }),
  guiLaiThongBaoPhatHanh: h(async (req, res) => traVe(res, await quanLyLich.guiLaiThongBaoPhatHanh(req.params.maLop, req.body), M.PH_HANH_THANH_CONG)),
  phanCongLai: h(async (req, res) => traVe(res, await quanLyLich.phanCongLai(req.params.maLop, req.user.ma))),
  xuLyDeXuatThayDoi: h(async (req, res) => traVe(res, await quanLyLich.xuLyDeXuatThayDoi(req.params.maLichDay, req.params.maPhanHoiLichDay, req.body), M.PH_CAP_NHAT_THANH_CONG)),

  // Thông báo
  guiLaiThongBao: h(async (req, res) => traVe(res, { soThongBao: await thongBao.guiLai(req.body.dsMaThongBao) })),
};
