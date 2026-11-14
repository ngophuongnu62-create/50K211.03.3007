/** Controller dùng chung: thông báo của tôi, danh mục. */
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const { traVe } = require('../utils/phanHoi');
const thongBao = require('../services/thongBao.service');
const { CaHoc, PhongHoc, MonHoc, LopHoc, KhoaHoc } = require('../models');

const h = asyncHandler;

module.exports = {
  thongBaoCuaToi: h(async (req, res) => traVe(res, await thongBao.thongBaoCuaToi(req.user))),
  caHoc: h(async (req, res) => traVe(res, await CaHoc.find().sort({ gioBatDau: 1 }).lean())),
  phongHoc: h(async (req, res) => traVe(res, await PhongHoc.find().sort({ tenPhong: 1 }).lean())),
  monHoc: h(async (req, res) => traVe(res, await MonHoc.find().sort({ tenMonHoc: 1 }).lean())),
  lopHoc: h(async (req, res) => traVe(res, await LopHoc.find().sort({ tenLop: 1 }).lean())),
  khoaHoc: h(async (req, res) => traVe(res, await KhoaHoc.find().sort({ ngayBatDau: -1 }).lean())),
  // Kiểm tra sức khỏe cho bộ cân bằng tải / Docker: 503 khi mất kết nối CSDL
  suKhoe: (req, res) => {
    const coCSDL = mongoose.connection.readyState === 1;
    res.status(coCSDL ? 200 : 503).json({ success: coCSDL, data: { trangThai: coCSDL ? 'ok' : 'mat-ket-noi-csdl', thoiGian: new Date().toISOString() } });
  },
};
