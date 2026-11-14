/**
 * UC_2 – Quản lý thông tin phòng học
 *  MH05 Danh sách phòng trống (QL-2.1-a), MH06 Chi tiết phòng (QL-2.1-b), 6.a (QL-2.1-c), 2.a (QL-2.1-d)
 *  MH07 Chọn phòng và thời gian (QL-2.2-a…e)
 *  MH08 Danh sách phòng đã đăng ký (QL-2.3-a…e)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Search, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, DatePicker, Empty, Field, Loading, Modal, PageHeader, Select, Seg } from '../../components/ui';
import { ddmmyyyy, homNay, nhanNgay } from '../../lib/format';

const TABS = [
  { key: 'trong', label: 'Lịch phòng trống' },
  { key: 'dang-ky', label: 'Đăng ký phòng' },
  { key: 'da-dang-ky', label: 'Phòng đã đăng ký' },
];
const NHAN_PHONG = { ChuaSuDung: 'Chưa sử dụng', DangSuDung: 'Đang sử dụng' };
const MAU_PHONG = { ChuaSuDung: 'gray', DangSuDung: 'blue' };

export default function PhongHoc() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'trong';
  const [dangKyMacDinh, setDangKyMacDinh] = useState(null);
  const chonTab = (k, them = {}) => setSp({ tab: k, ...them });
  return (
    <>
      <PageHeader crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Phòng học' }]} title="Phòng học" sub="Xem lịch phòng trống, đăng ký và hủy đăng ký phòng." />
      <Seg items={TABS} value={tab} onChange={(k) => chonTab(k)} />
      <div style={{ marginTop: 24 }}>
        {tab === 'trong' && <LichPhongTrong onDangKy={(v) => { setDangKyMacDinh(v); chonTab('dang-ky'); }} />}
        {tab === 'dang-ky' && <DangKyPhong macDinh={dangKyMacDinh} />}
        {tab === 'da-dang-ky' && <PhongDaDangKy />}
      </div>
    </>
  );
}

/* ------------------------------------------------ MH05, MH06 */
function LichPhongTrong({ onDangKy }) {
  const [boLoc, setBoLoc] = useState({ tenPhong: '', ngay: homNay(), trangThai: '' });
  const [ketQua, setKetQua] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(null);
  const [loiTim, setLoiTim] = useState(null);
  const [chon, setChon] = useState(null);
  const [chiTiet, setChiTiet] = useState(null);
  const [dsPhong, setDsPhong] = useState([]);

  const tai = useCallback(async (loc) => {
    setDangTai(true);
    setLoiTai(null);
    try {
      const { data } = await api('/quan-ly/phong-hoc/trong', { query: loc });
      setKetQua(data);
      if (!dsPhong.length && !loc.tenPhong && !loc.trangThai) setDsPhong(data.dsPhong);
    } catch (e) {
      if (e.status === 400) setLoiTim(e.message); // 6.a
      else setLoiTai(e.message); // 2.a
    } finally {
      setDangTai(false);
    }
  }, [dsPhong.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { tai({ ngay: boLoc.ngay }); }, []);

  useEffect(() => {
    if (!chon) { setChiTiet(null); return; }
    api(`/quan-ly/phong-hoc/${chon}`, { query: { ngay: ketQua?.ngay } }).then((r) => setChiTiet(r.data)).catch((e) => setLoiTai(e.message));
  }, [chon, ketQua?.ngay]);

  const timKiem = () => {
    setChon(null);
    tai({ ngay: boLoc.ngay, trangThai: boLoc.trangThai, tenPhong: boLoc.tenPhong });
  };

  return (
    <>
      <div className="card" style={{ padding: 20 }}>
        <div className="row gap-12" style={{ alignItems: 'flex-end' }}>
          <div className="grow"><Field label="Tên phòng">
            <Select value={boLoc.tenPhong} onChange={(v) => setBoLoc((b) => ({ ...b, tenPhong: v }))}
              options={[{ value: '', label: 'Tất cả phòng' }, ...dsPhong.map((p) => ({ value: p.tenPhong, label: p.tenPhong }))]} />
          </Field></div>
          <div className="grow"><Field label="Thời gian sử dụng">
            <DatePicker value={boLoc.ngay} onChange={(v) => setBoLoc((b) => ({ ...b, ngay: v }))} />
          </Field></div>
          <div className="grow"><Field label="Trạng thái">
            <Select value={boLoc.trangThai} onChange={(v) => setBoLoc((b) => ({ ...b, trangThai: v }))}
              options={[{ value: '', label: 'Tất cả trạng thái' }, { value: 'ChuaSuDung', label: 'Chưa sử dụng' }, { value: 'DangSuDung', label: 'Đang sử dụng' }]} />
          </Field></div>
          <Button icon={Search} onClick={timKiem} style={{ height: 40, marginBottom: 2 }}>Tìm kiếm</Button>
        </div>
      </div>

      <div className="row gap-20" style={{ alignItems: 'flex-start', marginTop: 24 }}>
        <div className="card flush grow">
          {dangTai && <Loading />}
          {!dangTai && loiTai && (
            <Empty icon={AlertTriangle} title={loiTai} text="Bạn có thể thử tải lại danh sách."
              action={<Button variant="outline" icon={RefreshCw} onClick={() => tai({ ngay: boLoc.ngay })}>Tải lại</Button>} />
          )}
          {!dangTai && !loiTai && ketQua && (
            <table className="table gray-head">
              <thead>
                <tr><th>Phòng</th><th>Ca còn trống</th>{!chon && <th>Trạng thái</th>}{!chon && <th aria-label="Thao tác" />}</tr>
              </thead>
              <tbody>
                {ketQua.dsPhong.map((p) => (
                  <tr key={p.maPhong} className={`clickable ${chon === p.maPhong ? 'selected' : ''}`} onClick={() => setChon(p.maPhong)}>
                    <td><div className="cell-main">{p.tenPhong}</div><div className="cell-sub">{p.moTa}</div></td>
                    <td className="c-ink-700">{p.caConTrong.length ? p.caConTrong.join(' · ') : '—'}</td>
                    {!chon && <td><Badge tone={MAU_PHONG[p.trangThai]}>{NHAN_PHONG[p.trangThai]}</Badge></td>}
                    {!chon && <td className="t-right"><button className="btn-dark-link">Xem chi tiết</button></td>}
                  </tr>
                ))}
                {!ketQua.dsPhong.length && <tr><td colSpan={4} className="c-muted">Không có phòng phù hợp tiêu chí tìm kiếm.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        {chon && chiTiet && (
          <div className="card" style={{ width: 460, flex: 'none' }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="card-title">Phòng {chiTiet.tenPhong}</div>
                <div className="card-sub">{chiTiet.moTa}</div>
              </div>
              <Badge tone={MAU_PHONG[chiTiet.trangThai]}>{NHAN_PHONG[chiTiet.trangThai]}</Badge>
            </div>
            <hr className="divider" style={{ margin: '16px 0' }} />
            <dl className="kv" style={{ gridTemplateColumns: '150px 1fr' }}>
              <dt>Thời gian</dt><dd>{nhanNgay(chiTiet.ngay)}</dd>
              <dt>Sức chứa</dt><dd>{chiTiet.sucChua} chỗ ngồi</dd>
            </dl>
            <div className="t-13 w-600" style={{ marginTop: 20 }}>Lịch sử dụng trong ngày</div>
            <div className="col gap-12 mt-16">
              {chiTiet.theoCa.map((c) => {
                const sd = chiTiet.suDung.find((s) => s.maCa === c.maCa);
                return (
                  <div key={c.maCa} className="row between" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    <div>
                      <div className="t-13 w-600">{c.tenCa} · {c.gio}</div>
                      {sd && <div className="t-12 c-muted mt-4">{sd.tenLop || `Đăng ký bởi ${sd.nguoiDangKy}`}{sd.giangVienPhuTrach?.length ? ` · ${sd.giangVienPhuTrach.join(', ')}` : ''}</div>}
                    </div>
                    {c.trong ? <Badge tone="green">Trống</Badge> : <Badge tone="blue">Đang sử dụng</Badge>}
                  </div>
                );
              })}
            </div>
            <div className="row gap-12" style={{ marginTop: 20 }}>
              <Button variant="outline" block onClick={() => setChon(null)}>Quay lại</Button>
              <Button block onClick={() => onDangKy({ maPhong: chiTiet.maPhong, ngaySuDung: chiTiet.ngay })}>Đăng ký phòng</Button>
            </div>
          </div>
        )}
      </div>

      {/* 6.a: tiêu chí không hợp lệ – hỏi có nhập lại hay không */}
      <Modal open={!!loiTim} onClose={() => setLoiTim(null)}
        icon={<div className="modal-icon" style={{ background: 'var(--amber-bg)' }}><AlertTriangle size={24} color="var(--amber-900)" /></div>}
        title={loiTim} sub="Bạn có muốn nhập lại thông tin tìm kiếm không?"
        footer={<>
          <Button variant="outline" onClick={() => setLoiTim(null)}>Không</Button>
          <Button onClick={() => { setLoiTim(null); setBoLoc({ tenPhong: '', ngay: homNay(), trangThai: '' }); }}>Nhập lại</Button>
        </>} />
    </>
  );
}

/* ------------------------------------------------ MH07 */
function DangKyPhong({ macDinh }) {
  const toast = useToast();
  const [form, setForm] = useState({ maPhong: macDinh?.maPhong || '', ngaySuDung: macDinh?.ngaySuDung || homNay(), maCa: '' });
  const [bang, setBang] = useState(null);
  const [dsCa, setDsCa] = useState([]);
  const [kiemTra, setKiemTra] = useState(null); // { ok, tieuDe, text }
  const [thieu, setThieu] = useState({});
  const [dangGui, setDangGui] = useState(false);

  const taiBang = useCallback(() => {
    api('/quan-ly/phong-hoc/trong', { query: { ngay: form.ngaySuDung } }).then((r) => setBang(r.data)).catch(() => {});
  }, [form.ngaySuDung]);
  useEffect(taiBang, [taiBang]);
  useEffect(() => { api('/danh-muc/ca-hoc').then((r) => setDsCa(r.data)); }, []);

  const doi = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setKiemTra(null); setThieu((t) => ({ ...t, [k]: false })); };
  const phongChon = bang?.dsPhong.find((p) => p.maPhong === form.maPhong);
  const caChon = dsCa.find((c) => c._id === form.maCa);

  const kiemTraPhong = async () => {
    const t = { maPhong: !form.maPhong, ngaySuDung: !form.ngaySuDung, maCa: !form.maCa };
    setThieu(t);
    if (t.maPhong || t.ngaySuDung || t.maCa) return;
    try {
      await api('/quan-ly/phong-hoc/kiem-tra', { method: 'POST', body: form });
      setKiemTra({ ok: true, tieuDe: 'Phòng còn trống', text: `${phongChon?.tenPhong} trống vào ${caChon?.tenCa}, ${nhanNgay(form.ngaySuDung).replace(',', '')}` });
    } catch (e) {
      setKiemTra({ ok: false, text: e.message }); // 5.a
    }
  };

  const xacNhan = async () => {
    setDangGui(true);
    try {
      await api('/quan-ly/dang-ky-phong', { method: 'POST', body: form });
      toast({ title: 'Đăng ký phòng học thành công', text: `${phongChon?.tenPhong} · ${caChon?.tenCa} · ${ddmmyyyy(form.ngaySuDung)} → “Đã đăng ký phòng”.` });
      setKiemTra(null);
      taiBang();
    } catch (e) {
      if (e.status === 409) setKiemTra({ ok: false, text: e.message });
      else toast({ type: 'error', title: e.message, text: 'Không cập nhật được trạng thái phòng. Vui lòng thử lại.' }); // 8.a
    } finally {
      setDangGui(false);
    }
  };

  return (
    <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
      <div className="card" style={{ width: 420, flex: 'none' }}>
        <div className="card-title">Thông tin đăng ký</div>
        <div className="col gap-16" style={{ marginTop: 20 }}>
          <Field label="Phòng học" required error={thieu.maPhong && 'Vui lòng chọn phòng học'}>
            <Select value={form.maPhong} onChange={(v) => doi('maPhong', v)} placeholder="Chọn phòng" error={thieu.maPhong}
              options={(bang?.dsPhong || []).map((p) => ({ value: p.maPhong, label: `${p.tenPhong} · ${p.moTa?.split(' · ')[0] || ''}` }))} />
          </Field>
          <Field label="Ngày sử dụng" required>
            <DatePicker value={form.ngaySuDung} onChange={(v) => doi('ngaySuDung', v)} min={homNay()} />
          </Field>
          <Field label="Ca học" required error={thieu.maCa && 'Vui lòng chọn ca học'}>
            <Select value={form.maCa} onChange={(v) => doi('maCa', v)} placeholder="Chọn ca học" error={thieu.maCa}
              options={dsCa.map((c) => ({ value: c._id, label: `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}` }))} />
          </Field>
          {kiemTra?.ok && <Alert type="success" title={kiemTra.tieuDe}>{kiemTra.text}</Alert>}
          {kiemTra && !kiemTra.ok && <Alert type="error">{kiemTra.text}</Alert>}
          <Button variant="outline" block onClick={kiemTraPhong}>Kiểm tra trạng thái phòng học</Button>
          <Button block disabled={!kiemTra?.ok} loading={dangGui} onClick={xacNhan}>Xác nhận đăng ký phòng</Button>
        </div>
      </div>
      <div className="card grow">
        <div className="card-title">Danh sách phòng học</div>
        <div className="card-sub">{nhanNgay(form.ngaySuDung)}</div>
        <table className="table" style={{ marginTop: 16 }}>
          <thead><tr><th>Tên phòng</th>{dsCa.map((c) => <th key={c._id}>{c.tenCa}</th>)}</tr></thead>
          <tbody>
            {(bang?.dsPhong || []).map((p) => (
              <tr key={p.maPhong}>
                <td><div className="cell-main">{p.tenPhong}</div><div className="cell-sub">{p.moTa}</div></td>
                {p.theoCa.map((c) => (
                  <td key={c.maCa}>
                    {c.trong && (
                      <button className="btn-link" style={{ color: 'var(--green-900)', fontSize: 14 }}
                        onClick={() => { doi('maPhong', p.maPhong); doi('maCa', c.maCa); }}>Trống</button>
                    )}
                    {!c.trong && c.loaiChiemDung === 'DangKyPhong' && <Badge tone="green">Đã đăng ký phòng</Badge>}
                    {!c.trong && c.loaiChiemDung === 'LichDay' && <span className="c-muted">{c.maLop}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------ MH08 */
function PhongDaDangKy() {
  const toast = useToast();
  const [ds, setDs] = useState(null);
  const [chon, setChon] = useState(null);
  const [hoi, setHoi] = useState(false);
  const [khongThe, setKhongThe] = useState(null);
  const [dangGui, setDangGui] = useState(false);

  const tai = useCallback(() => api('/quan-ly/dang-ky-phong').then((r) => setDs(r.data)), []);
  useEffect(() => { tai(); }, [tai]);
  const dk = useMemo(() => ds?.find((d) => d.maDangKy === chon), [ds, chon]);
  const thoiGianNgan = (d) => `${nhanNgay(d.ngaySuDung).split(',')[0]} ${ddmmyyyy(d.ngaySuDung).slice(0, 5)} · ${d.thoiGian.split(' · ')[1]}`;
  const nhanTT = (d) => (d.trangThaiDangKy === 'DaHuy' ? ['red', 'Đã hủy'] : [MAU_PHONG[d.trangThaiPhong], NHAN_PHONG[d.trangThaiPhong]]);

  const huy = async () => {
    setDangGui(true);
    try {
      await api(`/quan-ly/dang-ky-phong/${dk.maDangKy}/huy`, { method: 'PATCH' });
      setHoi(false);
      toast({ title: 'Đã hủy phòng thành công', text: `${dk.tenPhong} · ${ddmmyyyy(dk.ngaySuDung)} · ${dk.thoiGian.split(' · ')[1]} → “Đã hủy”.` });
      tai();
    } catch (e) {
      setHoi(false);
      if (e.status === 422) setKhongThe(e.message); // 8.a
      else toast({ type: 'error', title: e.message, text: `Đăng ký vẫn giữ trạng thái “${NHAN_PHONG[dk.trangThaiPhong]}”.` }); // 9.a
    } finally {
      setDangGui(false);
    }
  };

  if (!ds) return <Loading />;
  return (
    <div className="row gap-20" style={{ alignItems: 'flex-start' }}>
      <div className="card flush grow">
        <table className="table gray-head">
          <thead><tr><th>Tên phòng</th><th>Thời gian</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {ds.map((d) => {
              const [mau, nhan] = nhanTT(d);
              return (
                <tr key={d.maDangKy} className={`clickable ${chon === d.maDangKy ? 'selected' : ''}`} onClick={() => setChon(d.maDangKy)}>
                  <td className="w-600">{d.tenPhong}</td>
                  <td>{thoiGianNgan(d)}</td>
                  <td><Badge tone={mau}>{nhan}</Badge></td>
                </tr>
              );
            })}
            {!ds.length && <tr><td colSpan={3} className="c-muted">Chưa có phòng nào được đăng ký.</td></tr>}
          </tbody>
        </table>
      </div>
      {dk && (
        <div className="card" style={{ width: 400, flex: 'none' }}>
          <div className="card-title">Phòng {dk.tenPhong}</div>
          <div className="card-sub">Đăng ký bởi {dk.nguoiDangKy}</div>
          <hr className="divider" style={{ margin: '16px 0' }} />
          <dl className="kv" style={{ gridTemplateColumns: '130px 1fr' }}>
            <dt>Tên phòng</dt><dd>{dk.tenPhong}</dd>
            <dt>Thời gian</dt><dd>{thoiGianNgan(dk)}</dd>
            <dt>Trạng thái</dt><dd><Badge tone={nhanTT(dk)[0]}>{nhanTT(dk)[1]}</Badge></dd>
          </dl>
          {dk.trangThaiDangKy === 'DaHuy'
            ? <div className="t-12 c-muted" style={{ marginTop: 16 }}>Thông tin hủy đã được lưu vào lịch sử sử dụng phòng.</div>
            : <Button variant="danger-outline" block icon={Trash2} style={{ marginTop: 20 }} onClick={() => setHoi(true)}>Hủy phòng</Button>}
        </div>
      )}
      <Modal open={hoi} onClose={() => setHoi(false)}
        icon={<div className="modal-icon" style={{ background: 'var(--amber-bg)', width: 44, height: 44 }}><AlertTriangle size={20} color="var(--amber-900)" /></div>}
        title="Bạn có chắc chắn muốn hủy đăng ký phòng này không?"
        sub={dk && `${dk.tenPhong} · ${nhanNgay(dk.ngaySuDung).replace(',', '')} · ${dk.thoiGian.split(' · ')[1]}`}
        footer={<><Button variant="outline" onClick={() => setHoi(false)}>Không hủy</Button><Button loading={dangGui} onClick={huy}>Xác nhận hủy</Button></>} />
      <Modal open={!!khongThe} onClose={() => setKhongThe(null)} title={khongThe}
        sub="Phòng đang trong thời gian sử dụng hoặc đăng ký không còn hiệu lực nên không thể hủy."
        footer={<Button onClick={() => setKhongThe(null)}>Đóng</Button>} />
    </div>
  );
}
