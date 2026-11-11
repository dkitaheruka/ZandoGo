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
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <p className="text-xs uppercase font-semibold tracking-wider text-seve">Entreprises & Prestataires</p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Gestion des Boutiques & Commerces
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Modération, vérification des types d'activités (Retail, Digital, Télécoms, Fret) et fixation des commissions.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-400 tabular-nums">
            {stores.length} entreprise{stores.length > 1 ? 's' : ''} référencée{stores.length > 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-wax/10 border border-wax/30 text-xs text-wax" role="alert">
            {error} <button onClick={load} className="underline font-semibold ml-2">Réessayer</button>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-seve/10 border border-seve/30 text-xs text-seve font-medium">
            {success}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-24 rounded-2xl bg-slate-950 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {stores.map((store) => (
              <div
                key={store.id}
                className="p-6 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="font-semibold text-base text-white">{store.storeName}</h2>
                      <span className="text-[11px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {store.storeType || 'COMMERCE'}
                      </span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold ${
                          store.status === 'ACTIVE'
                            ? 'bg-seve/10 text-seve'
                            : 'bg-wax/10 text-wax'
                        }`}
                      >
                        {store.status}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-slate-400 max-w-xl">
                      {store.description || 'Aucune description renseignée.'}
                    </p>

                    <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-400 tabular-nums">
                      <span>Slug : <strong className="text-slate-300">/{store.slug}</strong></span>
                      <span>·</span>
                      <span>Solde : <strong className="text-slate-200">{(store.balanceUsd || 0).toLocaleString('fr-FR')} $</strong></span>
                      <span>·</span>
                      <span>Commandes : <strong className="text-slate-200">{store.totalOrders || 0}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {store.status !== 'ACTIVE' ? (
                      <button
                        disabled={busyId === store.id}
                        onClick={() => review(store.id, 'ACTIVE')}
                        className="px-4 py-2 rounded-xl bg-seve hover:bg-seve/90 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Activer la boutique
                      </button>
                    ) : (
                      <button
                        disabled={busyId === store.id}
                        onClick={() => review(store.id, 'SUSPENDED')}
                        className="px-4 py-2 rounded-xl border border-wax/40 text-wax hover:bg-wax/10 text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <label htmlFor={`rate-${store.id}`} className="text-slate-400">
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
                      className="w-24 rounded-lg bg-slate-900 border border-slate-700 px-3 py-1 font-mono text-white text-xs outline-none focus:border-seve"
                    />
                  </div>

                  <span className="text-[11px] text-slate-400 font-mono">
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
