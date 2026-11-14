/**
 * MH17 – Danh sách tất cả lịch dạy (QL-5-a), MH18 – Chi tiết lịch dạy (QL-5-b)
 * Ngoại lệ 5a không tìm thấy (QL-5-c), 5b / BR05 khoảng thời gian không hợp lệ (QL-5-d). Chỉ xem (BR06).
 */
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../api/client';
import { Alert, Badge, Button, DateRangePicker, Empty, Field, Loading, Modal, PageHeader, Select } from '../../components/ui';
import { congNgay, dauTuan, homNay } from '../../lib/format';

export const NHAN_THUC_HIEN = { DangThucHien: 'Đang thực hiện', ChuaHoanThanh: 'Chưa hoàn thành', DaXong: 'Đã xong' };
const XAM_THUC_HIEN = { DangThucHien: 'g1', ChuaHoanThanh: 'g2', DaXong: 'g3' };
const MAU_THUC_HIEN = { DangThucHien: 'blue', ChuaHoanThanh: 'amber', DaXong: 'green' };

const macDinh = () => {
  const t = dauTuan(homNay());
  return { loaiLop: '', maLop: '', maGiaoVien: '', maTroGiang: '', maPhong: '', tuNgay: t, denNgay: congNgay(t, 6), trangThaiXacNhan: '' };
};
const TAT_CA = { value: '', label: 'Tất cả' };

