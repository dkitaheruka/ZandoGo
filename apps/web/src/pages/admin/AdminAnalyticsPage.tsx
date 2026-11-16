import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  DollarSign,
  Percent,
  Store,
  AlertTriangle,
  Zap,
  Globe,
  CreditCard,
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import {
  TrendAreaChart,
  RevenueBarChart,
  DonutBreakdownChart,
  HorizontalBarList,
} from '../../components/AnalyticsCharts';
import { api } from '../../lib/api';
import { useStore } from '../../lib/store-context';
import type { AdminAnalyticsPayload } from '../../lib/types';

export function AdminAnalyticsPage() {
  const { exchangeRate } = useStore();
  const [analytics, setAnalytics] = useState<AdminAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<AdminAnalyticsPayload>('/analytics/admin')
      .then(({ data }) => setAnalytics(data))
      .catch(() => setError('Impossible de charger les analyses globales de la plateforme.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4" />
              <span>Supervision Analytique & Flux Financiers</span>
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Analyses & Diagrammes Super Admin (RDC & Environs)
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Volume GMV, frais de transaction configurables ({analytics?.kpis.paymentTransactionFeePercent ?? 3.5}%), répartition par opérateur Mobile Money / Carte et performance par boutique.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/pricing"
              className="px-4 py-2 rounded-card bg-white/10 hover:bg-white/15 text-brume text-xs font-display font-semibold border border-white/15 transition"
            >
              Modifier taux ({analytics?.kpis.paymentTransactionFeePercent ?? 3.5}%)
            </Link>
            <Link
              to="/admin/stores"
              className="px-4 py-2 rounded-card bg-safran hover:bg-safran/90 text-nuit text-xs font-display font-bold transition"
            >
              Gérer retraits boutiques
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax">{error}</div>
        )}

        {loading || !analytics ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((k) => (
              <div key={k} className="h-28 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-card bg-nuit/70 border border-white/10">
                <div className="flex items-center justify-between text-xs text-brume/65">
                  <span>Volume Brut (GMV)</span>
                  <DollarSign className="w-4 h-4 text-safran" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-white tabular-nums">
                  ${analytics.kpis.grossVolumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] font-mono text-brume/50">
                  ≈ {Math.round(analytics.kpis.grossVolumeUsd * exchangeRate).toLocaleString('fr-FR')} CDF ·{' '}
                  {analytics.kpis.totalOrders} commandes
                </span>
              </div>

              <div className="p-5 rounded-card bg-nuit/70 border border-white/10">
                <div className="flex items-center justify-between text-xs text-brume/65">
                  <span>Commissions & Frais ({analytics.kpis.paymentTransactionFeePercent}%)</span>
                  <Percent className="w-4 h-4 text-seve" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-seve tabular-nums">
                  ${analytics.kpis.platformCommissionEarnedUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[11px] font-mono text-safran">
                  + ${analytics.kpis.totalTransactionFeesUsd.toFixed(2)} frais transaction ({analytics.kpis.paymentTransactionFeePercent}%)
                </span>
              </div>

              <div className="p-5 rounded-card bg-nuit/70 border border-white/10">
                <div className="flex items-center justify-between text-xs text-brume/65">
                  <span>Boutiques Actives</span>
                  <Store className="w-4 h-4 text-safran" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-white tabular-nums">
                  {analytics.kpis.activeStores} / {analytics.kpis.totalStores}
                </p>
                <span className="text-[11px] text-brume/60 flex items-center gap-1 mt-1">
                  <Zap className={`w-3 h-3 ${analytics.kpis.allowImmediateVendorWithdrawal ? 'text-seve' : 'text-safran'}`} />
                  {analytics.kpis.allowImmediateVendorWithdrawal
                    ? 'Retrait immédiat global ACTIF'
                    : 'Règle 48h depuis paiement'}
                </span>
              </div>

              <div className="p-5 rounded-card bg-nuit/70 border border-white/10">
                <div className="flex items-center justify-between text-xs text-brume/65">
                  <span>Litiges Séquestre Ouverts</span>
                  <AlertTriangle className="w-4 h-4 text-wax" />
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold text-wax tabular-nums">
                  {analytics.kpis.openDisputes}
                </p>
                <Link to="/admin/disputes" className="text-[11px] text-safran hover:underline block mt-1">
                  Arbitrer les dossiers &rarr;
                </Link>
              </div>
            </div>

            {/* Row 1: Platform Weekly Volume Curve & Top Stores Bars */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-card bg-nuit/70 border border-white/10 space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm text-white">
                    Volume des transactions hebdomadaires (USD)
                  </h2>
                  <p className="text-xs text-brume/60">Évolution sur 7 jours de l’activité globale</p>
                </div>
                <TrendAreaChart data={analytics.revenueSeries} dark />
              </div>

              <div className="p-6 rounded-card bg-nuit/70 border border-white/10 space-y-3">
                <div>
                  <h2 className="font-display font-bold text-sm text-white">
                    Performance par boutique (USD)
                  </h2>
                  <p className="text-xs text-brume/60">Classement des boutiques par volume généré</p>
                </div>
                <RevenueBarChart data={analytics.storeRevenueSeries} dark />
              </div>
            </div>

            {/* Row 2: Payment Operators Donut + Regional Breakdown Bars */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="p-6 rounded-card bg-nuit/70 border border-white/10 space-y-4">
                <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-safran" />
                  <span>Répartition par Opérateur Mobile Money & Carte</span>
                </h2>
                <DonutBreakdownChart
                  dark
                  centerLabel="Opérations"
                  items={(analytics.paymentMethods || []).map((pm) => ({
                    label: pm.label,
                    value: pm.count,
                    color: pm.color,
                    sublabel: `$${pm.volumeUsd.toFixed(2)} traités`,
                  }))}
                />
              </div>

              <div className="p-6 rounded-card bg-nuit/70 border border-white/10 space-y-4">
                <h2 className="font-display font-bold text-sm text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-seve" />
                  <span>Volume géographique RDC & Environs</span>
                </h2>
                <HorizontalBarList
                  dark
                  items={(analytics.regionalBreakdown || []).map((r) => ({
                    label: r.label,
                    value: r.value,
                  }))}
                  valueFormatter={(v) => `${v} unité(s)`}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
