import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import './styles/base.css';
import './styles/components.css';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import { LangProvider } from './lib/lang';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import TrangThaiMang from './components/TrangThaiMang';

/** Lỗi hiển thị ở một màn hình tự được xóa khi người dùng chuyển sang trang khác */
function KhungAnToan({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary khoaDatLai={pathname}>{children}</ErrorBoundary>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <LangProvider>
          <ToastProvider>
            <KhungAnToan>
              <App />
            </KhungAnToan>
            <TrangThaiMang />
          </ToastProvider>
        </LangProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
