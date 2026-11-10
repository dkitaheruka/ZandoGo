import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { Product, VendorStore } from '../../lib/types';

export function StoreProductsPage() {
  const { storeId = '' } = useParams();
  const [store, setStore] = useState<VendorStore | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<VendorStore>(`/vendors/stores/${storeId}`),
      api.get<Product[]>(`/vendors/stores/${storeId}/products`),
    ])
      .then(([storeResponse, productsResponse]) => {
        setStore(storeResponse.data);
        setProducts(productsResponse.data);
      })
      .catch(() => setError('Impossible de charger le catalogue de cette boutique.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [storeId]);

  async function toggleStatus(product: Product) {
    const nextStatus = product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    setBusyId(product.id);
    setError(null);
    try {
      await api.patch(`/vendors/stores/${storeId}/products/${product.id}`, { status: nextStatus });
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, status: nextStatus } : item));
    } catch (reason) {
      const message = (reason as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : (message ?? 'Impossible de modifier le statut du produit.'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <Link to="/vendor" className="text-sm text-seve hover:underline">← Mes boutiques</Link>
          <h1 className="mt-3 font-display text-4xl font-semibold">{store?.storeName ?? 'Catalogue'}</h1>
          <p className="mt-2 text-encre/60">Gérez les produits de votre boutique.</p>
        </div>
        <Link to={`/vendor/${storeId}/products/new`} className="rounded-full bg-nuit px-6 py-3 font-medium text-brume hover:bg-nuit/90">Ajouter un produit</Link>
      </div>
      {error && <div className="mt-6 rounded-lg bg-wax/10 p-4 text-sm text-wax" role="alert">{error} <button onClick={load} className="ml-2 underline">Réessayer</button></div>}
      {loading ? (
        <p className="py-16 text-encre/60" role="status">Chargement des produits…</p>
      ) : products.length ? (
        <div className="mt-8 overflow-x-auto rounded-card border border-encre/10 bg-white">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-brume text-encre/60">
              <tr><th className="px-5 py-3 font-medium">Produit</th><th className="px-5 py-3 font-medium">Prix de base</th><th className="px-5 py-3 font-medium">Statut</th><th className="px-5 py-3 text-right font-medium">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-encre/10">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-5 py-4 font-medium">{product.title}</td>
                  <td className="px-5 py-4">{Number(product.basePriceUsd).toLocaleString('fr-FR')} USD</td>
                  <td className="px-5 py-4">{product.status === 'ACTIVE' ? 'En vente' : product.status}</td>
                  <td className="px-5 py-4 text-right">
                    <button disabled={busyId === product.id} onClick={() => toggleStatus(product)} className="font-medium text-seve hover:underline disabled:opacity-50">
                      {busyId === product.id ? 'Mise à jour…' : product.status === 'ACTIVE' ? 'Désactiver' : 'Publier'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-10 rounded-card border border-dashed border-encre/20 py-16 text-center">
          <h2 className="font-display text-xl font-medium">Aucun produit</h2>
          <p className="mt-2 text-sm text-encre/60">Ajoutez votre premier produit au catalogue.</p>
          <Link to={`/vendor/${storeId}/products/new`} className="mt-5 inline-block text-seve hover:underline">Ajouter un produit</Link>
        </div>
      )}
    </section>
  );
}
