/** MH04 – Trang chủ Quản lý (QL-00) */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarCheck, DoorOpen, MessageSquare, Plus } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Loading, PageHeader, StatCard, useTai } from '../../components/ui';
import { MAU_TRANG_THAI_LICH, NHAN_TRANG_THAI_LICH } from '../../lib/format';

const NUT_LICH = {
  Nhap: { nhan: 'Phân công', duong: (m) => `/quan-ly/quan-ly-lich/${m}/phan-cong` },
  ChoGVXacNhan: { nhan: 'Xem', duong: (m) => `/quan-ly/quan-ly-lich/${m}/phe-duyet` },
  DaDuyet: { nhan: 'Phát hành', duong: (m) => `/quan-ly/quan-ly-lich/${m}/phe-duyet` },
};

export default function TrangChu() {
  const { phien } = useAuth();
  const nav = useNavigate();
  const { data, loading, error } = useTai(() => api('/quan-ly/tong-quan'));
  const [xemHet, setXemHet] = useState(false);

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Trang chủ' }]}
        title={`Xin chào, ${phien?.nguoiDung?.hoTen || ''}`}
        sub={data?.homNay}
        actions={<Button icon={Plus} onClick={() => nav('/quan-ly/quan-ly-lich/tao')}>Tạo lịch dạy</Button>}
      />
      {loading && <Loading />}
      {error && <Alert type="error">{error.message}</Alert>}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 28 - 24 }}>
            <StatCard label="Lịch chờ phê duyệt" value={data.thongKe.lichChoPheDuyet} icon={CalendarCheck} />
            <StatCard label="Phản hồi chờ xử lý" value={data.thongKe.phanHoiChoXuLy} icon={MessageSquare} />
            <StatCard label="Xung đột cần xử lý" value={data.thongKe.xungDotCanXuLy} icon={AlertTriangle} />
            <StatCard label="Phòng trống hôm nay" value={`${data.thongKe.phongTrongHomNay.trong} / ${data.thongKe.phongTrongHomNay.tong}`} icon={DoorOpen} />
          </div>

          <section className="card" style={{ marginTop: 28 }}>
            <div className="row between">
              <div>
                <div className="card-title">Cảnh báo xung đột lịch dạy</div>
                <div className="card-sub">Hệ thống tự phát hiện khi lập và phân công lịch</div>
              </div>
              {data.canhBaoXungDot.length > 0 && ( // Figma QL-00: luôn có “Xem tất cả”
                <button className="btn-link" onClick={() => setXemHet((x) => !x)}>{xemHet ? 'Thu gọn' : 'Xem tất cả'}</button>
              )}
            </div>
            <div style={{ marginTop: 4 }}>
              {!data.canhBaoXungDot.length && <div className="t-14 c-muted" style={{ padding: '16px 0 0' }}>Không có xung đột nào.</div>}
              {(xemHet ? data.canhBaoXungDot : data.canhBaoXungDot.slice(0, 3)).map((c) => (
                <div key={`${c.loai}-${c.maLichDay}-${c.moTa}`} className="list-row">
                  <AlertTriangle size={20} color="var(--danger)" />
                  <div className="grow">
                    <div className="t-14 w-600">{c.tieuDe}</div>
                    <div className="t-13 c-muted" style={{ marginTop: 2 }}>{c.moTa}</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => nav(`/quan-ly/quan-ly-lich/${c.maLop}/phe-duyet${c.trangThaiLich ? `?trangThai=${c.trangThaiLich}` : ''}`)}>Xử lý</Button>
                </div>
              ))}
            </div>
          </section>

          <section className="card" style={{ marginTop: 28 }}>
            <div className="row between">
              <div className="card-title">Lịch dạy cần xử lý</div>
              <Link to="/quan-ly/quan-ly-lich" className="btn-link row gap-4">Quản lý lịch dạy<ArrowRight size={16} /></Link>
            </div>
            <table className="table" style={{ marginTop: 16 }}>
              <thead>
                <tr><th style={{ width: 312 }}>Lớp học</th><th style={{ width: 280 }}>Thời gian</th><th style={{ width: 220 }}>Trạng thái</th><th aria-label="Thao tác" /></tr>
              </thead>
              <tbody>
                {data.lichDayCanXuLy.map((l) => (
                  <tr key={`${l.maLop}-${l.trangThaiLich}`} style={{ height: 56 }}>
                    <td className="w-600">{l.tenLop}</td>
                    <td className="c-ink-700">{l.lichHoc}</td>
                    <td><Badge tone={MAU_TRANG_THAI_LICH[l.trangThaiLich]}>{NHAN_TRANG_THAI_LICH[l.trangThaiLich]}</Badge></td>
                    <td className="t-right">
                      <Button variant="outline" size="sm" onClick={() => nav(NUT_LICH[l.trangThaiLich].duong(l.maLop))}>{NUT_LICH[l.trangThaiLich].nhan}</Button>
                    </td>
                  </tr>
                ))}
                {!data.lichDayCanXuLy.length && <tr><td colSpan={4} className="c-muted">Không có lịch cần xử lý.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
