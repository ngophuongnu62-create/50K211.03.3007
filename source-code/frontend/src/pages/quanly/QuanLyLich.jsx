/** MH19 – Quản lý lịch dạy (QL-6-0): vòng đời Nháp → Chờ GV xác nhận → Đã duyệt → Đã phát hành */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, RotateCw } from 'lucide-react';
import { api } from '../../api/client';
import { useToastChuyenTrang } from '../../components/Toast';
import { Alert, Button, Loading, PageHeader, Seg } from '../../components/ui';
import { NHAN_TRANG_THAI_LICH } from '../../lib/format';

/** Nhãn trạng thái lịch dạng thang xám như màn hình QL-6-0 */
const XAM_LICH = { Nhap: 'g2', ChoGVXacNhan: 'g1', DaDuyet: 'g1', DaPhatHanh: 'g3' };
export function NhanLich({ trangThai }) {
  return <span className={`badge badge-${XAM_LICH[trangThai] || 'g2'}`}>{NHAN_TRANG_THAI_LICH[trangThai]}</span>;
}

const TABS = [
  { key: '', dem: 'TatCa', label: 'Tất cả' },
  { key: 'Nhap', dem: 'Nhap', label: 'Nháp' },
  { key: 'ChoGVXacNhan', dem: 'ChoGVXacNhan', label: 'Chờ GV xác nhận' },
  { key: 'DaDuyet', dem: 'DaDuyet', label: 'Đã duyệt' },
  { key: 'DaPhatHanh', dem: 'DaPhatHanh', label: 'Đã phát hành' },
];

export default function QuanLyLich() {
  const nav = useNavigate();
  const loc = useLocation();
  const [tab, setTab] = useState(loc.state?.tab || '');
  const [kq, setKq] = useState(null);
  const [loi, setLoi] = useState(null);

  useToastChuyenTrang();

  useEffect(() => {
    api('/quan-ly/quan-ly-lich').then((r) => setKq(r.data)).catch((e) => setLoi(e.message));
  }, []);

  const ds = kq ? kq.ds.filter((l) => !tab || l.trangThaiLich === tab) : [];
  const hanhDong = (l) => {
    const den = (duong) => () => nav(`/quan-ly/quan-ly-lich/${l.maLop}/${duong}`);
    switch (l.hanhDong) {
      case 'PhanCong': return <Button variant="outline" size="sm" onClick={den('phan-cong')}>Phân công lịch dạy</Button>;
      case 'PheDuyetVaPhatHanh': return <Button variant="outline" size="sm" onClick={den('phe-duyet')}>Phê duyệt và phát hành</Button>;
      case 'PhatHanh': return <Button variant="outline" size="sm" onClick={den('phe-duyet')}>Phát hành</Button>;
      default: return <Button variant="ghost" size="sm" style={{ color: 'var(--ink-500)' }} onClick={den('phe-duyet')}>Xem</Button>;
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy' }]}
        title="Quản lý lịch dạy"
        sub={<span className="row gap-6" style={{ display: 'inline-flex' }}>
          {['Nháp', 'Chờ GV xác nhận', 'Đã duyệt', 'Đã phát hành'].map((t, i) => (
            <span key={t} className="row gap-6">{i > 0 && <ArrowRight size={14} />}{t}</span>
          ))}
        </span>}
        actions={<>
          <Button variant="outline" icon={RotateCw} onClick={() => nav('/quan-ly/quan-ly-lich/tuan-toi')}>Tạo lịch tuần mới</Button>
          <Button icon={Plus} onClick={() => nav('/quan-ly/quan-ly-lich/tao')}>Tạo lịch dạy</Button>
        </>}
      />
      <Seg cream value={tab} onChange={setTab} items={TABS.map((t) => ({ key: t.key, label: t.label, count: kq ? kq.dem[t.dem] : undefined }))} />
      {loi && <div style={{ marginTop: 16 }}><Alert type="error">{loi}</Alert></div>}
      <div className="card flush" style={{ marginTop: 24 }}>
        {!kq && !loi && <Loading />}
        {kq && (
          <table className="table gray-head">
            <thead><tr><th>Lớp học</th><th>Lịch học</th><th>Giáo viên</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr></thead>
            <tbody>
              {ds.map((l) => (
                <tr key={l.maLop}>
                  <td className="cell-main">{l.tenLop}</td>
                  <td>{l.lichHoc}</td>
                  <td>{l.giaoVien === '–' ? '—' : l.giaoVien}</td>
                  <td><NhanLich trangThai={l.trangThaiLich} /></td>
                  <td className="t-right">{hanhDong(l)}</td>
                </tr>
              ))}
              {!ds.length && <tr><td colSpan={5} className="c-muted">Không có lịch dạy ở trạng thái này.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
