import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  Package,
  Handshake,
  DollarSign,
  TrendingUp,
  Plus,
  ExternalLink,
  Truck,
  ShoppingBag,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import { api } from '../../lib/api';
import type { NegotiationOffer, Product, VendorStore, WalletSummary } from '../../lib/types';

const SALES_TREND_7D = [
  { day: 'Lun', amount: 185 },
  { day: 'Mar', amount: 240 },
  { day: 'Mer', amount: 195 },
  { day: 'Jeu', amount: 310 },
  { day: 'Ven', amount: 280 },
  { day: 'Sam', amount: 420 },
  { day: 'Dim', amount: 360 },
];

export function VendorDashboardPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [ordersCount, setOrdersCount] = useState(0);
  const [pendingNegoCount, setPendingNegoCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(async ({ data }) => {
        const list = data || [];
        setStores(list);
        const primaryStoreId = list[0]?.id || 'store-1';

        const [walRes, ordRes, negRes, prodRes] = await Promise.all([
          api.get<WalletSummary>('/wallets/mine').catch(() => ({ data: null })),
          api.get<any[]>(`/vendors/stores/${primaryStoreId}/orders`).catch(() => ({ data: [] })),
          api.get<NegotiationOffer[]>('/negotiations').catch(() => ({ data: [] })),
          api.get<Product[]>('/products').catch(() => ({ data: [] })),
        ]);

        if (walRes.data) setWallet(walRes.data);
        setOrdersCount((ordRes.data || []).length);
        setPendingNegoCount((negRes.data || []).filter((n) => n.status === 'PENDING_VENDOR_REVIEW').length);
        const myStoreIds = new Set(list.map((s) => s.id));
        setLowStockCount(
          (prodRes.data || []).filter(
            (p) =>
              (myStoreIds.size === 0 || (p.store?.id && myStoreIds.has(p.store.id))) &&
              p.productType === 'PHYSICAL' &&
              p.stockQty !== undefined &&
              p.stockQty <= (p.lowStockThreshold || 5),
          ).length,
        );
      })
      .catch(() => setError('Impossible de charger vos boutiques.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const primaryStoreId = stores[0]?.id || 'store-1';
  const totalBalance = wallet
    ? wallet.availableBalanceUsd + wallet.lockedEscrowUsd
    : stores.reduce((acc, s) => acc + (s.balanceUsd || 0), 0);
  const maxTrend = Math.max(...SALES_TREND_7D.map((d) => d.amount));

  return (
    <VendorLayout storeId={primaryStoreId} storeName={stores[0]?.storeName || 'Mes Boutiques'}>
      <div className="max-w-6xl space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-seve uppercase tracking-wider">
              <Store className="w-4 h-4 text-seve" />
              <span>Tableau de Bord Vendeur & Grossiste RDC</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Espace Marchand ZandoGo
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Pilotez vos stocks, négociez les prix en direct et suivez vos livraisons sur toute la République.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to={`/vendor/${primaryStoreId}/orders`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card border border-encre/15 bg-white hover:border-seve/40 text-nuit font-display font-bold text-xs transition"
            >
              <ShoppingBag className="w-4 h-4 text-seve" />
              <span>Commandes & Retraits</span>
            </Link>
            <Link
              to="/vendor/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Ouvrir une boutique</span>
            </Link>
          </div>
        </div>

        {/* 4 Dynamic KPI Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Portefeuille & Séquestre</span>
              <DollarSign className="w-4 h-4 text-seve" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-seve font-medium">
              <TrendingUp className="w-3 h-3" />
              <span>
                Disponible : ${(wallet?.availableBalanceUsd ?? totalBalance).toFixed(2)}
              </span>
            </span>
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Commandes Boutique</span>
              <Truck className="w-4 h-4 text-seve" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {ordersCount} {ordersCount > 1 ? 'commandes' : 'commande'}
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/orders`}
              className="mt-1 block text-[11px] text-seve font-semibold hover:underline"
            >
              Expédier & suivre &rarr;
            </Link>
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>Négociations B2B</span>
              <Handshake className="w-4 h-4 text-safran" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {pendingNegoCount} en attente
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/negotiations`}
              className="mt-1 block text-[11px] text-seve font-semibold hover:underline"
            >
              Répondre aux offres &rarr;
            </Link>
          </div>

          <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
            <div className="flex items-center justify-between text-encre/60 text-xs font-medium">
              <span>État des Stocks</span>
              <Package className="w-4 h-4 text-wax" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold text-nuit tabular-nums">
              {lowStockCount} {lowStockCount > 1 ? 'alertes stock' : 'alerte stock'}
            </p>
            <Link
              to={`/vendor/${primaryStoreId}/products`}
              className="mt-1 block text-[11px] text-wax font-medium hover:underline"
            >
              {lowStockCount > 0 ? 'Réapprovisionnement suggéré →' : 'Inventaire optimal ✓'}
            </Link>
          </div>
        </div>

        {/* 7-day Performance Analytics Widget */}
        <div className="rounded-card bg-white border border-encre/10 p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-sm font-bold text-nuit">
                Tendance des ventes sur 7 jours (USD)
              </h2>
              <p className="text-xs text-encre/60">
                Volume journalier validé en gros B2B & détail sur ZandoGo
              </p>
            </div>
            <Link
              to={`/vendor/${primaryStoreId}/orders`}
              className="text-xs font-semibold text-seve hover:underline"
            >
              Gérer mes retraits Mobile Money &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-7 gap-3 items-end h-32 pt-4">
            {SALES_TREND_7D.map((bar) => {
              const pct = Math.max(18, Math.round((bar.amount / maxTrend) * 100));
              return (
                <div key={bar.day} className="flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono text-encre/60">${bar.amount}</span>
                  <div className="w-full max-w-[44px] bg-brume rounded-t-lg overflow-hidden flex items-end h-20">
                    <div
                      className="w-full bg-seve hover:bg-nuit transition-colors rounded-t-lg"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-display font-semibold text-nuit">{bar.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-card bg-wax/10 border border-wax/20 p-4 text-xs text-wax flex items-center justify-between">
            <span>{error}</span>
            <button onClick={load} className="underline font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {/* Stores Grid */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-encre/60 mb-4 font-display">
            Vos Espaces Commerciaux Enregistrés
          </h2>

          {loading ? (
            <div className="py-20 text-center text-xs font-mono text-encre/50">
              Chargement de vos boutiques…
            </div>
          ) : stores.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="bg-white border border-encre/10 rounded-card p-6 shadow-xs hover:border-seve/40 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold text-nuit">
                          {store.storeName}
                        </h3>
                        <span className="px-2 py-0.5 rounded-card text-[10px] font-display font-semibold bg-seve/10 text-seve border border-seve/25">
                          {store.status === 'ACTIVE' ? 'Active & Vérifiée' : store.status}
                        </span>
                      </div>
                      <p className="text-xs text-encre/50 mt-0.5 font-mono">/{store.slug}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-encre/50 block">Solde boutique</span>
                      <span className="font-display text-sm font-bold text-nuit tabular-nums">
                        ${(store.balanceUsd ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-encre/70 line-clamp-2 leading-relaxed">
                    {store.description || 'Commerce grossiste et détail sur la place de marché ZandoGo.'}
                  </p>

                  <div className="mt-6 pt-4 border-t border-encre/10 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/vendor/${store.id}/products`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-seve hover:bg-seve/90 text-brume font-display font-bold text-xs transition shadow-xs"
                      >
                        <Package className="w-3.5 h-3.5" />
                        <span>Stocks</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/orders`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card bg-nuit hover:bg-nuit/90 text-brume font-display font-bold text-xs transition shadow-xs"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-safran" />
                        <span>Commandes</span>
                      </Link>

                      <Link
                        to={`/vendor/${store.id}/negotiations`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border border-encre/15 hover:border-seve/40 text-encre font-medium text-xs bg-brume/30 transition"
                      >
                        <Handshake className="w-3.5 h-3.5 text-encre/50" />
                        <span>Devis B2B</span>
                      </Link>
                    </div>

                    <Link
                      to="/products"
                      target="_blank"
                      className="text-encre/40 hover:text-encre"
                      title="Voir sur le site public"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-encre/20 py-16 text-center bg-white p-8">
              <Store className="w-12 h-12 text-encre/30 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-nuit font-display">Aucune boutique active</h3>
              <p className="text-xs text-encre/60 mt-1 max-w-sm mx-auto">
                Ouvrez votre première boutique pour commencer à vendre des produits physiques, digitaux ou des services.
              </p>
              <Link
                to="/vendor/new"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-card bg-seve text-brume font-display font-bold text-xs hover:bg-seve/90"
              >
                <Plus className="w-4 h-4" />
                <span>Créer ma boutique</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </VendorLayout>
  );
}
