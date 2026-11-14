/** MH09 – Danh sách hồ sơ giáo viên (QL-3.1-a); thông báo sau thêm / sửa (QL-3.2-e, QL-3.3-d) */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Plus, Search } from 'lucide-react';
import { api } from '../../api/client';
import { useToastChuyenTrang } from '../../components/Toast';
import { Alert, Button, Field, Loading, PageHeader, Select, TextInput } from '../../components/ui';
import { NHAN_LOAI_NHAN_SU, vietTat } from '../../lib/format';

const sdtDep = (s = '') => s.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

export default function HoSoDanhSach() {
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState('');
  const [loai, setLoai] = useState('');
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState(null);
  const [moiNhat] = useState(loc.state?.maMoi || null);

  const tai = (query = {}) => api('/quan-ly/ho-so-giao-vien', { query }).then((r) => setDs(r.data)).catch((e) => setLoi(e.message));

  useToastChuyenTrang();
  useEffect(() => {
    tai();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hồ sơ vừa thêm hiển thị đầu danh sách (QL-3.2-e)
  const sapXep = ds ? [...ds].sort((a, b) => (b.maNhanSu === moiNhat) - (a.maNhanSu === moiNhat)) : [];

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Hồ sơ giáo viên' }]}
        title="Hồ sơ giáo viên"
        sub="Quản lý thông tin giáo viên, trợ giảng."
        actions={<Button icon={Plus} onClick={() => nav('/quan-ly/ho-so-giao-vien/them')}>Thêm hồ sơ giáo viên</Button>}
      />
      <form className="card" style={{ padding: 20 }} onSubmit={(e) => { e.preventDefault(); tai({ q, loaiNhanSu: loai }); }}>
        <div className="row gap-12" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><Field label="Tìm kiếm">
            <TextInput icon={Search} placeholder="Họ tên, số điện thoại, email" value={q} onChange={(e) => setQ(e.target.value)} />
          </Field></div>
          <div style={{ flex: 1 }}><Field label="Loại nhân sự">
            <Select value={loai} onChange={setLoai} options={[{ value: '', label: 'Tất cả' }, { value: 'GiaoVien', label: 'Giáo viên' }, { value: 'TroGiang', label: 'Trợ giảng' }]} />
          </Field></div>
          <Button type="submit" variant="outline" style={{ marginBottom: 2 }}>Lọc</Button>
        </div>
      </form>
      {loi && <div className="mt-16"><Alert type="error">{loi}</Alert></div>}
      <div className="card flush" style={{ marginTop: 24 }}>
        {!ds && !loi && <Loading />}
        {ds && (
          <table className="table gray-head">
            <thead><tr><th>Giáo viên</th><th>Loại</th><th>Chuyên môn</th><th>Số điện thoại</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {sapXep.map((g) => (
                <tr key={g.maNhanSu} className={g.maNhanSu === moiNhat ? 'selected' : ''}>
                  <td>
                    <div className="row gap-12">
                      <span className="avatar gray">{vietTat(g.hoTen)}</span>
                      <div><div className="cell-main">{g.hoTen}</div><div className="cell-sub">{g.maNhanSu}</div></div>
                    </div>
                  </td>
                  <td>{NHAN_LOAI_NHAN_SU[g.loaiNhanSu]}</td>
                  <td>{g.chuyenMon.join(', ') || '—'}</td>
                  <td>{sdtDep(g.soDienThoai)}</td>
                  <td className="t-right">
                    <div className="row gap-8" style={{ justifyContent: 'flex-end' }}>
                      <button className="icon-btn" style={{ borderRadius: 8, borderColor: 'var(--border-strong)' }} aria-label={`Xem hồ sơ ${g.hoTen}`} onClick={() => nav(`/quan-ly/ho-so-giao-vien/${g.maNhanSu}`)}><Eye size={17} /></button>
                      <button className="icon-btn" style={{ borderRadius: 8, borderColor: 'var(--border-strong)' }} aria-label={`Chỉnh sửa hồ sơ ${g.hoTen}`} onClick={() => nav(`/quan-ly/ho-so-giao-vien/${g.maNhanSu}/sua`)}><Pencil size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!ds.length && <tr><td colSpan={5} className="c-muted">Không tìm thấy hồ sơ phù hợp.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
