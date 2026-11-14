/** Dải cảnh báo khi thiết bị mất kết nối mạng – người dùng biết vì sao thao tác chưa lưu được. */
import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function TrangThaiMang() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const bat = () => setOnline(true);
    const tat = () => setOnline(false);
    window.addEventListener('online', bat);
    window.addEventListener('offline', tat);
    return () => {
      window.removeEventListener('online', bat);
      window.removeEventListener('offline', tat);
    };
  }, []);
  if (online) return null;
  return (
    <div className="alert alert-warning" role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1000, boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,.12))' }}>
      <WifiOff size={20} />
      <div className="grow">Mất kết nối mạng. Các thao tác sẽ không được lưu cho đến khi có mạng trở lại.</div>
    </div>
  );
}
