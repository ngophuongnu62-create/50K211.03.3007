/** Thành phần giao diện dùng chung – theo mẫu Figma. */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Info, Loader2, Lock, X, XCircle, CalendarCheck } from 'lucide-react';
import { congNgay, dauTuan, ddmm, ddmmyyyy, homNay, nhanNgay } from '../lib/format';

/* ---------- Tiêu đề trang ---------- */
export function PageHeader({ crumbs = [], title, sub, actions }) {
  return (
    <div className="page-head">
      <div>
        {crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Đường dẫn">
            {crumbs.map((c, i) => (
              <span key={c.label} className="row gap-8">
                {i > 0 && <ChevronRight size={14} />}
                {c.to ? <Link to={c.to}>{c.label}</Link> : <span className={i === crumbs.length - 1 ? 'last' : ''}>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="row gap-12">{actions}</div>}
    </div>
  );
}

/* ---------- Nút ---------- */
/**
 * Nút bấm dùng chung – chống bấm đúp (double-click submit):
 * nếu onClick trả về Promise (gọi API), nút tự khóa và hiện vòng xoay cho tới khi xử lý xong;
 * các lần bấm trong lúc đang xử lý bị bỏ qua (khóa bằng ref nên chặn được cả 2 cú bấm liên tiếp rất nhanh).
 */
export function Button({ variant = 'primary', size, block, loading, disabled, icon: Icon, iconRight: IconRight, children, className = '', onClick, ...props }) {
  const dangXuLyRef = useRef(false);
  const [dangXuLy, setDangXuLy] = useState(false);
  const conGan = useRef(true);
  useEffect(() => () => { conGan.current = false; }, []);
  const ban = loading || dangXuLy;
  const xuLyBam = onClick && ((e) => {
    if (dangXuLyRef.current || loading) {
      e.preventDefault();
      return undefined;
    }
    const kq = onClick(e);
    if (kq && typeof kq.then === 'function') {
      dangXuLyRef.current = true;
      setDangXuLy(true);
      const xong = () => {
        dangXuLyRef.current = false;
        if (conGan.current) setDangXuLy(false);
      };
      kq.then(xong, xong);
    }
    return kq;
  });
  return (
    <button
      type="button"
      className={`btn btn-${variant} ${size || ''} ${block ? 'block' : ''} ${className}`}
      {...props}
      disabled={ban || disabled}
      aria-busy={ban || undefined}
      onClick={xuLyBam}
    >
      {ban ? <Loader2 size={16} className="spin" /> : Icon && <Icon size={16} />}
      {children}
      {IconRight && <IconRight size={16} />}
    </button>
  );
}

/* ---------- Trường biểu mẫu ---------- */
export function Field({ label, required, error, hint, counter, children, strong }) {
  return (
    <div className="field">
      {label && (
        <label className={`label ${strong ? 'strong' : ''}`}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error && (
        <div className="field-error"><AlertCircle size={14} />{error}</div>
      )}
      {!error && hint && <div className="hint">{hint}</div>}
      {counter}
    </div>
  );
}

export function TextInput({ icon: Icon, error, right, size, disabled, ...props }) {
  return (
    <div className={`control ${size || ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
      {Icon && <Icon size={18} className="ico" />}
      <input disabled={disabled} {...props} />
      {right}
    </div>
  );
}

export function TextArea({ error, max = 500, value = '', onChange, rows = 4, ...props }) {
  return (
    <>
      <div className={`control textarea ${error ? 'error' : ''}`}>
        <textarea value={value} onChange={onChange} maxLength={max} rows={rows} {...props} />
      </div>
      <div className="counter">{value.length} / {max}</div>
    </>
  );
}

/* Đóng popup khi bấm ra ngoài */
function useClickOutside(ref, onOutside) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, onOutside]);
}

/** Danh sách chọn có dấu tích (Figma QL-4.2-a) */
export function Select({ value, onChange, options = [], placeholder = 'Chọn', error, size, disabled }) {
  const [mo, setMo] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setMo(false));
  const chon = options.find((o) => String(o.value) === String(value));
  return (
    <div ref={ref} className={`control ${size || ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`} style={mo ? { borderColor: 'var(--amber-icon)' } : undefined}>
      <button type="button" className="select-trigger" onClick={() => !disabled && setMo((m) => !m)} disabled={disabled} aria-haspopup="listbox" aria-expanded={mo}>
        <span className={chon ? '' : 'ph'}>{chon ? chon.label : placeholder}</span>
        <ChevronDown size={18} className="ico" />
      </button>
      {mo && (
        <div className="select-pop" role="listbox">
          {options.map((o) => (
            <div
              key={o.value}
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={`select-opt ${String(o.value) === String(value) ? 'on' : ''}`}
              onClick={() => { onChange(o.value); setMo(false); }}
            >
              <span>{o.label}</span>
              {String(o.value) === String(value) && <Check size={16} />}
            </div>
          ))}
          {!options.length && <div className="select-opt c-muted">Không có lựa chọn</div>}
        </div>
      )}
    </div>
  );
}

const THANG = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

/** Chọn ngày bằng lịch tháng (Figma QL-2.1-a) */
export function DatePicker({ value, onChange, error, size, min, placeholder = 'Chọn ngày' }) {
  const [mo, setMo] = useState(false);
  const [thang, setThang] = useState(() => (value || homNay()).slice(0, 7));
  const ref = useRef(null);
  useClickOutside(ref, () => setMo(false));
  const dau = `${thang}-01`;
  const [y, m] = thang.split('-').map(Number);
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lech = (new Date(`${dau}T00:00:00Z`).getUTCDay() + 6) % 7;
  const o = Array.from({ length: lech }, () => null).concat(Array.from({ length: soNgay }, (_, i) => `${thang}-${String(i + 1).padStart(2, '0')}`));
  const doiThang = (n) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setThang(d.toISOString().slice(0, 7));
  };
  const today = homNay();
  return (
    <div ref={ref} className={`control ${size || ''} ${error ? 'error' : ''}`} style={mo ? { borderColor: 'var(--amber-icon)' } : undefined}>
      <button type="button" className="select-trigger" onClick={() => setMo((x) => !x)}>
        <span className={value ? '' : 'ph'}>{value ? nhanNgay(value) : placeholder}</span>
        <CalendarDays size={18} className="ico" />
      </button>
      {mo && (
        <div className="cal">
          <div className="cal-head">
            <button type="button" onClick={() => doiThang(-1)} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
            <div className="cal-title">{THANG[m - 1]}, {y}</div>
            <button type="button" onClick={() => doiThang(1)} aria-label="Tháng sau"><ChevronRight size={18} /></button>
          </div>
          <div className="cal-grid">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((t) => <div key={t} className="cal-dow">{t}</div>)}
            {o.map((d, i) => (d ? (
              <button
                type="button"
                key={d}
                className={`cal-day ${d === value ? 'on' : ''} ${d === today ? 'today' : ''}`}
                disabled={min && d < min}
                onClick={() => { onChange(d); setMo(false); }}
              >
                {Number(d.slice(8))}
              </button>
            ) : <span key={`x${i}`} />))}
          </div>
          <div className="cal-foot">
            <span>{value ? `Đã chọn: ${nhanNgay(value)}` : ''}</span>
            <button type="button" onClick={() => { onChange(today); setThang(today.slice(0, 7)); setMo(false); }}>Hôm nay</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Chọn khoảng ngày "09/11 → 15/11/2026" (Figma QL-5-a): lần bấm 1 = từ ngày, lần bấm 2 = đến ngày */
/** motNgay: ô "Thời gian sử dụng" (Figma QL-2.1-a/c) – một ngày hiển thị "Thứ Ba, 10/11/2026", chân lịch "Đã chọn: …" + "Hôm nay" */
export function DateRangePicker({ tuNgay, denNgay, onChange, error, size, motNgay, placeholder = 'Chọn khoảng thời gian' }) {
  const [mo, setMo] = useState(false);
  const [buoc, setBuoc] = useState(0);
  const [thang, setThang] = useState(() => (tuNgay || homNay()).slice(0, 7));
  const ref = useRef(null);
  useClickOutside(ref, () => { setMo(false); setBuoc(0); });
  const [y, m] = thang.split('-').map(Number);
  const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lech = (new Date(`${thang}-01T00:00:00Z`).getUTCDay() + 6) % 7;
  const o = Array.from({ length: lech }, () => null).concat(Array.from({ length: soNgay }, (_, i) => `${thang}-${String(i + 1).padStart(2, '0')}`));
  const doiThang = (n) => setThang(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7));
  const chon = (d) => {
    if (buoc === 0) { onChange({ tuNgay: d, denNgay: '' }); setBuoc(1); } else { onChange({ tuNgay, denNgay: d }); setBuoc(0); setMo(false); }
  };
  const ngan = tuNgay && denNgay && tuNgay.slice(0, 4) === denNgay.slice(0, 4); // Figma QL-2.1-c: "12/11 → 09/11/2026"
  const mot = motNgay && tuNgay && (!denNgay || denNgay === tuNgay);
  const nhan = !tuNgay ? '' : mot ? nhanNgay(tuNgay) : `${ngan ? ddmm(tuNgay) : ddmmyyyy(tuNgay)} → ${denNgay ? ddmmyyyy(denNgay) : '…'}`;
  const [a, b] = tuNgay && denNgay && tuNgay > denNgay ? [denNgay, tuNgay] : [tuNgay, denNgay];
  const today = homNay();
  return (
    <div ref={ref} className={`control ${size || ''} ${error ? 'error' : ''}`} style={mo ? { borderColor: 'var(--amber-icon)' } : undefined}>
      <button type="button" className="select-trigger" onClick={() => setMo((x) => !x)}>
        <span className={nhan ? '' : 'ph'}>{nhan || placeholder}</span>
        <CalendarDays size={18} className="ico" />
      </button>
      {mo && (
        <div className="cal">
          <div className="cal-head">
            <button type="button" onClick={() => doiThang(-1)} aria-label="Tháng trước"><ChevronLeft size={18} /></button>
            <div className="cal-title">{THANG[m - 1]}, {y}</div>
            <button type="button" onClick={() => doiThang(1)} aria-label="Tháng sau"><ChevronRight size={18} /></button>
          </div>
          <div className="cal-grid">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((t) => <div key={t} className="cal-dow">{t}</div>)}
            {o.map((d, i) => (d ? (
              <button type="button" key={d} onClick={() => chon(d)}
                className={`cal-day ${d === tuNgay || d === denNgay ? 'on' : ''} ${a && b && d > a && d < b ? 'range' : ''} ${d === today ? 'today' : ''}`}>
                {Number(d.slice(8))}
              </button>
            ) : <span key={`x${i}`} />))}
          </div>
          {motNgay ? (
            <div className="cal-foot">
              <span>{nhan ? `Đã chọn: ${nhan}` : ''}</span>
              <button type="button" onClick={() => { onChange({ tuNgay: today, denNgay: today }); setThang(today.slice(0, 7)); setBuoc(0); setMo(false); }}>Hôm nay</button>
            </div>
          ) : <div className="cal-foot">
            <span>{buoc === 1 ? 'Chọn ngày kết thúc' : 'Chọn ngày bắt đầu'}</span>
            <button type="button" onClick={() => { const t = dauTuan(today); onChange({ tuNgay: t, denNgay: congNgay(t, 6) }); setThang(t.slice(0, 7)); setBuoc(0); setMo(false); }}>Tuần này</button>
          </div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Thông báo trong trang ---------- */
const ICON_ALERT = { error: AlertCircle, warning: AlertTriangle, success: CheckCircle2, info: Info };
export function Alert({ type = 'error', title, children, action }) {
  const Icon = ICON_ALERT[type];
  return (
    <div className={`alert alert-${type}${action ? ' co-nut' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon size={20} />
      <div className="grow">
        {title && <div className="alert-title">{title}</div>}
        {children && <div>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = 'gray', children, icon: Icon }) {
  return <span className={`badge badge-${tone}`}>{Icon && <Icon size={12} />}{children}</span>;
}

/* ---------- Tab dạng nút gạt ---------- */
export function Seg({ items, value, onChange, cream }) {
  return (
    <div className={`seg ${cream ? 'cream' : ''}`} role="tablist">
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={value === it.key} className={value === it.key ? 'on' : ''} onClick={() => onChange(it.key)}>
          {it.label}
          {it.count !== undefined && <span className="count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Hộp thoại ---------- */
export function Modal({ open, onClose, title, sub, children, footer, wide, icon, style }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} style={style}>
        {icon}
        {(title || onClose) && (
          <div className="modal-head">
            <div>
              {title && <div className="modal-title">{title}</div>}
              {sub && <div className="modal-sub">{sub}</div>}
            </div>
            {onClose && <button className="modal-x" onClick={onClose} aria-label="Đóng"><X size={20} /></button>}
          </div>
        )}
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Trạng thái trống / đang tải ---------- */
/** Hộp thoại kết quả có biểu tượng bên trái (Figma QL-6.1-e/f/g): tone = success | error | warning */
const ICON_KQ = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, 'warning-red': AlertTriangle, info: Info, lock: Lock, 'x-circle': XCircle, pink: CalendarCheck };
export function ThongBaoModal({ open, onClose, tone = 'success', icon, width, title, text, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const Icon = icon || ICON_KQ[tone];
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal tb-modal" role="alertdialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined}>
        <div className="row gap-14" style={{ alignItems: 'flex-start' }}>
          <span className={`tb-icon ${tone}`}><Icon size={22} /></span>
          <div className="grow">
            <div className="tb-title">{title}</div>
            {text && <div className="tb-text">{text}</div>}
            {children}
          </div>
          {onClose && <button className="modal-x" onClick={onClose} aria-label="Đóng"><X size={20} /></button>}
        </div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon = Info, title, text, action, cream }) {
  return (
    <div className="empty">
      <div className={`empty-icon ${cream ? 'cream' : ''}`}><Icon size={28} /></div>
      {title && <div className="empty-title">{title}</div>}
      {text && <div className="empty-text">{text}</div>}
      {action && <div>{action}</div>}
    </div>
  );
}

export function Loading({ text = 'Đang tải…' }) {
  return <div className="loading"><Loader2 size={20} className="spin" style={{ animation: 'spin .8s linear infinite' }} /><div className="mt-8">{text}</div></div>;
}

export function StatCard({ label, value, icon: Icon, children }) {
  return (
    <div className="stat">
      <div className="stat-label"><span>{label}</span>{Icon && <Icon size={20} color="var(--ink-300)" />}</div>
      <div className="stat-value">{value}</div>
      {children}
    </div>
  );
}

/** Nút chuyển tuần ‹ Tuần 09/11 – 15/11/2026 › */
export function WeekNav({ tuNgay, onChange }) {
  const den = congNgay(tuNgay, 6);
  return (
    <div className="row gap-12">
      <button type="button" className="btn btn-outline sm" style={{ width: 34, padding: 0 }} onClick={() => onChange(congNgay(tuNgay, -7))} aria-label="Tuần trước"><ChevronLeft size={16} /></button>
      <div className="t-16 w-700">Tuần {tuNgay.slice(8, 10)}/{tuNgay.slice(5, 7)} – {den.slice(8, 10)}/{den.slice(5, 7)}/{den.slice(0, 4)}</div>
      <button type="button" className="btn btn-outline sm" style={{ width: 34, padding: 0 }} onClick={() => onChange(congNgay(tuNgay, 7))} aria-label="Tuần sau"><ChevronRight size={16} /></button>
    </div>
  );
}

/** Dùng chung để gọi API trong màn hình: { data, loading, error, reload } */
export function useTai(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null, message: null });
  const [lan, setLan] = useState(0);
  useEffect(() => {
    let huy = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((r) => !huy && setState({ data: r.data, message: r.message, loading: false, error: null }))
      .catch((e) => !huy && setState({ data: null, message: null, loading: false, error: e }));
    return () => { huy = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, lan]);
  return { ...state, reload: () => setLan((x) => x + 1) };
}
