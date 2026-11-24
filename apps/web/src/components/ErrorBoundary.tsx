import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue lors du chargement de ZandoGo.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ZandoGo ErrorBoundary]', error, info.componentStack);
  }

  async handleResetCacheAndReload() {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      // ignore
    }
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {
      // ignore
    }
    window.location.href = '/';
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-brume text-encre flex items-center justify-center p-6 font-sans">
        <div className="max-w-lg w-full rounded-card bg-white border border-encre/15 shadow-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-card bg-nuit text-safran font-display font-extrabold text-base flex items-center justify-center shrink-0">
              ZG
            </div>
            <div>
              <h1 className="font-display text-lg font-bold text-nuit">
                Impossible d’afficher la page correctement
              </h1>
              <p className="text-xs text-encre/65">
                Une erreur d’affichage s’est produite dans votre navigateur.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-wax/10 border border-wax/25 text-xs font-mono text-wax break-words">
            {this.state.errorMessage}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume text-xs font-display font-bold transition"
            >
              Recharger la page
            </button>
            <button
              type="button"
              onClick={() => void this.handleResetCacheAndReload()}
              className="px-4 py-2.5 rounded-card border border-encre/20 bg-brume hover:bg-encre/5 text-nuit text-xs font-display font-semibold transition"
            >
              Vider le cache local & réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }
}
