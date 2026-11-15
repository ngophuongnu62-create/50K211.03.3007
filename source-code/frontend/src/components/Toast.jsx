/** Thông báo nổi góc phải (thành công / lỗi / cảnh báo) – theo mẫu Figma QL-2.2-d, QL-3.2-e… */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);
let dem = 0;

export function ToastProvider({ children }) {
  const [ds, setDs] = useState([]);
  const dong = useCallback((id) => setDs((x) => x.filter((t) => t.id !== id)), []);
  const hien = useCallback((t) => {
    const id = ++dem;
    setDs((x) => [...x, { id, type: 'success', ...t }]);
    setTimeout(() => dong(id), t.thoiGian || 5000);
  }, [dong]);
  return (
    <ToastContext.Provider value={hien}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {ds.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={22} color="var(--green-500)" />}
            {t.type === 'error' && <XCircle size={22} color="var(--danger)" />}
            {t.type === 'warning' && <AlertTriangle size={22} color="var(--amber-icon)" />}
            <div className="grow">
              <div className="toast-title">{t.title}</div>
              {t.text && <div className="toast-text">{t.text}</div>}
            </div>
            <button className="toast-close" onClick={() => dong(t.id)} aria-label="Đóng"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);

/**
 * Hiện thông báo được gửi kèm khi chuyển trang (location.state.toast) đúng một lần,
 * rồi xóa khỏi state để tải lại trang không hiện lại.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useToastChuyenTrang() {
  const loc = useLocation();
  const nav = useNavigate();
  const hien = useContext(ToastContext);
  const daHien = useRef(null);
  useEffect(() => {
    if (!loc.state?.toast || daHien.current === loc.key) return;
    daHien.current = loc.key;
    hien(loc.state.toast);
    const { toast: _daHien, ...conLai } = loc.state;
    nav(loc.pathname + loc.search, { replace: true, state: Object.keys(conLai).length ? conLai : null });
  }, [loc, nav, hien]);
}
