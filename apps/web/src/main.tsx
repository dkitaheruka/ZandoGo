import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './lib/auth-context';
import { PresenceProvider } from './lib/presence-context';
import { StoreProvider } from './lib/store-context';
import './index.css';

declare global {
  interface Window {
    __ZANDOGO_MOUNTED__?: boolean;
  }
}

if (import.meta.env.PROD) {
  try {
    registerSW({ immediate: true });
  } catch {
    // ignore service worker registration errors
  }
} else if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      regs.forEach((reg) => {
        reg.unregister().catch(() => {});
      });
    })
    .catch(() => {});
}

const rootEl = document.getElementById('root');
if (rootEl) {
  window.__ZANDOGO_MOUNTED__ = true;
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <PresenceProvider>
              <StoreProvider>
                <App />
              </StoreProvider>
            </PresenceProvider>
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
