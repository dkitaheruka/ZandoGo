import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  ShieldCheck,
  Scale,
  Truck,
  ArrowLeftRight,
  SlidersHorizontal,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';

const ADMIN_NAV = [
  { to: '/admin', label: 'Vue d’ensemble & KPIs', icon: LayoutDashboard },
  { to: '/admin/stores', label: 'Boutiques & Entreprises', icon: Store },
  { to: '/admin/kyc', label: 'Vérifications KYC', icon: ShieldCheck },
  { to: '/admin/disputes', label: 'Litiges & Séquestres', icon: Scale },
  { to: '/admin/agents', label: 'Transporteurs & Coursiers', icon: Truck },
  { to: '/admin/pricing', label: 'Tarifs & Commissions', icon: SlidersHorizontal },
  { to: '/admin/exchange-rate', label: 'Taux de change USD/CDF', icon: ArrowLeftRight },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#111917] text-brume flex font-sans">
      {/* SaaS Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } shrink-0 bg-nuit border-r border-white/10 flex flex-col justify-between transition-all duration-200 z-20`}
      >
        <div>
          {/* Brand lockup */}
          <div className="h-16 px-4 border-b border-white/10 flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-card bg-seve flex items-center justify-center font-bold text-brume text-xs font-display shadow-xs">
                  ZG
                </span>
                <span className="font-display font-bold tracking-tight text-brume text-base">
                  Zando<span className="text-safran">Go</span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Agrandir la barre' : 'Réduire la barre'}
              className="p-1.5 rounded-lg text-brume/60 hover:text-brume hover:bg-white/5 transition-colors mx-auto"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Nav links */}
          <nav className="p-3 space-y-1">
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-card text-xs font-medium transition-all ${
                    active
                      ? 'bg-seve text-brume font-display font-bold shadow-xs'
                      : 'text-brume/70 hover:text-brume hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-brume' : 'text-safran'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to="/products"
            className="flex items-center gap-3 px-3 py-2 rounded-card text-xs text-brume/70 hover:text-brume hover:bg-white/5 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 shrink-0 text-safran" />
            {!collapsed && <span className="truncate">Retour Place de Marché</span>}
          </Link>
          <Link
            to="/vendor"
            className="flex items-center gap-3 px-3 py-2 rounded-card text-xs text-brume/70 hover:text-brume hover:bg-white/5 transition-colors"
          >
            <Store className="w-4 h-4 shrink-0 text-seve" />
            {!collapsed && <span className="truncate">Espace Vendeur Pro</span>}
          </Link>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#111917]">
        {/* Top Header Contract */}
        <header className="h-16 px-8 border-b border-white/10 bg-nuit/90 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-2 text-xs text-brume/60">
            <span className="text-brume font-medium font-display">Console Centrale ZandoGo</span>
            <span aria-hidden="true">/</span>
            <span className="truncate text-safran font-semibold">Supervision RDC & Séquestre</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-seve" />
              <span className="text-brume/80 font-mono text-[11px] tabular-nums">Système Opérationnel</span>
            </div>

            <div className="flex items-center gap-2 border-l border-white/10 pl-4 text-xs">
              <div className="h-7 w-7 rounded-full bg-seve text-brume flex items-center justify-center font-display font-bold">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-semibold text-brume leading-none">{user?.fullName || 'Administrateur'}</p>
                <p className="text-[10px] text-safran font-mono mt-0.5">SUPER_ADMIN</p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Body */}
        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
