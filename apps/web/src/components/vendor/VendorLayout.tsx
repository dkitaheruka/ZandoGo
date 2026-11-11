import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Handshake,
  ShoppingBag,
  PlusCircle,
  ExternalLink,
  ArrowLeft,
  CheckCircle2,
  Store,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

export function VendorLayout({
  children,
  storeName = 'Boutique Victoire Wax',
  storeId = 'store-1',
}: {
  children: ReactNode;
  storeName?: string;
  storeId?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [storeMenuOpen, setStoreMenuOpen] = useState(false);

  const navItems = [
    {
      label: 'Mes Boutiques',
      href: '/vendor',
      icon: LayoutDashboard,
      active: location.pathname === '/vendor',
    },
    {
      label: 'Stock & Inventaire',
      href: `/vendor/${storeId}/products`,
      icon: Package,
      active: location.pathname.includes('/products') && !location.pathname.includes('/new'),
    },
    {
      label: 'Négociations & Devis B2B',
      href: `/vendor/${storeId}/negotiations`,
      icon: Handshake,
      active: location.pathname.includes('/negotiations'),
      badge: '2 en attente',
    },
    {
      label: 'Commandes & Expéditions',
      href: `/vendor/${storeId}/orders`,
      icon: ShoppingBag,
      active: location.pathname.includes('/orders') && location.pathname.startsWith('/vendor'),
    },
    {
      label: 'Nouvelle Offre',
      href: `/vendor/${storeId}/products/new`,
      icon: PlusCircle,
      active: location.pathname.includes('/products/new'),
    },
  ];

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 antialiased font-sans">
      {/* Light Professional Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0 h-screen z-20">
        {/* Brand Lockup */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-amber-500 text-slate-900 font-bold flex items-center justify-center font-display text-base shadow-xs">
              ZG
            </span>
            <div className="leading-none">
              <span className="font-display font-bold text-lg text-slate-900 tracking-tight">ZandoGo</span>
              <span className="block text-[10px] font-mono font-semibold uppercase tracking-wider text-amber-600">
                Espace Vendeur Pro
              </span>
            </div>
          </Link>
        </div>

        {/* Store Selector Dropdown */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStoreMenuOpen(!storeMenuOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/80 transition text-left"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-slate-900 truncate">{storeName}</p>
                  <p className="text-[10px] font-mono text-slate-500 truncate">Vendeur Certifié RDC</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            </button>

            {storeMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 py-1 text-xs">
                <Link
                  to="/vendor"
                  onClick={() => setStoreMenuOpen(false)}
                  className="block px-3 py-2 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Voir toutes mes boutiques
                </Link>
                <Link
                  to="/vendor/new"
                  onClick={() => setStoreMenuOpen(false)}
                  className="block px-3 py-2 text-amber-700 hover:bg-amber-50 font-semibold border-t border-slate-100"
                >
                  + Ouvrir une nouvelle boutique
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                  item.active
                    ? 'bg-amber-50 text-amber-900 font-semibold border border-amber-200/80 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.active ? 'text-amber-700' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500 text-slate-900">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility & Return to Consumer Marketplace */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Statut : Boutique Active & En Règle</span>
          </div>

          <Link
            to="/products"
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Place de marché ZandoGo</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-rose-600 hover:text-rose-700 font-medium transition pt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
            <span className="text-slate-900 font-semibold">Console Fournisseur</span>
            <span>/</span>
            <span className="text-slate-700">{storeName}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link
              to="/products"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 font-medium bg-slate-50 transition"
            >
              <span>Aperçu boutique en direct</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>

            <div className="h-4 w-px bg-slate-200" />

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                {(user?.fullName || 'V')[0]}
              </div>
              <span className="font-medium text-slate-800">{user?.fullName || 'Fournisseur ZandoGo'}</span>
            </div>
          </div>
        </header>

        {/* Page Inner Container */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
