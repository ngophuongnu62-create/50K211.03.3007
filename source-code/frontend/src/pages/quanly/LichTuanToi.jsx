/**
 * MH22 – Lịch tuần tới kèm đề xuất (QL-6.2-a)
 * Chỉnh sửa đặc biệt (QL-6.2-b), 4a tuần tới không có thay đổi (QL-6.2-c),
 * 10a lịch tuần bị xung đột (QL-6.2-d), tạo lịch tuần thành công (QL-6.2-e)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, CalendarPlus, CalendarX2, Check, MoreHorizontal } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, DatePicker, Field, Loading, Modal, PageHeader, Select, StatCard, ThongBaoModal } from '../../components/ui';
import { congNgay, ddmm, ddmmyyyy } from '../../lib/format';

const THU_NGAN = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const thuNgan = (s) => THU_NGAN[new Date(`${s}T00:00:00Z`).getUTCDay()];

export default function LichTuanToi() {
  const nav = useNavigate();
  const toast = useToast();
  const [kq, setKq] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dm, setDm] = useState({ gv: [], phong: [], ca: [] });
  const [chon, setChon] = useState({}); // { [maLichDay]: { maGiaoVien, maPhong, maCa, ngayDay, huyBuoi } }
  const [buoiBu, setBuoiBu] = useState([]);
  const [menu, setMenu] = useState(null);
  const [hop, setHop] = useState(null); // { loai: 'doiCa'|'huy'|'bu', buoi }
  const [xungDot, setXungDot] = useState(null);
  const [khongDoi, setKhongDoi] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [daTao, setDaTao] = useState(false); // QL-6.2-e: đã tạo lịch tuần → ở lại trang, khóa nút xác nhận

  useEffect(() => {
    Promise.all([
      api('/quan-ly/quan-ly-lich/tuan-toi'), api('/quan-ly/nhan-su', { query: { vaiTro: 'GiaoVien' } }),
      api('/danh-muc/phong-hoc'), api('/danh-muc/ca-hoc'),
    ]).then(([t, gv, phong, ca]) => {
      setKq(t.data);
      setDm({ gv: gv.data, phong: phong.data, ca: ca.data });
      if (!t.data.buoiBiAnhHuong.length) setKhongDoi(true); // 4a
      // Chọn sẵn đề xuất đầu tiên của hệ thống (BR05: Quản lý vẫn quyết định)
      const md = {};
      for (const b of t.data.buoiBiAnhHuong) {
        const gvHienTai = b.giaoVienHienTai.find((g) => g.vaiTro === 'GiaoVien');
        md[b.maLichDay] = {
          maGiaoVien: b.deXuat.giaoVien ? (b.deXuat.giaoVien[0]?.maNhanSu || '') : gvHienTai?.maNhanSu || '',
          maPhong: b.deXuat.phong ? (b.deXuat.phong[0]?.maPhong || '') : b.phongHienTai.maPhong,
          maCa: b.maCa,
          ngayDay: b.ngayDay,
        };
      }
      setChon(md);
    }).catch((e) => setLoi(e.message));
  }, []);

  const tuan = kq?.tuan;
  const nhanTuan = tuan ? `${ddmm(tuan.tuNgay)} – ${ddmmyyyy(tuan.denNgay)}` : '';
  const doi = (ma, k, v) => setChon((c) => ({ ...c, [ma]: { ...c[ma], [k]: v } }));

  const coThayDoi = (b) => {
    const c = chon[b.maLichDay] || {};
    const gvHienTai = b.giaoVienHienTai.find((g) => g.vaiTro === 'GiaoVien')?.maNhanSu;
    return c.huyBuoi || (c.maGiaoVien && c.maGiaoVien !== gvHienTai) || (c.maPhong && c.maPhong !== b.phongHienTai.maPhong) || c.maCa !== b.maCa || c.ngayDay !== b.ngayDay;
  };

  const xacNhan = async () => {
    const thayDoi = kq.buoiBiAnhHuong.filter(coThayDoi).map((b) => {
      const c = chon[b.maLichDay];
      if (c.huyBuoi) return { maLichDay: b.maLichDay, huyBuoi: true };
      const gvHienTai = b.giaoVienHienTai.find((g) => g.vaiTro === 'GiaoVien')?.maNhanSu;
      return {
        maLichDay: b.maLichDay,
        ...(c.maGiaoVien && c.maGiaoVien !== gvHienTai ? { maGiaoVien: c.maGiaoVien } : {}),
        ...(c.maPhong && c.maPhong !== b.phongHienTai.maPhong ? { maPhong: c.maPhong } : {}),
        ...(c.maCa !== b.maCa ? { maCa: c.maCa } : {}),
        ...(c.ngayDay !== b.ngayDay ? { ngayDay: c.ngayDay } : {}),
      };
    });
    setDangGui(true);
    try {
      const { data, message } = await api('/quan-ly/quan-ly-lich/tuan-toi/xac-nhan', { method: 'POST', body: { thayDoi, buoiBu } });
      toast({ title: message, text: `Lịch tuần ${ddmm(data.tuan.tuNgay)} – ${ddmm(data.tuan.denNgay)} chờ giáo viên xác nhận. Đã thông báo cho ${data.soNhanSuDuocThongBao} giáo viên có thay đổi.`, thoiGian: 8000 });
      setDaTao(true); // Figma QL-6.2-e: ở lại trang "Tạo lịch tuần mới" kèm thông báo
    } catch (e) {
      if (e.code === 'DU_LIEU_KHONG_HOP_LE' && !e.data) setKhongDoi(true);
      else setXungDot({ tieuDe: e.message, chiTiet: e.data?.chiTiet || e.data?.loi || [] }); // 10a
    } finally {
      setDangGui(false);
    }
  };

  if (!kq && !loi) return <Loading />;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy', to: '/quan-ly/quan-ly-lich' }, { label: 'Tạo lịch tuần mới' }]}
        title="Tạo lịch tuần mới"
        sub={`Tuần ${nhanTuan} · Chỉ thay đổi các buổi bị ảnh hưởng, các buổi khác giữ lịch cố định.`}
        actions={<>
          <Button variant="outline" onClick={() => nav('/quan-ly/quan-ly-lich')}>Hủy tạo lịch tuần</Button>
          <Button icon={Check} loading={dangGui} onClick={xacNhan} disabled={daTao || (!kq?.buoiBiAnhHuong.length && !buoiBu.length)}>Xác nhận lịch tuần</Button>
        </>}
      />
      {loi && <Alert type="error">{loi}</Alert>}
      {kq && (
        <>
          <div className="grid-3" style={{ gap: 16 }}>
            <StatCard label="Buổi bị ảnh hưởng" value={kq.buoiBiAnhHuong.length} />
            <StatCard label="Giữ lịch cố định" value={kq.soBuoiGiuCoDinh} />
            <StatCard label="Thay đổi các tuần sau (đã lưu)" value={kq.soThayDoiTuanSau} />
          </div>
          <section className="card" style={{ marginTop: 24, padding: 24 }}>
            <div className="card-title">Các buổi bị ảnh hưởng</div>
            <div className="t-13 c-muted" style={{ marginTop: 3, lineHeight: '16px' }}>Hệ thống đề xuất giáo viên thay thế và phòng trống — Quản lý quyết định</div>
            <table className="table" style={{ marginTop: 14 }}>
              <thead><tr><th style={{ width: 232 }}>Buổi dạy</th><th style={{ width: 200 }}>Lý do</th><th style={{ width: 210 }}>Giáo viên</th><th style={{ width: 210 }}>Phòng</th><th aria-label="Tình trạng" /></tr></thead>
              <tbody>
                {kq.buoiBiAnhHuong.map((b) => {
                  const c = chon[b.maLichDay] || {};
                  const tenCa = dm.ca.find((x) => x._id === c.maCa)?.tenCa;
                  const optGV = (b.deXuat.giaoVien && b.deXuat.giaoVien.length ? b.deXuat.giaoVien : dm.gv)
                    .map((g) => ({ value: g.maNhanSu, label: g.hoTen }));
                  const gvHT = b.giaoVienHienTai.find((g) => g.vaiTro === 'GiaoVien');
                  if (!b.deXuat.giaoVien && gvHT && !optGV.some((o) => o.value === gvHT.maNhanSu)) optGV.unshift({ value: gvHT.maNhanSu, label: gvHT.hoTen });
                  const optPhong = b.deXuat.phong && b.deXuat.phong.length
                    ? b.deXuat.phong.map((p) => ({ value: p.maPhong, label: p.tenPhong }))
                    : b.deXuat.phong ? dm.phong.filter((p) => p._id !== b.phongHienTai.maPhong).map((p) => ({ value: p._id, label: p.tenPhong }))
                      : [{ value: b.phongHienTai.maPhong, label: b.phongHienTai.tenPhong }];
                  return (
                    <tr key={b.maLichDay} className={menu === b.maLichDay ? 'hl' : ''} style={c.huyBuoi ? { opacity: 0.55, height: 64 } : { height: 64 }}>
                      <td>
                        <div className="cell-main">{b.tenLop}</div>
                        <div className="cell-sub">{thuNgan(c.ngayDay)} {ddmm(c.ngayDay)} · {tenCa}{c.huyBuoi ? ' · Hủy buổi' : ''}</div>
                      </td>
                      <td className="c-ink-600" style={{ fontSize: 13, lineHeight: '16px' }}>{b.lyDo.join('; ')}</td>
                      <td><Select size="md" value={c.maGiaoVien} onChange={(v) => doi(b.maLichDay, 'maGiaoVien', v)} placeholder="Chọn giáo viên" options={optGV} disabled={c.huyBuoi} /></td>
                      <td><Select size="md" value={c.maPhong} onChange={(v) => doi(b.maLichDay, 'maPhong', v)} placeholder="Chọn phòng" options={optPhong} disabled={c.huyBuoi} /></td>
                      <td className="t-right">
                        <div className="row gap-8" style={{ justifyContent: 'flex-end', position: 'relative' }}>
                          {c.huyBuoi ? <Badge tone="gray">Hủy buổi</Badge>
                            : b.chuaCoDeXuat ? <Badge tone="red">Chưa có đề xuất</Badge>
                              : <Badge tone="blue">Có thay đổi</Badge>}
                          <MenuDacBiet mo={menu === b.maLichDay} onMo={() => setMenu(menu === b.maLichDay ? null : b.maLichDay)} onDong={() => setMenu(null)}
                            onChon={(loai) => { setMenu(null); setHop({ loai, buoi: b }); }} daHuy={c.huyBuoi} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {buoiBu.map((bu, i) => (
                  <tr key={`bu${i}`}>
                    <td>
                      <div className="cell-main">{bu.tenLop}</div>
                      <div className="cell-sub">{thuNgan(bu.ngayDay)} {ddmm(bu.ngayDay)} · {dm.ca.find((x) => x._id === bu.maCa)?.tenCa}</div>
                    </td>
                    <td className="c-ink-600">Buổi bù</td>
                    <td>{dm.gv.find((g) => g.maNhanSu === bu.maGiaoVien)?.hoTen}</td>
                    <td>{dm.phong.find((p) => p._id === bu.maPhong)?.tenPhong}</td>
                    <td className="t-right"><div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <Badge tone="blue">Thêm buổi bù</Badge>
                      <Button variant="ghost" size="sm" onClick={() => setBuoiBu((x) => x.filter((_, j) => j !== i))}>Bỏ</Button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {hop?.loai === 'doiCa' && (
        <DoiCa buoi={hop.buoi} tuan={tuan} dsCa={dm.ca} gt={chon[hop.buoi.maLichDay]} onClose={() => setHop(null)}
          onLuu={({ ngayDay, maCa }) => { setChon((c) => ({ ...c, [hop.buoi.maLichDay]: { ...c[hop.buoi.maLichDay], ngayDay, maCa } })); setHop(null); }} />
      )}
      <Modal open={hop?.loai === 'huy'} onClose={() => setHop(null)}
        title={chon[hop?.buoi?.maLichDay]?.huyBuoi ? 'Khôi phục buổi dạy này?' : 'Hủy buổi dạy này?'}
        sub={hop?.buoi && `${hop.buoi.tenLop} · ${thuNgan(hop.buoi.ngayDay)} ${ddmm(hop.buoi.ngayDay)}`}
        footer={<>
          <Button variant="outline" onClick={() => setHop(null)}>Không</Button>
          <Button onClick={() => { doi(hop.buoi.maLichDay, 'huyBuoi', !chon[hop.buoi.maLichDay]?.huyBuoi); setHop(null); }}>Đồng ý</Button>
        </>} />
      {hop?.loai === 'bu' && (
        <BuoiBu buoi={hop.buoi} tuan={tuan} dm={dm} onClose={() => setHop(null)}
          onLuu={(bu) => { setBuoiBu((x) => [...x, bu]); setHop(null); }} />
      )}

      <ThongBaoModal open={khongDoi} tone="info" width={460} onClose={() => nav('/quan-ly/quan-ly-lich')}
        title="Tuần tới không có thay đổi!"
        text={`Không có buổi dạy nào của tuần ${ddmm(tuan?.tuNgay)} – ${ddmm(tuan?.denNgay)} bị ảnh hưởng bởi lịch bận giáo viên hoặc lịch phòng.`}
        footer={<Button onClick={() => nav('/quan-ly/quan-ly-lich')}>Đóng</Button>} />
      <ThongBaoModal open={!!xungDot} tone="warning-red" width={500} onClose={() => setXungDot(null)}
        title={xungDot?.tieuDe}
        text={xungDot && `${xungDot.chiTiet.slice(0, 2).join('. ')}${xungDot.chiTiet.length ? '. ' : ''}Không thể xác nhận lịch tuần khi còn xung đột.`}
        footer={<>
          <Button variant="outline" onClick={() => nav('/quan-ly/quan-ly-lich')}>Hủy tạo lịch tuần</Button>
          <Button onClick={() => setXungDot(null)}>Sửa lịch</Button>
        </>} />
    </>
  );
}

/** Menu "…" chỉnh sửa đặc biệt (QL-6.2-b): đổi ca, hủy buổi, thêm buổi bù */
function MenuDacBiet({ mo, onMo, onDong, onChon, daHuy }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!mo) return undefined;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onDong(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [mo, onDong]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="icon-btn" style={{ borderRadius: 8, width: 32, height: 32 }} aria-label="Chỉnh sửa đặc biệt" aria-expanded={mo} onClick={onMo}>
        <MoreHorizontal size={18} />
      </button>
      {mo && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" disabled={daHuy} onClick={() => onChon('doiCa')}><ArrowLeftRight size={16} />Đổi ca</button>
          <button role="menuitem" onClick={() => onChon('huy')}><CalendarX2 size={16} />{daHuy ? 'Khôi phục buổi' : 'Hủy buổi'}</button>
          <button role="menuitem" onClick={() => onChon('bu')}><CalendarPlus size={16} />Thêm buổi bù</button>
        </div>
      )}
    </div>
  );
}

