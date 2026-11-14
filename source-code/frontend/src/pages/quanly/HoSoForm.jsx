/**
 * MH11 – Biểu mẫu thêm hồ sơ (QL-3.2-a…e) và MH12 – Biểu mẫu chỉnh sửa hồ sơ (QL-3.3-a…d)
 * Ngoại lệ: 7a không hợp lệ, 7b thiếu thông tin, 7c SĐT/email đã tồn tại, 8a cập nhật thất bại, 6a hủy.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImageIcon, Upload, X } from 'lucide-react';
import { api, duongDanTep } from '../../api/client';
import { Alert, Button, Field, Loading, PageHeader, Select, TextInput } from '../../components/ui';

/** Thẻ ảnh bằng cấp: ảnh + tên + nơi cấp ("Cử nhân Ngôn ngữ Anh – ĐH Ngoại ngữ Đà Nẵng") */
export function TheBangCap({ bang, anhTam, onXoa }) {
  const [loiAnh, setLoiAnh] = useState(false);
  const [ten, noiCap] = (bang.tenBangCap || '').split(' – ');
  const anh = anhTam || duongDanTep(bang.hinhAnh);
  return (
    <div style={{ width: 180, position: 'relative' }}>
      <div style={{ height: 120, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--cream-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {anh && !loiAnh ? <img src={anh} alt={ten} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setLoiAnh(true)} /> : <ImageIcon size={26} color="var(--ink-300)" />}
      </div>
      {onXoa && (
        <button type="button" onClick={onXoa} aria-label="Bỏ ảnh" className="icon-btn" style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26 }}><X size={14} /></button>
      )}
      <div className="t-13 w-500" style={{ marginTop: 8 }}>{ten}</div>
      {noiCap && <div className="t-12 c-muted mt-4">{noiCap}</div>}
    </div>
  );
}

const TRONG = { hoTen: '', soDienThoai: '', email: '', loaiNhanSu: 'GiaoVien', diaChi: '' };

