/** Controller cho Giáo viên / Trợ giảng: UC_7, UC_8, UC_9, UC_10 và Trang chủ GV. */
const asyncHandler = require('../utils/asyncHandler');
const { traVe } = require('../utils/phanHoi');
const M = require('../constants/messages');
const gv = require('../services/giaoVien.service');

const h = asyncHandler;

module.exports = {
  tongQuan: h(async (req, res) => traVe(res, await gv.tongQuan(req.user.ma))),
  // UC_7
  lichDay: h(async (req, res) => {
    const data = await gv.lichDayCaNhan(req.user.ma, req.query);
    return traVe(res, data, data.thongBao);
  }),
  chiTietLichDay: h(async (req, res) => traVe(res, await gv.chiTietLichDay(req.user.ma, req.params.maLichDay))),
  // UC_8
  caDuKien: h(async (req, res) => traVe(res, await gv.caDuKien(req.user.ma))),
  chiTietCaDuKien: h(async (req, res) => traVe(res, await gv.chiTietCaDuKien(req.user.ma, req.params.maLichDay))),
  xacNhanCaDay: h(async (req, res) => traVe(res, await gv.xacNhanCaDay(req.user, req.params.maLichDay), M.GV_DA_XAC_NHAN)),
  deXuatThayDoi: h(async (req, res) => traVe(res, await gv.deXuatThayDoi(req.user, req.params.maLichDay, req.body), M.GV_GUI_PHAN_HOI_THANH_CONG)),
  // UC_9
  lichRanh: h(async (req, res) => traVe(res, await gv.lichRanhTuanToi(req.user.ma))),
  capNhatLichRanh: h(async (req, res) => traVe(res, await gv.capNhatLichRanh(req.user.ma, req.body), M.LR_THANH_CONG)),
  // UC_10
  guiYeuCau: h(async (req, res) => traVe(res, await gv.guiYeuCau(req.user.ma, req.body), M.YC_THANH_CONG, 201)),
  yeuCauCuaToi: h(async (req, res) => traVe(res, await gv.yeuCauCuaToi(req.user.ma))),
};
