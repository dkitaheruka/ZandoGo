import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { api } from '../lib/api';
import type { Product } from '../lib/types';

export function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.get<Product[]>('/products', { params: query ? { search: query } : {} })
      .then(({ data }) => {
        if (active) setProducts(data);
      })
      .catch(() => {
        if (active) setError('Impossible de charger les produits. Vérifiez votre connexion puis réessayez.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [query, retryKey]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(search.trim());
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-seve">La sélection locale</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">Tous les produits</h1>
        </div>
        <form onSubmit={submit} className="flex w-full max-w-md gap-2">
          <label className="sr-only" htmlFor="product-search">Rechercher un produit</label>
          <input id="product-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Que recherchez-vous ?" className="min-w-0 flex-1 rounded-full border border-encre/20 bg-white px-5 py-3" />
          <button type="submit" className="rounded-full bg-nuit px-5 py-3 font-medium text-brume">Rechercher</button>
        </form>
      </div>
      {error && (
        <div className="mt-8 rounded-lg border border-wax/30 bg-wax/10 p-4 text-sm text-wax" role="alert">
          {error} <button className="ml-2 underline" onClick={() => setRetryKey((value) => value + 1)}>Réessayer</button>
        </div>
      )}
      {loading ? (
        <p className="py-16 text-center text-encre/60" role="status">Chargement des produits…</p>
      ) : products.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        !error && (
          <div className="py-20 text-center">
            <p className="font-display text-2xl font-medium">Aucun produit trouvé</p>
            <p className="mt-2 text-encre/60">Essayez une autre recherche ou revenez plus tard.</p>
            <Link to="/" className="mt-5 inline-block text-seve hover:underline">Retour à l’accueil</Link>
          </div>
        )
      )}
    </section>
  );
}
