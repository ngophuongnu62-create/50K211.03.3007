/** MH40 – Lịch sử phản hồi (PH-14-e) */
import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Empty, Loading, PageHeader, useTai } from '../../components/ui';
import { ddmmyyyy, NHAN_LOAI_PHAN_HOI, ngayCua } from '../../lib/format';
import { MAU_CONG_KHAI } from './TraCuuPhieu';

export default function LichSuPhanHoi() {
  const nav = useNavigate();
  const { phien } = useAuth();
  const { data: ds, error } = useTai(() => api('/phu-huynh/gop-y'), []);
  return (
    <>
      <PageHeader crumbs={[{ label: 'Tra cứu phiếu', to: '/phu-huynh/tra-cuu-phieu' }, { label: 'Lịch sử phản hồi' }]}
        title="Lịch sử phản hồi" sub={`Các phiếu đã gửi bằng thông tin học viên ${phien.hocVien.tenHocVien}.`} />
      {error && <Alert type="error">{error.message}</Alert>}
      <div className="card flush">
        {!ds && !error && <Loading />}
        {ds && !ds.length && <div><Empty cream icon={MessageSquare} title="Chưa có phiếu phản hồi nào." /></div>}
        {ds?.length > 0 && (
          <table className="table">
            <thead><tr><th style={{ width: 183 }}>Mã phiếu</th><th style={{ width: 424 }}>Tiêu đề</th><th style={{ width: 200 }}>Phân loại</th><th style={{ width: 140 }}>Ngày gửi</th><th>Tiến độ</th></tr></thead>
            <tbody>
              {ds.map((p) => (
                <tr key={p.maPhieu} className="clickable" onClick={() => nav(`/phu-huynh/tra-cuu-phieu?ma=${p.maPhieu}`)}>
                  <td className="w-600">{p.maPhieu}</td>
                  <td>{p.tieuDe}</td>
                  <td>{NHAN_LOAI_PHAN_HOI[p.loaiPhanHoi]}</td>
                  <td>{ddmmyyyy(ngayCua(p.thoiGianGui))}</td>
                  <td><Badge tone={MAU_CONG_KHAI[p.trangThaiXuLy]}>{p.nhanTrangThai}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
