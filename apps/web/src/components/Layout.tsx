import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  MessageSquare,
  Package,
  Store,
  Search,
  ShieldCheck,
  Globe,
  LogOut,
  Layers,
  Sparkles,
  FileText,
  Truck,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { NotificationsBell } from './NotificationsBell';
import { api } from '../lib/api';
import type { Cart } from '../lib/types';

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState<number>(0);

  const isConsoleRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/vendor');

  // Fetch cart item count
  useEffect(() => {
    if (user && !isConsoleRoute) {
      api
        .get<Cart>('/cart')
        .then(({ data }) => {
          const count = data?.items?.reduce((sum, it) => sum + (it.quantity || 1), 0) || 0;
          setCartCount(count);
        })
        .catch(() => {});
    }
  }, [user, location.pathname, isConsoleRoute]);

  // If in Admin or Vendor console, bypass consumer header/footer so they retain full-screen SaaS UI
  if (isConsoleRoute) {
    return <>{children}</>;
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/products');
    }
  }

  const isAdmin = user?.roles.some((r) => r.role === 'ADMIN' || r.role === 'SUPER_ADMIN');
  const isVendor = user?.roles.some((r) => r.role === 'VENDOR_OWNER' || r.role === 'VENDOR_STAFF');

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-800 antialiased font-sans">
      {/* Top Utility Bar (Signature Congolese Green #172320 strip) */}
      <div className="bg-[#172320] text-emerald-100/90 text-[11px] font-mono border-b border-emerald-950">
        <div className="mx-auto max-w-7xl px-6 h-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Protection Acheteur ZandoGo : Séquestre 100% Garanti</span>
            </span>
            <span className="hidden md:inline text-emerald-800">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-emerald-200/80">
              <Globe className="w-3 h-3 text-emerald-400" />
              <span>Toute la RDC (Kinshasa, Lubumbashi, Goma, Matadi, Kisangani, etc.)</span>
            </span>
          </div>

          <div className="flex items-center gap-4 text-emerald-200/80">
            <span>Parité : 1 USD = 2 850 CDF</span>
            {isAdmin && (
              <Link to="/admin" className="text-emerald-300 hover:underline font-bold">
                Console Admin ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Header Bar (ZandoGo branding + search + professional icon menus) */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-7xl px-6 h-18 flex items-center justify-between gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="h-9 w-9 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center font-display text-lg shadow-xs group-hover:scale-105 transition-transform">
              ZG
            </div>
            <div>
              <span className="text-2xl font-display font-extrabold tracking-tight text-slate-900">
                Zando<span className="text-emerald-700">Go</span>
              </span>
              <span className="block text-[9px] font-mono font-semibold uppercase tracking-wider text-slate-400 -mt-1">
                Marketplace RDC
              </span>
            </div>
          </Link>

          {/* Global Search Bar with Green Theme */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden sm:flex flex-1 max-w-xl items-center rounded-xl border-2 border-emerald-700/80 bg-white overflow-hidden shadow-xs focus-within:border-emerald-700 transition"
          >
            <div className="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shrink-0 hidden md:block">
              Tous produits & services
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Que recherchez-vous ? (tissus wax, téléphones, formations PDF, services...)"
              className="w-full px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none"
            />
            <button
              type="submit"
              className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-xs font-bold transition flex items-center justify-center shrink-0"
              title="Lancer la recherche"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          {/* Professional Icon Menus (Panier, Messagerie, Commandes, Vendeur, User) */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* Vendor Space Link Button */}
            <Link
              to={isVendor ? '/vendor' : '/vendor/new'}
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 transition"
            >
              <Store className="w-4 h-4 text-emerald-700" />
              <span>{isVendor ? 'Espace Vendeur' : 'Vendre sur ZandoGo'}</span>
            </Link>

            {/* Messagerie & Négociations Icon */}
            <Link
              to="/chat"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
              title="Messagerie & Négociations Fournisseurs"
              aria-label="Messagerie"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            {/* Commandes Icon */}
            <Link
              to="/orders"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
              title="Mes Commandes (Payées & Non payées)"
              aria-label="Commandes"
            >
              <Package className="w-5 h-5" />
            </Link>

            {/* Notifications */}
            {user && <NotificationsBell />}

            {/* Panier Icon with Badge */}
            <Link
              to="/cart"
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition relative"
              title="Panier d'achats"
              aria-label="Panier"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-700 text-white font-bold font-mono text-[10px] rounded-full h-4 min-w-4 px-1 flex items-center justify-center shadow-xs">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="h-5 w-px bg-slate-200 mx-1" />

            {/* Account / User */}
            {user ? (
              <div className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0"
                  title={user.fullName || user.email || 'Compte'}
                >
                  {(user.fullName || 'U')[0]}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 font-semibold"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition shadow-xs"
                >
                  S'inscrire
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Secondary Category Navigation Strip */}
        <div className="border-t border-slate-100 bg-white">
          <div className="mx-auto max-w-7xl px-6 h-10 flex items-center gap-6 text-xs font-medium text-slate-600 overflow-x-auto">
            <Link to="/products" className="font-semibold text-slate-900 hover:text-emerald-700 whitespace-nowrap flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-700" />
              <span>Toutes les catégories</span>
            </Link>
            <Link to="/products" className="hover:text-emerald-700 whitespace-nowrap flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>Biens physiques & Stocks</span>
            </Link>
            <Link to="/products" className="hover:text-emerald-700 whitespace-nowrap flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Numériques & PDF</span>
            </Link>
            <Link to="/products" className="hover:text-emerald-700 whitespace-nowrap flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Services & Prestations</span>
            </Link>
            <Link to="/orders" className="hover:text-emerald-700 whitespace-nowrap flex items-center gap-1">
              <Truck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Suivi livraison & Fret</span>
            </Link>
            <Link to="/chat" className="text-emerald-700 font-semibold hover:underline whitespace-nowrap ml-auto">
              Discuter d'un produit ou de la livraison &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-20">
        <div className="mx-auto max-w-7xl px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs text-slate-600">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-6 w-6 rounded-lg bg-emerald-700 text-white font-bold flex items-center justify-center font-display text-xs">
                ZG
              </div>
              <span className="font-display font-bold text-slate-900 text-base">ZandoGo</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              Place de marché universelle de référence en République Démocratique du Congo.
              Vente au détail dès 1 article, commandes groupées et services avec paiement sécurisé sous séquestre.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
              Protection & Confiance
            </h4>
            <ul className="space-y-2 text-slate-500">
              <li>Paiement sous séquestre ZandoGo</li>
              <li>Fournisseurs vérifiés RCCM</li>
              <li>Négociation de prix directe</li>
              <li>Litiges & Arbitrage sous 48h</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
              Couverture Logistique RDC
            </h4>
            <ul className="space-y-2 text-slate-500">
              <li>Grand Kinshasa (coursiers express)</li>
              <li>Lubumbashi & Haut-Katanga</li>
              <li>Goma & Nord-Kivu</li>
              <li>Matadi, Kisangani, Bukavu</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-3">
              Moyens de Règlement
            </h4>
            <p className="text-slate-500 mb-2">
              Orange Money, Airtel Money, M-Pesa Vodacom, Cartes Visa / Mastercard ou espèces à la livraison.
            </p>
            <span className="font-mono text-slate-400 block text-[10px]">
              © {new Date().getFullYear()} ZandoGo RDC. Tous droits réservés.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
