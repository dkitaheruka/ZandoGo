import { useEffect, useState, type ReactNode } from 'react';
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
  Lock,
  Check,
  BarChart3,
  Users,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { PWAInstallButton } from '../PWAInstallButton';
import type { NegotiationOffer, VendorStore } from '../../lib/types';

export function VendorLayout({
  children,
  storeName,
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
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [pendingNegoCount, setPendingNegoCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setStores(data || []))
      .catch(() => {});

    api
      .get<NegotiationOffer[]>('/negotiations')
      .then(({ data }) => {
        setPendingNegoCount((data || []).filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length);
      })
      .catch(() => {});

    api
      .get<any[]>(`/vendors/stores/${storeId}/orders`)
      .then(({ data }) => {
        setPendingOrdersCount((data || []).filter((o) => o.status === 'PENDING' || o.status === 'PROCESSING').length);
      })
      .catch(() => {});
  }, [storeId, location.pathname]);

  const activeStore = stores.find((s) => s.id === storeId) || stores[0];
  const resolvedStoreName = storeName || activeStore?.storeName || 'Mes Boutiques';

  function handleSwitchStore(targetId: string) {
    setStoreMenuOpen(false);
    if (location.pathname.includes('/products/new')) {
      navigate(`/vendor/${targetId}/products/new`);
    } else if (location.pathname.includes('/products')) {
      navigate(`/vendor/${targetId}/products`);
    } else if (location.pathname.includes('/negotiations')) {
      navigate(`/vendor/${targetId}/negotiations`);
    } else if (location.pathname.includes('/orders')) {
      navigate(`/vendor/${targetId}/orders`);
    } else if (location.pathname.includes('/analytics')) {
      navigate(`/vendor/${targetId}/analytics`);
    } else if (location.pathname.includes('/team')) {
      navigate(`/vendor/${targetId}/team`);
    } else if (location.pathname.includes('/ads')) {
      navigate(`/vendor/${targetId}/ads`);
    } else {
      navigate(`/vendor/${targetId}/products`);
    }
  }

  const navItems = [
    {
      label: 'Mes Boutiques',
      href: '/vendor',
      icon: LayoutDashboard,
      active: location.pathname === '/vendor',
    },
    {
      label: 'Stock & Produits',
      href: `/vendor/${storeId}/products`,
      icon: Package,
      active: location.pathname.includes('/products') && !location.pathname.includes('/new'),
    },
    {
      label: 'Négociations & Devis B2B',
      href: `/vendor/${storeId}/negotiations`,
      icon: Handshake,
      active: location.pathname.includes('/negotiations'),
      badge: pendingNegoCount > 0 ? `${pendingNegoCount} en attente` : undefined,
    },
    {
      label: 'Commandes & Retraits',
      href: `/vendor/${storeId}/orders`,
      icon: ShoppingBag,
      active: location.pathname.includes('/orders') && location.pathname.startsWith('/vendor'),
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} à traiter` : undefined,
    },
    {
      label: 'Publier un produit',
      href: `/vendor/${storeId}/products/new`,
      icon: PlusCircle,
      active: location.pathname.includes('/products/new'),
    },
    {
      label: 'Publicités & Boosts',
      href: `/vendor/${storeId}/ads`,
      icon: Megaphone,
      active: location.pathname.includes('/ads'),
    },
    {
      label: 'Équipe & Collaborateurs',
      href: `/vendor/${storeId}/team`,
      icon: Users,
      active: location.pathname.includes('/team'),
    },
    {
      label: 'Analyses & Diagrammes',
      href: `/vendor/${storeId}/analytics`,
      icon: BarChart3,
      active: location.pathname.includes('/analytics'),
    },
  ];

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex bg-brume text-encre antialiased font-sans">
      {/* Light Professional Sidebar */}
      <aside className="w-64 bg-white border-r border-encre/10 flex flex-col shrink-0 sticky top-0 h-screen z-20">
        {/* Brand Lockup */}
        <div className="h-16 px-6 border-b border-encre/10 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-card bg-nuit text-safran font-bold flex items-center justify-center font-display text-base shadow-xs">
              ZG
            </span>
            <div className="leading-none">
              <span className="font-display font-extrabold text-lg text-nuit tracking-tight">ZandoGo</span>
              <span className="block text-[10px] font-display font-semibold uppercase tracking-wider text-safran">
                Espace Vendeur Pro
              </span>
            </div>
          </Link>
        </div>

        {/* Store Selector Dropdown (Multi-Boutiques) */}
        <div className="p-4 border-b border-encre/10">
          <div className="relative">
            <button
              type="button"
              onClick={() => setStoreMenuOpen(!storeMenuOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-card border border-encre/15 hover:border-safran/60 bg-brume/50 transition text-left"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-7 w-7 rounded-lg bg-safran/20 text-nuit flex items-center justify-center shrink-0 border border-safran/40">
                  <Store className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-semibold text-nuit truncate">{resolvedStoreName}</p>
                  <p className="text-[10px] text-encre/60 truncate">
                    {stores.length} {stores.length > 1 ? 'boutiques actives' : 'boutique'}
                  </p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-encre/50 shrink-0" />
            </button>

            {storeMenuOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-encre/10 rounded-card shadow-lg z-30 py-1 text-xs max-h-72 overflow-y-auto">
                <Link
                  to="/vendor"
                  onClick={() => setStoreMenuOpen(false)}
                  className="block px-3 py-2 text-encre hover:bg-brume font-semibold border-b border-encre/10"
                >
                  Toutes mes boutiques ({stores.length})
                </Link>
                {stores.map((st) => {
                  const isCurrent = st.id === storeId;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleSwitchStore(st.id)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-safran/10 transition ${
                        isCurrent ? 'bg-safran/20 text-nuit font-bold' : 'text-encre'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate">{st.storeName}</p>
                        <p className="text-[10px] text-encre/55 font-mono truncate">
                          {st.payoutBlocked ? 'Retraits gelés' : st.isCertified ? 'Certifiée' : 'Standard'}
                        </p>
                      </div>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-nuit shrink-0" />}
                    </button>
                  );
                })}
                <Link
                  to="/vendor/new"
                  onClick={() => setStoreMenuOpen(false)}
                  className="block px-3 py-2 text-nuit hover:bg-safran/20 font-bold border-t border-encre/10"
                >
                  + Acheter une nouvelle boutique
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
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-card text-xs font-medium transition ${
                  item.active
                    ? 'bg-nuit text-brume font-display font-bold shadow-xs'
                    : 'text-encre/70 hover:text-nuit hover:bg-encre/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${item.active ? 'text-safran' : 'text-encre/50'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold bg-safran text-nuit">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility & Return to Consumer Marketplace */}
        <div className="p-4 border-t border-encre/10 bg-brume/30 space-y-3">
          {activeStore?.payoutBlocked ? (
            <div className="flex items-center gap-2 text-[11px] font-medium text-wax bg-wax/10 border border-wax/25 rounded-card p-2.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Retraits bloqués (litige admin)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[11px] font-medium text-seve bg-seve/10 border border-seve/20 rounded-card p-2.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Statut : Boutique Active & En Règle</span>
            </div>
          )}

          <Link
            to="/products"
            className="flex items-center gap-2 text-xs font-semibold text-encre/70 hover:text-nuit transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Place de marché ZandoGo</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-wax hover:text-wax/80 font-medium transition pt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-encre/10 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 text-xs text-encre/60 font-medium">
            <span className="text-nuit font-semibold">Console Fournisseur</span>
            <span>/</span>
            <span className="text-encre/80">{resolvedStoreName}</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <PWAInstallButton variant="header" compact />

            <Link
              to="/products"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border border-encre/15 hover:border-safran/60 text-encre font-medium bg-brume/40 transition"
            >
              <span>Aperçu boutique en direct</span>
              <ExternalLink className="w-3.5 h-3.5 text-encre/50" />
            </Link>

            <div className="h-4 w-px bg-encre/10" />

            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-nuit text-safran flex items-center justify-center font-display font-bold text-xs">
                {(user?.fullName || 'V')[0]}
              </div>
              <span className="font-medium text-nuit">{user?.fullName || 'Fournisseur ZandoGo'}</span>
            </div>
          </div>
        </header>

        {/* Page Inner Container */}
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
