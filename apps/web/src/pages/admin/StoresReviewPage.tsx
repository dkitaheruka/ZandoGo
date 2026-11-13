import { useEffect, useState } from 'react';
import { Lock, Unlock, BadgeCheck, Megaphone } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { api } from '../../lib/api';
import type { VendorStore } from '../../lib/types';

export function StoresReviewPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commission, setCommission] = useState<Record<string, string>>({});
  const [blockReason, setBlockReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => {
        const list = data || [];
        setStores(list);
        const initialComm: Record<string, string> = {};
        list.forEach((s) => {
          initialComm[s.id] = String(s.commissionRate ?? 5);
        });
        setCommission(initialComm);
      })
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
        commissionRate: rate !== undefined ? Number(rate) : undefined,
      });
      setSuccess(`Boutique mise à jour avec le statut ${status} (commission ${rate || 5}%).`);
      setStores((prev) =>
        prev.map((s) =>
          s.id === storeId
            ? { ...s, status, commissionRate: rate !== undefined ? Number(rate) : s.commissionRate }
            : s,
        ),
      );
    } catch {
      setError('Impossible de mettre à jour la boutique.');
    } finally {
      setBusyId(null);
    }
  }

  async function togglePayoutBlock(store: VendorStore) {
    const nextBlocked = !store.payoutBlocked;
    setBusyId(store.id);
    setError(null);
    setSuccess(null);
    try {
      const reason =
        blockReason[store.id]?.trim() ||
        'Retraits bloqués par l’administration suite à un litige client pertinent en cours d’examen.';
      const { data } = await api.patch<VendorStore>(`/vendors/stores/${store.id}/payout-block`, {
        blocked: nextBlocked,
        reason: nextBlocked ? reason : undefined,
      });
      setStores((prev) => prev.map((s) => (s.id === store.id ? { ...s, ...data } : s)));
      setSuccess(
        nextBlocked
          ? `Les retraits Mobile Money de « ${store.storeName} » sont désormais bloqués.`
          : `Les retraits de « ${store.storeName} » ont été rétablis.`,
      );
    } catch {
      setError('Erreur lors de la mise à jour du blocage des retraits.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="text-xs uppercase font-display font-semibold tracking-wider text-safran">
              Entreprises & Prestataires
            </p>
            <h1 className="mt-1 font-display text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Gestion des Boutiques, Commissions & Retraits
            </h1>
            <p className="mt-1 text-xs text-brume/70">
              Modération des boutiques achetées, ajustement de la commission par vendeur et blocage immédiat des retraits en cas de litige.
            </p>
          </div>
          <span className="font-display text-xs text-brume/60 tabular-nums">
            {stores.length} entreprise{stores.length > 1 ? 's' : ''} référencée{stores.length > 1 ? 's' : ''}
          </span>
        </div>

        {error && (
          <div className="p-4 rounded-card bg-wax/10 border border-wax/30 text-xs text-wax" role="alert">
            {error}{' '}
            <button onClick={load} className="underline font-semibold ml-2">
              Réessayer
            </button>
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
                className={`p-6 rounded-card bg-nuit/60 border transition-colors shadow-xs ${
                  store.payoutBlocked ? 'border-wax/50' : 'border-white/10 hover:border-safran/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-bold text-base text-white">{store.storeName}</h2>
                      <span className="text-[11px] font-display uppercase px-2 py-0.5 rounded-card bg-white/10 text-brume">
                        {store.storeType || 'COMMERCE'}
                      </span>
                      <span
                        className={`text-[11px] font-display px-2 py-0.5 rounded-card font-semibold ${
                          store.status === 'ACTIVE' ? 'bg-seve/20 text-seve' : 'bg-wax/20 text-wax'
                        }`}
                      >
                        {store.status}
                      </span>
                      {store.isCertified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-card bg-seve/20 text-seve">
                          <BadgeCheck className="w-3 h-3" />
                          <span>Certifié</span>
                        </span>
                      )}
                      {store.hasMonthlyAd && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-card bg-safran/20 text-safran">
                          <Megaphone className="w-3 h-3" />
                          <span>Pub Mensuelle</span>
                        </span>
                      )}
                      {store.payoutBlocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-display font-bold px-2 py-0.5 rounded-card bg-wax text-white">
                          <Lock className="w-3 h-3" />
                          <span>Retraits bloqués</span>
                        </span>
                      )}
                    </div>

                    <p className="mt-1.5 text-xs text-brume/70 max-w-xl">
                      {store.description || 'Aucune description renseignée.'}
                    </p>

                    {store.payoutBlocked && store.payoutBlockReason && (
                      <p className="mt-2 text-xs text-wax bg-wax/10 border border-wax/30 rounded-card px-3 py-1.5">
                        Motif du gel : {store.payoutBlockReason}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-mono text-brume/60 tabular-nums">
                      <span>
                        Slug : <strong className="text-brume">/{store.slug}</strong>
                      </span>
                      <span>·</span>
                      <span>
                        Solde :{' '}
                        <strong className="text-white font-display">
                          {(store.balanceUsd || 0).toLocaleString('fr-FR')} $
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Commandes : <strong className="text-white font-display">{store.totalOrders || 0}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyId === store.id}
                      onClick={() => togglePayoutBlock(store)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-card text-xs font-display font-semibold transition-colors disabled:opacity-50 ${
                        store.payoutBlocked
                          ? 'bg-safran/20 text-safran border border-safran/40 hover:bg-safran/30'
                          : 'bg-wax/15 text-wax border border-wax/40 hover:bg-wax/25'
                      }`}
                    >
                      {store.payoutBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{store.payoutBlocked ? 'Débloquer retraits' : 'Bloquer retraits'}</span>
                    </button>

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
                        className="px-4 py-2 rounded-card border border-white/20 text-brume/80 hover:bg-white/5 text-xs font-display font-semibold transition-colors disabled:opacity-50"
                      >
                        Suspendre
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor={`rate-${store.id}`} className="text-brume/70">
                      Commission plateforme (%) :
                    </label>
                    <input
                      id={`rate-${store.id}`}
                      type="number"
                      min={0}
                      max={50}
                      step="0.5"
                      value={commission[store.id] ?? String(store.commissionRate ?? 5)}
                      onChange={(e) => setCommission((prev) => ({ ...prev, [store.id]: e.target.value }))}
                      className="w-20 rounded-card bg-white/5 border border-white/10 px-3 py-1 font-display text-white text-xs outline-none focus:border-safran"
                    />
                    <button
                      type="button"
                      disabled={busyId === store.id}
                      onClick={() => review(store.id, store.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE')}
                      className="px-3 py-1 rounded-card bg-safran/20 text-safran hover:bg-safran/30 font-display font-semibold transition"
                    >
                      Appliquer
                    </button>
                  </div>

                  {!store.payoutBlocked && (
                    <input
                      type="text"
                      placeholder="Motif éventuel de blocage des retraits…"
                      value={blockReason[store.id] ?? ''}
                      onChange={(e) => setBlockReason((prev) => ({ ...prev, [store.id]: e.target.value }))}
                      className="flex-1 min-w-[200px] max-w-xs rounded-card bg-white/5 border border-white/10 px-3 py-1 text-xs text-brume outline-none focus:border-wax"
                    />
                  )}

                  <span className="text-[11px] text-brume/60 font-mono">
                    Mode : {store.fulfillmentMode || 'PLATFORM_DELIVERY'}
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