function DoiCa({ buoi, tuan, dsCa, gt, onClose, onLuu }) {
  const [ngayDay, setNgay] = useState(gt.ngayDay);
  const [maCa, setCa] = useState(gt.maCa);
  const ngoaiTuan = ngayDay < tuan.tuNgay || ngayDay > tuan.denNgay;
  return (
    <Modal open onClose={onClose} title="Đổi ca" sub={`${buoi.tenLop} · ${buoi.nhanBuoi}`}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={ngoaiTuan} onClick={() => onLuu({ ngayDay, maCa })}>Lưu</Button></>}>
      <div className="col gap-16">
        <Field label="Ngày dạy" required error={ngoaiTuan ? 'Ngày mới phải thuộc tuần tới' : null}>
          <DatePicker value={ngayDay} onChange={setNgay} min={tuan.tuNgay} />
        </Field>
        <Field label="Ca học" required>
          <Select value={maCa} onChange={setCa} options={dsCa.map((c) => ({ value: c._id, label: `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}` }))} />
        </Field>
      </div>
    </Modal>
  );
}

function BuoiBu({ buoi, tuan, dm, onClose, onLuu }) {
  const [f, setF] = useState({ ngayDay: congNgay(tuan.tuNgay, 0), maCa: buoi.maCa, maPhong: buoi.phongHienTai.maPhong, maGiaoVien: buoi.giaoVienHienTai.find((g) => g.vaiTro === 'GiaoVien')?.maNhanSu || '' });
  const ngoaiTuan = f.ngayDay < tuan.tuNgay || f.ngayDay > tuan.denNgay;
  const du = f.maCa && f.maPhong && f.maGiaoVien && !ngoaiTuan;
  const optGV = useMemo(() => dm.gv.map((g) => ({ value: g.maNhanSu, label: g.hoTen })), [dm.gv]);
  return (
    <Modal open onClose={onClose} title="Thêm buổi bù" sub={buoi.tenLop}
      footer={<><Button variant="outline" onClick={onClose}>Hủy</Button>
        <Button disabled={!du} onClick={() => onLuu({ maLop: buoi.maLop, tenLop: buoi.tenLop, ...f, soTiet: 3 })}>Thêm</Button></>}>
      <div className="col gap-16">
        <Field label="Ngày dạy" required error={ngoaiTuan ? 'Buổi bù phải thuộc tuần tới' : null}>
          <DatePicker value={f.ngayDay} onChange={(v) => setF({ ...f, ngayDay: v })} min={tuan.tuNgay} />
        </Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="Ca học" required>
            <Select value={f.maCa} onChange={(v) => setF({ ...f, maCa: v })} options={dm.ca.map((c) => ({ value: c._id, label: `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}` }))} />
          </Field>
          <Field label="Phòng" required>
            <Select value={f.maPhong} onChange={(v) => setF({ ...f, maPhong: v })} options={dm.phong.map((p) => ({ value: p._id, label: p.tenPhong }))} />
          </Field>
        </div>
        <Field label="Giáo viên" required>
          <Select value={f.maGiaoVien} onChange={(v) => setF({ ...f, maGiaoVien: v })} placeholder="Chọn giáo viên" options={optGV} />
        </Field>
      </div>
    </Modal>
  );
}
