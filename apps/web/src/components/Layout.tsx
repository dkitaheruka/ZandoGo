import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth-context';
import { NotificationsBell } from './NotificationsBell';

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-encre/10 bg-brume/95 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-semibold text-nuit">
            Marché<span className="text-seve">.</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-8 text-sm">
            <Link to="/products" className="hover:text-seve transition-colors">
              Produits
            </Link>
            <Link to="/cart" className="hover:text-seve transition-colors">
              Panier
            </Link>
            <Link to="/orders" className="hover:text-seve transition-colors">
              Mes commandes
            </Link>
            <Link to="/chat" className="hover:text-seve transition-colors">
              Messages
            </Link>
          </nav>

          <div className="flex items-center gap-4 text-sm">
            {user ? (
              <>
                {user.roles.some((r) => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN') && (
                  <>
                    <Link to="/admin" className="hidden md:inline hover:text-seve transition-colors">
                      Administration
                    </Link>
                    <Link to="/admin/agents" className="hidden lg:inline hover:text-seve transition-colors">
                      Candidatures livreurs
                    </Link>
                  </>
                )}
                <Link to="/delivery" className="hidden md:inline hover:text-seve transition-colors">
                  Espace livreur
                </Link>
                <Link to="/vendor" className="hidden md:inline hover:text-seve transition-colors">
                  Espace vendeur
                </Link>
                <NotificationsBell />
                <span className="text-encre/70">{user.email ?? user.phone}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-full border border-encre/20 px-4 py-1.5 hover:border-encre/40 transition-colors"
                >
                  Se déconnecter
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="hover:text-seve transition-colors">
                  Se connecter
                </Link>
                <Link
                  to="/register"
                  className="rounded-full bg-nuit text-brume px-4 py-1.5 hover:bg-nuit/90 transition-colors"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-encre/10 mt-16">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-encre/60 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Marché</span>
          <span className="route-line flex-1 mx-6" aria-hidden="true" />
          <span>Kinshasa · RDC</span>
        </div>
      </footer>
    </div>
  );
}