export default function HoSoForm() {
  const { maNhanSu } = useParams();
  const laSua = Boolean(maNhanSu);
  const nav = useNavigate();
  const [form, setForm] = useState(TRONG);
  const [bangCu, setBangCu] = useState([]);
  const [bangMoi, setBangMoi] = useState([]); // { file, url, ten }
  const [loi, setLoi] = useState({});
  const [thongBao, setThongBao] = useState(null);
  const [dangTai, setDangTai] = useState(laSua);
  const [dangGui, setDangGui] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!laSua) return;
    api(`/quan-ly/ho-so-giao-vien/${maNhanSu}`).then(({ data }) => {
      setForm({ hoTen: data.hoTen, soDienThoai: data.soDienThoai, email: data.email, loaiNhanSu: data.loaiNhanSu, diaChi: data.diaChi || '' });
      setBangCu(data.bangCap);
      setDangTai(false);
    }).catch((e) => nav('/quan-ly/ho-so-giao-vien', { replace: true, state: { toast: { type: 'error', title: e.message } } }));
  }, [laSua, maNhanSu, nav]);

  const doi = (k) => (e) => { const v = e?.target ? e.target.value : e; setForm((f) => ({ ...f, [k]: v })); setLoi((l) => ({ ...l, [k]: undefined })); };

  const chonAnh = (e) => {
    const ds = [...e.target.files].filter((f) => ['image/jpeg', 'image/png'].includes(f.type));
    setBangMoi((b) => [...b, ...ds.map((f) => ({ file: f, url: URL.createObjectURL(f), ten: f.name.replace(/\.[^.]+$/, '') }))]);
    setLoi((l) => ({ ...l, bangCap: undefined }));
    e.target.value = '';
  };

  const luu = async () => {
    setDangGui(true);
    setThongBao(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(k, v);
    for (const b of bangMoi) { fd.append('bangCap', b.file); fd.append('tenBangCap', b.ten); }
    if (laSua) fd.append('giuBangCap', JSON.stringify(bangCu.map((b) => b.maBangCap)));
    try {
      const { data, message } = await api(laSua ? `/quan-ly/ho-so-giao-vien/${maNhanSu}` : '/quan-ly/ho-so-giao-vien', { method: laSua ? 'PUT' : 'POST', form: fd });
      const taiKhoan = !laSua && data.taiKhoan?.matKhauTam ? ` Tài khoản: ${data.taiKhoan.tenDangNhap} · mật khẩu tạm: ${data.taiKhoan.matKhauTam}` : '';
      nav('/quan-ly/ho-so-giao-vien', {
        state: {
          maMoi: laSua ? maNhanSu : data.hoSo.maNhanSu,
          toast: { title: message, text: (laSua ? 'Danh sách hiển thị thông tin mới nhất.' : 'Danh sách đã cập nhật hồ sơ mới.') + taiKhoan, thoiGian: taiKhoan ? 15000 : 5000 },
        },
      });
    } catch (e) {
      const fe = { ...e.fieldErrors };
      // Lỗi chung của trường bắt buộc hiển thị ngay dưới từng trường (QL-3.2-c)
      setLoi(fe);
      setThongBao({ text: e.message, phu: e.status >= 500 ? 'Thông tin hồ sơ trước khi chỉnh sửa được giữ nguyên.' : null });
    } finally {
      setDangGui(false);
    }
  };

  if (dangTai) return <Loading />;
  const tenTrang = laSua ? 'Chỉnh sửa hồ sơ giáo viên' : 'Thêm hồ sơ giáo viên';
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Hồ sơ giáo viên', to: '/quan-ly/ho-so-giao-vien' }, { label: laSua ? 'Chỉnh sửa' : 'Thêm mới' }]}
        title={tenTrang}
        sub={laSua ? `${maNhanSu} · ${form.hoTen}` : 'Các trường có dấu * là bắt buộc.'}
        actions={<>
          <Button variant="outline" onClick={() => nav(laSua ? `/quan-ly/ho-so-giao-vien/${maNhanSu}` : '/quan-ly/ho-so-giao-vien')}>Hủy</Button>
          <Button loading={dangGui} onClick={luu}>Lưu</Button>
        </>}
      />
      {thongBao && <div style={{ marginBottom: 24 }}><Alert type="error" title={thongBao.phu ? thongBao.text : undefined}>{thongBao.phu || thongBao.text}</Alert></div>}
      <section className="card" style={{ padding: 28 }}>
        <div className="card-title">Thông tin cá nhân</div>
        <div className="grid-2" style={{ marginTop: 20 }}>
          <Field label="Họ và tên" required error={loi.hoTen}>
            <TextInput placeholder="VD: Hoàng Bảo Ngọc" value={form.hoTen} error={loi.hoTen} onChange={doi('hoTen')} />
          </Field>
          <Field label="Số điện thoại" required error={loi.soDienThoai}>
            <TextInput placeholder="09xx xxx xxx" inputMode="tel" value={form.soDienThoai} error={loi.soDienThoai} onChange={doi('soDienThoai')} />
          </Field>
          <Field label="Email" required error={loi.email}>
            <TextInput placeholder="ten@broadway.edu.vn" type="email" value={form.email} error={loi.email} onChange={doi('email')} />
          </Field>
          <Field label="Loại nhân sự" error={loi.loaiNhanSu}>
            <Select value={form.loaiNhanSu} onChange={doi('loaiNhanSu')} options={[{ value: 'GiaoVien', label: 'Giáo viên' }, { value: 'TroGiang', label: 'Trợ giảng' }]} />
          </Field>
        </div>
        <div style={{ marginTop: 20 }}>
          <Field label="Địa chỉ" required error={loi.diaChi}>
            <TextInput placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành" value={form.diaChi} error={loi.diaChi} onChange={doi('diaChi')} />
          </Field>
        </div>
        <hr className="divider" style={{ margin: '24px 0' }} />
        <div className="card-title">Trình độ học vấn<span className="req">*</span></div>
        <div className="t-13 c-muted mt-8">Bằng cấp, chứng chỉ dạng hình ảnh</div>
        {loi.bangCap && <div className="field-error mt-8">{loi.bangCap}</div>}
        <div className="row gap-16 wrap" style={{ marginTop: 16, alignItems: 'flex-start' }}>
          {bangCu.map((b) => <TheBangCap key={b.maBangCap} bang={b} onXoa={() => setBangCu((x) => x.filter((y) => y.maBangCap !== b.maBangCap))} />)}
          {bangMoi.map((b, i) => (
            <div key={b.url} className="col gap-8">
              <TheBangCap bang={{ tenBangCap: b.ten }} anhTam={b.url} onXoa={() => setBangMoi((x) => x.filter((_, j) => j !== i))} />
              <input className="control" style={{ height: 32, width: 180, fontSize: 12 }} value={b.ten} aria-label="Tên bằng cấp"
                onChange={(e) => setBangMoi((x) => x.map((y, j) => (j === i ? { ...y, ten: e.target.value } : y)))} />
            </div>
          ))}
          <button type="button" onClick={() => fileRef.current.click()}
            style={{ width: 180, height: 120, borderRadius: 8, border: `1px dashed ${loi.bangCap ? 'var(--brand)' : 'var(--border-strong)'}`, background: 'var(--white)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Upload size={20} color="var(--ink-600)" />
            <span className="t-13 w-500 c-ink-700">Tải ảnh lên</span>
            <span className="t-12 c-muted">JPG, PNG</span>
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple hidden onChange={chonAnh} />
        </div>
      </section>
    </>
  );
}
