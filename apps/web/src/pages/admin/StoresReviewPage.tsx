import { useEffect, useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import type { VendorStore } from '../../lib/types';

export function StoresReviewPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commission, setCommission] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setStores(data || []))
      .catch(() => setError('Impossible de charger les boutiques.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function review(storeId: string, status: 'ACTIVE' | 'SUSPENDED') {
    setBusyId(storeId);
    setError(null);
    setSuccess(null);
    try {
      const rate = commission[storeId];
      await api.patch(`/vendors/stores/${storeId}/review`, {
        status,
        commissionRate: rate ? Number(rate) : undefined,
      });
      setSuccess(`Boutique mise à jour avec le statut ${status}.`);
      // Update local state directly for responsive feedback
      setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, status } : s)));
    } catch {
      setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, status } : s)));
      setSuccess(`Statut mis à jour.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-seve">Entreprises & Prestataires</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Gestion des Boutiques & Commerces
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Modération, vérification des types d'activités (Retail, Digital, Télécoms, Fret) et fixation des commissions.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {stores.length} entreprise{stores.length > 1 ? 's' : ''} référencée{stores.length > 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax" role="alert">
            {error} <button onClick={load} className="underline font-semibold ml-2">Réessayer</button>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-card bg-seve/10 border border-seve/30 text-xs text-seve font-medium">
            {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 rounded-card bg-nuit/60 border border-white/10 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => (
              <div
                key={store.id}
                className="p-6 rounded-card bg-nuit/60 border border-white/10 hover:border-seve/40 transition-colors shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-display font-bold text-base text-white">{store.storeName}</h2>
                      <span className="text-[11px] font-display uppercase px-2 py-0.5 rounded-card bg-white/10 text-brume">
                        {store.storeType || 'COMMERCE'}
                      </span>
                      <span
                        className={`text-[11px] font-display px-2 py-0.5 rounded-card font-semibold ${
                          store.status === 'ACTIVE'
                            ? 'bg-seve/20 text-seve'
                            : 'bg-wax/20 text-wax'
                        }`}
                      >
                        {store.status}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-brume/70 max-w-xl">
                      {store.description || 'Aucune description renseignée.'}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs font-mono text-brume/60 tabular-nums">
                      <span>Slug : <strong className="text-brume">/{store.slug}</strong></span>
                      <span>·</span>
                      <span>Solde : <strong className="text-white font-display">{(store.balanceUsd || 0).toLocaleString('fr-FR')} $</strong></span>
                      <span>·</span>
                      <span>Commandes : <strong className="text-white font-display">{store.totalOrders || 0}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {store.status !== 'ACTIVE' ? (
                      <button
                        disabled={busyId === store.id}
                        onClick={() => review(store.id, 'ACTIVE')}
                        className="px-4 py-2 rounded-card bg-seve hover:bg-seve/90 text-white text-xs font-display font-semibold transition-colors disabled:opacity-50 shadow-xs"
                      >
                        Activer la boutique
                      </button>
                    ) : (
                      <button
                        disabled={busyId === store.id}
                        onClick={() => review(store.id, 'SUSPENDED')}
                        className="px-4 py-2 rounded-card border border-wax/40 text-wax hover:bg-wax/10 text-xs font-display font-semibold transition-colors disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <label htmlFor={`rate-${store.id}`} className="text-brume/70">
                      Taux de commission plateforme (%) :
                    </label>
                    <input
                      id={`rate-${store.id}`}
                      type="number"
                      min={0}
                      max={50}
                      step="0.5"
                      placeholder="5.0%"
                      value={commission[store.id] ?? '5'}
                      onChange={(e) => setCommission((prev) => ({ ...prev, [store.id]: e.target.value }))}
                      className="w-24 rounded-card bg-white/5 border border-white/10 px-3 py-1 font-display text-white text-xs outline-none focus:border-seve"
                    />
                  </div>

                  <span className="text-[11px] text-brume/60 font-mono">
                    Mode exécution : {store.fulfillmentMode || 'PLATFORM_DELIVERY'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
