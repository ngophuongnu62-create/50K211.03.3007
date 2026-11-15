/**
 * Validator $jsonSchema ở mức collection – lớp kiểm tra thứ hai bên cạnh schema Mongoose
 * (tài liệu MongoDB mục 1 và 4.2). Thay cho CHECK, NOT NULL và kiểu dữ liệu của bản SQL.
 */
const E = require('../constants/enums');

const str = (maxLength, extra = {}) => ({ bsonType: 'string', ...(maxLength ? { maxLength } : {}), ...extra });
const so = (extra = {}) => ({ bsonType: ['int', 'long', 'double'], ...extra });
const ngay = { bsonType: 'date' };
const enumStr = (values) => ({ bsonType: 'string', enum: values });
const mang = (items, extra = {}) => ({ bsonType: 'array', items, ...extra });
const doiTuong = (required, properties, extra = {}) => ({ bsonType: 'object', required, properties, ...extra });

const VALIDATORS = {
  nguoiDung: {
    $jsonSchema: doiTuong(
      ['_id', 'loaiNguoiDung', 'hoTen', 'soDienThoai', 'email', 'tenDangNhap', 'matKhau', 'trangThaiTaiKhoan'],
      {
        _id: str(20),
        loaiNguoiDung: enumStr(E.LOAI_NGUOI_DUNG),
        hoTen: str(100),
        soDienThoai: str(15),
        email: str(100),
        tenDangNhap: str(50),
        matKhau: str(255),
        trangThaiTaiKhoan: enumStr(E.TRANG_THAI_TAI_KHOAN),
        mustChangePassword: { bsonType: 'bool' },
        phienBanToken: so({ minimum: 0 }),
        matKhauDoiLuc: ngay,
        diaChi: str(200),
        loaiNhanSu: enumStr(E.LOAI_NHAN_SU),
        hinhThucLamViec: enumStr(E.HINH_THUC_LAM_VIEC),
        kinhNghiem: so({ minimum: 0 }),
        bangCap: mang(doiTuong(['maBangCap', 'tenBangCap', 'hinhAnh'], {
          maBangCap: str(20), tenBangCap: str(150), hinhAnh: str(255),
        })),
        chuyenMon: mang(str(20)),
      },
      {
        // NhanSuGiangDay bắt buộc có các cột riêng
        anyOf: [
          { properties: { loaiNguoiDung: { enum: ['QuanLy'] } } },
          { required: ['loaiNhanSu', 'hinhThucLamViec', 'kinhNghiem'], properties: { loaiNguoiDung: { enum: ['NhanSuGiangDay'] } } },
        ],
      },
    ),
  },
  monHoc: {
    $jsonSchema: doiTuong(['_id', 'tenMonHoc'], { _id: str(20), tenMonHoc: str(100), moTa: str(255) }),
  },
  khoaHoc: {
    $and: [
      { $jsonSchema: doiTuong(['_id', 'tenKhoaHoc', 'ngayBatDau', 'ngayKetThuc'], {
        _id: str(20), tenKhoaHoc: str(100), ngayBatDau: ngay, ngayKetThuc: ngay,
      }) },
      { $expr: { $lte: ['$ngayBatDau', '$ngayKetThuc'] } }, // CK_KhoaHoc_Ngay
    ],
  },
  lopHoc: {
    $jsonSchema: doiTuong(
      ['_id', 'maMonHoc', 'maKhoaHoc', 'tenLop', 'loaiLop', 'soLuongHocVien', 'tongSoTiet', 'trangThaiLop'],
      {
        _id: str(20), maMonHoc: str(20), maKhoaHoc: str(20), tenLop: str(100), loaiLop: str(50),
        soLuongHocVien: so({ minimum: 0 }), tongSoTiet: so({ minimum: 1 }), trangThaiLop: enumStr(E.TRANG_THAI_LOP),
      },
    ),
  },
  phuHuynhHocVien: {
    $jsonSchema: doiTuong(['_id', 'tenHocVien', 'soDienThoai'], {
      _id: str(20), tenHocVien: str(100), soDienThoai: str(15), lopTheoHoc: mang(str(20)),
    }),
  },
  phongHoc: {
    $jsonSchema: doiTuong(['_id', 'tenPhong', 'sucChua', 'trangThaiPhong'], {
      _id: str(20), tenPhong: str(50), sucChua: so({ minimum: 1 }), trangThaiPhong: enumStr(E.TRANG_THAI_PHONG), moTa: str(255),
    }),
  },
  caHoc: {
    $and: [
      { $jsonSchema: doiTuong(['_id', 'tenCa', 'gioBatDau', 'gioKetThuc'], {
        _id: str(20), tenCa: str(20),
        gioBatDau: str(5, { pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }),
        gioKetThuc: str(5, { pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }),
      }) },
      { $expr: { $lt: ['$gioBatDau', '$gioKetThuc'] } }, // CK_CaHoc_Gio
    ],
  },
  dangKyPhong: {
    $jsonSchema: doiTuong(
      ['_id', 'maPhong', 'maCa', 'maQuanLy', 'ngaySuDung', 'trangThaiDangKy', 'thoiDiemDangKy'],
      {
        _id: str(20), maPhong: str(20), maCa: str(20), maQuanLy: str(20), ngaySuDung: ngay,
        trangThaiDangKy: enumStr(E.TRANG_THAI_DANG_KY), thoiDiemDangKy: ngay, thoiDiemHuy: ngay,
      },
    ),
  },
  lichRanh: {
    $jsonSchema: doiTuong(['_id', 'maNhanSu', 'tuanBatDau', 'cacRanh', 'thoiDiemCapNhat'], {
      _id: str(20), maNhanSu: str(20), tuanBatDau: ngay, thoiDiemCapNhat: ngay,
      cacRanh: mang(doiTuong(['ngayRanh', 'maCa'], { ngayRanh: ngay, maCa: str(20) }), { uniqueItems: true }),
    }),
  },
  lichDay: {
    $jsonSchema: doiTuong(
      ['_id', 'maLop', 'maPhong', 'maCa', 'maQuanLy', 'ngayDay', 'soTiet', 'trangThaiLich', 'thoiDiemTao'],
      {
        _id: str(20), maLop: str(20), maPhong: str(20), maCa: str(20), maQuanLy: str(20), ngayDay: ngay,
        soTiet: so({ minimum: 1 }), trangThaiLich: enumStr(E.TRANG_THAI_LICH),
        thoiDiemTao: ngay, thoiDiemCapNhat: ngay, thoiDiemGuiDuKien: ngay,
        phanCong: mang(doiTuong(['maPhanCong', 'maNhanSu', 'vaiTro', 'trangThaiPhanCong'], {
          maPhanCong: str(20), maNhanSu: str(20), vaiTro: enumStr(E.VAI_TRO_PHAN_CONG),
          trangThaiPhanCong: enumStr(E.TRANG_THAI_PHAN_CONG), thoiDiemGuiThongBao: ngay, thoiDiemPhanHoi: ngay,
          phanHoiLichDay: mang(doiTuong(['maPhanHoiLichDay', 'lyDoThayDoi', 'thoiGianPhanHoi', 'trangThaiXuLy'], {
            maPhanHoiLichDay: str(20), maCaDeXuat: str(20), ngayDeXuat: ngay, lyDoThayDoi: str(500),
            thoiGianPhanHoi: ngay, trangThaiXuLy: enumStr(E.TRANG_THAI_XU_LY_PHAN_HOI_LICH),
          })),
        })),
        lichSu: mang(doiTuong(['maLichSuLich', 'maQuanLy', 'hanhDong', 'thoiDiem'], {
          maLichSuLich: str(20), maQuanLy: str(20), hanhDong: enumStr(E.HANH_DONG_LICH), thoiDiem: ngay, ghiChu: str(255),
        })),
        xacNhanCaHoc: mang(doiTuong(['maXacNhan', 'maPHHV', 'ketQua', 'thoiGianXacNhan'], {
          maXacNhan: str(20), maPHHV: str(20), ketQua: enumStr(E.KET_QUA_XAC_NHAN), lyDoTuChoi: str(500), thoiGianXacNhan: ngay,
        }, {
          // CK_XacNhan_LyDo
          anyOf: [{ properties: { ketQua: { enum: ['XacNhan'] } } }, { required: ['lyDoTuChoi'] }],
        })),
        yeuCauNghiHoc: mang(doiTuong(['maYeuCauNghi', 'maPHHV', 'lyDoXinNghi', 'thoiGianGui', 'trangThaiNghi'], {
          maYeuCauNghi: str(20), maPHHV: str(20), lyDoXinNghi: enumStr(E.LY_DO_XIN_NGHI), ghiChu: str(500),
          thoiGianGui: ngay, trangThaiNghi: enumStr(E.TRANG_THAI_NGHI),
        })),
      },
    ),
  },
  phanHoiGopY: {
    $jsonSchema: doiTuong(
      ['_id', 'loaiPhanHoi', 'tieuDe', 'noiDung', 'thoiGianGui', 'trangThaiXuLy'],
      {
        _id: str(20), maNhanSu: str(20), maPHHV: str(20), maQuanLy: str(20), maLichDay: str(20), maPhanHoiLichDay: str(20),
        loaiPhanHoi: enumStr(E.LOAI_PHAN_HOI), tieuDe: str(200), noiDung: str(500), thoiGianGui: ngay,
        trangThaiXuLy: enumStr(E.TRANG_THAI_XU_LY),
        tepDinhKem: mang(doiTuong(['maTep', 'tenTep', 'loaiTep', 'duongDan'], {
          maTep: str(20), tenTep: str(150), loaiTep: enumStr(E.LOAI_TEP), duongDan: str(255),
        })),
        lichSuXuLy: mang(doiTuong(['maLichSu', 'maQuanLy', 'loaiThaoTac', 'thoiGianXuLy'], {
          maLichSu: str(20), maQuanLy: str(20), loaiThaoTac: enumStr(E.LOAI_THAO_TAC),
          trangThaiTruoc: enumStr(E.TRANG_THAI_XU_LY), trangThaiSau: enumStr(E.TRANG_THAI_XU_LY),
          ghiChuXuLy: str(500), noiDungPhanHoi: str(500), thoiGianXuLy: ngay,
        }, {
          // CK_LichSuXuLy_TuChoi
          anyOf: [
            { not: { required: ['trangThaiSau'] } },
            { properties: { trangThaiSau: { enum: ['ChoXuLy', 'DangXuLy', 'DaXuLy'] } } },
            { required: ['ghiChuXuLy'] },
          ],
        })),
      },
      // CK_PhanHoiGopY_NguoiGui: đúng một người gửi
      { oneOf: [{ required: ['maNhanSu'] }, { required: ['maPHHV'] }] },
    ),
  },
  // Nhật ký hệ thống (production): người thực hiện, thời điểm, hành động, đối tượng là bắt buộc
  audit_logs: {
    $jsonSchema: doiTuong(
      ['thoiDiem', 'nguoiThucHien', 'hanhDong', 'doiTuong'],
      {
        thoiDiem: ngay,
        nguoiThucHien: doiTuong(['ma', 'vaiTro'], { ma: str(20), vaiTro: str(30), hoTen: str(100) }),
        hanhDong: str(60),
        doiTuong: doiTuong(['loai', 'ma'], { loai: str(40), ma: str(60) }),
        moTa: str(500),
        ip: str(64),
        userAgent: str(300),
        maYeuCau: str(64),
      },
    ),
  },
  khoaTaiNguyen: {
    $jsonSchema: doiTuong(['_id', 'phienBan'], { _id: str(80), phienBan: so({ minimum: 0 }), capNhatLuc: ngay }),
  },
  thongBao: {
    $jsonSchema: doiTuong(
      ['_id', 'loaiThongBao', 'tieuDe', 'noiDung', 'trangThaiGui'],
      {
        _id: str(20), maNguoiNhan: str(20), maPHHV: str(20), loaiThongBao: enumStr(E.LOAI_THONG_BAO),
        tieuDe: str(200), noiDung: str(500), thoiDiemGui: ngay, trangThaiGui: enumStr(E.TRANG_THAI_GUI),
      },
      // CK_ThongBao_NguoiNhan: đúng một người nhận
      { oneOf: [{ required: ['maNguoiNhan'] }, { required: ['maPHHV'] }] },
    ),
  },
};

/** Tạo collection (nếu chưa có) và gắn validator ở chế độ strict. */
async function apDungValidator(db) {
  const coSan = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const [ten, validator] of Object.entries(VALIDATORS)) {
    if (!coSan.has(ten)) {
      await db.createCollection(ten, { validator, validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.command({ collMod: ten, validator, validationLevel: 'strict', validationAction: 'error' });
    }
  }
}

module.exports = { VALIDATORS, apDungValidator };
