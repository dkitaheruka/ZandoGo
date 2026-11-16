import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Percent,
  Package,
  ArrowRight,
} from 'lucide-react';
import { VendorLayout } from '../../components/vendor/VendorLayout';
import {
  TrendAreaChart,
  RevenueBarChart,
  DonutBreakdownChart,
  HorizontalBarList,
} from '../../components/AnalyticsCharts';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { VendorAnalyticsPayload, VendorStore } from '../../lib/types';

export function VendorAnalyticsPage() {
  const { storeId = 'store-1' } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { exchangeRate } = useStore();
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [analytics, setAnalytics] = useState<VendorAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setStores(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get<VendorAnalyticsPayload>(`/analytics/vendor/${storeId}`)
      .then(({ data }) => setAnalytics(data))
      .catch(() => setError('Impossible de charger les diagrammes analytiques de cette boutique.'))
      .finally(() => setLoading(false));
  }, [storeId]);

  return (
    <VendorLayout storeId={storeId} storeName={analytics?.storeName}>
      <div className="max-w-6xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-encre/10 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-nuit uppercase tracking-wider font-display">
              <BarChart3 className="w-4 h-4 text-safran" />
              <span>Business Intelligence & Performance Vendeur</span>
            </div>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-nuit tracking-tight">
              Analyses & Diagrammes — {analytics?.storeName || 'Boutique'}
            </h1>
            <p className="mt-1 text-xs text-encre/70">
              Suivez votre chiffre d’affaires brut, vos revenus nets après commission, la répartition par type d’offre et vos meilleurs produits.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {stores.length > 1 && (
              <select
                value={storeId}
                onChange={(e) => navigate(`/vendor/${e.target.value}/analytics`)}
                className="px-3 py-2 rounded-card border border-encre/15 bg-white text-xs font-display font-bold text-nuit outline-none focus:border-safran"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            )}
            <Link
              to={`/vendor/${storeId}/orders`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-card bg-nuit text-brume text-xs font-display font-bold hover:bg-nuit/90 transition"
            >
              <span>Gérer mes retraits</span>
              <ArrowRight className="w-3.5 h-3.5 text-safran" />
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/25 text-xs text-wax">{error}</div>
        )}

        {loading || !analytics ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-28 rounded-card bg-white border border-encre/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Strip */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
                <div className="flex items-center justify-between text-xs text-encre/60">
                  <span>Chiffre d’affaires brut</span>
                  <DollarSign className="w-4 h-4 text-safran" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-nuit tabular-nums">
                  ${analytics.kpis.grossRevenueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] font-mono text-encre/50">
                  ≈ {Math.round(analytics.kpis.grossRevenueUsd * exchangeRate).toLocaleString('fr-FR')} CDF
                </span>
              </div>

              <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
                <div className="flex items-center justify-between text-xs text-encre/60">
                  <span>Revenu Net Vendeur</span>
                  <TrendingUp className="w-4 h-4 text-seve" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-seve tabular-nums">
                  ${analytics.kpis.netVendorUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] text-encre/60">Après déduction commission</span>
              </div>

              <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
                <div className="flex items-center justify-between text-xs text-encre/60">
                  <span>Commission Plateforme</span>
                  <Percent className="w-4 h-4 text-encre/50" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-nuit tabular-nums">
                  ${analytics.kpis.platformCommissionUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] text-encre/60">
                  Sur {analytics.kpis.paidOrders} commande(s) payée(s)
                </span>
              </div>

              <div className="p-5 rounded-card bg-white border border-encre/10 shadow-xs">
                <div className="flex items-center justify-between text-xs text-encre/60">
                  <span>Panier Moyen</span>
                  <ShoppingBag className="w-4 h-4 text-safran" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-nuit tabular-nums">
                  ${analytics.kpis.averageBasketUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] text-encre/60">Total commandes : {analytics.kpis.totalOrders}</span>
              </div>
            </div>

            {/* Row 1: Trend Curve & Daily Bars */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm text-nuit">
                    Courbe d’évolution des ventes (7 jours)
                  </h2>
                  <p className="text-xs text-encre/60">Volume journalier généré (survolez un point pour détailler)</p>
                </div>
                <TrendAreaChart data={analytics.revenueSeries} />
              </div>

              <div className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm text-nuit">
                    Histogramme journalier des revenus (USD)
                  </h2>
                  <p className="text-xs text-encre/60">Comparaison des pics d’activité de votre boutique</p>
                </div>
                <RevenueBarChart data={analytics.revenueSeries} />
              </div>
            </div>

            {/* Row 2: Product Type Donut + Status Donut + Top Products */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-4">
                <h2 className="font-display font-bold text-sm text-nuit flex items-center gap-2">
                  <Package className="w-4 h-4 text-seve" />
                  <span>Répartition par type d’offre</span>
                </h2>
                <DonutBreakdownChart items={analytics.productTypeBreakdown} centerLabel="Offres" />
              </div>

              <div className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-4">
                <h2 className="font-display font-bold text-sm text-nuit flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-safran" />
                  <span>Statuts des commandes</span>
                </h2>
                <DonutBreakdownChart items={analytics.statusBreakdown} centerLabel="Cmds" />
              </div>

              <div className="p-6 rounded-card bg-white border border-encre/10 shadow-xs space-y-4">
                <h2 className="font-display font-bold text-sm text-nuit flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-seve" />
                  <span>Produits les plus performants</span>
                </h2>
                <HorizontalBarList
                  items={(analytics.topProducts || []).map((p) => ({
                    label: p.title,
                    value: p.revenueUsd,
                    subtitle: `${p.qty} unité(s) / km vendus`,
                  }))}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
