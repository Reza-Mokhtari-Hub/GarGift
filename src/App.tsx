import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { ErrorBoundary, ToastContainer } from './components/ui/Common';
import { StorefrontLayout } from './components/StorefrontLayout';
import { HomePage } from './pages/HomePage';
import { CatalogPage, ProductDetailPage } from './pages/CatalogAndProductPages';
import { CartAndCheckoutPage } from './pages/CartAndCheckoutPages';
import {
  AuthPage,
  CustomerAccountPage,
  StaticCmsPage,
  BlogPage,
} from './pages/CustomerAndStaticPages';
import { AdminPanelPage } from './pages/AdminPanelPage';

function NotFoundPage() {
  return (
    <div className="container mx-auto max-w-lg px-4 py-20 text-center space-y-4">
      <div className="text-5xl font-extrabold text-indigo-500">۴۰۴</div>
      <h1 className="text-xl font-bold text-slate-900 dark:text-white">
        صفحه مورد نظر شما یافت نشد
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
        آدرس واردشده وجود ندارد یا تغییر کرده است.
      </p>
      <Link
        to="/"
        className="inline-flex px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold"
      >
        بازگشت به صفحه اصلی گرگیفت+
      </Link>
    </div>
  );
}

export default function App() {
  const { fetchBootstrap, themeMode } = useAppStore();

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    fetchBootstrap();
  }, [fetchBootstrap, themeMode]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastContainer />
        <Routes>
          {/* Admin Panel Routes (Full-screen SaaS Workspace Layout) */}
          <Route path="/admin" element={<AdminPanelPage />} />
          <Route path="/admin/:module" element={<AdminPanelPage />} />

          {/* Storefront Routes */}
          <Route
            path="/*"
            element={
              <StorefrontLayout>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/products" element={<CatalogPage />} />
                  <Route path="/product/:slug" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartAndCheckoutPage />} />
                  <Route path="/checkout" element={<CartAndCheckoutPage />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/account" element={<CustomerAccountPage />} />
                  <Route path="/account/:tab" element={<CustomerAccountPage />} />
                  <Route path="/page/:slug" element={<StaticCmsPage />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </StorefrontLayout>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
