/**
 * MH24 – Kiểm tra trước khi phê duyệt (QL-6.4-a)
 * Phê duyệt thành công (QL-6.4-b), đã duyệt chờ phát hành (QL-6.4-c), phát hành thành công (QL-6.4-d),
 * 11.a chưa gửi được thông báo (QL-6.4-e), 6.a không phê duyệt được (QL-6.4-f), 10.a không phát hành được (QL-6.4-g).
 * Lịch "Đã phát hành" mở ở chế độ chỉ xem (MH19 – "Xem").
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, RotateCw } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../components/Toast';
import { Alert, Badge, Button, Loading, PageHeader, ThongBaoModal } from '../../components/ui';
import { MAU_TRANG_THAI_LICH, NHAN_HINH_THUC, NHAN_TRANG_THAI_LICH, vietTat } from '../../lib/format';

const NHAN_PHAN_HOI_GV = { DaXacNhan: 'Đã xác nhận', ChoXacNhan: 'Chờ phản hồi', DeXuatThayDoi: 'Đề xuất thay đổi', HetHan: 'Quá hạn phản hồi' };
const MAU_PHAN_HOI_GV = { DaXacNhan: 'green', ChoXacNhan: 'amber', DeXuatThayDoi: 'blue', HetHan: 'red' };
const sdtDep = (s = '') => s.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');

export default function PheDuyet() {
  const { maLop } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [kt, setKt] = useState(null);
  const [loi, setLoi] = useState(null);
  const [dang, setDang] = useState('');
  const [hop, setHop] = useState(null); // { tone, title, text }
  const [gui, setGui] = useState(null); // kết quả gửi thông báo lịch chính thức

  const tai = useCallback(() => api(`/quan-ly/quan-ly-lich/${maLop}/kiem-tra`).then((r) => setKt(r.data)).catch((e) => setLoi(e.message)), [maLop]);
  useEffect(() => { tai(); }, [tai]);

  const pheDuyet = async () => {
    setDang('duyet');
    try {
      await api(`/quan-ly/quan-ly-lich/${maLop}/phe-duyet`, { method: 'POST' });
      await tai();
      setHop({ tone: 'success', title: 'Phê duyệt lịch thành công!', text: 'Lịch chuyển sang “Đã duyệt” và đã ghi lịch sử phê duyệt. Bấm “Phát hành” để công bố lịch chính thức.' });
    } catch (e) {
      if (e.status === 409) setHop({ tone: 'error', title: e.message, text: 'Lịch giữ trạng thái trước khi duyệt.' });
      else setHop({ tone: 'error', title: 'Không phê duyệt được lịch. Vui lòng thử lại!', text: 'Lịch giữ trạng thái trước khi duyệt để bạn thử lại.' }); // 6.a
    } finally {
      setDang('');
    }
  };

  const phatHanh = async () => {
    setDang('phatHanh');
    try {
      const { data } = await api(`/quan-ly/quan-ly-lich/${maLop}/phat-hanh`, { method: 'POST' });
      setGui(data);
      await tai();
      if (!data.chuaGui?.length) setHop({ tone: 'success', title: 'Phát hành lịch dạy thành công!', text: 'Lịch chính thức đã gửi tới giáo viên và phụ huynh / học viên của lớp.' });
    } catch {
      setHop({ tone: 'error', title: 'Không phát hành được lịch. Vui lòng thử lại!', text: 'Lịch giữ trạng thái “Đã duyệt” để bạn bấm “Phát hành” lại.' }); // 10.a
    } finally {
      setDang('');
    }
  };

  const guiLai = async () => {
    setDang('guiLai');
    try {
      const { data } = await api(`/quan-ly/quan-ly-lich/${maLop}/gui-lai-thong-bao`, { method: 'POST', body: { dsNguoiNhan: gui.chuaGui } });
      setGui(data);
      if (!data.chuaGui?.length) toast({ title: 'Đã gửi lại thông báo lịch chính thức.' });
    } catch (e) {
      toast({ type: 'error', title: e.message });
    } finally {
      setDang('');
    }
  };

  const phanCongLai = async () => {
    setDang('pcl');
    try {
      await api(`/quan-ly/quan-ly-lich/${maLop}/phan-cong-lai`, { method: 'POST' }); // 5.a: đưa lịch về "Nháp"
      nav(`/quan-ly/quan-ly-lich/${maLop}/phan-cong`);
    } catch (e) {
      toast({ type: 'error', title: e.message });
      setDang('');
    }
  };

  const crumbs = [{ label: 'Trang chủ', to: '/quan-ly' }, { label: 'Quản lý lịch dạy', to: '/quan-ly/quan-ly-lich' }, { label: 'Phê duyệt và phát hành' }];
  if (loi) return <><PageHeader crumbs={crumbs} title="Phê duyệt và phát hành" /><Alert type="error">{loi}</Alert></>;
  if (!kt) return <Loading />;

  const tt = kt.trangThaiLich;
  const gv = kt.nhanSu.filter((n) => n.vaiTro === 'GiaoVien');
  const xd = kt.xungDot;
  const mucKT = [
    ['Trùng giáo viên', xd.trungGiaoVien], ['Trùng phòng học', xd.trungPhong], ['Sai lịch rảnh', xd.saiLichRanh],
  ];

  return (
    <>
      <PageHeader crumbs={crumbs} title="Phê duyệt và phát hành" sub={kt.lichHoc}
        actions={tt === 'ChoGVXacNhan' ? <>
          <Button variant="outline" loading={dang === 'pcl'} onClick={phanCongLai}>Phân công lại</Button>
          <Button icon={Check} loading={dang === 'duyet'} onClick={pheDuyet}>Phê duyệt</Button>
        </> : tt === 'DaDuyet' ? <>
          <Button variant="outline" onClick={() => nav('/quan-ly/quan-ly-lich')}>Đóng</Button>
          <Button loading={dang === 'phatHanh'} onClick={phatHanh}>Phát hành</Button>
        </> : <Button variant="outline" onClick={() => nav('/quan-ly/quan-ly-lich')}>Đóng</Button>}
      />
      {tt === 'ChoGVXacNhan' && !kt.coThePheDuyet && (
        <div style={{ marginBottom: 16 }}><Alert type="warning">Lịch chưa có phản hồi xác nhận của giáo viên, chưa thể phê duyệt.</Alert></div>
      )}
      <div className="row gap-16" style={{ alignItems: 'stretch' }}>
        <section className="card" style={{ flex: 1, padding: 24 }}>
          <div className="row between">
            <div className="card-title">Giáo viên được phân công</div>
            <Badge tone={MAU_TRANG_THAI_LICH[tt]}>{NHAN_TRANG_THAI_LICH[tt]}</Badge>
          </div>
          {gv.map((g) => (
            <div key={g.maNhanSu} className="row gap-14" style={{ marginTop: 14 }}>
              <span className="avatar gray" style={{ width: 40, height: 40 }}>{vietTat(g.hoTen)}</span>
              <div className="grow">
                <div className="gv-ten">{g.hoTen}</div>
                <div className="gv-mota">{[g.chuyenMon[0], NHAN_HINH_THUC[g.hinhThucLamViec]].filter(Boolean).join(' · ')}</div>
              </div>
              <Badge tone={MAU_PHAN_HOI_GV[g.trangThaiPhanHoi]}>{NHAN_PHAN_HOI_GV[g.trangThaiPhanHoi] || g.trangThaiPhanHoi}</Badge>
            </div>
          ))}
          {!gv.length && <div className="c-muted t-13 mt-16">Chưa có giáo viên được phân công.</div>}
        </section>
        <section className="card" style={{ flex: 1, padding: 24 }}>
          <div className="card-title">Phản hồi phụ huynh / học viên</div>
          <div className="row" style={{ gap: 32, marginTop: 14 }}>
            {[['Đã xác nhận', kt.phuHuynh.daXacNhan], ['Từ chối', kt.phuHuynh.tuChoi], ['Chưa phản hồi', kt.phuHuynh.chuaPhanHoi]].map(([n, v]) => (
              <div key={n}><div style={{ fontSize: 22, fontWeight: 700, lineHeight: '28px' }}>{v}</div><div className="t-12 c-muted">{n}</div></div>
            ))}
          </div>
          {kt.phuHuynh.dsTuChoi.length > 0 && (
            <div className="t-12 mt-8" style={{ color: 'var(--danger-900)' }}>
              {kt.phuHuynh.dsTuChoi.slice(0, 3).map((x) => `${x.tenHocVien}: ${x.lyDoTuChoi || 'không nêu lý do'}`).join(' · ')}
            </div>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 24, padding: '24px 24px 8px' }}>
        <div className="card-title">Kết quả kiểm tra trùng lịch</div>
        <div style={{ marginTop: 6 }}>
          {mucKT.map(([ten, ds], i) => (
            <div key={ten} className="row between" style={{ padding: '16px 0', borderTop: i ? '1px solid var(--line)' : 'none' }}>
              <div className="row gap-12">
                {ds.length ? <AlertTriangle size={20} color="var(--brand)" /> : <CheckCircle2 size={20} color="#21a559" />}
                <span className="t-14">{ten}</span>
              </div>
              <span className="t-13 w-600" style={{ color: ds.length ? 'var(--brand)' : 'var(--green-800)' }}>
                {ds.length ? `${ds.length} buổi` : 'Không có'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {gui && (
        <section className="card" style={{ marginTop: 24, padding: 24 }}>
          <div className="card-title">Gửi thông báo lịch chính thức</div>
          <div className="t-13 c-muted mt-4">Giáo viên được phân công và phụ huynh có học viên thuộc lớp</div>
          {gui.chuaGui?.length ? (
            <>
              <div style={{ marginTop: 14 }}>
                <Alert type="warning" action={<Button variant="outline" size="sm" icon={RotateCw} loading={dang === 'guiLai'} onClick={guiLai}>Gửi lại</Button>}>
                  {gui.chuaGui.filter((n) => n.maPHHV).length} phụ huynh chưa được gửi thông báo. Lịch vẫn giữ trạng thái “Đã phát hành”.
                </Alert>
              </div>
              <table className="table" style={{ marginTop: 14 }}>
                <thead><tr><th>Người nhận</th><th>Số điện thoại</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {gui.chuaGui.map((n) => (
                    <tr key={n.maNguoiNhan || n.maPHHV}>
                      <td>{n.maPHHV ? `PH ${n.hoTen}` : n.hoTen}</td>
                      <td>{n.soDienThoai ? sdtDep(n.soDienThoai) : '—'}</td>
                      <td><Badge tone="red">Chưa gửi</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="row" style={{ gap: 48, marginTop: 14 }}>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{gui.daGuiNhanSu} / {gui.soNhanSu}</div><div className="t-12 c-muted">Giáo viên đã nhận</div></div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>{gui.daGuiPhuHuynh} / {gui.soPhuHuynh}</div><div className="t-12 c-muted">Phụ huynh đã nhận</div></div>
            </div>
          )}
        </section>
      )}

      <ThongBaoModal open={!!hop} tone={hop?.tone} onClose={() => setHop(null)} title={hop?.title} text={hop?.text}
        footer={<Button onClick={() => setHop(null)}>OK</Button>} />
    </>
  );
}
