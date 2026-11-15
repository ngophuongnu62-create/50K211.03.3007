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
import { Alert, Badge, Button, DatePicker, DateRangePicker, Empty, Field, Loading, PageHeader, Select, Seg, ThongBaoModal } from '../../components/ui';
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
  const [boLoc, setBoLoc] = useState({ tenPhong: '', tuNgay: homNay(), denNgay: '', trangThai: '' });
  const [ketQua, setKetQua] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loiTai, setLoiTai] = useState(null);
  const [loiTim, setLoiTim] = useState(null);
  const [chon, setChon] = useState(null);
  const [chiTiet, setChiTiet] = useState(null);
  const [dsPhong, setDsPhong] = useState([]);

  const tai = useCallback(async (loc, tuTimKiem = false) => {
    setDangTai(true);
    setLoiTai(null);
    try {
      const { data } = await api('/quan-ly/phong-hoc/trong', { query: loc });
      // Không có phòng khớp tiêu chí → hộp thoại 6.a, giữ nguyên danh sách hiện tại (theo yêu cầu chủ dự án)
      if (tuTimKiem && !data.dsPhong.length) {
        setLoiTim({ tieuDe: 'Thông tin tìm kiếm không hợp lệ' });
        return;
      }
      setKetQua(data);
      if (!dsPhong.length && !loc.tenPhong && !loc.trangThai) setDsPhong(data.dsPhong);
    } catch (e) {
      if (e.status === 400) setLoiTim({ tieuDe: e.message, lyDo: e.data?.lyDo }); // 6.a
      else setLoiTai(true); // 2.a
    } finally {
      setDangTai(false);
    }
  }, [dsPhong.length]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { tai({ tuNgay: boLoc.tuNgay }); }, []);

  useEffect(() => {
    if (!chon) { setChiTiet(null); return; }
    api(`/quan-ly/phong-hoc/${chon}`, { query: { ngay: ketQua?.ngay } }).then((r) => setChiTiet(r.data)).catch(() => setLoiTai(true));
  }, [chon, ketQua?.ngay]);

  const thoiGian = () => ({ tuNgay: boLoc.tuNgay, denNgay: boLoc.denNgay || boLoc.tuNgay });
  const timKiem = () => {
    setChon(null);
    // 6.a (Figma QL-2.1-c): ngày kết thúc trước ngày bắt đầu
    if (boLoc.tuNgay && boLoc.denNgay && boLoc.denNgay < boLoc.tuNgay) {
      setLoiTim({ tieuDe: 'Thông tin tìm kiếm không hợp lệ', lyDo: 'Ngày kết thúc đang trước ngày bắt đầu.' });
      return;
    }
    tai({ ...thoiGian(), trangThai: boLoc.trangThai, tenPhong: boLoc.tenPhong }, true);
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
            <DateRangePicker motNgay tuNgay={boLoc.tuNgay} denNgay={boLoc.denNgay} error={!!loiTim?.lyDo}
              onChange={({ tuNgay, denNgay }) => setBoLoc((b) => ({ ...b, tuNgay, denNgay }))} />
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
            // 2.a (Figma QL-2.1-d): mọi lỗi tải (mất mạng, máy chủ chậm…) đều hiển thị cùng một thông báo
            <div style={{ minHeight: 362, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Empty cream icon={AlertTriangle} title="Không thể tải danh sách phòng trống." text="Use case kết thúc. Bạn có thể thử tải lại sau."
              action={<Button variant="outline" icon={RefreshCw} onClick={() => tai(thoiGian())}>Tải lại</Button>} /></div>
          )}
          {!dangTai && !loiTai && ketQua && (
            <table className="table gray-head">
              <thead>
                <tr><th style={{ width: chon ? undefined : 272 }}>Phòng</th><th style={{ width: chon ? undefined : 280 }}>Ca còn trống</th>{!chon && <th style={{ width: 200 }}>Trạng thái</th>}{!chon && <th aria-label="Thao tác" />}</tr>
              </thead>
              <tbody>
                {ketQua.dsPhong.map((p) => (
                  <tr key={p.maPhong} className={`clickable ${chon === p.maPhong ? 'selected' : ''}`} onClick={() => setChon(p.maPhong)}>
                    <td><div className="cell-main">{p.tenPhong}</div><div className="cell-sub">{p.moTa}</div></td>
                    <td className="c-ink-700">{p.caConTrong.length ? p.caConTrong.join(' · ') : '—'}</td>
                    {!chon && <td><Badge tone={MAU_PHONG[p.trangThai]}>{NHAN_PHONG[p.trangThai]}</Badge></td>}
                    {!chon && <td className="t-right"><button className="btn-link">Xem chi tiết</button></td>}
                  </tr>
                ))}
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
      <ThongBaoModal open={!!loiTim} tone="error" onClose={() => setLoiTim(null)}
        title={loiTim?.tieuDe} text={`${loiTim?.lyDo ? `${loiTim.lyDo} ` : ''}Bạn có muốn nhập lại thông tin tìm kiếm không?`}
        footer={<>
          <Button variant="outline" onClick={() => setLoiTim(null)}>Không</Button>
          <Button onClick={() => { setLoiTim(null); setBoLoc({ tenPhong: '', tuNgay: homNay(), denNgay: '', trangThai: '' }); }}>Nhập lại</Button>
        </>} />
    </>
  );
}

/* ------------------------------------------------ MH07 */
function DangKyPhong({ macDinh }) {
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const ngay = macDinh?.ngaySuDung && macDinh.ngaySuDung > homNay() ? macDinh.ngaySuDung : homNay();
    return { maPhong: macDinh?.maPhong || '', ngaySuDung: ngay, maCa: '' };
  });
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
  // Ca đã kết thúc của hôm nay không đăng ký được (BR3) → không cho chọn, tránh báo "phải cung cấp đầy đủ và hợp lệ" khi đã chọn đủ
  const gioHienTai = new Date().toTimeString().slice(0, 5);
  const caDaQua = (c) => form.ngaySuDung === homNay() && c.gioKetThuc <= gioHienTai;
  useEffect(() => {
    if (caChon && caDaQua(caChon)) setForm((f) => ({ ...f, maCa: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ngaySuDung, caChon]);

  const kiemTraPhong = async () => {
    const t = { maPhong: !form.maPhong, ngaySuDung: !form.ngaySuDung, maCa: !form.maCa };
    setThieu(t);
    if (t.maPhong || t.ngaySuDung || t.maCa) return;
    try {
      await api('/quan-ly/phong-hoc/kiem-tra', { method: 'POST', body: form });
      setKiemTra({ ok: true, tieuDe: 'Phòng còn trống', text: `${phongChon?.tenPhong} trống vào ${caChon?.tenCa}, ${nhanNgay(form.ngaySuDung).replace(',', '')}.` });
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
              options={dsCa.filter((c) => !caDaQua(c)).map((c) => ({ value: c._id, label: `${c.tenCa} · ${c.gioBatDau} – ${c.gioKetThuc}` }))} />
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
          <thead><tr><th style={{ width: 162 }}>Tên phòng</th>{dsCa.map((c, i) => <th key={c._id} style={{ width: i < dsCa.length - 1 ? 152 : undefined }}>{c.tenCa}</th>)}</tr></thead>
          <tbody>
            {(bang?.dsPhong || []).map((p) => (
              <tr key={p.maPhong}>
                <td><div className="cell-main">{p.tenPhong}</div><div className="cell-sub">{p.moTa}</div></td>
                {p.theoCa.map((c) => (
                  <td key={c.maCa}>
                    {c.trong && (
                      // Figma QL-2.2-b: ô phòng + ca đang chọn tô nền vàng, viền vàng
                      <button className={`btn-link ${form.maPhong === p.maPhong && form.maCa === c.maCa ? 'o-phong-chon' : ''}`}
                        style={{ color: 'var(--green-900)', fontSize: 14 }}
                        disabled={caDaQua(dsCa.find((x) => x._id === c.maCa) || {})}
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

  // Figma QL-2.3-a: luôn có một dòng được chọn và khung chi tiết bên phải
  const tai = useCallback(() => api('/quan-ly/dang-ky-phong').then((r) => { setDs(r.data); setChon((c) => c || r.data[0]?.maDangKy || null); }), []);
  useEffect(() => { tai(); }, [tai]);
  const dk = useMemo(() => ds?.find((d) => d.maDangKy === chon), [ds, chon]);
  const thoiGianNgan = (d) => `${nhanNgay(d.ngaySuDung).split(',')[0]} ${ddmmyyyy(d.ngaySuDung).slice(0, 5)} · ${d.thoiGian.split(' · ')[1]}`;
  const nhanTT = (d) => (d.trangThaiDangKy === 'DaHuy' ? ['gray', 'Đã hủy'] : [MAU_PHONG[d.trangThaiPhong], NHAN_PHONG[d.trangThaiPhong]]);

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
      <div className="card flush" style={{ width: 700, flex: 'none' }}>
        <table className="table gray-head">
          <thead><tr><th style={{ width: 152 }}>Tên phòng</th><th style={{ width: 364 }}>Thời gian</th><th>Trạng thái</th></tr></thead>
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
          <dl className="kv kv-figma" style={{ gridTemplateColumns: '120px 1fr', columnGap: 12, rowGap: 16 }}>
            <dt>Tên phòng</dt><dd>{dk.tenPhong}</dd>
            <dt>Thời gian</dt><dd>{thoiGianNgan(dk)}</dd>
            <dt>Trạng thái</dt><dd><Badge tone={nhanTT(dk)[0]}>{nhanTT(dk)[1]}</Badge></dd>
          </dl>
          {dk.trangThaiDangKy === 'DaHuy'
            ? <div className="t-12 c-muted" style={{ marginTop: 16 }}>Thông tin hủy đã được lưu vào lịch sử sử dụng phòng.</div>
            : <Button variant="danger-outline" block icon={Trash2} style={{ marginTop: 16 }} onClick={() => setHoi(true)}>Hủy phòng</Button>}
        </div>
      )}
      {/* QL-2.3-b (Figma): biểu tượng cảnh báo bên trái, nút "Xác nhận hủy" đỏ #dc2626 */}
      <ThongBaoModal open={hoi} tone="warning" onClose={() => setHoi(false)}
        title="Bạn có chắc chắn muốn hủy đăng ký phòng này không?"
        text={dk && `${dk.tenPhong} · ${nhanNgay(dk.ngaySuDung).replace(',', '')} · ${dk.thoiGian.split(' · ')[1]}`}
        footer={<><Button variant="outline" onClick={() => setHoi(false)}>Không hủy</Button><Button variant="danger" loading={dangGui} onClick={huy}>Xác nhận hủy</Button></>} />
      {/* QL-2.3-d (Figma): hộp thoại 460px, biểu tượng x-circle, nút "Đóng" viền */}
      <ThongBaoModal open={!!khongThe} tone="x-circle" width={460} onClose={() => setKhongThe(null)} title={khongThe}
        text="Phòng đang trong thời gian sử dụng nên không đủ điều kiện hủy."
        footer={<Button variant="outline" onClick={() => setKhongThe(null)}>Đóng</Button>} />
    </div>
  );
}
