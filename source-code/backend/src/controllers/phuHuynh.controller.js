/** Controller cho Phụ huynh / Học viên: UC_11, UC_12, UC_13, UC_14. */
const asyncHandler = require('../utils/asyncHandler');
const { traVe } = require('../utils/phanHoi');
const M = require('../constants/messages');
const { thongTinTep } = require('../middlewares/upload');
const ph = require('../services/phuHuynh.service');

const h = asyncHandler;

module.exports = {
  // UC_12
  dsLop: h(async (req, res) => traVe(res, await ph.danhSachLop(req.user.ma))),
  thoiKhoaBieu: h(async (req, res) => {
    const data = await ph.thoiKhoaBieu(req.user.ma, req.query);
    return traVe(res, data, data.thongBao);
  }),
  chiTietCaHoc: h(async (req, res) => traVe(res, await ph.chiTietCaHoc(req.user.ma, req.params.maLichDay))),
  // UC_11
  lichDuKien: h(async (req, res) => {
    const data = await ph.lichDuKien(req.user.ma);
    return traVe(res, data, data.thongBao);
  }),
  xacNhanCaHoc: h(async (req, res) => traVe(res, await ph.xacNhanCaHoc(req.user, req.params.maLichDay), M.XN_THANH_CONG)),
  tuChoiCaHoc: h(async (req, res) => traVe(res, await ph.tuChoiCaHoc(req.user, req.params.maLichDay, req.body), M.XN_TU_CHOI_THANH_CONG)),
  xacNhanTatCa: h(async (req, res) => {
    const data = await ph.xacNhanTatCa(req.user);
    return traVe(res, { soCa: data.soCa }, data.message);
  }),
  // UC_13
  thongTinXinNghi: h(async (req, res) => traVe(res, await ph.thongTinXinNghi(req.user.ma, req.params.maLichDay))),
  xinNghi: h(async (req, res) => traVe(res, await ph.xinNghi(req.user, req.params.maLichDay, req.body), M.NGHI_THANH_CONG, 201)),
  // UC_14
  guiGopY: h(async (req, res) => {
    const tep = (req.files || []).map((f) => thongTinTep(f));
    return traVe(res, await ph.guiGopY(req.user, req.body, tep), M.GY_THANH_CONG, 201);
  }),
  lichSuPhieu: h(async (req, res) => traVe(res, await ph.lichSuPhieu(req.user.ma))),
  traCuuPhieu: h(async (req, res) => traVe(res, await ph.traCuuPhieu(req.user.ma, req.params.maPhieu))),
};
