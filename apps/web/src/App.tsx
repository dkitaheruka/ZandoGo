import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProductListPage } from './pages/ProductListPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrdersListPage } from './pages/OrdersListPage';
import { ChatPage } from './pages/ChatPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { KycPage } from './pages/KycPage';
import { RequireAuth } from './components/RequireAuth';
import { VendorDashboardPage } from './pages/vendor/VendorDashboardPage';
import { CreateStorePage } from './pages/vendor/CreateStorePage';
import { StoreProductsPage } from './pages/vendor/StoreProductsPage';
import { CreateProductPage } from './pages/vendor/CreateProductPage';
import { AdminHomePage } from './pages/admin/AdminHomePage';
import { KycReviewPage } from './pages/admin/KycReviewPage';
import { StoresReviewPage } from './pages/admin/StoresReviewPage';
import { DisputesPage } from './pages/admin/DisputesPage';
import { ExchangeRatePage } from './pages/admin/ExchangeRatePage';
import { AgentsReviewPage } from './pages/admin/AgentsReviewPage';
import { DeliveryHomePage } from './pages/delivery/DeliveryHomePage';
import { VendorNegotiationsPage } from './pages/vendor/VendorNegotiationsPage';
import { VendorOrdersPage } from './pages/vendor/VendorOrdersPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/products" element={<ProductListPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
        <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
        <Route path="/orders" element={<RequireAuth><OrdersListPage /></RequireAuth>} />
        <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
        <Route path="/orders/:orderId/tracking" element={<RequireAuth><OrderTrackingPage /></RequireAuth>} />
        <Route path="/kyc" element={<RequireAuth><KycPage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/vendor" element={<RequireAuth><VendorDashboardPage /></RequireAuth>} />
        <Route path="/vendor/new" element={<RequireAuth><CreateStorePage /></RequireAuth>} />
        <Route
          path="/vendor/:storeId/products"
          element={
            <RequireAuth requireRole={['VENDOR_OWNER', 'VENDOR_STAFF']}>
              <StoreProductsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/vendor/:storeId/products/new"
          element={
            <RequireAuth requireRole={['VENDOR_OWNER', 'VENDOR_STAFF']}>
              <CreateProductPage />
            </RequireAuth>
          }
        />
        <Route
          path="/vendor/:storeId/negotiations"
          element={
            <RequireAuth requireRole={['VENDOR_OWNER', 'VENDOR_STAFF']}>
              <VendorNegotiationsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/vendor/:storeId/orders"
          element={
            <RequireAuth requireRole={['VENDOR_OWNER', 'VENDOR_STAFF']}>
              <VendorOrdersPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <AdminHomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/kyc"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <KycReviewPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/stores"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <StoresReviewPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/disputes"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <DisputesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/exchange-rate"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <ExchangeRatePage />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/agents"
          element={
            <RequireAuth requireRole={['ADMIN', 'SUPER_ADMIN']}>
              <AgentsReviewPage />
            </RequireAuth>
          }
        />
        <Route path="/delivery" element={<RequireAuth><DeliveryHomePage /></RequireAuth>} />
        <Route
          path="*"
          element={
            <div className="mx-auto max-w-xl px-6 py-24 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-seve">Erreur 404</p>
              <h1 className="mt-3 font-display text-3xl font-semibold">Cette page n’existe pas</h1>
              <p className="mt-3 text-encre/60">Le lien est peut-être incorrect ou la page a été déplacée.</p>
              <Link to="/" className="mt-7 inline-block rounded-full bg-nuit px-6 py-3 font-medium text-brume hover:bg-nuit/90">
                Retour à l’accueil
              </Link>
            </div>
          }
        />
      </Routes>
    </Layout>
  );
}
