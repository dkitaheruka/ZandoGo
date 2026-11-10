import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import type { VendorStore } from '../../lib/types';

const STORE_STATUS = {
  PENDING: ['En cours de validation', 'bg-safran/25 text-nuit'],
  ACTIVE: ['Active', 'bg-seve/15 text-seve'],
  SUSPENDED: ['Suspendue', 'bg-wax/15 text-wax'],
} as const;

export function VendorDashboardPage() {
  const [stores, setStores] = useState<VendorStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.get<VendorStore[]>('/vendors/stores/mine')
      .then(({ data }) => setStores(data))
      .catch(() => setError('Impossible de charger vos boutiques.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-seve">Espace vendeur</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Mes boutiques</h1>
          <p className="mt-2 text-encre/60">Gérez votre catalogue et l’activité de vos boutiques.</p>
        </div>
        <Link to="/vendor/new" className="rounded-full bg-nuit px-6 py-3 font-medium text-brume hover:bg-nuit/90">Ouvrir une boutique</Link>
      </div>
      {error && <div className="mt-8 rounded-lg bg-wax/10 p-4 text-sm text-wax" role="alert">{error} <button onClick={load} className="ml-2 underline">Réessayer</button></div>}
      {loading ? (
        <p className="py-16 text-encre/60" role="status">Chargement…</p>
      ) : stores.length ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {stores.map((store) => (
            <article key={store.id} className="rounded-card border border-encre/10 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-semibold">{store.storeName}</h2>
                  <p className="mt-1 text-sm text-encre/50">/{store.slug}</p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STORE_STATUS[store.status][1]}`}>
                  {STORE_STATUS[store.status][0]}
                </span>
              </div>
              {store.description && <p className="mt-4 text-sm leading-relaxed text-encre/70">{store.description}</p>}
              <div className="mt-6 border-t border-encre/10 pt-4">
                {store.status === 'ACTIVE' ? (
                  <Link to={`/vendor/${store.id}/products`} className="font-medium text-seve hover:underline">Gérer les produits →</Link>
                ) : (
                  <p className="text-sm text-encre/60">Les produits seront disponibles après validation de la boutique.</p>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-card border border-dashed border-encre/20 py-16 text-center">
          <h2 className="font-display text-xl font-medium">Aucune boutique pour le moment</h2>
          <p className="mt-2 text-sm text-encre/60">Créez une boutique pour commencer à vendre.</p>
          <Link to="/vendor/new" className="mt-5 inline-block text-seve hover:underline">Créer ma boutique</Link>
        </div>
      )}
    </section>
  );
}
