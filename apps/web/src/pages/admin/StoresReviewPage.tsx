import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { VendorStore } from '../../lib/types';

interface PendingStore extends VendorStore {
  owner: { id: string; fullName: string; email?: string; phone?: string };
}

export function StoresReviewPage() {
  const [stores, setStores] = useState<PendingStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [commission, setCommission] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .get<PendingStore[]>('/vendors/stores/pending')
      .then(({ data }) => setStores(data))
      .catch(() => setError('Impossible de charger les boutiques en attente.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function review(storeId: string, status: 'ACTIVE' | 'SUSPENDED') {
    setBusyId(storeId);
    setError(null);
    try {
      const rate = commission[storeId];
      await api.patch(`/vendors/stores/${storeId}/review`, {
        status,
        commissionRate: rate ? Number(rate) : undefined,
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Action impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">Boutiques à valider</h1>
      <p className="mt-2 text-encre/60">
        L'activation exige un document vendeur déjà approuvé (page « Documents »).
      </p>

      {error && (
        <div className="mt-6 text-sm text-wax" role="alert">
          {error}
          <button onClick={load} className="ml-2 underline">Réessayer</button>
        </div>
      )}

      {loading ? (
        <p className="mt-10 text-encre/50">Chargement…</p>
      ) : stores.length === 0 ? (
        <p className="mt-10 text-encre/50">Aucune boutique en attente.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {stores.map((store) => (
            <div key={store.id} className="border border-encre/10 p-5">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="font-medium">{store.storeName}</p>
                  <p className="text-sm text-encre/50">
                    {store.owner.fullName} · {store.owner.email ?? store.owner.phone}
                  </p>
                  {store.description && <p className="mt-2 text-sm text-encre/70">{store.description}</p>}
                </div>
                <div className="flex gap-3 flex-shrink-0">
                  <button
                    disabled={busyId === store.id}
                    onClick={() => review(store.id, 'ACTIVE')}
                    className="bg-seve text-white text-sm font-medium px-4 py-2 hover:bg-seve/90 transition-colors disabled:opacity-60"
                  >
                    Activer
                  </button>
                  <button
                    disabled={busyId === store.id}
                    onClick={() => review(store.id, 'SUSPENDED')}
                    className="border border-wax text-wax text-sm font-medium px-4 py-2 hover:bg-wax/10 transition-colors disabled:opacity-60"
                  >
                    Refuser
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 text-sm">
                <label htmlFor={`rate-${store.id}`} className="text-encre/60">
                  Commission négociée (%)
                </label>
                <input
                  id={`rate-${store.id}`}
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  placeholder="taux de la catégorie"
                  value={commission[store.id] ?? ''}
                  onChange={(e) => setCommission((prev) => ({ ...prev, [store.id]: e.target.value }))}
                  className="w-40 border border-encre/20 px-3 py-1.5"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
