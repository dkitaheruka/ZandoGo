import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  ShieldCheck,
  Scale,
  Truck,
  ArrowLeftRight,
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
  { to: '/admin/exchange-rate', label: 'Taux de change USD/CDF', icon: ArrowLeftRight },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* SaaS Sidebar */}
      <aside
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col justify-between transition-all duration-200 z-20`}
      >
        <div>
          {/* Brand lockup */}
          <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white text-xs font-display shadow-xs">
                  ZG
                </span>
                <span className="font-display font-bold tracking-tight text-white text-base">
                  Zando<span className="text-cyan-400">Go</span>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Agrandir la barre' : 'Réduire la barre'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors mx-auto"
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-cyan-400'}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link
            to="/products"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <ShoppingBag className="w-4 h-4 shrink-0 text-cyan-400" />
            {!collapsed && <span className="truncate">Retour Place de Marché</span>}
          </Link>
          <Link
            to="/vendor"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <Store className="w-4 h-4 shrink-0 text-emerald-400" />
            {!collapsed && <span className="truncate">Espace Vendeur Pro</span>}
          </Link>
        </div>
      </aside>

      {/* Main App Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {/* Top Header Contract */}
        <header className="h-16 px-8 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-slate-200 font-medium">Console Centrale ZandoGo</span>
            <span aria-hidden="true">/</span>
            <span className="truncate text-cyan-400 font-semibold">Supervision RDC & Séquestre</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-mono text-[11px] tabular-nums">Système Opérationnel</span>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-800 pl-4 text-xs">
              <div className="h-7 w-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-semibold text-slate-200 leading-none">{user?.fullName || 'Administrateur'}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">SUPER_ADMIN</p>
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
