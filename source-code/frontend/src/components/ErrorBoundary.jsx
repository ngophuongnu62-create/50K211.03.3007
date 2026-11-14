/**
 * Lưới an toàn của giao diện: lỗi hiển thị bất ngờ ở một màn hình không làm trắng toàn bộ ứng dụng.
 * Người dùng thấy thông báo tiếng Việt và có thể tải lại / về trang chủ; lỗi tự xóa khi chuyển trang.
 */
import { Component } from 'react';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { loi: null };
  }

  static getDerivedStateFromError(loi) {
    return { loi };
  }

  componentDidCatch(loi, info) {
    // eslint-disable-next-line no-console
    console.error('Lỗi giao diện:', loi, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.loi && prev.khoaDatLai !== this.props.khoaDatLai) this.setState({ loi: null });
  }

  render() {
    if (!this.state.loi) return this.props.children;
    return (
      <div className="loading" role="alert" style={{ minHeight: '60vh', justifyContent: 'center' }}>
        <AlertTriangle size={40} color="var(--amber-icon)" />
        <div className="t-20 w-700" style={{ marginTop: 16 }}>Màn hình gặp sự cố khi hiển thị</div>
        <p className="t-15 c-muted" style={{ marginTop: 8, maxWidth: 460, textAlign: 'center' }}>
          Dữ liệu của bạn không bị ảnh hưởng. Vui lòng tải lại trang; nếu vẫn gặp lỗi, hãy liên hệ Quản lý trung tâm.
        </p>
        <div className="row gap-12" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}><RotateCw size={16} />Tải lại trang</button>
          <button type="button" className="btn btn-outline" onClick={() => { window.location.href = '/'; }}><Home size={16} />Về trang đầu</button>
        </div>
      </div>
    );
  }
}
