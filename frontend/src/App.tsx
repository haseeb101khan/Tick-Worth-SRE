import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { WhatsAppFab } from './components/WhatsAppFab';
import { RequireRole, STAFF_ROLES } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { ProductsPage } from './pages/ProductsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { BrandPage } from './pages/BrandPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { StaffLoginPage } from './pages/StaffLoginPage';
import { CartPage } from './pages/CartPage';
import { OrderHistoryPage } from './pages/OrderHistoryPage';
import { DashboardPage } from './pages/DashboardPage';

// Public storefront chrome: fixed navbar + footer around the customer-facing routes.
function StorefrontLayout() {
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith('/dashboard');

  return (
    <div className="flex min-h-screen flex-col bg-ivory text-ink">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ProductsPage />} />
          <Route path="/shop/:id" element={<ProductDetailPage />} />
          <Route path="/brand/:slug" element={<BrandPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/orders"
            element={
              <RequireRole roles={['CUSTOMER']}>
                <OrderHistoryPage />
              </RequireRole>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireRole roles={STAFF_ROLES}>
                <DashboardPage />
              </RequireRole>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
      <WhatsAppFab />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          {/* Staff portal is a separate door — no storefront navbar/footer. */}
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route path="/*" element={<StorefrontLayout />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