export default function TraCuuLich() {
  const [loc, setLoc] = useState(macDinh);
  const [dm, setDm] = useState({ lop: [], gv: [], tg: [], phong: [] });
  const [kq, setKq] = useState(null);
  const [loi, setLoi] = useState(null);
  const [loiNgay, setLoiNgay] = useState(null);
  const [dangTai, setDangTai] = useState(false);
  const [chon, setChon] = useState(null);

  useEffect(() => {
    Promise.all([
      api('/danh-muc/lop-hoc'), api('/quan-ly/nhan-su', { query: { vaiTro: 'GiaoVien' } }),
      api('/quan-ly/nhan-su', { query: { vaiTro: 'TroGiang' } }), api('/danh-muc/phong-hoc'),
    ]).then(([lop, gv, tg, phong]) => setDm({ lop: lop.data, gv: gv.data, tg: tg.data, phong: phong.data })).catch((e) => setLoi(e.message));
  }, []);

  const traCuu = async (dk = loc) => {
    setLoiNgay(null);
    setLoi(null);
    // BR05: kiểm tra ngay trên giao diện, đồng thời backend cũng kiểm tra lại
    if (dk.tuNgay && dk.denNgay && dk.tuNgay > dk.denNgay) { setLoiNgay('Ngày bắt đầu không được lớn hơn ngày kết thúc'); return; }
    setDangTai(true);
    try {
      const { data } = await api('/quan-ly/lich-day', { query: { ...dk, soDong: 200 } });
      setKq(data);
    } catch (e) {
      if (e.fieldErrors?.thoiGianDay) setLoiNgay(e.fieldErrors.thoiGianDay);
      else setLoi(e.message);
    } finally {
      setDangTai(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { traCuu(); }, []);

  const datLai = () => { const m = macDinh(); setLoc(m); traCuu(m); }; // luồng 4b
  const doi = (k) => (v) => setLoc((l) => ({ ...l, [k]: v }));

  const opt = useMemo(() => ({
    loai: [TAT_CA, ...[...new Set(dm.lop.map((l) => l.loaiLop))].map((l) => ({ value: l, label: l }))],
    lop: [TAT_CA, ...dm.lop.filter((l) => !loc.loaiLop || l.loaiLop === loc.loaiLop).map((l) => ({ value: l._id, label: l.tenLop }))],
    gv: [TAT_CA, ...dm.gv.map((g) => ({ value: g.maNhanSu, label: g.hoTen }))],
    tg: [TAT_CA, ...dm.tg.map((g) => ({ value: g.maNhanSu, label: g.hoTen }))],
    phong: [TAT_CA, ...dm.phong.map((p) => ({ value: p._id, label: p.tenPhong }))],
    tt: [TAT_CA, ...Object.entries(NHAN_THUC_HIEN).map(([value, label]) => ({ value, label }))],
  }), [dm, loc.loaiLop]);

  return (
    <>
      <PageHeader crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Tra cứu lịch dạy' }]}
        title="Tra cứu tất cả lịch dạy" sub="Chỉ xem — thao tác tra cứu không thay đổi dữ liệu lịch dạy." />
      <form className="card" style={{ padding: 20 }} onSubmit={(e) => { e.preventDefault(); traCuu(); }}>
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px 12px' }}>
          <Field label="Loại lớp học"><Select value={loc.loaiLop} onChange={(v) => setLoc((l) => ({ ...l, loaiLop: v, maLop: '' }))} options={opt.loai} /></Field>
          <Field label="Tên lớp"><Select value={loc.maLop} onChange={doi('maLop')} options={opt.lop} /></Field>
          <Field label="Giáo viên phụ trách"><Select value={loc.maGiaoVien} onChange={doi('maGiaoVien')} options={opt.gv} /></Field>
          <Field label="Trợ giảng"><Select value={loc.maTroGiang} onChange={doi('maTroGiang')} options={opt.tg} /></Field>
        </div>
        <div className="row gap-12" style={{ marginTop: 18, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}><Field label="Phòng học"><Select value={loc.maPhong} onChange={doi('maPhong')} options={opt.phong} /></Field></div>
          <div style={{ flex: 1 }}>
            <Field label="Thời gian dạy" error={loiNgay}>
              <DateRangePicker tuNgay={loc.tuNgay} denNgay={loc.denNgay} error={loiNgay}
                onChange={({ tuNgay, denNgay }) => { setLoc((l) => ({ ...l, tuNgay, denNgay })); setLoiNgay(null); }} />
            </Field>
          </div>
          <div style={{ flex: 1 }}><Field label="Trạng thái xác nhận"><Select value={loc.trangThaiXacNhan} onChange={doi('trangThaiXacNhan')} options={opt.tt} /></Field></div>
          <div className="row gap-8" style={{ marginTop: 26 }}>
            <Button variant="outline" onClick={datLai}>Đặt lại</Button>
            <Button type="submit" icon={Search} loading={dangTai}>Tra cứu</Button>
          </div>
        </div>
      </form>
      {loi && <div style={{ marginTop: 16 }}><Alert type="error">{loi}</Alert></div>}
      <div className="card flush" style={{ marginTop: 24 }}>
        {!kq && !loi && <Loading />}
        {kq && kq.ds.length === 0 && (
          <div style={{ padding: '40px 0 40px' }}>
            <Empty cream icon={Search} title="Không tìm thấy lịch dạy phù hợp với điều kiện lọc!" text="Thay đổi điều kiện lọc và tra cứu lại."
              action={<Button variant="outline" onClick={datLai}>Đặt lại bộ lọc</Button>} />
          </div>
        )}
        {kq && kq.ds.length > 0 && (
          <table className="table gray-head">
            <thead><tr><th>Tên lớp</th><th>Giáo viên phụ trách</th><th>Phòng học</th><th>Thời gian dạy</th><th>Trạng thái</th></tr></thead>
            <tbody>
              {kq.ds.map((l) => (
                <tr key={l.maLop} className={`clickable ${chon?.maLop === l.maLop ? 'selected' : ''}`} onClick={() => setChon(l)}>
                  <td className="cell-main">{l.tenLop}</td>
                  <td>{l.giaoVienPhuTrach || '—'}</td>
                  <td>{l.phongHoc}</td>
                  <td>{l.thoiGianDay}</td>
                  <td><span className={`badge badge-${XAM_THUC_HIEN[l.trangThaiXacNhan]}`}>{NHAN_THUC_HIEN[l.trangThaiXacNhan]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {chon && (
        <Modal open onClose={() => setChon(null)} title={chon.tenLop} sub="Chi tiết lịch dạy"
          footer={<Button variant="outline" onClick={() => setChon(null)}>Quay lại</Button>}>
          <dl className="kv" style={{ gridTemplateColumns: '182px 1fr', rowGap: 16 }}>
            <dt>Loại lớp học</dt><dd>{chon.loaiLop}</dd>
            <dt>Tên lớp</dt><dd>{chon.tenLop}</dd>
            <dt>Giáo viên phụ trách</dt><dd>{chon.giaoVienPhuTrach || '—'}</dd>
            <dt>Trợ giảng</dt><dd>{chon.troGiang || '—'}</dd>
            <dt>Phòng học</dt><dd>{chon.phongHoc}</dd>
            <dt>Số lượng học sinh</dt><dd>{chon.soLuongHocVien}</dd>
            <dt>Thời gian dạy</dt><dd>{chon.thoiGianDayDayDu}</dd>
            <dt>Trạng thái xác nhận</dt><dd><Badge tone={MAU_THUC_HIEN[chon.trangThaiXacNhan]}>{NHAN_THUC_HIEN[chon.trangThaiXacNhan]}</Badge></dd>
          </dl>
        </Modal>
      )}
    </>
  );
}
